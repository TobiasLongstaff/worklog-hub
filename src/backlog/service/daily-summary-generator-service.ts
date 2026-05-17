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

export interface GenerationContext {
  date: string;
  project: string | null;
  createdItems: GenerationCtxItem[];
  acceptedItems: GenerationCtxItem[];
  verifiedItems: GenerationCtxItem[];
  discardedItems: GenerationCtxItem[];
  reopenedItems: GenerationCtxItem[];
  detectedTotal: number;
  promptsGenerated: GenerationCtxPrompt[];
  agentTasks: GenerationCtxAgentTask[];
  gitActivity: GitProjectData[];
  claudeCodeSessions: AgentSession[];
  openCodeSessions: AgentSession[];
}

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

function fmtItems(items: GenerationCtxItem[]): string {
  if (items.length === 0) return "  (ninguno)";
  return items
    .map(
      (it) =>
        `  - [${it.id.slice(0, 8)}] ${it.title} (${it.type}${it.module ? `, módulo: ${it.module}` : ""})`
    )
    .join("\n");
}

function fmtSessions(sessions: AgentSession[], label: string): string {
  if (sessions.length === 0) return `${label}: (sin actividad registrada hoy)`;
  const lines = sessions.flatMap((s) => {
    const msgs = s.messages
      .slice(0, 6)
      .map((m) => `    [${m.role.toUpperCase()}]: ${m.content.slice(0, 300)}`);
    return [`  Sesión ${s.sessionId} (${s.projectDir}):`, ...msgs];
  });
  return `${label}:\n${lines.join("\n")}`;
}

function fmtGit(activity: GitProjectData[]): string {
  if (activity.length === 0) return "  (sin repositorios configurados o sin actividad)";
  return activity
    .map((g) => {
      if (!g.isGitRepo) return `  ${g.name}: no es un repositorio git`;
      const commits = g.recentCommits
        ? `\n    Commits recientes:\n${g.recentCommits
            .split("\n")
            .slice(0, 8)
            .map((l) => `      ${l}`)
            .join("\n")}`
        : "";
      return `  ${g.name} (${g.branch ?? "?"}):${commits}`;
    })
    .join("\n");
}

function buildDailySummaryPrompt(ctx: GenerationContext): {
  system: string;
  userPrompt: string;
} {
  const system = `Sos un asistente que resume el trabajo diario de un desarrollador a partir de evidencia real recopilada por Worklog Hub.

Tu tarea es generar un resumen diario útil, claro y honesto.

## Reglas
- No inventes avances ni conclusiones que no estén respaldadas por el contexto.
- Si algo fue iniciado pero no terminado, decilo claramente.
- Si una IA o agente trabajó sobre una tarea pero no hay evidencia de validación manual, no lo presentés como "resuelto"; decí que fue trabajado o implementado según el agente.
- Diferenciá claramente: lo discutido, lo implementado, lo verificado, lo pendiente.
- Si hubo poco movimiento, decilo sin rellenar con información inventada.
- Escribí en español claro, profesional y directo.
- Usá **negrita** (`**texto**`) para resaltar nombres de funcionalidades, módulos, cantidades clave y decisiones importantes dentro del texto de los bullets.

## Formato esperado
# Resumen del día

## Avances principales
...

## Trabajo realizado con agentes
- OpenCode: ...
- Claude Code: ...

## Pendientes abiertos
...

## Validaciones o pruebas pendientes
...

## Qué conviene retomar mañana
...

## Estado general del día
...`;

  const userPrompt = `Generá el resumen de trabajo del día ${ctx.date}${ctx.project ? ` (proyecto: ${ctx.project})` : ""}.

## Contexto del día

### DETECTADOS HOY (${ctx.createdItems.length} nuevo(s))
${fmtItems(ctx.createdItems)}

### ACEPTADOS (${ctx.acceptedItems.length})
${fmtItems(ctx.acceptedItems)}

### VERIFICADOS Y CERRADOS (${ctx.verifiedItems.length})
${fmtItems(ctx.verifiedItems)}

### DESCARTADOS (${ctx.discardedItems.length})
${fmtItems(ctx.discardedItems)}

### REABIERTOS (${ctx.reopenedItems.length})
${fmtItems(ctx.reopenedItems)}

### INBOX TOTAL: ${ctx.detectedTotal} pendiente(s) sin revisar

### PROMPTS GENERADOS HOY (${ctx.promptsGenerated.length})
${
  ctx.promptsGenerated.length === 0
    ? "  (ninguno)"
    : ctx.promptsGenerated
        .map(
          (p) =>
            `  - "${p.title}" (${p.promptType}, ${p.targetRepo}${p.backlogItemTitle ? `, item: ${p.backlogItemTitle}` : ""})`
        )
        .join("\n")
}

### TAREAS DE AGENTES (${ctx.agentTasks.length})
${
  ctx.agentTasks.length === 0
    ? "  (ninguna)"
    : ctx.agentTasks
        .map(
          (t) =>
            `  - [${t.agent}] ${t.backlogItemTitle ?? t.id.slice(0, 8)} → ${t.status}${t.outputSummary ? `\n    Resultado: ${t.outputSummary.slice(0, 200)}` : ""}`
        )
        .join("\n")
}

### ACTIVIDAD GIT
${fmtGit(ctx.gitActivity)}

### ${fmtSessions(ctx.claudeCodeSessions, "CLAUDE CODE")}

### ${fmtSessions(ctx.openCodeSessions, "OPENCODE")}`;

  return { system, userPrompt };
}

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
    const { system, userPrompt } = buildDailySummaryPrompt(context);
    const rawContent = await client.generateText({ system, prompt: userPrompt });
    const title = extractTitle(rawContent) ?? `Resumen del ${date}`;

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
    const pp = project ? [date, project] : [date];
    const pc = project ? " AND project = ?" : "";

    const createdItems = (
      this.db
        .prepare(
          `SELECT id, title, type, status, module FROM backlog_items WHERE date(created_at) = ?${pc} ORDER BY created_at ASC`
        )
        .all(...pp) as Row[]
    ).map(toCtxItem);

    const acceptedItems = (
      this.db
        .prepare(
          `SELECT id, title, type, status, module FROM backlog_items WHERE date(accepted_at) = ?${pc}`
        )
        .all(...pp) as Row[]
    ).map(toCtxItem);

    const verifiedItems = (
      this.db
        .prepare(
          `SELECT id, title, type, status, module FROM backlog_items WHERE date(verified_at) = ?${pc}`
        )
        .all(...pp) as Row[]
    ).map(toCtxItem);

    const discardedItems = (
      this.db
        .prepare(
          `SELECT id, title, type, status, module FROM backlog_items WHERE date(discarded_at) = ?${pc}`
        )
        .all(...pp) as Row[]
    ).map(toCtxItem);

    const reopenedItems = (
      this.db
        .prepare(
          `SELECT id, title, type, status, module FROM backlog_items WHERE date(reopened_at) = ?${pc}`
        )
        .all(...pp) as Row[]
    ).map(toCtxItem);

    const detectedTotal = (
      this.db
        .prepare("SELECT COUNT(*) as n FROM backlog_items WHERE status = 'DETECTED'")
        .get() as { n: number }
    ).n;

    const promptRows = this.db
      .prepare(
        `SELECT p.id, p.title, p.prompt_type, p.target_repo, b.title as backlog_title
         FROM backlog_prompts p
         LEFT JOIN backlog_items b ON b.id = p.backlog_item_id
         WHERE date(p.created_at) = ?
         ORDER BY p.created_at ASC`
      )
      .all(date) as Row[];

    const promptsGenerated: GenerationCtxPrompt[] = promptRows.map((r) => ({
      id: String(r["id"] ?? ""),
      title: String(r["title"] ?? ""),
      promptType: String(r["prompt_type"] ?? ""),
      targetRepo: String(r["target_repo"] ?? ""),
      backlogItemTitle: r["backlog_title"] ? String(r["backlog_title"]) : null,
    }));

    const taskRows = this.db
      .prepare(
        `SELECT t.id, t.agent, t.status, t.output_summary, t.created_at, t.finished_at, b.title as backlog_title
         FROM agent_tasks t
         LEFT JOIN backlog_items b ON b.id = t.backlog_item_id
         WHERE date(t.created_at) = ? OR date(t.finished_at) = ?
         ORDER BY t.created_at ASC`
      )
      .all(date, date) as Row[];

    const agentTasks: GenerationCtxAgentTask[] = taskRows.map((r) => ({
      id: String(r["id"] ?? ""),
      agent: String(r["agent"] ?? ""),
      status: String(r["status"] ?? ""),
      backlogItemTitle: r["backlog_title"] ? String(r["backlog_title"]) : null,
      outputSummary: r["output_summary"] ? String(r["output_summary"]) : null,
      createdAt: String(r["created_at"] ?? ""),
      finishedAt: r["finished_at"] ? String(r["finished_at"]) : null,
    }));

    let gitActivity: GitProjectData[] = [];
    let claudeCodeSessions: AgentSession[] = [];
    let openCodeSessions: AgentSession[] = [];

    try {
      const config = loadConfig(this.hubRoot);
      const [git, claude, opencode] = await Promise.allSettled([
        collectAllGitData(config.projects, 1),
        collectClaudeCodeSessions(config),
        collectOpenCodeSessions(config),
      ]);

      if (git.status === "fulfilled") gitActivity = git.value;
      if (claude.status === "fulfilled") {
        claudeCodeSessions = claude.value.filter((s) => s.date === date);
      }
      if (opencode.status === "fulfilled") {
        openCodeSessions = opencode.value.filter((s) => s.date === date);
      }
    } catch {
      // worklog.config.json not found — continue with empty collector data
    }

    return {
      date,
      project: project ?? null,
      createdItems,
      acceptedItems,
      verifiedItems,
      discardedItems,
      reopenedItems,
      detectedTotal,
      promptsGenerated,
      agentTasks,
      gitActivity,
      claudeCodeSessions,
      openCodeSessions,
    };
  }
}
