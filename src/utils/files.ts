import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { logger } from "./logger.ts";

export function ensureDir(dir: string): void {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

export function readIfExists(filePath: string): string | null {
  try {
    if (!existsSync(filePath)) return null;
    return readFileSync(filePath, "utf-8");
  } catch (err) {
    logger.warn(`No se pudo leer ${filePath}: ${err}`);
    return null;
  }
}

export function writeFile(filePath: string, content: string): void {
  writeFileSync(filePath, content, "utf-8");
}

export interface DailyEntry {
  filename: string;
  date: string;
  path: string;
}

export function listDailyLogs(dailyDir: string): DailyEntry[] {
  if (!existsSync(dailyDir)) return [];
  try {
    return readdirSync(dailyDir)
      .filter((f) => /^\d{4}-\d{2}-\d{2}.*\.md$/.test(f))
      .sort()
      .reverse()
      .map((f) => ({
        filename: f,
        date: f.slice(0, 10),
        path: join(dailyDir, f),
      }));
  } catch {
    return [];
  }
}

export function getLastDaily(dailyDir: string): { date: string; content: string } | null {
  const entries = listDailyLogs(dailyDir);
  const first = entries[0];
  if (!first) return null;
  const content = readIfExists(first.path);
  if (content === null) return null;
  return { date: first.date, content };
}

export function getNextAvailableDailyPath(dailyDir: string, date: string): string {
  const base = join(dailyDir, `${date}.md`);
  if (!existsSync(base)) return base;
  for (let i = 2; i <= 99; i++) {
    const candidate = join(dailyDir, `${date}-${i}.md`);
    if (!existsSync(candidate)) return candidate;
  }
  return join(dailyDir, `${date}-99.md`);
}

export function dailyExists(dailyDir: string, date: string): boolean {
  return existsSync(join(dailyDir, `${date}.md`));
}
