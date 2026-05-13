import { homedir } from "os";
import { resolve, join, isAbsolute } from "path";

export function expandTilde(p: string): string {
  if (p === "~") return homedir();
  if (p.startsWith("~/") || p.startsWith("~\\")) {
    return join(homedir(), p.slice(2));
  }
  return p;
}

export function resolveRelativeTo(base: string, p: string): string {
  const expanded = expandTilde(p);
  if (isAbsolute(expanded)) return expanded;
  return resolve(base, expanded);
}

export function normalizePath(p: string): string {
  return p.replace(/\\/g, "/");
}
