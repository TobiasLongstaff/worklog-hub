import { join } from "path";
import { getDb } from "../src/backlog/db/connection.ts";
import { BacklogItemRepository } from "../src/backlog/repository/backlog-item-repository.ts";
import { BacklogEvidenceRepository } from "../src/backlog/repository/backlog-evidence-repository.ts";
import { BacklogPromptRepository } from "../src/backlog/repository/backlog-prompt-repository.ts";
import { AgentTaskRepository } from "../src/backlog/repository/agent-task-repository.ts";
import { BacklogService } from "../src/backlog/service/backlog-service.ts";
import { AgentExecutor } from "../src/backlog/service/agent-executor.ts";
import { createApiHandler } from "../src/backlog/api/handlers.ts";
import { createMcpHandler } from "../src/backlog/mcp/handler.ts";
import { loadConfig } from "../src/config/load-config.ts";
import type { StackConfig } from "../src/config/load-config.ts";

const HUB_ROOT = join(import.meta.dir, "..");
const PORT = Number(process.env["BACKLOG_PORT"] ?? 3131);
const PUBLIC_DIR = join(HUB_ROOT, "public");

// Resolve project paths and stack config for agent dispatch
let projectPaths = { frontend: null as string | null, backend: null as string | null };
let stack: StackConfig = {};
try {
  const config = loadConfig(HUB_ROOT);
  const frontend = config.projects.find((p) => p.type === "frontend");
  const backend  = config.projects.find((p) => p.type === "backend");
  projectPaths = {
    frontend: frontend?.resolvedPath ?? null,
    backend:  backend?.resolvedPath ?? null,
  };
  stack = config.stack;
} catch {
  // worklog.config.json not found — agent paths and stack will be empty
}

const db = getDb(HUB_ROOT);
const itemRepo     = new BacklogItemRepository(db);
const evidenceRepo = new BacklogEvidenceRepository(db);
const promptRepo   = new BacklogPromptRepository(db);
const taskRepo     = new AgentTaskRepository(db);
const executor     = new AgentExecutor(HUB_ROOT);

const service = new BacklogService(
  itemRepo, evidenceRepo, promptRepo, taskRepo, executor, projectPaths, stack
);

const apiHandler = createApiHandler(service);
const mcpHandler = createMcpHandler(service);

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

function addCors(res: Response): Response {
  const headers = new Headers(res.headers);
  for (const [k, v] of Object.entries(CORS_HEADERS)) headers.set(k, v);
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
}

Bun.serve({
  port: PORT,

  async fetch(req) {
    const url = new URL(req.url);
    const { pathname } = url;

    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    if (pathname.startsWith("/api/")) {
      return addCors(await apiHandler(req));
    }

    if (pathname === "/mcp") {
      return addCors(await mcpHandler(req));
    }

    // Serve static frontend
    const filePath = pathname === "/" ? "/index.html" : pathname;
    const file = Bun.file(join(PUBLIC_DIR, filePath));
    if (await file.exists()) {
      return new Response(file);
    }

    return new Response("Not Found", { status: 404 });
  },
});

console.log(`
╔══════════════════════════════════════════╗
║          BACKLOG VIVO — worklog-hub       ║
╚══════════════════════════════════════════╝

  Web:  http://localhost:${PORT}
  API:  http://localhost:${PORT}/api/backlog
  MCP:  http://localhost:${PORT}/mcp

  Frontend: ${projectPaths.frontend ?? "(no configurado)"}
  Backend:  ${projectPaths.backend  ?? "(no configurado)"}

  Para exponer el MCP por HTTPS en local:
    npx cloudflared tunnel --url http://localhost:${PORT}
    (o: npx ngrok http ${PORT})

  Presioná Ctrl+C para detener.
`);
