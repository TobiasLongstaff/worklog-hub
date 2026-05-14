import type { Database } from "bun:sqlite";
import type {
  BacklogPrompt,
  BacklogPromptTargetRepo,
  BacklogPromptType,
} from "../domain/types.ts";

type Row = Record<string, unknown>;

function rowToPrompt(row: Row): BacklogPrompt {
  return {
    id: row["id"] as string,
    backlogItemId: row["backlog_item_id"] as string,
    targetRepo: row["target_repo"] as BacklogPromptTargetRepo,
    promptType: row["prompt_type"] as BacklogPromptType,
    title: row["title"] as string,
    content: row["content"] as string,
    isActive: Boolean(row["is_active"]),
    createdAt: row["created_at"] as string,
    updatedAt: row["updated_at"] as string,
  };
}

export class BacklogPromptRepository {
  constructor(private readonly db: Database) {}

  findById(id: string): BacklogPrompt | null {
    const row = this.db
      .prepare("SELECT * FROM backlog_prompts WHERE id = ?")
      .get(id) as Row | null;
    return row ? rowToPrompt(row) : null;
  }

  findByItemId(backlogItemId: string): BacklogPrompt[] {
    const rows = this.db
      .prepare(
        "SELECT * FROM backlog_prompts WHERE backlog_item_id = ? ORDER BY created_at DESC"
      )
      .all(backlogItemId) as Row[];
    return rows.map(rowToPrompt);
  }

  findActiveByItemId(backlogItemId: string): BacklogPrompt | null {
    const row = this.db
      .prepare(
        "SELECT * FROM backlog_prompts WHERE backlog_item_id = ? AND is_active = 1 ORDER BY created_at DESC LIMIT 1"
      )
      .get(backlogItemId) as Row | null;
    return row ? rowToPrompt(row) : null;
  }

  create(input: {
    id: string;
    backlogItemId: string;
    targetRepo: BacklogPromptTargetRepo;
    promptType: BacklogPromptType;
    title: string;
    content: string;
    createdAt: string;
    updatedAt: string;
  }): BacklogPrompt {
    // Deactivate previous prompts of same targetRepo + promptType
    this.db
      .prepare(
        "UPDATE backlog_prompts SET is_active = 0, updated_at = ? WHERE backlog_item_id = ? AND target_repo = ? AND prompt_type = ?"
      )
      .run(input.updatedAt, input.backlogItemId, input.targetRepo, input.promptType);

    this.db
      .prepare(
        `INSERT INTO backlog_prompts
           (id, backlog_item_id, target_repo, prompt_type, title, content, is_active, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)`
      )
      .run(
        input.id,
        input.backlogItemId,
        input.targetRepo,
        input.promptType,
        input.title,
        input.content,
        input.createdAt,
        input.updatedAt
      );

    return this.findById(input.id)!;
  }
}
