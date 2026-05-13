import { existsSync } from "fs";
import { join } from "path";
import { ensureDir, writeFile, getNextAvailableDailyPath } from "../utils/files.ts";
import { getBackupTimestamp } from "../utils/dates.ts";
import { logger } from "../utils/logger.ts";
import { buildDailyNoteHeader, buildGitEvidenceSection } from "./markdown.ts";
import type { GitProjectData } from "../collectors/git-collector.ts";

export interface WriteDailyNoteParams {
  memoryPath: string;
  date: string;
  aiBodySection: string;
  gitData: GitProjectData[];
  forceOverwrite?: boolean;
}

export interface WriteDailyNoteResult {
  path: string;
  wasExisting: boolean;
}

export function buildFullDailyNote(
  date: string,
  aiBodySection: string,
  gitData: GitProjectData[]
): string {
  return [
    buildDailyNoteHeader(date),
    aiBodySection.trim(),
    "\n",
    buildGitEvidenceSection(gitData),
    "\n",
  ].join("\n");
}

export function writeDailyNote(params: WriteDailyNoteParams): WriteDailyNoteResult {
  const { memoryPath, date, aiBodySection, gitData, forceOverwrite } = params;
  const dailyDir = join(memoryPath, "daily");
  ensureDir(dailyDir);

  const existingPath = join(dailyDir, `${date}.md`);
  const wasExisting = existsSync(existingPath);

  let targetPath: string;
  if (wasExisting && !forceOverwrite) {
    targetPath = getNextAvailableDailyPath(dailyDir, date);
  } else {
    targetPath = existingPath;
  }

  const content = buildFullDailyNote(date, aiBodySection, gitData);
  writeFile(targetPath, content);
  logger.info(`Nota diaria guardada en: ${targetPath}`);

  return { path: targetPath, wasExisting };
}

export interface WriteCurrentFocusParams {
  memoryPath: string;
  date: string;
  content: string;
}

export function writeCurrentFocus(params: WriteCurrentFocusParams): void {
  const { memoryPath, date, content } = params;
  const focusPath = join(memoryPath, "current-focus.md");
  const backupDir = join(memoryPath, ".backup");

  ensureDir(backupDir);

  // Backup primero
  if (existsSync(focusPath)) {
    const timestamp = getBackupTimestamp();
    const backupPath = join(backupDir, `current-focus-${timestamp}.md`);
    try {
      const existing = Bun.file(focusPath);
      Bun.write(backupPath, existing);
      logger.info(`Backup de current-focus.md guardado en: ${backupPath}`);
    } catch (err) {
      logger.warn(`No se pudo hacer backup de current-focus.md: ${err}`);
    }
  }

  writeFile(focusPath, content.trim() + "\n");
  logger.info("current-focus.md actualizado");
}

export function buildManualDailyBody(answers: {
  whatDidYouDo: string;
  whatIsPending: string;
  whatShouldContinue: string;
  isAnythingBroken: string;
  whatNotToTouch: string;
}): string {
  return [
    "## Qué hice hoy",
    answers.whatDidYouDo
      .split("\n")
      .map((l) => `- ${l.trim()}`)
      .filter((l) => l !== "- ")
      .join("\n") || "- (sin registrar)",
    "",
    "## Qué quedó pendiente",
    answers.whatIsPending
      .split("\n")
      .map((l) => `- ${l.trim()}`)
      .filter((l) => l !== "- ")
      .join("\n") || "- (sin registrar)",
    "",
    "## Próximo paso recomendado",
    `- ${answers.whatShouldContinue || "(sin registrar)"}`,
    "",
    "## Bloqueos / dudas",
    `- ${answers.isAnythingBroken || "(ninguno)"}`,
    "",
    "## Qué NO tocar todavía",
    `- ${answers.whatNotToTouch || "(ninguno)"}`,
    "",
    "## Resumen IA",
    "_(IA no configurada — nota generada manualmente)_",
  ].join("\n");
}
