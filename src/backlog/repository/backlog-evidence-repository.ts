import type { Database } from "bun:sqlite";
import type { AddEvidenceInput, BacklogEvidence, BacklogEvidenceType } from "../domain/types.ts";

type Row = Record<string, unknown>;

function rowToEvidence(row: Row): BacklogEvidence {
  return {
    id: row["id"] as string,
    backlogItemId: row["backlog_item_id"] as string,
    type: row["type"] as BacklogEvidenceType,
    summary: row["summary"] as string,
    rawReference: (row["raw_reference"] as string | null) ?? null,
    metadataJson: (row["metadata_json"] as string | null) ?? null,
    createdAt: row["created_at"] as string,
  };
}

export class BacklogEvidenceRepository {
  constructor(private readonly db: Database) {}

  findByItemId(backlogItemId: string): BacklogEvidence[] {
    const rows = this.db
      .prepare(
        "SELECT * FROM backlog_evidence WHERE backlog_item_id = ? ORDER BY created_at DESC"
      )
      .all(backlogItemId) as Row[];
    return rows.map(rowToEvidence);
  }

  create(input: AddEvidenceInput & { id: string; backlogItemId: string; createdAt: string }): BacklogEvidence {
    this.db
      .prepare(
        `INSERT INTO backlog_evidence (id, backlog_item_id, type, summary, raw_reference, metadata_json, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        input.id,
        input.backlogItemId,
        input.type,
        input.summary,
        input.rawReference ?? null,
        input.metadataJson ?? null,
        input.createdAt
      );

    return rowToEvidence(
      this.db.prepare("SELECT * FROM backlog_evidence WHERE id = ?").get(input.id) as Row
    );
  }
}
