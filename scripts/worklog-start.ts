import { join } from "path";
import { loadConfig } from "../src/config/load-config.ts";
import { loadEnv, hasAIConfigured } from "../src/config/env.ts";
import { collectAllGitData } from "../src/collectors/git-collector.ts";
import { collectMemoryData } from "../src/collectors/memory-collector.ts";
import { collectClaudeCodeSessions } from "../src/collectors/claude-code-collector.ts";
import { collectOpenCodeSessions } from "../src/collectors/opencode-collector.ts";
import { createAIClient } from "../src/ai/ai-client.ts";
import { buildStartPrompt } from "../src/ai/prompts.ts";
import { buildRawContextSummary } from "../src/memory/markdown.ts";
import { getLocalDate } from "../src/utils/dates.ts";
import { logger } from "../src/utils/logger.ts";
import type { WorklogContext } from "../src/ai/schemas.ts";

const HUB_ROOT = join(import.meta.dir, "..");

async function main(): Promise<void> {
  const date = getLocalDate();
  console.log(`\n[worklog:start] ${date}\n`);

  // Config
  let config;
  try {
    config = loadConfig(HUB_ROOT);
  } catch (err) {
    console.error(`\n✗ Error de configuración:\n  ${err}\n`);
    process.exit(1);
  }

  // Env
  const env = loadEnv();
  const aiAvailable = hasAIConfigured(env);

  console.log("Recolectando contexto…\n");

  // Recolección en paralelo
  const [memory, gitData, claudeSessions, opencodeSessions] = await Promise.all([
    Promise.resolve(collectMemoryData(config.resolvedMemoryPath)),
    collectAllGitData(config.projects, config.daysToScan),
    collectClaudeCodeSessions(config),
    collectOpenCodeSessions(config),
  ]);

  logger.info(`Git: ${gitData.length} proyecto(s) escaneados`);
  logger.info(`Claude Code: ${claudeSessions.length} sesión(es) cargadas`);
  logger.info(`OpenCode: ${opencodeSessions.length} sesión(es) cargadas`);

  const ctx: WorklogContext = {
    date,
    daysScanned: config.daysToScan,
    memory,
    projects: gitData,
    agentSessions: { claudeCode: claudeSessions, openCode: opencodeSessions },
  };

  if (!aiAvailable) {
    console.log(buildRawContextSummary(memory, gitData));
    console.log(
      "\n⚠  IA no configurada.\n" +
        "   Para obtener el resumen inteligente, configura en .env:\n" +
        "     AI_PROVIDER=openai\n" +
        "     OPENAI_API_KEY=sk-...\n" +
        "     OPENAI_MODEL=gpt-4o\n"
    );
    return;
  }

  // Llamada a IA
  let aiClient;
  try {
    aiClient = createAIClient(env);
  } catch (err) {
    logger.error(`No se pudo crear el cliente IA: ${err}`);
    console.log(buildRawContextSummary(memory, gitData));
    return;
  }

  if (!aiClient) {
    console.log(buildRawContextSummary(memory, gitData));
    return;
  }

  console.log("Generando resumen con IA…\n");

  try {
    const { system, prompt } = buildStartPrompt(ctx);
    const summary = await aiClient.generateText({ system, prompt });
    console.log(summary);
  } catch (err) {
    logger.error(`Error al llamar a la IA: ${err}`);
    console.log("\n--- Evidencia recolectada (sin resumen IA) ---\n");
    console.log(buildRawContextSummary(memory, gitData));
  }

  console.log("\n");
}

main().catch((err) => {
  console.error(`[error fatal] ${err}`);
  process.exit(1);
});
