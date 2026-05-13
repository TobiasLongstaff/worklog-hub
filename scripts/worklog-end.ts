import { join } from "path";
import { createInterface } from "readline";
import { loadConfig } from "../src/config/load-config.ts";
import { loadEnv, hasAIConfigured } from "../src/config/env.ts";
import { collectAllGitData } from "../src/collectors/git-collector.ts";
import { collectMemoryData } from "../src/collectors/memory-collector.ts";
import { collectClaudeCodeSessions } from "../src/collectors/claude-code-collector.ts";
import { collectOpenCodeSessions } from "../src/collectors/opencode-collector.ts";
import { createAIClient } from "../src/ai/ai-client.ts";
import { buildEndPrompt } from "../src/ai/prompts.ts";
import { writeDailyNote, writeCurrentFocus, buildManualDailyBody } from "../src/memory/memory-writer.ts";
import { getLocalDate } from "../src/utils/dates.ts";
import { dailyExists } from "../src/utils/files.ts";
import { logger } from "../src/utils/logger.ts";
import type { WorklogContext, UserAnswers } from "../src/ai/schemas.ts";

const HUB_ROOT = join(import.meta.dir, "..");

function makeReadline() {
  return createInterface({ input: process.stdin, output: process.stdout });
}

function ask(rl: ReturnType<typeof createInterface>, question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(`\n${question}\n> `, (answer) => resolve(answer.trim()));
  });
}

async function main(): Promise<void> {
  const date = getLocalDate();
  console.log(`\n╔══════════════════════════════╗`);
  console.log(`║   WORKLOG END — ${date}   ║`);
  console.log(`╚══════════════════════════════╝\n`);

  // Config
  let config;
  try {
    config = loadConfig(HUB_ROOT);
  } catch (err) {
    console.error(`\n✗ Error de configuración:\n  ${err}\n`);
    process.exit(1);
  }

  const env = loadEnv();
  const aiAvailable = hasAIConfigured(env);

  if (!aiAvailable) {
    console.log("⚠  IA no configurada. La nota se generará solo con tus respuestas + datos Git.\n");
  }

  // === Preguntas interactivas ===
  console.log("Responde las siguientes preguntas. Sé concreto.\n");

  const rl = makeReadline();

  const whatDidYouDo = await ask(rl, "1. ¿Qué hiciste hoy?");
  const whatIsPending = await ask(rl, "2. ¿Qué quedó pendiente?");
  const whatShouldContinue = await ask(rl, "3. ¿Qué debería seguir mañana?");
  const isAnythingBroken = await ask(rl, "4. ¿Hay algo roto, dudoso o bloqueado?");
  const whatNotToTouch = await ask(rl, "5. ¿Qué cosas NO deberías tocar todavía?");

  rl.close();

  const answers: UserAnswers = {
    whatDidYouDo,
    whatIsPending,
    whatShouldContinue,
    isAnythingBroken,
    whatNotToTouch,
  };

  console.log("\nRecolectando evidencia…\n");

  const [memory, gitData, claudeSessions, opencodeSessions] = await Promise.all([
    Promise.resolve(collectMemoryData(config.resolvedMemoryPath)),
    collectAllGitData(config.projects, config.daysToScan),
    collectClaudeCodeSessions(config),
    collectOpenCodeSessions(config),
  ]);

  logger.info(`Git: ${gitData.length} proyecto(s)`);
  logger.info(`Claude Code: ${claudeSessions.length} sesión(es)`);
  logger.info(`OpenCode: ${opencodeSessions.length} sesión(es)`);

  const ctx: WorklogContext = {
    date,
    daysScanned: config.daysToScan,
    memory,
    projects: gitData,
    agentSessions: { claudeCode: claudeSessions, openCode: opencodeSessions },
  };

  // ¿Ya existe nota de hoy?
  const dailyDir = join(config.resolvedMemoryPath, "daily");
  const alreadyHasNote = dailyExists(dailyDir, date);
  let forceOverwrite = false;

  if (alreadyHasNote) {
    const rl2 = makeReadline();
    const answer = await ask(rl2, `⚠  Ya existe una nota para hoy (${date}.md). ¿Sobreescribir? (s/n)`);
    rl2.close();
    forceOverwrite = answer === "s" || answer === "si" || answer === "sí";
  }

  // === Generar contenido ===
  let dailyBodySection: string;
  let currentFocusContent: string | null = null;

  if (aiAvailable) {
    const aiClient = (() => {
      try {
        return createAIClient(env);
      } catch (err) {
        logger.error(`No se pudo crear el cliente IA: ${err}`);
        return null;
      }
    })();

    if (aiClient) {
      console.log("Generando nota con IA…\n");
      try {
        const { system, prompt } = buildEndPrompt(ctx, answers);
        const response = await aiClient.generateText({ system, prompt });

        const separator = "---SEPARADOR-CURRENT-FOCUS---";
        const sepIndex = response.indexOf(separator);

        if (sepIndex !== -1) {
          dailyBodySection = response.slice(0, sepIndex).trim();
          currentFocusContent = response.slice(sepIndex + separator.length).trim();
        } else {
          dailyBodySection = response.trim();
          logger.warn("La IA no generó la sección de current-focus. Solo se actualizará la nota diaria.");
        }
      } catch (err) {
        logger.error(`Error al llamar a la IA: ${err}`);
        console.log("⚠  Falla de IA — generando nota manual como fallback.\n");
        dailyBodySection = buildManualDailyBody(answers);
      }
    } else {
      dailyBodySection = buildManualDailyBody(answers);
    }
  } else {
    dailyBodySection = buildManualDailyBody(answers);
  }

  // === Escribir nota diaria ===
  const result = writeDailyNote({
    memoryPath: config.resolvedMemoryPath,
    date,
    aiBodySection: dailyBodySection,
    gitData,
    forceOverwrite,
  });

  console.log(`\n✓ Nota diaria guardada en: ${result.path}`);

  // === Actualizar current-focus ===
  if (currentFocusContent) {
    writeCurrentFocus({
      memoryPath: config.resolvedMemoryPath,
      date,
      content: currentFocusContent,
    });
    console.log("✓ current-focus.md actualizado");
  } else {
    logger.warn("No se actualizó current-focus.md (sin contenido de IA)");
    console.log("  Edita memory/current-focus.md manualmente si es necesario.");
  }

  console.log("\n¡Hasta mañana!\n");
}

main().catch((err) => {
  console.error(`[error fatal] ${err}`);
  process.exit(1);
});
