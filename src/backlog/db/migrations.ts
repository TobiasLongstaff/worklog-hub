import type { Database } from "bun:sqlite";

const SCHEMA_V1 = `
  CREATE TABLE IF NOT EXISTS backlog_items (
    id                      TEXT PRIMARY KEY,
    title                   TEXT NOT NULL,
    type                    TEXT NOT NULL,
    status                  TEXT NOT NULL,
    source                  TEXT NOT NULL,
    project                 TEXT,
    module                  TEXT,
    area                    TEXT,
    description             TEXT NOT NULL DEFAULT '',
    origin_context          TEXT NOT NULL DEFAULT '',
    why_it_matters          TEXT,
    suggested_next_step     TEXT,
    raw_excerpt             TEXT,
    duplicate_of_id         TEXT,
    related_worklog_id      TEXT,
    related_commit_id       TEXT,
    related_agent_session_id TEXT,
    confidence              INTEGER,
    accepted_at             TEXT,
    verified_at             TEXT,
    discarded_at            TEXT,
    reopened_at             TEXT,
    created_at              TEXT NOT NULL,
    updated_at              TEXT NOT NULL,
    FOREIGN KEY (duplicate_of_id) REFERENCES backlog_items(id) ON DELETE SET NULL
  );

  CREATE INDEX IF NOT EXISTS idx_bi_status     ON backlog_items(status);
  CREATE INDEX IF NOT EXISTS idx_bi_type       ON backlog_items(type);
  CREATE INDEX IF NOT EXISTS idx_bi_source     ON backlog_items(source);
  CREATE INDEX IF NOT EXISTS idx_bi_project    ON backlog_items(project);
  CREATE INDEX IF NOT EXISTS idx_bi_module     ON backlog_items(module);
  CREATE INDEX IF NOT EXISTS idx_bi_created_at ON backlog_items(created_at);

  CREATE TABLE IF NOT EXISTS backlog_evidence (
    id               TEXT PRIMARY KEY,
    backlog_item_id  TEXT NOT NULL,
    type             TEXT NOT NULL,
    summary          TEXT NOT NULL,
    raw_reference    TEXT,
    metadata_json    TEXT,
    created_at       TEXT NOT NULL,
    FOREIGN KEY (backlog_item_id) REFERENCES backlog_items(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_be_item_id ON backlog_evidence(backlog_item_id);
`;

const SCHEMA_V2 = `
  CREATE TABLE IF NOT EXISTS backlog_prompts (
    id               TEXT PRIMARY KEY,
    backlog_item_id  TEXT NOT NULL,
    target_repo      TEXT NOT NULL,
    prompt_type      TEXT NOT NULL,
    title            TEXT NOT NULL,
    content          TEXT NOT NULL,
    is_active        INTEGER NOT NULL DEFAULT 1,
    created_at       TEXT NOT NULL,
    updated_at       TEXT NOT NULL,
    FOREIGN KEY (backlog_item_id) REFERENCES backlog_items(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_bp_item_id    ON backlog_prompts(backlog_item_id);
  CREATE INDEX IF NOT EXISTS idx_bp_target     ON backlog_prompts(target_repo);
  CREATE INDEX IF NOT EXISTS idx_bp_type       ON backlog_prompts(prompt_type);
  CREATE INDEX IF NOT EXISTS idx_bp_is_active  ON backlog_prompts(is_active);

  CREATE TABLE IF NOT EXISTS agent_tasks (
    id                  TEXT PRIMARY KEY,
    backlog_item_id     TEXT NOT NULL,
    backlog_prompt_id   TEXT NOT NULL,
    agent               TEXT NOT NULL,
    target_repo         TEXT NOT NULL,
    prompt_snapshot     TEXT NOT NULL,
    prompt_file_path    TEXT,
    agent_command       TEXT,
    status              TEXT NOT NULL DEFAULT 'READY_TO_SEND',
    agent_session_id    TEXT,
    execution_log_path  TEXT,
    output_summary      TEXT,
    created_at          TEXT NOT NULL,
    sent_at             TEXT,
    started_at          TEXT,
    finished_at         TEXT,
    updated_at          TEXT NOT NULL,
    FOREIGN KEY (backlog_item_id)   REFERENCES backlog_items(id)   ON DELETE CASCADE,
    FOREIGN KEY (backlog_prompt_id) REFERENCES backlog_prompts(id) ON DELETE RESTRICT
  );

  CREATE INDEX IF NOT EXISTS idx_at_item_id   ON agent_tasks(backlog_item_id);
  CREATE INDEX IF NOT EXISTS idx_at_agent     ON agent_tasks(agent);
  CREATE INDEX IF NOT EXISTS idx_at_status    ON agent_tasks(status);
  CREATE INDEX IF NOT EXISTS idx_at_created   ON agent_tasks(created_at);
`;

const SCHEMA_V3 = `
  CREATE TABLE IF NOT EXISTS integration_settings (
    key        TEXT PRIMARY KEY,
    value      TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
`;

const SCHEMA_V4 = `
  CREATE TABLE IF NOT EXISTS daily_summaries (
    id         TEXT PRIMARY KEY,
    date       TEXT NOT NULL,
    project    TEXT,
    title      TEXT,
    content    TEXT NOT NULL DEFAULT '',
    source     TEXT NOT NULL DEFAULT 'MANUAL',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_ds_date    ON daily_summaries(date);
  CREATE INDEX IF NOT EXISTS idx_ds_project ON daily_summaries(project);
`;

const SCHEMA_V5 = `
  ALTER TABLE daily_summaries ADD COLUMN model TEXT;
  ALTER TABLE daily_summaries ADD COLUMN context_snapshot_json TEXT;
  ALTER TABLE daily_summaries ADD COLUMN prompt_snapshot TEXT;
`;

const MIGRATIONS: { version: number; sql: string }[] = [
  { version: 1, sql: SCHEMA_V1 },
  { version: 2, sql: SCHEMA_V2 },
  { version: 3, sql: SCHEMA_V3 },
  { version: 4, sql: SCHEMA_V4 },
  { version: 5, sql: SCHEMA_V5 },
];

export function runMigrations(db: Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version    INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL
    );
  `);

  const applied = db
    .prepare("SELECT version FROM schema_migrations ORDER BY version")
    .all() as { version: number }[];

  const appliedSet = new Set(applied.map((r) => r.version));

  const insert = db.prepare(
    "INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)"
  );

  for (const migration of MIGRATIONS) {
    if (appliedSet.has(migration.version)) continue;
    db.transaction(() => {
      db.exec(migration.sql);
      insert.run(migration.version, new Date().toISOString());
    })();
  }
}
