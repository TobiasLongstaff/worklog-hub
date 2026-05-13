import { existsSync, readdirSync, readFileSync, statSync } from "fs";
import { join } from "path";
import type { WorklogConfig } from "../config/load-config.ts";
import { logger } from "../utils/logger.ts";

export interface AgentMessage {
  role: "user" | "assistant";
  content: string;
}

export interface AgentSession {
  sessionId: string;
  projectDir: string;
  date: string;
  messages: AgentMessage[];
}

function truncate(s: string, maxLen: number): string {
  if (s.length <= maxLen) return s;
  return s.slice(0, maxLen) + "…";
}

function extractContent(content: unknown): string {
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

function parseJSONL(raw: string): Array<Record<string, unknown>> {
  const results: Array<Record<string, unknown>> = [];
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        results.push(parsed as Record<string, unknown>);
      }
    } catch {
      // skip malformed lines
    }
  }
  return results;
}

function extractMessages(entries: Array<Record<string, unknown>>, maxMessages: number): AgentMessage[] {
  const messages: AgentMessage[] = [];

  for (const entry of entries) {
    if (messages.length >= maxMessages) break;

    // Claude Code JSONL: { type: "user"|"assistant", message: { role, content } }
    // or direct: { role: "user"|"assistant", content: ... }
    const msg = (entry["message"] ?? entry) as Record<string, unknown>;
    const role = String(msg["role"] ?? entry["role"] ?? "");

    if (role === "user" || role === "human") {
      const content = extractContent(msg["content"] ?? entry["content"]);
      if (content.trim()) {
        messages.push({ role: "user", content: truncate(content, 600) });
      }
    } else if (role === "assistant") {
      const content = extractContent(msg["content"] ?? entry["content"]);
      if (content.trim()) {
        messages.push({ role: "assistant", content: truncate(content, 600) });
      }
    }
  }
  return messages;
}

function isRelatedToProjects(dirName: string, projectPaths: string[]): boolean {
  const lower = dirName.toLowerCase();
  for (const p of projectPaths) {
    const parts = p.replace(/\\/g, "/").split("/").filter((x) => x.length > 3);
    for (const part of parts.slice(-2)) {
      if (lower.includes(part.toLowerCase())) return true;
    }
  }
  return false;
}

interface SessionFile {
  path: string;
  sessionId: string;
  projectDir: string;
  mtime: number;
  related: boolean;
}

export async function collectClaudeCodeSessions(config: WorklogConfig): Promise<AgentSession[]> {
  const { agentLogs, projects, maxAgentSessions, maxAgentMessagesPerSession } = config;
  const ccConfig = agentLogs.claudeCode;

  if (!ccConfig.enabled) return [];

  const basePath = ccConfig.resolvedBasePath;
  if (!basePath || !existsSync(basePath)) {
    if (ccConfig.enabled) logger.warn(`Claude Code: path no encontrado: ${basePath}`);
    return [];
  }

  const projectPaths = projects.map((p) => p.resolvedPath);

  let projectDirs: string[] = [];
  try {
    projectDirs = readdirSync(basePath, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name);
  } catch (err) {
    logger.warn(`Claude Code: error leyendo ${basePath}: ${err}`);
    return [];
  }

  const sessionFiles: SessionFile[] = [];

  for (const dirName of projectDirs) {
    const dirPath = join(basePath, dirName);
    const related = isRelatedToProjects(dirName, projectPaths);

    try {
      const files = readdirSync(dirPath).filter((f) => f.endsWith(".jsonl"));
      for (const file of files) {
        const filePath = join(dirPath, file);
        try {
          const stat = statSync(filePath);
          sessionFiles.push({
            path: filePath,
            sessionId: file.replace(".jsonl", ""),
            projectDir: dirName,
            mtime: stat.mtimeMs,
            related,
          });
        } catch {
          // skip unreadable file
        }
      }
    } catch {
      // skip unreadable dir
    }
  }

  // Sort: related first, then by mtime descending
  sessionFiles.sort((a, b) => {
    if (a.related !== b.related) return a.related ? -1 : 1;
    return b.mtime - a.mtime;
  });

  const toProcess = sessionFiles.slice(0, maxAgentSessions);
  const sessions: AgentSession[] = [];

  for (const sf of toProcess) {
    try {
      const raw = readFileSync(sf.path, "utf-8");
      const entries = parseJSONL(raw);
      const messages = extractMessages(entries, maxAgentMessagesPerSession);
      if (messages.length === 0) continue;

      sessions.push({
        sessionId: sf.sessionId.slice(0, 8),
        projectDir: sf.projectDir,
        date: new Date(sf.mtime).toISOString().split("T")[0] ?? "",
        messages,
      });
    } catch (err) {
      logger.warn(`Claude Code: error parseando sesión ${sf.path}: ${err}`);
    }
  }

  return sessions;
}

export function countClaudeCodeSessions(config: WorklogConfig): number {
  const basePath = config.agentLogs.claudeCode.resolvedBasePath;
  if (!basePath || !existsSync(basePath)) return 0;

  const projectPaths = config.projects.map((p) => p.resolvedPath);
  let count = 0;

  try {
    const dirs = readdirSync(basePath, { withFileTypes: true }).filter((d) => d.isDirectory());
    for (const dir of dirs) {
      if (!isRelatedToProjects(dir.name, projectPaths)) continue;
      try {
        const files = readdirSync(join(basePath, dir.name)).filter((f) => f.endsWith(".jsonl"));
        count += files.length;
      } catch {
        // skip
      }
    }
  } catch {
    // skip
  }

  return count;
}
