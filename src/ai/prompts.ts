import type { WorklogContext, UserAnswers } from "./schemas.ts";
import type { GitProjectData } from "../collectors/git-collector.ts";
import type { AgentSession } from "../collectors/claude-code-collector.ts";
import type { GenerateTextInput } from "./ai-client.ts";
import type { GitDiffData } from "../collectors/git-diff-collector.ts";

const SYSTEM_RULES = `Eres un asistente de continuidad de trabajo para un desarrollador que trabaja solo en un sistema de facturación/ERP.

REGLAS ABSOLUTAS:
- Responde ÚNICAMENTE en español claro y directo
- NO traduzcas: nombres de archivos, ramas (branches), funciones, queries, mutations, rutas, variables ni comandos
- NO inventes contexto que no esté presente en la evidencia
- Si la evidencia es insuficiente para algo, dilo explícitamente
- Prioridad de fuentes (de mayor a menor): current-focus.md → última nota daily → datos git → logs de agentes
- Usa los logs de Claude Code y OpenCode SOLO para detectar intención, decisiones y próximos pasos; NO como verdad absoluta
- Detecta trabajo incompleto, contradicciones y dispersión
- Sé crítico y específico. NUNCA des respuestas genéricas
- Marca con "⚠" cualquier incertidumbre o inferencia
- Devuelve Markdown limpio, listo para mostrar en consola`;

function formatGitSection(project: GitProjectData): string {
  if (!project.exists) return `### ${project.name}\n- ✗ Path no encontrado: ${project.path}`;
  if (!project.isGitRepo) return `### ${project.name}\n- ✗ No es un repositorio git`;
  if (project.error) return `### ${project.name}\n- ⚠ Error: ${project.error}`;

  const lines = [
    `### ${project.name} (${project.type})`,
    `- Branch: \`${project.branch ?? "desconocida"}\``,
    `- Status:\n\`\`\`\n${project.status ?? "(sin cambios)"}\n\`\`\``,
    `- Commits recientes (${project.recentCommits?.split("\n").filter(Boolean).length ?? 0}):`,
    project.recentCommits
      ? project.recentCommits
          .split("\n")
          .filter(Boolean)
          .map((l) => `  - ${l}`)
          .join("\n")
      : "  (ninguno)",
  ];

  if (project.diffStat) {
    lines.push(`- Diff stat:\n\`\`\`\n${project.diffStat}\n\`\`\``);
  }

  return lines.join("\n");
}

function formatAgentSessions(sessions: AgentSession[], label: string): string {
  if (sessions.length === 0) return `### ${label}\n(sin sesiones detectadas)`;

  const parts = [`### ${label}`];
  for (const s of sessions) {
    parts.push(`\n**Sesión ${s.sessionId}** | Proyecto: ${s.projectDir} | Fecha: ${s.date}`);
    for (const msg of s.messages) {
      const roleLabel = msg.role === "user" ? "[tú]" : "[asistente]";
      parts.push(`${roleLabel}: ${msg.content}`);
    }
  }
  return parts.join("\n");
}

function buildContextBlock(ctx: WorklogContext): string {
  const blocks: string[] = [];

  blocks.push(`## Fecha: ${ctx.date} | Días escaneados: ${ctx.daysScanned}`);

  // Memoria curada
  if (ctx.memory.currentFocus) {
    blocks.push(`\n## current-focus.md\n${truncateSection(ctx.memory.currentFocus, 2000)}`);
  } else {
    blocks.push(`\n## current-focus.md\n(no existe)`);
  }

  if (ctx.memory.lastDaily) {
    blocks.push(
      `\n## Última nota daily (${ctx.memory.lastDaily.date})\n${truncateSection(ctx.memory.lastDaily.content, 2000)}`
    );
  } else {
    blocks.push(`\n## Última nota daily\n(no existe)`);
  }

  if (ctx.memory.backlog) {
    blocks.push(`\n## backlog.md\n${truncateSection(ctx.memory.backlog, 1000)}`);
  }

  if (ctx.memory.decisions) {
    blocks.push(`\n## decisions.md\n${truncateSection(ctx.memory.decisions, 1000)}`);
  }

  // Git
  blocks.push(`\n## Datos Git`);
  for (const p of ctx.projects) {
    blocks.push(formatGitSection(p));
  }

  // Sesiones de agentes
  blocks.push(
    `\n## Sesiones de agentes\n${formatAgentSessions(ctx.agentSessions.claudeCode, "Claude Code")}`
  );
  blocks.push(formatAgentSessions(ctx.agentSessions.openCode, "OpenCode"));

  return blocks.join("\n");
}

function truncateSection(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max) + `\n…[recortado, ${s.length - max} caracteres más]`;
}

export function buildStartPrompt(ctx: WorklogContext): GenerateTextInput {
  const system = SYSTEM_RULES;

  const prompt = `A continuación tienes el contexto completo de trabajo. Genera el resumen de arranque del día con EXACTAMENTE esta estructura (sin agregar ni quitar secciones):

---ESTRUCTURA ESPERADA---
# Arranque del día

## En qué estabas
[Describe con precisión en qué parte del trabajo estabas, qué módulo, qué problema]

## Último avance importante
[El progreso más significativo registrado en la evidencia]

## Pendientes principales
1. [pendiente concreto]
2. [pendiente concreto]
[agrega todos los que encuentres en la evidencia]

## Prioridad recomendada para hoy
1. [tarea específica, justificada por la evidencia]
2. [tarea específica]
3. [tarea específica]

## Qué NO tocar hoy
- [elemento concreto a evitar con razón breve]

## Riesgos o inconsistencias
- [riesgo o contradicción detectada en la evidencia]

## Primer paso concreto
[Una sola acción específica e inmediata para empezar a trabajar ahora mismo]
---FIN ESTRUCTURA---

CONTEXTO:
${buildContextBlock(ctx)}`;

  return { system, prompt };
}

export function buildEndPrompt(ctx: WorklogContext, answers: UserAnswers): GenerateTextInput {
  const system = SYSTEM_RULES;

  const projectNames = ctx.projects.map((p) => p.name);

  const gitEvidence = ctx.projects
    .map((p) => {
      if (!p.exists || !p.isGitRepo) return `### ${p.name}\n(no disponible)`;
      return [
        `### ${p.name}`,
        `- Branch: \`${p.branch ?? "desconocida"}\``,
        `- Commits recientes:\n${
          p.recentCommits
            ?.split("\n")
            .filter(Boolean)
            .map((l) => `  - ${l}`)
            .join("\n") ?? "  (ninguno)"
        }`,
        `- Cambios sin commitear:\n\`\`\`\n${p.status ?? "(ninguno)"}\n\`\`\``,
      ].join("\n");
    })
    .join("\n\n");

  const claudeSessions = ctx.agentSessions.claudeCode
    .map(
      (s) =>
        `**${s.sessionId}** (${s.date}):\n` +
        s.messages.map((m) => `  [${m.role === "user" ? "tú" : "IA"}]: ${m.content}`).join("\n")
    )
    .join("\n\n");

  const opencodeSessions = ctx.agentSessions.openCode
    .map(
      (s) =>
        `**${s.sessionId}** (${s.date}):\n` +
        s.messages.map((m) => `  [${m.role === "user" ? "tú" : "IA"}]: ${m.content}`).join("\n")
    )
    .join("\n\n");

  const prompt = `Genera DOS documentos separados por la línea "---SEPARADOR-CURRENT-FOCUS---".

=== RESPUESTAS DEL DESARROLLADOR HOY ===
Qué hice hoy: ${answers.whatDidYouDo}
Qué quedó pendiente: ${answers.whatIsPending}
Qué debería seguir mañana: ${answers.whatShouldContinue}
¿Algo roto, dudoso o bloqueado?: ${answers.isAnythingBroken}
Qué NO tocar todavía: ${answers.whatNotToTouch}

=== CONTEXTO DE MEMORIA ===
${ctx.memory.currentFocus ? `**current-focus.md:**\n${truncateSection(ctx.memory.currentFocus, 1500)}` : ""}
${ctx.memory.lastDaily ? `**Último daily (${ctx.memory.lastDaily.date}):**\n${truncateSection(ctx.memory.lastDaily.content, 1500)}` : ""}
${ctx.memory.backlog ? `**backlog.md:**\n${truncateSection(ctx.memory.backlog, 800)}` : ""}

=== EVIDENCIA GIT ===
${gitEvidence}

=== SESIONES CLAUDE CODE ===
${claudeSessions || "(sin sesiones)"}

=== SESIONES OPENCODE ===
${opencodeSessions || "(sin sesiones)"}

---GENERA EXACTAMENTE ESTO---

DOCUMENTO 1: nota diaria (empieza con "## Qué hice hoy", sin encabezado de fecha ni "# ...")

## Qué hice hoy
- [ítem basado en respuestas + evidencia]

## Qué quedó pendiente
- [ítem]

## Próximo paso recomendado
- [paso concreto]

## Bloqueos / dudas
- [ítem o "(ninguno)"]

## Qué NO tocar todavía
- [ítem]

## Evidencia de agentes
### Claude Code
- Sesiones consideradas: ${ctx.agentSessions.claudeCode.length}
- Señales relevantes:
  - [señal extraída de las sesiones, o "(ninguna relevante)"]

### OpenCode
- Sesiones consideradas: ${ctx.agentSessions.openCode.length}
- Señales relevantes:
  - [señal extraída de las sesiones, o "(ninguna relevante)"]

## Resumen IA
[síntesis crítica de 3-5 líneas: estado real del trabajo, contradicciones detectadas, riesgos y prioridad para mañana]

---SEPARADOR-CURRENT-FOCUS---

DOCUMENTO 2: current-focus.md actualizado (empieza con "# Current Focus")

# Current Focus

## Proyecto activo
[nombre del proyecto o módulo más urgente de: ${projectNames.join(", ")}]

## Módulo actual
[módulo, feature o área específica]

## Estado actual
[una oración que describe el estado real: qué está hecho, qué falta]

## Próximo paso
[acción concreta e inmediata]

## Pendientes inmediatos
- [ítem]

## No distraerse con
- [ítem]

## Última actualización
${ctx.date}`;

  return { system, prompt };
}

// ─── Commit Plan ─────────────────────────────────────────────────────────────

const COMMIT_PLAN_SYSTEM = `You are an expert Git commit strategist embedded in a personal worklog system.
Your job is to analyze a git diff and propose well-structured commits optimized for clarity, traceability, and worklog continuity.

STRICT RULES:
- Base ONLY on the provided git status and diff. Never invent changes.
- Commit summaries MUST be in English, under 72 characters.
- Prefer English for the entire commit body.
- Do NOT translate: file names, routes, functions, GraphQL queries/mutations/types, Prisma models, branches, table names, database fields, or any technical identifiers.
- Prefer one commit per logical unit of work.
- If unrelated changes are mixed, recommend splitting into multiple commits.
- If the diff was truncated, say so explicitly and note it may affect your accuracy.
- Warn clearly about: .env files, secrets, console.log/debug leftovers, generated files (*.generated.*, dist/, build/), commented-out dead code, temporary files, lockfile-only noise, accidental changes outside the intended scope.
- Status field rules:
  - "completed" only if the feature/fix is clearly done with no obvious gaps.
  - "in-progress" if TODOs, placeholders, broken imports, missing connections, incomplete flows, or partial implementations exist.
  - "blocked" if a blocker is explicitly visible in the diff.
- Be precise, not polite. Accuracy over politeness.

CONVENTIONAL COMMIT TYPES: feat | fix | refactor | ui | test | docs | chore | wip

ALLOWED SCOPES:
auth | organizations | users | permissions | plans | onboarding |
invoices | credit-notes | contacts | products | treasury | bank-accounts |
current-account | collections | checks | reports | afip | arca |
ui | layout | sidebar | graphql | prisma | tests | config | tooling | docs`;

export function buildCommitPlanPrompt(data: GitDiffData): GenerateTextInput {
  const stagedTruncWarning = data.stagedDiff.truncated
    ? `⚠ Staged diff truncated at ${data.stagedDiff.content.length.toLocaleString()} of ${data.stagedDiff.originalLength.toLocaleString()} chars. Analysis may be incomplete.`
    : "";

  const unstagedTruncWarning = data.unstagedDiff.truncated
    ? `⚠ Unstaged diff truncated at ${data.unstagedDiff.content.length.toLocaleString()} of ${data.unstagedDiff.originalLength.toLocaleString()} chars. Analysis may be incomplete.`
    : "";

  const untrackedLines = data.statusShort
    .split("\n")
    .filter((l) => l.startsWith("??"))
    .join("\n");

  const prompt = `Analyze the following Git state and generate a commit plan.

PROJECT: ${data.projectName} (${data.projectType})
BRANCH: ${data.branch}

=== git status --short ===
${data.statusShort || "(clean)"}

=== STAGED — git diff --cached --stat ===
${data.stagedStat || "(nothing staged)"}

=== UNSTAGED — git diff --stat ===
${data.unstagedStat || "(nothing unstaged)"}

=== STAGED — git diff --cached --name-status ===
${data.stagedNameStatus || "(nothing staged)"}

=== UNSTAGED — git diff --name-status ===
${data.unstagedNameStatus || "(nothing unstaged)"}
${untrackedLines ? `\n=== UNTRACKED FILES ===\n${untrackedLines}` : ""}

=== STAGED DIFF ===
${stagedTruncWarning ? stagedTruncWarning + "\n" : ""}${data.stagedDiff.content || "(nothing staged)"}

=== UNSTAGED DIFF ===
${unstagedTruncWarning ? unstagedTruncWarning + "\n" : ""}${data.unstagedDiff.content || "(nothing unstaged)"}

---

Generate your response using EXACTLY this Markdown structure. Do not add or remove top-level sections.

# Commit Plan

## Project
- Name: ${data.projectName}
- Type: ${data.projectType}
- Branch: \`${data.branch}\`

## Diff Review
[Summarize what changed. Key files, patterns, and purpose. Note if staged/unstaged mix is confusing or if untracked files need attention.]

## Recommended Strategy
- [One commit / Multiple commits]
- Reason: [brief justification based on the actual diff]

## Suggested Commit Groups

### Commit 1

Files:
- [exact file paths to stage for this commit]

Message:

\`\`\`
<type>(<scope>): <summary under 72 chars>

Context:
- <why this change exists and what workflow/module it belongs to>

Changes:
- <concrete change 1>
- <concrete change 2>

Pending:
- <what remains unfinished, or "None.">

Worklog:
- Module: <stable module name>
- Project area: frontend | backend | fullstack | tooling | docs
- Status: completed | in-progress | blocked
- Next: <next concrete action, or "None">
\`\`\`

[Add Commit 2, Commit 3... only if there are genuinely separate logical units]

## Risks / Warnings
- [Specific warnings about risky files, secrets, debug code, incomplete flows, accidental changes. Write "None." if clean.]

## Suggested Exclusions
- [Files that should NOT be committed in this round. Write "None." if everything should go.]`;

  return { system: COMMIT_PLAN_SYSTEM, prompt };
}
