import type { Database } from "bun:sqlite";
import type {
  BacklogItem,
  BacklogItemArea,
  BacklogItemSource,
  BacklogItemStatus,
  BacklogItemType,
  BacklogStats,
  CreateBacklogItemInput,
  ListBacklogItemsFilter,
  UpdateBacklogItemInput,
} from "../domain/types.ts";

type Row = Record<string, unknown>;

function rowToItem(row: Row): BacklogItem {
  return {
    id: row["id"] as string,
    title: row["title"] as string,
    type: row["type"] as BacklogItemType,
    status: row["status"] as BacklogItemStatus,
    source: row["source"] as BacklogItemSource,
    project: (row["project"] as string | null) ?? null,
    module: (row["module"] as string | null) ?? null,
    area: (row["area"] as BacklogItemArea | null) ?? null,
    description: (row["description"] as string) ?? "",
    originContext: (row["origin_context"] as string) ?? "",
    whyItMatters: (row["why_it_matters"] as string | null) ?? null,
    suggestedNextStep: (row["suggested_next_step"] as string | null) ?? null,
    rawExcerpt: (row["raw_excerpt"] as string | null) ?? null,
    duplicateOfId: (row["duplicate_of_id"] as string | null) ?? null,
    relatedWorklogId: (row["related_worklog_id"] as string | null) ?? null,
    relatedCommitId: (row["related_commit_id"] as string | null) ?? null,
    relatedAgentSessionId: (row["related_agent_session_id"] as string | null) ?? null,
    confidence: (row["confidence"] as number | null) ?? null,
    acceptedAt: (row["accepted_at"] as string | null) ?? null,
    verifiedAt: (row["verified_at"] as string | null) ?? null,
    discardedAt: (row["discarded_at"] as string | null) ?? null,
    reopenedAt: (row["reopened_at"] as string | null) ?? null,
    createdAt: row["created_at"] as string,
    updatedAt: row["updated_at"] as string,
  };
}

export class BacklogItemRepository {
  constructor(private readonly db: Database) {}

  findById(id: string): BacklogItem | null {
    const row = this.db
      .prepare("SELECT * FROM backlog_items WHERE id = ?")
      .get(id) as Row | null;
    return row ? rowToItem(row) : null;
  }

  findAll(filter: ListBacklogItemsFilter = {}): BacklogItem[] {
    const conditions: string[] = [];
    const params: (string | number | null)[] = [];

    if (filter.status) {
      conditions.push("status = ?");
      params.push(filter.status);
    }
    if (filter.type) {
      conditions.push("type = ?");
      params.push(filter.type);
    }
    if (filter.source) {
      conditions.push("source = ?");
      params.push(filter.source);
    }
    if (filter.project) {
      conditions.push("project = ?");
      params.push(filter.project);
    }
    if (filter.module) {
      conditions.push("module LIKE ?");
      params.push(`%${filter.module}%`);
    }
    if (filter.area) {
      conditions.push("area = ?");
      params.push(filter.area);
    }
    if (filter.search) {
      conditions.push(
        "(title LIKE ? OR description LIKE ? OR origin_context LIKE ? OR module LIKE ?)"
      );
      const term = `%${filter.search}%`;
      params.push(term, term, term, term);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const limit = filter.limit ?? 200;
    const offset = filter.offset ?? 0;

    const allParams = [...params, limit, offset] as (string | number | null)[];
    const rows = this.db
      .prepare(
        `SELECT * FROM backlog_items ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`
      )
      .all(...allParams) as Row[];

    return rows.map(rowToItem);
  }

  create(
    input: CreateBacklogItemInput & { id: string; createdAt: string; updatedAt: string }
  ): BacklogItem {
    this.db
      .prepare(
        `INSERT INTO backlog_items (
          id, title, type, status, source, project, module, area,
          description, origin_context, why_it_matters, suggested_next_step, raw_excerpt,
          duplicate_of_id, related_worklog_id, related_commit_id, related_agent_session_id,
          confidence, accepted_at, verified_at, discarded_at, reopened_at,
          created_at, updated_at
        ) VALUES (
          ?, ?, ?, 'DETECTED', ?, ?, ?, ?,
          ?, ?, ?, ?, ?,
          NULL, NULL, NULL, NULL,
          NULL, NULL, NULL, NULL, NULL,
          ?, ?
        )`
      )
      .run(
        input.id,
        input.title,
        input.type,
        input.source,
        input.project ?? null,
        input.module ?? null,
        input.area ?? null,
        input.description,
        input.originContext,
        input.whyItMatters ?? null,
        input.suggestedNextStep ?? null,
        input.rawExcerpt ?? null,
        input.createdAt,
        input.updatedAt
      );

    return this.findById(input.id)!;
  }

  update(
    id: string,
    input: UpdateBacklogItemInput & { updatedAt: string }
  ): BacklogItem | null {
    const sets: string[] = ["updated_at = ?"];
    const params: (string | number | null)[] = [input.updatedAt];

    if (input.title !== undefined) { sets.push("title = ?"); params.push(input.title); }
    if (input.type !== undefined) { sets.push("type = ?"); params.push(input.type); }
    if (input.module !== undefined) { sets.push("module = ?"); params.push(input.module); }
    if (input.area !== undefined) { sets.push("area = ?"); params.push(input.area); }
    if (input.description !== undefined) { sets.push("description = ?"); params.push(input.description); }
    if (input.originContext !== undefined) { sets.push("origin_context = ?"); params.push(input.originContext); }
    if (input.whyItMatters !== undefined) { sets.push("why_it_matters = ?"); params.push(input.whyItMatters); }
    if (input.suggestedNextStep !== undefined) {
      sets.push("suggested_next_step = ?");
      params.push(input.suggestedNextStep);
    }

    params.push(id);
    this.db
      .prepare(`UPDATE backlog_items SET ${sets.join(", ")} WHERE id = ?`)
      .run(...params);

    return this.findById(id);
  }

  updateStatus(
    id: string,
    status: BacklogItemStatus,
    ts: {
      updatedAt: string;
      acceptedAt?: string;
      verifiedAt?: string;
      discardedAt?: string;
      reopenedAt?: string;
    }
  ): BacklogItem | null {
    const sets = ["status = ?", "updated_at = ?"];
    const params: (string | number | null)[] = [status, ts.updatedAt];

    if (ts.acceptedAt !== undefined) { sets.push("accepted_at = ?"); params.push(ts.acceptedAt); }
    if (ts.verifiedAt !== undefined) { sets.push("verified_at = ?"); params.push(ts.verifiedAt); }
    if (ts.discardedAt !== undefined) { sets.push("discarded_at = ?"); params.push(ts.discardedAt); }
    if (ts.reopenedAt !== undefined) { sets.push("reopened_at = ?"); params.push(ts.reopenedAt); }

    params.push(id);
    this.db
      .prepare(`UPDATE backlog_items SET ${sets.join(", ")} WHERE id = ?`)
      .run(...params);

    return this.findById(id);
  }

  getStats(): BacklogStats {
    const rows = this.db
      .prepare("SELECT status, COUNT(*) as count FROM backlog_items GROUP BY status")
      .all() as { status: string; count: number }[];

    const counts: Record<string, number> = {};
    for (const row of rows) {
      counts[row["status"] as string] = row["count"] as number;
    }

    const total = Object.values(counts).reduce((s, n) => s + n, 0);

    return {
      detected: counts["DETECTED"] ?? 0,
      accepted: counts["ACCEPTED"] ?? 0,
      assignedToAgent: counts["ASSIGNED_TO_AGENT"] ?? 0,
      implementedClaimed: counts["IMPLEMENTED_CLAIMED"] ?? 0,
      implementedSuspected: counts["IMPLEMENTED_SUSPECTED"] ?? 0,
      needsManualTest: counts["NEEDS_MANUAL_TEST"] ?? 0,
      verifiedDone: counts["VERIFIED_DONE"] ?? 0,
      discarded: counts["DISCARDED"] ?? 0,
      reopened: counts["REOPENED"] ?? 0,
      total,
    };
  }
}
