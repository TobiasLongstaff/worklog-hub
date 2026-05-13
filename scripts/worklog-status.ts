import { join } from "path";
import { existsSync, readdirSync } from "fs";
import { loadConfig } from "../src/config/load-config.ts";
import { loadEnv, hasAIConfigured } from "../src/config/env.ts";
import { collectAllGitData } from "../src/collectors/git-collector.ts";
import { collectMemoryData } from "../src/collectors/memory-collector.ts";
import { countClaudeCodeSessions } from "../src/collectors/claude-code-collector.ts";
import { countOpenCodeSessions } from "../src/collectors/opencode-collector.ts";
import { listDailyLogs } from "../src/utils/files.ts";

const HUB_ROOT = join(import.meta.dir, "..");

function mark(ok: boolean): string {
  return ok ? "✓" : "✗";
}

async function main(): Promise<void> {
  console.log("\n╔══════════════════════════════╗");
  console.log("║      WORKLOG STATUS          ║");
  console.log("╚══════════════════════════════╝\n");

  // === ENV ===
  const env = loadEnv();
  const aiConfigured = hasAIConfigured(env);
  console.log("=== Configuración IA ===");
  console.log(`  AI_PROVIDER : ${env.aiProvider ?? "(no configurado)"}`);
  console.log(`  API Key     : ${env.openaiApiKey ? "✓ configurada" : "✗ no configurada"}`);
  console.log(`  Modelo      : ${env.openaiModel}`);
  if (!aiConfigured) {
    console.log(`\n  ⚠  IA no disponible. Configura AI_PROVIDER y OPENAI_API_KEY en .env`);
  }

  // === CONFIG ===
  console.log("\n=== Configuración del hub ===");
  let config;
  try {
    config = loadConfig(HUB_ROOT);
    console.log(`  ${mark(true)} worklog.config.json encontrado`);
    console.log(`  Idioma          : ${config.language}`);
    console.log(`  Días a escanear : ${config.daysToScan}`);
    console.log(`  Proyectos       : ${config.projects.length}`);
    console.log(`  Max sesiones IA : ${config.maxAgentSessions}`);
  } catch (err) {
    console.log(`  ${mark(false)} worklog.config.json: ${err}`);
    process.exit(1);
  }

  // === PROYECTOS + GIT ===
  console.log("\n=== Proyectos ===");
  const gitData = await collectAllGitData(config.projects, config.daysToScan);

  for (const p of gitData) {
    console.log(`\n  [${p.type}] ${p.name}`);
    console.log(`    Path   : ${p.path} ${mark(p.exists)}`);

    if (!p.exists) {
      console.log(`    ✗ Path no encontrado`);
      continue;
    }
    if (!p.isGitRepo) {
      console.log(`    ✗ No es un repositorio git`);
      continue;
    }
    if (p.error) {
      console.log(`    ⚠ Error: ${p.error}`);
      continue;
    }

    console.log(`    Branch : ${p.branch ?? "(desconocida)"}`);

    const statusLines = p.status?.split("\n").filter(Boolean) ?? [];
    if (statusLines.length === 0) {
      console.log(`    Status : (limpio)`);
    } else {
      console.log(`    Status : ${statusLines.length} archivo(s) modificado(s)`);
      for (const l of statusLines.slice(0, 5)) console.log(`      ${l}`);
      if (statusLines.length > 5) console.log(`      …y ${statusLines.length - 5} más`);
    }

    const commitLines = p.recentCommits?.split("\n").filter(Boolean) ?? [];
    console.log(`    Commits (${config.daysToScan}d): ${commitLines.length}`);
    for (const l of commitLines.slice(0, 3)) console.log(`      ${l}`);
    if (commitLines.length > 3) console.log(`      …y ${commitLines.length - 3} más`);
  }

  // === MEMORIA ===
  console.log("\n=== Memoria ===");
  const memory = collectMemoryData(config.resolvedMemoryPath);
  const dailyDir = join(config.resolvedMemoryPath, "daily");
  const dailyLogs = listDailyLogs(dailyDir);

  console.log(`  ${mark(!!memory.currentFocus)} current-focus.md`);
  console.log(`  ${mark(!!memory.backlog)} backlog.md`);
  console.log(`  ${mark(!!memory.decisions)} decisions.md`);

  if (dailyLogs.length > 0) {
    const last = dailyLogs[0]!;
    console.log(`  ${mark(true)} Último daily : ${last.date} (${dailyLogs.length} notas en total)`);
  } else {
    console.log(`  ${mark(false)} Notas diarias : ninguna`);
  }

  // === AGENTES ===
  console.log("\n=== Agentes ===");

  const ccConfig = config.agentLogs.claudeCode;
  console.log(`\n  Claude Code`);
  console.log(`    Habilitado : ${ccConfig.enabled ? "sí" : "no"}`);
  if (ccConfig.enabled) {
    const pathExists = existsSync(ccConfig.resolvedBasePath);
    console.log(`    Path : ${ccConfig.resolvedBasePath} ${mark(pathExists)}`);
    if (pathExists) {
      const count = countClaudeCodeSessions(config);
      console.log(`    Sesiones detectadas (proyectos configurados) : ~${count}`);
    }
  }

  const ocConfig = config.agentLogs.openCode;
  console.log(`\n  OpenCode`);
  console.log(`    Habilitado : ${ocConfig.enabled ? "sí" : "no"}`);
  if (ocConfig.enabled) {
    const pathExists = existsSync(ocConfig.resolvedBasePath);
    console.log(`    Path : ${ocConfig.resolvedBasePath} ${mark(pathExists)}`);
    if (pathExists) {
      const count = countOpenCodeSessions(config);
      console.log(`    Sesiones detectadas : ~${count}`);
    }
  }

  console.log("\n");
}

main().catch((err) => {
  console.error(`[error] ${err}`);
  process.exit(1);
});
