import type { Database } from "bun:sqlite";
import type { DailySummaryRepository } from "../repository/daily-summary-repository.ts";
import type { DailySummary, CreateDailySummaryInput } from "../domain/types.ts";

export interface DailyContextItem {
  id: string;
  title: string;
  type: string;
  status: string;
  module: string | null;
  project: string | null;
}

export interface DailyContext {
  date: string;
  project: string | null;
  createdItems: DailyContextItem[];
  acceptedItems: DailyContextItem[];
  verifiedItems: DailyContextItem[];
  discardedItems: DailyContextItem[];
  detectedTotal: number;
  promptsGenerated: number;
  agentTasksCreated: number;
  agentTasksCompleted: number;
}

type Row = Record<string, unknown>;

function toCtxItem(r: Row): DailyContextItem {
  return {
    id: r["id"] as string,
    title: r["title"] as string,
    type: r["type"] as string,
    status: r["status"] as string,
    module: (r["module"] as string | null) ?? null,
    project: (r["project"] as string | null) ?? null,
  };
}

export class DailySummaryService {
  constructor(
    private readonly repo: DailySummaryRepository,
    private readonly db: Database
  ) {}

  getSummary(date: string, project?: string | null): DailySummary | null {
    return this.repo.findByDate(date, project);
  }

  listRecent(limit = 30): DailySummary[] {
    return this.repo.listRecent(limit);
  }

  saveSummary(input: CreateDailySummaryInput): DailySummary {
    return this.repo.upsert(input);
  }

  getContextForDate(date: string, project?: string | null): DailyContext {
    const projectParams = project ? [date, project] : [date];
    const projectClause = project ? " AND project = ?" : "";

    const createdRows = this.db
      .prepare(
        `SELECT id, title, type, status, module, project FROM backlog_items WHERE date(created_at) = ?${projectClause} ORDER BY created_at ASC`
      )
      .all(...projectParams) as Row[];

    const acceptedRows = this.db
      .prepare(
        `SELECT id, title, type, status, module, project FROM backlog_items WHERE date(accepted_at) = ?${projectClause}`
      )
      .all(...projectParams) as Row[];

    const verifiedRows = this.db
      .prepare(
        `SELECT id, title, type, status, module, project FROM backlog_items WHERE date(verified_at) = ?${projectClause}`
      )
      .all(...projectParams) as Row[];

    const discardedRows = this.db
      .prepare(
        `SELECT id, title, type, status, module, project FROM backlog_items WHERE date(discarded_at) = ?${projectClause}`
      )
      .all(...projectParams) as Row[];

    const promptsCount = (
      this.db
        .prepare("SELECT COUNT(*) as n FROM backlog_prompts WHERE date(created_at) = ?")
        .get(date) as { n: number }
    ).n;

    const tasksCreated = (
      this.db
        .prepare("SELECT COUNT(*) as n FROM agent_tasks WHERE date(created_at) = ?")
        .get(date) as { n: number }
    ).n;

    const tasksCompleted = (
      this.db
        .prepare(
          "SELECT COUNT(*) as n FROM agent_tasks WHERE date(finished_at) = ? AND status = 'COMPLETED'"
        )
        .get(date) as { n: number }
    ).n;

    const detectedTotal = (
      this.db
        .prepare("SELECT COUNT(*) as n FROM backlog_items WHERE status = 'DETECTED'")
        .get() as { n: number }
    ).n;

    return {
      date,
      project: project ?? null,
      createdItems: createdRows.map(toCtxItem),
      acceptedItems: acceptedRows.map(toCtxItem),
      verifiedItems: verifiedRows.map(toCtxItem),
      discardedItems: discardedRows.map(toCtxItem),
      detectedTotal,
      promptsGenerated: promptsCount,
      agentTasksCreated: tasksCreated,
      agentTasksCompleted: tasksCompleted,
    };
  }
}
