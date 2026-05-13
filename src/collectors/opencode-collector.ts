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

// Tries to read sessions from OpenCode's storage format.
// OpenCode stores sessions and messages under storage/session/ and storage/message/.
async function readOpenCodeStorage(
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
    related: boolean;
  }

  const sessionMetas: SessionMeta[] = [];

  try {
    const entries = readdirSync(sessionDir, { withFileTypes: true });
    for (const entry of entries) {
      try {
        const filePath = join(sessionDir, entry.name);
        const stat = statSync(filePath);
        let related = false;

        // Try to read session file for project path hints
        try {
          const content = readFileSync(filePath, "utf-8");
          const parsed = JSON.parse(content) as Record<string, unknown>;
          const path = String(parsed["path"] ?? parsed["projectPath"] ?? parsed["cwd"] ?? "");
          related = isRelatedToProjects(path || entry.name, projectPaths);
        } catch {
          related = false;
        }

        sessionMetas.push({ id: entry.name.replace(/\.json$/, ""), mtime: stat.mtimeMs, related });
      } catch {
        // skip
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

    // Try reading messages from storage/message/<session-id>/
    const msgSessionDir = join(messageDir, meta.id);
    const msgSessionFile = join(messageDir, `${meta.id}.json`);

    try {
      if (existsSync(msgSessionDir)) {
        // Messages stored as individual files inside the session dir
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
            // skip
          }
        }
      } else if (existsSync(msgSessionFile)) {
        // Messages stored as a single JSON array
        const raw = readFileSync(msgSessionFile, "utf-8");
        const parsed = JSON.parse(raw) as unknown;
        const arr = Array.isArray(parsed) ? parsed : [];

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

    if (messages.length > 0) {
      sessions.push({
        sessionId: meta.id.slice(0, 8),
        projectDir: meta.id,
        date: new Date(meta.mtime).toISOString().split("T")[0] ?? "",
        messages,
      });
    }
  }

  return sessions;
}

// Fallback: read from log files
async function readOpenCodeLogs(
  basePath: string,
  maxSessions: number
): Promise<AgentSession[]> {
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
        // skip
      }
    }
  } catch {
    // skip
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

  const projectPaths = projects.map((p) => p.resolvedPath);

  let sessions = await readOpenCodeStorage(basePath, projectPaths, maxAgentSessions, maxAgentMessagesPerSession);

  // Fallback a logs si no se encontraron sesiones de storage
  if (sessions.length === 0) {
    logger.info("OpenCode: usando logs como fuente secundaria");
    sessions = await readOpenCodeLogs(basePath, maxAgentSessions);
  }

  return sessions;
}

export function countOpenCodeSessions(config: WorklogConfig): number {
  const basePath = config.agentLogs.openCode.resolvedBasePath;
  if (!basePath || !existsSync(basePath)) return 0;

  const sessionDir = join(basePath, "storage", "session");
  if (!existsSync(sessionDir)) return 0;

  try {
    return readdirSync(sessionDir).length;
  } catch {
    return 0;
  }
}
