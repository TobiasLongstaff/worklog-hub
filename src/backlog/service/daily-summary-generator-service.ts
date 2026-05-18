import type { Database } from "bun:sqlite";
import { loadConfig } from "../../config/load-config.ts";
import { loadEnv } from "../../config/env.ts";
import { createAIClient } from "../../ai/ai-client.ts";
import { collectAllGitData } from "../../collectors/git-collector.ts";
import { collectClaudeCodeSessions } from "../../collectors/claude-code-collector.ts";
import { collectOpenCodeSessions } from "../../collectors/opencode-collector.ts";
import type { DailySummaryRepository } from "../repository/daily-summary-repository.ts";
import type { SettingsRepository } from "../repository/settings-repository.ts";
import type { DailySummary } from "../domain/types.ts";
import type { AgentSession } from "../../collectors/claude-code-collector.ts";
import type { GitProjectData } from "../../collectors/git-collector.ts";

type Row = Record<string, unknown>;

// ── Types ─────────────────────────────────────────────────────────────────────

export interface GenerationCtxItem {
  id: string;
  title: string;
  type: string;
  status: string;
  module: string | null;
}

export interface GenerationCtxAgentTask {
  id: string;
  agent: string;
  status: string;
  backlogItemTitle: string | null;
  outputSummary: string | null;
  createdAt: string;
  finishedAt: string | null;
}

export interface GenerationCtxPrompt {
  id: string;
  title: string;
  promptType: string;
  targetRepo: string;
  backlogItemTitle: string | null;
}

export interface PreviousSummaryEntry {
  date: string;
  title: string | null;
  content: string;
}

export interface BacklogChange {
  date: string;
  title: string;
  type: string;
  status: string;
  module: string | null;
  changeType: string;
}

export interface ActivityWindow {
  from: string;
  to: string;
  activeDates: string[];
}

export interface GenerationContext {
  generatedForDate: string;
  project: string | null;
  activityWindow: ActivityWindow;
  // Prioridad 1 — sesiones de agentes
  openCodeSessions: AgentSession[];
  claudeCodeSessions: AgentSession[];
  // Prioridad 2 — tareas y prompts
  agentTasks: GenerationCtxAgentTask[];
  recentPrompts: GenerationCtxPrompt[];
  // Prioridad 3 — backlog
  unresolvedItems: GenerationCtxItem[];
  backlogChanges: BacklogChange[];
  detectedTotal: number;
  // Prioridad 4 — git (evidencia complementaria)
  gitActivity: GitProjectData[];
  // Continuidad
  previousSummaries: PreviousSummaryEntry[];
}

// ── Helpers de formato ────────────────────────────────────────────────────────

function toCtxItem(r: Row): GenerationCtxItem {
  return {
    id: r["id"] as string,
    title: r["title"] as string,
    type: r["type"] as string,
    status: r["status"] as string,
    module: r["module"] ? String(r["module"]) : null,
  };
}

function extractTitle(content: string): string | null {
  const match = content.match(/^#\s+(.+)$/m);
  return match?.[1]?.trim() ?? null;
}

function fmtSessions(sessions: AgentSession[], currentDate: string): string {
  if (sessions.length === 0) return "  (sin actividad registrada en los últimos días)";

  const byDate = new Map<string, AgentSession[]>();
  for (const s of sessions) {
    if (!byDate.has(s.date)) byDate.set(s.date, []);
    byDate.get(s.date)!.push(s);
  }

  return [...byDate.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([d, daySessions]) => {
      const dayLabel = d === currentDate ? `Hoy (${d})` : d;
      const msgsPerSession = d === currentDate ? 8 : 5;
      const lines = daySessions.flatMap((s) => {
        const msgs = s.messages
          .slice(0, msgsPerSession)
          .map((m) => `      [${m.role.toUpperCase()}]: ${m.content.slice(0, 350)}`);
        return [`    Sesión (${s.projectDir}):`, ...msgs];
      });
      return `  ${dayLabel}:\n${lines.join("\n")}`;
    })
    .join("\n\n");
}

function fmtAgentTasks(tasks: GenerationCtxAgentTask[]): string {
  if (tasks.length === 0) return "  (ninguna tarea registrada recientemente)";
  return tasks
    .map(
      (t) =>
        `  - [${t.agent}] ${t.backlogItemTitle ?? t.id.slice(0, 8)} → ${t.status}` +
        (t.outputSummary ? `\n    Resultado: ${t.outputSummary.slice(0, 250)}` : "")
    )
    .join("\n");
}

function fmtPrompts(prompts: GenerationCtxPrompt[]): string {
  if (prompts.length === 0) return "  (ninguno)";
  return prompts
    .map(
      (p) =>
        `  - "${p.title}" (${p.promptType}, ${p.targetRepo}${p.backlogItemTitle ? `, item: ${p.backlogItemTitle}` : ""})`
    )
    .join("\n");
}

function fmtUnresolved(items: GenerationCtxItem[]): string {
  if (items.length === 0) return "  (ningún ítem pendiente de validación o en agente)";
  return items
    .map(
      (it) =>
        `  - [${it.status}] ${it.title} (${it.type}${it.module ? `, ${it.module}` : ""})`
    )
    .join("\n");
}

function fmtBacklogChanges(changes: BacklogChange[]): string {
  if (changes.length === 0) return "  (sin cambios de estado en el período)";
  return changes
    .map(
      (c) =>
        `  - [${c.date}] ${c.changeType}: ${c.title} → ${c.status}` +
        (c.type !== "BUG" || c.module ? ` (${c.type}${c.module ? `, ${c.module}` : ""})` : "")
    )
    .join("\n");
}

function fmtGit(activity: GitProjectData[]): string {
  if (activity.length === 0) return "  (sin repositorios configurados o sin actividad)";
  return activity
    .map((g) => {
      if (!g.isGitRepo) return `  ${g.name}: no es un repositorio git`;
      const commits = g.recentCommits
        ? `\n    Commits recientes:\n${g.recentCommits
            .split("\n")
            .slice(0, 10)
            .map((l) => `      ${l}`)
            .join("\n")}`
        : "";
      return `  ${g.name} (${g.branch ?? "?"}):${commits}`;
    })
    .join("\n");
}

function fmtPreviousSummaries(summaries: PreviousSummaryEntry[]): string {
  if (summaries.length === 0) return "  (sin resúmenes anteriores registrados)";
  return summaries
    .map((s) => {
      const label = s.title ?? `Resumen del ${s.date}`;
      const body =
        s.content.length > 1000 ? s.content.slice(0, 1000) + "\n  [... truncado]" : s.content;
      return `### ${s.date} — ${label}\n${body}`;
    })
    .join("\n\n---\n\n");
}

// ── Prompt builder ────────────────────────────────────────────────────────────

function buildResumeBrief(ctx: GenerationContext): { system: string; userPrompt: string } {
  const { activityWindow, generatedForDate } = ctx;

  const hasActivity = activityWindow.activeDates.length > 0;
  const lastActiveDate = hasActivity ? activityWindow.to : null;

  const windowInfo = !hasActivity
    ? `No se encontró actividad registrada en los últimos 14 días.`
    : activityWindow.from === activityWindow.to
    ? `Actividad encontrada únicamente el ${activityWindow.from}.`
    : `Días activos en el período analizado: ${activityWindow.activeDates.join(", ")}.` +
      (lastActiveDate && lastActiveDate < generatedForDate
        ? ` La última actividad registrada fue el ${lastActiveDate}. Hoy (${generatedForDate}) todavía no hay actividad registrada.`
        : "");

  const system = `Sos un asistente de continuidad de trabajo para un desarrollador de software.

Tu tarea es generar un **Brief de continuidad** que ayude al desarrollador a retomar trabajo después de una pausa — puede ser un fin de semana, un feriado, días de descanso, o simplemente varias horas.

## Tu objetivo
Que el desarrollador pueda responder inmediatamente:
1. ¿En qué venía trabajando?
2. ¿Qué avanzó concretamente?
3. ¿Qué hicieron OpenCode y Claude Code?
4. ¿Qué quedó abierto o sin validar?
5. ¿Qué conviene hacer ahora?

## Jerarquía de fuentes
1. **Sesiones de OpenCode** — mayor prioridad. Reflejan el trabajo real ejecutado.
2. **Sesiones de Claude Code** — prioridad alta. Decisiones, análisis y desarrollo.
3. **Tareas y prompts de Worklog Hub** — prioridad media. Registro de lo que se delegó a agentes.
4. **Backlog** — prioridad media. Estado de pendientes, qué avanzó, qué quedó abierto.
5. **Commits de Git** — evidencia complementaria. Confirman implementación pero no explican el "por qué".

## Reglas obligatorias
- NO centres el texto en la ausencia de actividad del día actual. Si hoy no hubo trabajo, usá la actividad de los últimos días activos.
- Si pasaron días sin trabajar (fin de semana, feriado), mencionalo en UNA sola línea de contexto y avanzá a lo sustancial.
- Si un agente trabajó algo pero no hay validación manual del desarrollador, NO lo presentes como "resuelto". Decí "trabajado por el agente / pendiente de verificación".
- Diferenciá explícitamente: discutido, ejecutado por agente, implementado, validado por el desarrollador.
- Basate solo en evidencia del contexto. No inventes avances ni conclusiones.
- Terminá siempre con recomendaciones concretas y priorizadas de qué hacer ahora.
- Escribí en español claro, profesional y directo.
- Usá **negrita** para nombres de funcionalidades, módulos, cantidades clave y decisiones importantes.
- Si no hay suficiente evidencia para construir un brief útil, decilo en 2-3 líneas honestas. No rellenes con texto genérico sobre inactividad.

## Formato de salida
# Resumen para retomar

## En qué venías trabajando
...

## Avances recientes más importantes
...

## Trabajo reciente con agentes
### OpenCode
...

### Claude Code
...

## Pendientes y validaciones abiertas
...

## Qué conviene hacer ahora
1. ...
2. ...
3. ...

## Riesgos o cosas a no perder de vista
...

## Estado general
...`;

  const userPrompt = `Generá el brief de continuidad. Hoy es ${generatedForDate}${ctx.project ? ` (proyecto: ${ctx.project})` : ""}.

${windowInfo}

---

## FUENTE PRINCIPAL — SESIONES DE AGENTES

### OPENCODE (últimos días activos)
${fmtSessions(ctx.openCodeSessions, generatedForDate)}

### CLAUDE CODE (últimos días activos)
${fmtSessions(ctx.claudeCodeSessions, generatedForDate)}

---

## TAREAS DE AGENTES EN WORKLOG HUB
${fmtAgentTasks(ctx.agentTasks)}

### Prompts generados recientemente
${fmtPrompts(ctx.recentPrompts)}

---

## ESTADO DEL BACKLOG

### Pendientes en curso o sin validar (estado actual)
${fmtUnresolved(ctx.unresolvedItems)}

### Cambios de estado recientes
${fmtBacklogChanges(ctx.backlogChanges)}

### Inbox total sin revisar: ${ctx.detectedTotal}

---

## EVIDENCIA COMPLEMENTARIA — GIT
${fmtGit(ctx.gitActivity)}

---

## CONTINUIDAD — ÚLTIMOS RESÚMENES GENERADOS
${fmtPreviousSummaries(ctx.previousSummaries)}`;

  return { system, userPrompt };
}

// ── Service ───────────────────────────────────────────────────────────────────

export class DailySummaryGeneratorService {
  constructor(
    private readonly repo: DailySummaryRepository,
    private readonly db: Database,
    private readonly hubRoot: string,
    private readonly settingsRepo: SettingsRepository
  ) {}

  async generate(date: string, project?: string): Promise<DailySummary> {
    const { client, model, provider } = this.resolveAIClient();
    const context = await this.buildContext(date, project);
    const { system, userPrompt } = buildResumeBrief(context);
    const rawContent = await client.generateText({ system, prompt: userPrompt });
    const title = extractTitle(rawContent) ?? `Resumen para retomar — ${date}`;

    return this.repo.upsert({
      date,
      content: rawContent,
      title,
      project: project ?? null,
      source: provider === "anthropic" ? "ANTHROPIC_API" : "OPENAI_API",
      model,
      contextSnapshotJson: JSON.stringify(context),
      promptSnapshot: userPrompt,
    });
  }

  private resolveAIClient() {
    const settingsProvider = this.settingsRepo.get("ai_provider");
    const envConfig = loadEnv();
    const provider = settingsProvider ?? envConfig.aiProvider;

    if (!provider) {
      throw new Error(
        "API_KEY_MISSING: No hay proveedor de IA configurado. Configurá la API key en Ajustes → IA."
      );
    }

    let apiKey: string | null = null;
    let model: string;

    if (provider === "openai") {
      apiKey = this.settingsRepo.get("openai_api_key") ?? envConfig.openaiApiKey;
      model = this.settingsRepo.get("openai_model") ?? envConfig.openaiModel;
    } else if (provider === "anthropic") {
      apiKey = this.settingsRepo.get("anthropic_api_key") ?? envConfig.anthropicApiKey;
      model = this.settingsRepo.get("anthropic_model") ?? envConfig.anthropicModel;
    } else {
      throw new Error(
        `API_KEY_MISSING: Proveedor no soportado: "${provider}". Usá "openai" o "anthropic".`
      );
    }

    if (!apiKey) {
      throw new Error(
        "API_KEY_MISSING: API key no configurada. Configurala en Ajustes → IA."
      );
    }

    const env = {
      aiProvider: provider,
      openaiApiKey: provider === "openai" ? apiKey : null,
      openaiModel: provider === "openai" ? model! : "gpt-4o",
      anthropicApiKey: provider === "anthropic" ? apiKey : null,
      anthropicModel: provider === "anthropic" ? model! : "claude-sonnet-4-6",
    };

    const client = createAIClient(env);
    if (!client) {
      throw new Error("API_KEY_MISSING: No se pudo crear el cliente de IA.");
    }

    return { client, model: model!, provider };
  }

  private async buildContext(date: string, project?: string): Promise<GenerationContext> {
    const CALENDAR_LOOKBACK = 14;
    const MAX_ACTIVE_DAYS = 5;

    // Últimos 14 días calendario como candidatos
    const candidateDates = Array.from({ length: CALENDAR_LOOKBACK }, (_, i) => {
      const d = new Date(date);
      d.setDate(d.getDate() - i);
      return d.toISOString().slice(0, 10);
    });
    const cutoffDate = candidateDates[candidateDates.length - 1]!;

    // ── Recolectar sesiones de agentes ────────────────────────────────────────
    let allOpenCode: AgentSession[] = [];
    let allClaude: AgentSession[] = [];
    let gitActivity: GitProjectData[] = [];

    try {
      const config = loadConfig(this.hubRoot);
      const [git, claude, opencode] = await Promise.allSettled([
        collectAllGitData(config.projects, CALENDAR_LOOKBACK),
        collectClaudeCodeSessions(config),
        collectOpenCodeSessions(config),
      ]);
      if (git.status === "fulfilled") gitActivity = git.value;
      if (claude.status === "fulfilled") {
        allClaude = claude.value.filter((s) => candidateDates.includes(s.date));
      }
      if (opencode.status === "fulfilled") {
        allOpenCode = opencode.value.filter((s) => candidateDates.includes(s.date));
      }
    } catch {
      // worklog.config.json no encontrado — continúa sin datos de colectores
    }

    // ── Identificar días con actividad real ───────────────────────────────────
    const activeDateSet = new Set<string>([
      ...allOpenCode.map((s) => s.date),
      ...allClaude.map((s) => s.date),
    ]);

    const backlogActiveDates = this.db
      .prepare(
        `SELECT DISTINCT date(coalesce(verified_at, discarded_at, reopened_at, accepted_at, created_at)) as d
         FROM backlog_items
         WHERE date(coalesce(verified_at, discarded_at, reopened_at, accepted_at, created_at)) BETWEEN ? AND ?`
      )
      .all(cutoffDate, date) as { d: string }[];

    for (const row of backlogActiveDates) {
      if (row.d) activeDateSet.add(row.d);
    }

    const activeDates = [...activeDateSet]
      .filter((d) => d <= date)
      .sort((a, b) => b.localeCompare(a))
      .slice(0, MAX_ACTIVE_DAYS);

    const windowFrom = activeDates.length > 0 ? activeDates[activeDates.length - 1]! : date;
    const windowTo = activeDates.length > 0 ? activeDates[0]! : date;

    // ── Filtrar sesiones a días activos ───────────────────────────────────────
    const activeDatesList = activeDates.length > 0 ? activeDates : candidateDates;
    const openCodeSessions = allOpenCode.filter((s) => activeDatesList.includes(s.date));
    const claudeCodeSessions = allClaude.filter((s) => activeDatesList.includes(s.date));

    // ── Cambios de estado en el backlog ───────────────────────────────────────
    const backlogChangeRows = this.db
      .prepare(
        `WITH ranked AS (
           SELECT id, title, type, status, module,
             max(coalesce(verified_at, discarded_at, reopened_at, accepted_at, created_at)) AS last_change
           FROM backlog_items
           WHERE date(coalesce(verified_at, discarded_at, reopened_at, accepted_at, created_at)) BETWEEN ? AND ?
           GROUP BY id
         )
         SELECT r.id, r.title, r.type, r.status, r.module,
                date(r.last_change) AS change_date,
                CASE
                  WHEN date(b.verified_at)  = date(r.last_change) THEN 'VERIFICADO'
                  WHEN date(b.discarded_at) = date(r.last_change) THEN 'DESCARTADO'
                  WHEN date(b.reopened_at)  = date(r.last_change) THEN 'REABIERTO'
                  WHEN date(b.accepted_at)  = date(r.last_change) THEN 'ACEPTADO'
                  ELSE 'CREADO'
                END AS change_type
         FROM ranked r
         JOIN backlog_items b ON b.id = r.id
         ORDER BY r.last_change DESC
         LIMIT 25`
      )
      .all(cutoffDate, date) as Row[];

    const backlogChanges: BacklogChange[] = backlogChangeRows.map((r) => ({
      date: String(r["change_date"] ?? ""),
      title: String(r["title"] ?? ""),
      type: String(r["type"] ?? ""),
      status: String(r["status"] ?? ""),
      module: r["module"] ? String(r["module"]) : null,
      changeType: String(r["change_type"] ?? ""),
    }));

    // ── Ítems sin validar o en curso ──────────────────────────────────────────
    const unresolvedRows = this.db
      .prepare(
        `SELECT id, title, type, status, module FROM backlog_items
         WHERE status IN ('NEEDS_MANUAL_TEST', 'ASSIGNED_TO_AGENT', 'ACCEPTED',
                          'IMPLEMENTED_CLAIMED', 'IMPLEMENTED_SUSPECTED')
         ORDER BY updated_at DESC LIMIT 15`
      )
      .all() as Row[];
    const unresolvedItems = unresolvedRows.map(toCtxItem);

    const detectedTotal = (
      this.db
        .prepare("SELECT COUNT(*) as n FROM backlog_items WHERE status = 'DETECTED'")
        .get() as { n: number }
    ).n;

    // ── Tareas de agentes (últimos 14 días) ───────────────────────────────────
    const taskRows = this.db
      .prepare(
        `SELECT t.id, t.agent, t.status, t.output_summary, t.created_at, t.finished_at,
                b.title AS backlog_title
         FROM agent_tasks t
         LEFT JOIN backlog_items b ON b.id = t.backlog_item_id
         WHERE date(t.created_at) >= ? OR date(t.finished_at) >= ?
         ORDER BY t.created_at DESC LIMIT 20`
      )
      .all(cutoffDate, cutoffDate) as Row[];

    const agentTasks: GenerationCtxAgentTask[] = taskRows.map((r) => ({
      id: String(r["id"] ?? ""),
      agent: String(r["agent"] ?? ""),
      status: String(r["status"] ?? ""),
      backlogItemTitle: r["backlog_title"] ? String(r["backlog_title"]) : null,
      outputSummary: r["output_summary"] ? String(r["output_summary"]) : null,
      createdAt: String(r["created_at"] ?? ""),
      finishedAt: r["finished_at"] ? String(r["finished_at"]) : null,
    }));

    // ── Prompts generados recientemente ───────────────────────────────────────
    const promptRows = this.db
      .prepare(
        `SELECT p.id, p.title, p.prompt_type, p.target_repo, b.title AS backlog_title
         FROM backlog_prompts p
         LEFT JOIN backlog_items b ON b.id = p.backlog_item_id
         WHERE date(p.created_at) >= ?
         ORDER BY p.created_at DESC LIMIT 10`
      )
      .all(cutoffDate) as Row[];

    const recentPrompts: GenerationCtxPrompt[] = promptRows.map((r) => ({
      id: String(r["id"] ?? ""),
      title: String(r["title"] ?? ""),
      promptType: String(r["prompt_type"] ?? ""),
      targetRepo: String(r["target_repo"] ?? ""),
      backlogItemTitle: r["backlog_title"] ? String(r["backlog_title"]) : null,
    }));

    // ── Resúmenes anteriores ──────────────────────────────────────────────────
    const previousSummaries: PreviousSummaryEntry[] = this.repo
      .listRecent(20)
      .filter((s) => s.date < date)
      .slice(0, 5)
      .map((s) => ({ date: s.date, title: s.title, content: s.content }));

    return {
      generatedForDate: date,
      project: project ?? null,
      activityWindow: { from: windowFrom, to: windowTo, activeDates },
      openCodeSessions,
      claudeCodeSessions,
      agentTasks,
      recentPrompts,
      unresolvedItems,
      backlogChanges,
      detectedTotal,
      gitActivity,
      previousSummaries,
    };
  }
}
