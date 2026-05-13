import type { GitProjectData } from "../collectors/git-collector.ts";

export function buildDailyNoteHeader(date: string): string {
  return `# ${date}\n\n`;
}

export function buildGitEvidenceSection(projects: GitProjectData[]): string {
  const lines = ["## Evidencia Git"];

  for (const p of projects) {
    lines.push(`\n### ${p.name}`);
    if (!p.exists) {
      lines.push(`- ✗ Path no encontrado`);
      continue;
    }
    if (!p.isGitRepo) {
      lines.push(`- ✗ No es un repositorio git`);
      continue;
    }
    lines.push(`- Branch: \`${p.branch ?? "desconocida"}\``);

    const commits = p.recentCommits
      ?.split("\n")
      .filter(Boolean)
      .map((l) => `  - ${l}`)
      .join("\n");
    lines.push(`- Commits recientes:\n${commits || "  (ninguno)"}`);

    const status = p.status?.split("\n").filter(Boolean).map((l) => `  - ${l}`).join("\n");
    lines.push(`- Cambios sin commitear:\n${status || "  (ninguno)"}`);
  }

  return lines.join("\n");
}

export function buildFallbackDailyNote(
  date: string,
  aiSection: string,
  gitData: GitProjectData[]
): string {
  return [
    buildDailyNoteHeader(date),
    aiSection,
    "\n",
    buildGitEvidenceSection(gitData),
  ].join("\n");
}

export function buildRawContextSummary(
  memory: {
    currentFocus: string | null;
    backlog: string | null;
    lastDaily: { date: string; content: string } | null;
  },
  projects: GitProjectData[]
): string {
  const lines: string[] = ["===== CONTEXTO DE TRABAJO (sin IA) =====\n"];

  if (memory.currentFocus) {
    lines.push("=== CURRENT FOCUS ===");
    lines.push(memory.currentFocus);
    lines.push("");
  }

  if (memory.lastDaily) {
    lines.push(`=== ÚLTIMO DAILY (${memory.lastDaily.date}) ===`);
    lines.push(memory.lastDaily.content);
    lines.push("");
  }

  if (memory.backlog) {
    lines.push("=== BACKLOG ===");
    lines.push(memory.backlog);
    lines.push("");
  }

  lines.push("=== GIT ===");
  for (const p of projects) {
    lines.push(`\n--- ${p.name} (${p.type}) ---`);
    if (!p.exists) {
      lines.push("  ✗ Path no encontrado");
      continue;
    }
    if (!p.isGitRepo) {
      lines.push("  ✗ No es un repositorio git");
      continue;
    }
    lines.push(`  Branch: ${p.branch ?? "desconocida"}`);
    if (p.status) lines.push(`  Status:\n${p.status.split("\n").map((l) => `    ${l}`).join("\n")}`);
    if (p.recentCommits) {
      lines.push("  Commits recientes:");
      lines.push(p.recentCommits.split("\n").map((l) => `    ${l}`).join("\n"));
    }
  }

  return lines.join("\n");
}
