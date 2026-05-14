import type { Database } from "bun:sqlite";
import type {
  AgentTask,
  AgentTaskAgent,
  AgentTaskStatus,
  BacklogPromptTargetRepo,
} from "../domain/types.ts";

type Row = Record<string, unknown>;

function rowToTask(row: Row): AgentTask {
  return {
    id: row["id"] as string,
    backlogItemId: row["backlog_item_id"] as string,
    backlogPromptId: row["backlog_prompt_id"] as string,
    agent: row["agent"] as AgentTaskAgent,
    targetRepo: row["target_repo"] as BacklogPromptTargetRepo,
    promptSnapshot: row["prompt_snapshot"] as string,
    promptFilePath: (row["prompt_file_path"] as string | null) ?? null,
    agentCommand: (row["agent_command"] as string | null) ?? null,
    status: row["status"] as AgentTaskStatus,
    agentSessionId: (row["agent_session_id"] as string | null) ?? null,
    executionLogPath: (row["execution_log_path"] as string | null) ?? null,
    outputSummary: (row["output_summary"] as string | null) ?? null,
    createdAt: row["created_at"] as string,
    sentAt: (row["sent_at"] as string | null) ?? null,
    startedAt: (row["started_at"] as string | null) ?? null,
    finishedAt: (row["finished_at"] as string | null) ?? null,
    updatedAt: row["updated_at"] as string,
  };
}

export class AgentTaskRepository {
  constructor(private readonly db: Database) {}

  findById(id: string): AgentTask | null {
    const row = this.db
      .prepare("SELECT * FROM agent_tasks WHERE id = ?")
      .get(id) as Row | null;
    return row ? rowToTask(row) : null;
  }

  findByItemId(backlogItemId: string): AgentTask[] {
    const rows = this.db
      .prepare(
        "SELECT * FROM agent_tasks WHERE backlog_item_id = ? ORDER BY created_at DESC"
      )
      .all(backlogItemId) as Row[];
    return rows.map(rowToTask);
  }

  create(input: {
    id: string;
    backlogItemId: string;
    backlogPromptId: string;
    agent: AgentTaskAgent;
    targetRepo: BacklogPromptTargetRepo;
    promptSnapshot: string;
    promptFilePath: string | null;
    agentCommand: string | null;
    status: AgentTaskStatus;
    createdAt: string;
    updatedAt: string;
  }): AgentTask {
    this.db
      .prepare(
        `INSERT INTO agent_tasks
           (id, backlog_item_id, backlog_prompt_id, agent, target_repo,
            prompt_snapshot, prompt_file_path, agent_command, status,
            agent_session_id, execution_log_path, output_summary,
            created_at, sent_at, started_at, finished_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, NULL, ?, NULL, NULL, NULL, ?)`
      )
      .run(
        input.id,
        input.backlogItemId,
        input.backlogPromptId,
        input.agent,
        input.targetRepo,
        input.promptSnapshot,
        input.promptFilePath ?? null,
        input.agentCommand ?? null,
        input.status,
        input.createdAt,
        input.updatedAt
      );

    return this.findById(input.id)!;
  }

  updateStatus(
    id: string,
    status: AgentTaskStatus,
    ts: {
      updatedAt: string;
      sentAt?: string;
      startedAt?: string;
      finishedAt?: string;
      outputSummary?: string;
    }
  ): AgentTask | null {
    const sets = ["status = ?", "updated_at = ?"];
    const params: (string | number | null)[] = [status, ts.updatedAt];

    if (ts.sentAt !== undefined) { sets.push("sent_at = ?"); params.push(ts.sentAt); }
    if (ts.startedAt !== undefined) { sets.push("started_at = ?"); params.push(ts.startedAt); }
    if (ts.finishedAt !== undefined) { sets.push("finished_at = ?"); params.push(ts.finishedAt); }
    if (ts.outputSummary !== undefined) { sets.push("output_summary = ?"); params.push(ts.outputSummary); }

    params.push(id);
    this.db
      .prepare(`UPDATE agent_tasks SET ${sets.join(", ")} WHERE id = ?`)
      .run(...params);

    return this.findById(id);
  }
}
