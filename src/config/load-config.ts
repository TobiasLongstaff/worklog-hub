import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { resolveRelativeTo, expandTilde } from "../utils/path.ts";

export interface ProjectConfig {
  name: string;
  path: string;
  resolvedPath: string;
  type: string;
}

export interface AgentLogConfig {
  enabled: boolean;
  basePath: string;
  resolvedBasePath: string;
}

export interface StackConfig {
  frontend?: string;
  backend?: string;
  testing?: string;
}

export interface WorklogConfig {
  language: string;
  memoryPath: string;
  resolvedMemoryPath: string;
  daysToScan: number;
  maxAgentSessions: number;
  maxAgentMessagesPerSession: number;
  projects: ProjectConfig[];
  stack: StackConfig;
  agentLogs: {
    claudeCode: AgentLogConfig;
    openCode: AgentLogConfig;
  };
}

function resolveAgentLog(conf: unknown, hubRoot: string): AgentLogConfig {
  const c = conf as Record<string, unknown> | null | undefined;
  const basePath = String(c?.basePath ?? "");
  return {
    enabled: Boolean(c?.enabled ?? false),
    basePath,
    resolvedBasePath: basePath ? expandTilde(basePath) : "",
  };
}

export function loadConfig(hubRoot: string): WorklogConfig {
  const configPath = join(hubRoot, "worklog.config.json");

  if (!existsSync(configPath)) {
    throw new Error(
      `No se encontró worklog.config.json en ${hubRoot}\n` +
        `Por favor, copia el archivo de ejemplo:\n` +
        `  cp worklog.config.example.json worklog.config.json\n` +
        `Y edítalo con los paths de tus proyectos.`
    );
  }

  let raw: Record<string, unknown>;
  try {
    raw = JSON.parse(readFileSync(configPath, "utf-8")) as Record<string, unknown>;
  } catch (err) {
    throw new Error(`Error al parsear worklog.config.json: ${err}`);
  }

  const rawProjects = Array.isArray(raw["projects"]) ? raw["projects"] : [];
  const projects: ProjectConfig[] = rawProjects.map((p: unknown) => {
    const proj = p as Record<string, unknown>;
    const projectPath = String(proj["path"] ?? ".");
    return {
      name: String(proj["name"] ?? "unknown"),
      path: projectPath,
      resolvedPath: resolveRelativeTo(hubRoot, projectPath),
      type: String(proj["type"] ?? "unknown"),
    };
  });

  const rawAgentLogs = raw["agentLogs"] as Record<string, unknown> | undefined;
  const rawStack = raw["stack"] as Record<string, unknown> | undefined;
  const memoryPath = String(raw["memoryPath"] ?? "./memory");

  const stack: StackConfig = {
    frontend: rawStack?.["frontend"] ? String(rawStack["frontend"]) : undefined,
    backend:  rawStack?.["backend"]  ? String(rawStack["backend"])  : undefined,
    testing:  rawStack?.["testing"]  ? String(rawStack["testing"])  : undefined,
  };

  return {
    language: String(raw["language"] ?? "es"),
    memoryPath,
    resolvedMemoryPath: resolveRelativeTo(hubRoot, memoryPath),
    daysToScan: Number(raw["daysToScan"] ?? 3),
    maxAgentSessions: Number(raw["maxAgentSessions"] ?? 5),
    maxAgentMessagesPerSession: Number(raw["maxAgentMessagesPerSession"] ?? 20),
    projects,
    stack,
    agentLogs: {
      claudeCode: resolveAgentLog(rawAgentLogs?.["claudeCode"], hubRoot),
      openCode: resolveAgentLog(rawAgentLogs?.["openCode"], hubRoot),
    },
  };
}
