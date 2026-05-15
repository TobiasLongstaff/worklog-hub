import type { Database } from "bun:sqlite";

type Row = { key: string; value: string };

export class SettingsRepository {
  constructor(private readonly db: Database) {}

  get(key: string): string | null {
    const row = this.db
      .prepare("SELECT value FROM integration_settings WHERE key = ?")
      .get(key) as { value: string } | null;
    return row?.value ?? null;
  }

  set(key: string, value: string): void {
    this.db
      .prepare(
        "INSERT OR REPLACE INTO integration_settings (key, value, updated_at) VALUES (?, ?, ?)"
      )
      .run(key, value, new Date().toISOString());
  }

  delete(key: string): void {
    this.db
      .prepare("DELETE FROM integration_settings WHERE key = ?")
      .run(key);
  }

  getAll(): Record<string, string> {
    const rows = this.db
      .prepare("SELECT key, value FROM integration_settings")
      .all() as Row[];
    return Object.fromEntries(rows.map((r) => [r.key, r.value]));
  }
}
