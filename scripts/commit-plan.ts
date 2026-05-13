import { join } from "path";
import { loadConfig } from "../src/config/load-config.ts";
import { loadEnv, hasAIConfigured } from "../src/config/env.ts";
import { createAIClient } from "../src/ai/ai-client.ts";
import { buildCommitPlanPrompt } from "../src/ai/prompts.ts";
import { collectGitDiff, validateProjectForDiff } from "../src/collectors/git-diff-collector.ts";
import { loadLimits } from "../src/utils/limits.ts";
import { parseArgs } from "../src/utils/args.ts";
import { logger } from "../src/utils/logger.ts";

const HUB_ROOT = join(import.meta.dir, "..");

function printRawDiff(data: Awaited<ReturnType<typeof collectGitDiff>>): void {
  console.log(`Branch: \`${data.branch}\`\n`);

  if (data.hasStaged) {
    console.log("── Staged ──────────────────────────────");
    console.log(data.stagedStat || data.stagedNameStatus);
  }
  if (data.hasUnstaged) {
    console.log("── Unstaged ─────────────────────────────");
    console.log(data.unstagedStat || data.unstagedNameStatus);
  }
  if (data.hasUntracked) {
    const lines = data.statusShort.split("\n").filter((l) => l.startsWith("??"));
    console.log("── Sin trackear ──────────────────────────");
    lines.forEach((l) => console.log(l));
  }
  if (data.stagedDiff.truncated) {
    console.log(
      `\n⚠  Staged diff truncado: ${data.stagedDiff.content.length.toLocaleString()} de ${data.stagedDiff.originalLength.toLocaleString()} chars`
    );
  }
  if (data.unstagedDiff.truncated) {
    console.log(
      `⚠  Unstaged diff truncado: ${data.unstagedDiff.content.length.toLocaleString()} de ${data.unstagedDiff.originalLength.toLocaleString()} chars`
    );
  }
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const projectName = String(args["project"] ?? args["p"] ?? "");

  if (!projectName) {
    console.error("\n✗ Falta el nombre del proyecto.\n");
    console.error("  Uso:  bun run commit:plan -- --project <nombre>");
    console.error("        bun run commit:plan -- -p <nombre>\n");
    process.exit(1);
  }

  // Config
  let config;
  try {
    config = loadConfig(HUB_ROOT);
  } catch (err) {
    console.error(`\n✗ Error de configuración: ${err}\n`);
    process.exit(1);
  }

  // Find project
  const project = config.projects.find((p) => p.name === projectName);
  if (!project) {
    console.error(`\n✗ Proyecto "${projectName}" no encontrado en worklog.config.json.`);
    console.error(`  Proyectos disponibles: ${config.projects.map((p) => p.name).join(", ")}\n`);
    process.exit(1);
  }

  // Validate path and git repo
  const validation = validateProjectForDiff(project);
  if (!validation.exists || !validation.isGitRepo) {
    console.error(`\n✗ ${validation.errorMessage}\n`);
    process.exit(1);
  }

  console.log(`\n[commit:plan] ${project.name} (${project.type})\n`);

  // Collect diff
  const limits = loadLimits();
  console.log("Leyendo estado del repositorio…\n");
  const diffData = await collectGitDiff(project, limits);

  // No changes at all
  if (!diffData.hasStaged && !diffData.hasUnstaged && !diffData.hasUntracked) {
    console.log("✓ Sin cambios en el repositorio. Nada para commitear.");
    return;
  }

  // Print raw summary
  printRawDiff(diffData);

  // Env + AI
  const env = loadEnv();
  const aiAvailable = hasAIConfigured(env);

  if (!aiAvailable) {
    console.log(
      "\n⚠  IA no configurada. commit:plan necesita IA para proponer mensajes de commit.\n" +
        "   Configura AI_PROVIDER y la API key correspondiente en .env:\n" +
        "     AI_PROVIDER=anthropic  →  ANTHROPIC_API_KEY=sk-ant-...\n" +
        "     AI_PROVIDER=openai     →  OPENAI_API_KEY=sk-...\n"
    );
    return;
  }

  let aiClient;
  try {
    aiClient = createAIClient(env);
  } catch (err) {
    logger.error(`No se pudo crear el cliente IA: ${err}`);
    process.exit(1);
  }

  if (!aiClient) {
    logger.error("No se pudo inicializar el cliente IA.");
    process.exit(1);
  }

  console.log("\nAnalizando diff con IA…\n");

  try {
    const { system, prompt } = buildCommitPlanPrompt(diffData);
    const result = await aiClient.generateText({ system, prompt });
    console.log("\n" + result + "\n");
  } catch (err) {
    logger.error(`Error al llamar a la IA: ${err}`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(`[error fatal] ${err}`);
  process.exit(1);
});
