import { Database } from "bun:sqlite";
import { existsSync, readdirSync, readFileSync, statSync } from "fs";
import { join } from "path";
import type { WorklogConfig } from "../config/load-config.ts";
import { logger } from "../utils/logger.ts";
import type { AgentMessage, AgentSession } from "./claude-code-collector.ts";

function truncate(s: string, maxLen: number): string {
  if (s.length <= maxLen) return s;
  return s.slice(0, maxLen) + "…";
}

function extractTextContent(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return (content as Array<Record<string, unknown>>)
      .filter((c) => c["type"] === "text")
      .map((c) => String(c["text"] ?? ""))
      .join("\n")
      .trim();
  }
  return "";
}

function isRelatedToProjects(text: string, projectPaths: string[]): boolean {
  const lower = text.toLowerCase();
  for (const p of projectPaths) {
    const parts = p.replace(/\\/g, "/").split("/").filter((x) => x.length > 3);
    for (const part of parts.slice(-2)) {
      if (lower.includes(part.toLowerCase())) return true;
    }
  }
  return false;
}

// Primary: read from OpenCode SQLite database (OpenCode >= v1.2)
async function readOpenCodeSqlite(
  basePath: string,
  maxSessions: number,
  maxMessages: number
): Promise<AgentSession[]> {
  const dbPath = join(basePath, "opencode.db");
  if (!existsSync(dbPath)) return [];

  let db: Database | null = null;
  try {
    db = new Database(dbPath, { readonly: true });

    const sessionRows = db
      .query<{ id: string; directory: string; title: string; time_updated: number }, [number]>(
        `SELECT id, directory, title, time_updated
         FROM session
         ORDER BY time_updated DESC
         LIMIT ?`
      )
      .all(maxSessions);

    const sessions: AgentSession[] = [];

    for (const row of sessionRows) {
      const date = new Date(row.time_updated).toISOString().split("T")[0] ?? "";

      const parts = db
        .query<{ role: string; text: string }, [string, number]>(
          `SELECT json_extract(m.data, '$.role') AS role,
                  json_extract(p.data, '$.text') AS text
           FROM message m
           JOIN part p ON p.message_id = m.id AND p.session_id = m.session_id
           WHERE m.session_id = ?
             AND json_extract(p.data, '$.type') = 'text'
             AND json_extract(m.data, '$.role') IN ('user', 'assistant')
             AND length(coalesce(json_extract(p.data, '$.text'), '')) > 10
           ORDER BY m.time_created ASC
           LIMIT ?`
        )
        .all(row.id, maxMessages);

      const messages: AgentMessage[] = parts
        .filter((p) => p.text?.trim())
        .map((p) => ({
          role:
            p.role === "user" || p.role === "assistant"
              ? (p.role as "user" | "assistant")
              : "assistant",
          content: truncate(p.text, 600),
        }));

      // If no text parts, use session title so the date is still tracked
      if (messages.length === 0 && row.title) {
        messages.push({ role: "assistant", content: `[Sesión: ${row.title}]` });
      }

      sessions.push({
        sessionId: row.id.slice(0, 8),
        projectDir: row.directory || row.id,
        date,
        messages,
      });
    }

    return sessions;
  } catch (err) {
    logger.warn(`OpenCode: error leyendo SQLite: ${err}`);
    return [];
  } finally {
    try {
      db?.close();
    } catch {
      /* ignore */
    }
  }
}

// Fallback: read from legacy file-based storage (OpenCode < v1.2)
// Real structure: storage/session/<projectId>/ses_<id>.json
async function readOpenCodeFileStorage(
  basePath: string,
  projectPaths: string[],
  maxSessions: number,
  maxMessages: number
): Promise<AgentSession[]> {
  const sessionDir = join(basePath, "storage", "session");
  const messageDir = join(basePath, "storage", "message");

  if (!existsSync(sessionDir)) return [];

  interface SessionMeta {
    id: string;
    mtime: number;
    directory: string;
    title: string;
    related: boolean;
  }

  const sessionMetas: SessionMeta[] = [];

  try {
    const projectDirs = readdirSync(sessionDir, { withFileTypes: true }).filter((e) =>
      e.isDirectory()
    );

    for (const projectDir of projectDirs) {
      const projectPath = join(sessionDir, projectDir.name);
      try {
        const sessionFiles = readdirSync(projectPath).filter((f) => f.endsWith(".json"));
        for (const sessionFile of sessionFiles) {
          const filePath = join(projectPath, sessionFile);
          try {
            const content = readFileSync(filePath, "utf-8");
            const parsed = JSON.parse(content) as Record<string, unknown>;
            const id = String(parsed["id"] ?? sessionFile.replace(/\.json$/, ""));
            const directory = String(parsed["directory"] ?? "");
            const title = String(parsed["title"] ?? "");
            const timeObj = parsed["time"] as Record<string, unknown> | undefined;
            const mtime = Number(
              timeObj?.["updated"] ?? timeObj?.["created"] ?? statSync(filePath).mtimeMs
            );
            const related = isRelatedToProjects(directory || id, projectPaths);
            sessionMetas.push({ id, mtime, directory, title, related });
          } catch {
            /* skip */
          }
        }
      } catch {
        /* skip */
      }
    }
  } catch (err) {
    logger.warn(`OpenCode: error leyendo ${sessionDir}: ${err}`);
    return [];
  }

  sessionMetas.sort((a, b) => {
    if (a.related !== b.related) return a.related ? -1 : 1;
    return b.mtime - a.mtime;
  });

  const sessions: AgentSession[] = [];

  for (const meta of sessionMetas.slice(0, maxSessions)) {
    const messages: AgentMessage[] = [];
    const msgSessionDir = join(messageDir, meta.id);
    const msgSessionFile = join(messageDir, `${meta.id}.json`);

    try {
      if (existsSync(msgSessionDir)) {
        const msgFiles = readdirSync(msgSessionDir)
          .filter((f) => f.endsWith(".json"))
          .sort();
        for (const msgFile of msgFiles.slice(0, maxMessages)) {
          try {
            const raw = readFileSync(join(msgSessionDir, msgFile), "utf-8");
            const parsed = JSON.parse(raw) as Record<string, unknown>;
            const role = String(parsed["role"] ?? "");
            const content = extractTextContent(parsed["content"] ?? "");
            if ((role === "user" || role === "assistant") && content.trim()) {
              messages.push({ role: role as "user" | "assistant", content: truncate(content, 600) });
            }
          } catch {
            /* skip */
          }
        }
      } else if (existsSync(msgSessionFile)) {
        const raw = readFileSync(msgSessionFile, "utf-8");
        const arr = Array.isArray(JSON.parse(raw)) ? (JSON.parse(raw) as unknown[]) : [];
        for (const item of (arr as Array<Record<string, unknown>>).slice(0, maxMessages)) {
          const role = String(item["role"] ?? "");
          const content = extractTextContent(item["content"] ?? "");
          if ((role === "user" || role === "assistant") && content.trim()) {
            messages.push({ role: role as "user" | "assistant", content: truncate(content, 600) });
          }
        }
      }
    } catch (err) {
      logger.warn(`OpenCode: error leyendo mensajes de sesión ${meta.id}: ${err}`);
    }

    if (messages.length === 0 && meta.title) {
      messages.push({ role: "assistant", content: `[Sesión: ${meta.title}]` });
    }

    if (messages.length > 0) {
      sessions.push({
        sessionId: meta.id.slice(0, 8),
        projectDir: meta.directory || meta.id,
        date: new Date(meta.mtime).toISOString().split("T")[0] ?? "",
        messages,
      });
    }
  }

  return sessions;
}

// Last resort: raw process log files
async function readOpenCodeLogs(basePath: string, maxSessions: number): Promise<AgentSession[]> {
  const logDir = join(basePath, "log");
  if (!existsSync(logDir)) return [];

  const sessions: AgentSession[] = [];

  try {
    const files = readdirSync(logDir)
      .filter((f) => f.endsWith(".log") || f.endsWith(".txt") || f.endsWith(".json"))
      .slice(0, maxSessions);

    for (const file of files) {
      const filePath = join(logDir, file);
      try {
        const stat = statSync(filePath);
        const content = truncate(readFileSync(filePath, "utf-8"), 1000);
        sessions.push({
          sessionId: file.slice(0, 8),
          projectDir: "(log)",
          date: new Date(stat.mtimeMs).toISOString().split("T")[0] ?? "",
          messages: [{ role: "assistant", content: `[Log: ${file}]\n${content}` }],
        });
      } catch {
        /* skip */
      }
    }
  } catch {
    /* skip */
  }

  return sessions;
}

export async function collectOpenCodeSessions(config: WorklogConfig): Promise<AgentSession[]> {
  const { agentLogs, projects, maxAgentSessions, maxAgentMessagesPerSession } = config;
  const ocConfig = agentLogs.openCode;

  if (!ocConfig.enabled) return [];

  const basePath = ocConfig.resolvedBasePath;
  if (!basePath || !existsSync(basePath)) {
    if (ocConfig.enabled) logger.warn(`OpenCode: path no encontrado: ${basePath}`);
    return [];
  }

  // SQLite first (OpenCode >= v1.2)
  const sqliteSessions = await readOpenCodeSqlite(basePath, maxAgentSessions, maxAgentMessagesPerSession);
  if (sqliteSessions.length > 0) return sqliteSessions;

  // Legacy file-based storage (OpenCode < v1.2)
  const projectPaths = projects.map((p) => p.resolvedPath);
  const fileSessions = await readOpenCodeFileStorage(
    basePath,
    projectPaths,
    maxAgentSessions,
    maxAgentMessagesPerSession
  );
  if (fileSessions.length > 0) return fileSessions;

  // Last resort: raw logs
  logger.info("OpenCode: usando logs como fuente secundaria");
  return readOpenCodeLogs(basePath, maxAgentSessions);
}

export function countOpenCodeSessions(config: WorklogConfig): number {
  const basePath = config.agentLogs.openCode.resolvedBasePath;
  if (!basePath || !existsSync(basePath)) return 0;

  const dbPath = join(basePath, "opencode.db");
  if (existsSync(dbPath)) {
    try {
      const db = new Database(dbPath, { readonly: true });
      const result = db.query<{ n: number }, []>("SELECT COUNT(*) as n FROM session").get();
      db.close();
      return result?.n ?? 0;
    } catch {
      /* fall through to file-based count */
    }
  }

  const sessionDir = join(basePath, "storage", "session");
  if (!existsSync(sessionDir)) return 0;

  try {
    let count = 0;
    const projectDirs = readdirSync(sessionDir, { withFileTypes: true }).filter((e) =>
      e.isDirectory()
    );
    for (const d of projectDirs) {
      try {
        count += readdirSync(join(sessionDir, d.name)).filter((f) => f.endsWith(".json")).length;
      } catch {
        /* skip */
      }
    }
    return count;
  } catch {
    return 0;
  }
}
