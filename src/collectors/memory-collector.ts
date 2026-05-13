import { join } from "path";
import { readIfExists, getLastDaily } from "../utils/files.ts";

export interface MemoryData {
  currentFocus: string | null;
  backlog: string | null;
  decisions: string | null;
  lastDaily: { date: string; content: string } | null;
}

export function collectMemoryData(memoryPath: string): MemoryData {
  return {
    currentFocus: readIfExists(join(memoryPath, "current-focus.md")),
    backlog: readIfExists(join(memoryPath, "backlog.md")),
    decisions: readIfExists(join(memoryPath, "decisions.md")),
    lastDaily: getLastDaily(join(memoryPath, "daily")),
  };
}
