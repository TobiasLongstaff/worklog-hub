import type { Database } from "bun:sqlite";
import type { DailySummary, CreateDailySummaryInput, DailySummarySource } from "../domain/types.ts";

type Row = Record<string, unknown>;

function rowToSummary(row: Row): DailySummary {
  return {
    id: row["id"] as string,
    date: row["date"] as string,
    project: (row["project"] as string | null) ?? null,
    title: (row["title"] as string | null) ?? null,
    content: (row["content"] as string) ?? "",
    source: (row["source"] as DailySummarySource) ?? "MANUAL",
    model: (row["model"] as string | null) ?? null,
    contextSnapshotJson: (row["context_snapshot_json"] as string | null) ?? null,
    promptSnapshot: (row["prompt_snapshot"] as string | null) ?? null,
    createdAt: row["created_at"] as string,
    updatedAt: row["updated_at"] as string,
  };
}

export class DailySummaryRepository {
  constructor(private readonly db: Database) {}

  findById(id: string): DailySummary | null {
    const row = this.db
      .prepare("SELECT * FROM daily_summaries WHERE id = ?")
      .get(id) as Row | null;
    return row ? rowToSummary(row) : null;
  }

  findByDate(date: string, project?: string | null): DailySummary | null {
    const row = project
      ? (this.db
          .prepare(
            "SELECT * FROM daily_summaries WHERE date = ? AND project = ? ORDER BY created_at DESC LIMIT 1"
          )
          .get(date, project) as Row | null)
      : (this.db
          .prepare(
            "SELECT * FROM daily_summaries WHERE date = ? ORDER BY created_at DESC LIMIT 1"
          )
          .get(date) as Row | null);
    return row ? rowToSummary(row) : null;
  }

  listRecent(limit = 30): DailySummary[] {
    const rows = this.db
      .prepare("SELECT * FROM daily_summaries ORDER BY date DESC, created_at DESC LIMIT ?")
      .all(limit) as Row[];
    return rows.map(rowToSummary);
  }

  upsert(input: CreateDailySummaryInput): DailySummary {
    const now = new Date().toISOString();
    const existing = this.findByDate(input.date, input.project);

    if (existing) {
      this.db
        .prepare(
          "UPDATE daily_summaries SET title = ?, content = ?, source = ?, model = ?, context_snapshot_json = ?, prompt_snapshot = ?, updated_at = ? WHERE id = ?"
        )
        .run(
          input.title ?? null,
          input.content,
          input.source ?? "MANUAL",
          input.model ?? null,
          input.contextSnapshotJson ?? null,
          input.promptSnapshot ?? null,
          now,
          existing.id
        );
      return this.findById(existing.id)!;
    }

    const id = crypto.randomUUID();
    this.db
      .prepare(
        "INSERT INTO daily_summaries (id, date, project, title, content, source, model, context_snapshot_json, prompt_snapshot, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
      )
      .run(
        id,
        input.date,
        input.project ?? null,
        input.title ?? null,
        input.content,
        input.source ?? "MANUAL",
        input.model ?? null,
        input.contextSnapshotJson ?? null,
        input.promptSnapshot ?? null,
        now,
        now
      );
    return this.findById(id)!;
  }
}
