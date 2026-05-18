import { join } from "path";
import { getDb } from "../src/backlog/db/connection.ts";
import { BacklogItemRepository } from "../src/backlog/repository/backlog-item-repository.ts";
import { BacklogEvidenceRepository } from "../src/backlog/repository/backlog-evidence-repository.ts";
import { BacklogPromptRepository } from "../src/backlog/repository/backlog-prompt-repository.ts";
import { AgentTaskRepository } from "../src/backlog/repository/agent-task-repository.ts";
import { SettingsRepository } from "../src/backlog/repository/settings-repository.ts";
import { BacklogService } from "../src/backlog/service/backlog-service.ts";
import { AgentExecutor } from "../src/backlog/service/agent-executor.ts";
import { NgrokTunnelService } from "../src/backlog/service/ngrok-tunnel-service.ts";
import { DailySummaryRepository } from "../src/backlog/repository/daily-summary-repository.ts";
import { DailySummaryService } from "../src/backlog/service/daily-summary-service.ts";
import { DailySummaryGeneratorService } from "../src/backlog/service/daily-summary-generator-service.ts";
import { createApiHandler } from "../src/backlog/api/handlers.ts";
import { createMcpHandler } from "../src/backlog/mcp/handler.ts";
import { createSettingsHandler } from "../src/backlog/api/settings-handlers.ts";
import { createDailySummaryHandler } from "../src/backlog/api/daily-summary-handlers.ts";
import { loadConfig } from "../src/config/load-config.ts";
import type { StackConfig } from "../src/config/load-config.ts";

// En producción (app empaquetada), Tauri pasa WORKLOG_DATA_DIR apuntando a
// AppData\Roaming\{app}. En dev, usamos la raíz del proyecto.
const HUB_ROOT = process.env["WORKLOG_DATA_DIR"] ?? join(import.meta.dir, "..");
const PORT = Number(process.env["BACKLOG_PORT"] ?? 3131);
const PUBLIC_DIR = join(HUB_ROOT, "dist");

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
const settingsRepo = new SettingsRepository(db);
const executor     = new AgentExecutor(HUB_ROOT);

const service = new BacklogService(
  itemRepo, evidenceRepo, promptRepo, taskRepo, executor, projectPaths, stack
);

const summaryRepo      = new DailySummaryRepository(db);
const summaryService   = new DailySummaryService(summaryRepo, db);
const summaryGenerator = new DailySummaryGeneratorService(summaryRepo, db, HUB_ROOT, settingsRepo);
const ngrokService     = new NgrokTunnelService(settingsRepo);
const apiHandler       = createApiHandler(service);
const mcpHandler       = createMcpHandler(service, summaryService);
const settingsHandler  = createSettingsHandler(settingsRepo, ngrokService, PORT);
const summaryHandler   = createDailySummaryHandler(summaryService, summaryGenerator);

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

const httpServer = Bun.serve({
  port: PORT,

  async fetch(req) {
    const url = new URL(req.url);
    const { pathname } = url;

    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    if (pathname.startsWith("/api/settings") || pathname === "/api/health") {
      return addCors(await settingsHandler(req));
    }

    if (pathname.startsWith("/api/daily-summary")) {
      return addCors(await summaryHandler(req));
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

  Presioná Ctrl+C para detener.
`);

// Cierre limpio del socket para evitar sockets zombie en la próxima sesión
async function shutdown() {
  await httpServer.stop(true);
  process.exit(0);
}
process.on("SIGINT",  () => void shutdown());
process.on("SIGTERM", () => void shutdown());

// Autoarranque de ngrok si está configurado
const autostart = settingsRepo.get("ngrok_autostart");
if (autostart === "true") {
  const token  = settingsRepo.get("ngrok_authtoken");
  const domain = settingsRepo.get("ngrok_dev_domain");
  if (token && domain) {
    console.log(`  ngrok: iniciando túnel hacia ${domain}…`);
    // Pequeño delay para que el servidor HTTP esté listo primero
    setTimeout(() => {
      ngrokService.start(PORT).catch((err) => {
        console.error("  ngrok: error al iniciar:", err);
      });
    }, 1500);
  }
}
