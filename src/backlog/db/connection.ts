import { Database } from "bun:sqlite";
import { join } from "path";
import { ensureDir } from "../../utils/files.ts";
import { runMigrations } from "./migrations.ts";

let _db: Database | null = null;

export function getDb(hubRoot: string): Database {
  if (_db) return _db;

  const dataDir = join(hubRoot, "data");
  ensureDir(dataDir);

  _db = new Database(join(dataDir, "worklog-hub.sqlite"));
  _db.exec("PRAGMA journal_mode = WAL;");
  _db.exec("PRAGMA foreign_keys = ON;");

  runMigrations(_db);

  return _db;
}

export function closeDb(): void {
  if (_db) {
    _db.close();
    _db = null;
  }
}
