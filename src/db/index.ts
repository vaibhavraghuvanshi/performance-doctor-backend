import postgres, { type Sql } from "postgres";

let sql: Sql | undefined;

export function getSql(): Sql {
  if (!sql) {
    const connectionString = process.env.DATABASE_URL?.trim();
    if (!connectionString) {
      throw new Error("DATABASE_URL is required");
    }
    sql = postgres(connectionString, {
      max: 10,
      idle_timeout: 20,
      connect_timeout: 10,
    });
  }
  return sql;
}

export async function initializeDatabase(): Promise<void> {
  await getSql().unsafe(`
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      display_name TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS history (
      id UUID PRIMARY KEY,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      title TEXT NOT NULL,
      platform TEXT NOT NULL,
      code TEXT NOT NULL,
      result JSONB NOT NULL
    );

    CREATE INDEX IF NOT EXISTS history_user_created_idx
      ON history (user_id, created_at DESC);
  `);
}

export async function checkDatabase(): Promise<void> {
  await getSql()`SELECT 1`;
}

export async function closeDatabase(): Promise<void> {
  if (!sql) return;
  const current = sql;
  sql = undefined;
  await current.end({ timeout: 5 });
}
