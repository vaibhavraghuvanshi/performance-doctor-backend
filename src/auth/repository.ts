import { getSql } from "../db";
import type { AnalysisResult } from "../types/analysis";
import type { HistoryEntry, StoredUser } from "./types";

export interface NewUser {
  id: string;
  email: string;
  passwordHash: string;
  displayName: string;
  createdAt: string;
}

export interface NewHistoryEntry {
  id: string;
  userId: string;
  createdAt: string;
  title: string;
  platform: string;
  code: string;
  result: AnalysisResult;
}

export interface AuthRepository {
  createUser(user: NewUser): Promise<StoredUser | null>;
  findUserByEmail(email: string): Promise<StoredUser | null>;
  findUserById(id: string): Promise<StoredUser | null>;
  listHistory(userId: string): Promise<HistoryEntry[]>;
  findHistory(userId: string, id: string): Promise<HistoryEntry | null>;
  createHistory(entry: NewHistoryEntry, maxPerUser: number): Promise<void>;
  deleteHistory(userId: string, id: string): Promise<boolean>;
}

interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  display_name: string;
  created_at: Date | string;
}

interface HistoryRow {
  id: string;
  user_id: string;
  created_at: Date | string;
  title: string;
  platform: string;
  code: string;
  result: AnalysisResult;
}

function iso(value: Date | string): string {
  return value instanceof Date
    ? value.toISOString()
    : new Date(value).toISOString();
}

function mapUser(row: UserRow): StoredUser {
  return {
    id: row.id,
    email: row.email,
    passwordHash: row.password_hash,
    displayName: row.display_name,
    createdAt: iso(row.created_at),
  };
}

function mapHistory(row: HistoryRow): HistoryEntry {
  return {
    id: row.id,
    userId: row.user_id,
    createdAt: iso(row.created_at),
    title: row.title,
    platform: row.platform,
    code: row.code,
    result: row.result,
  };
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "23505"
  );
}

export class PostgresAuthRepository implements AuthRepository {
  async createUser(user: NewUser): Promise<StoredUser | null> {
    const sql = getSql();
    try {
      const [row] = await sql<UserRow[]>`
        INSERT INTO users (id, email, password_hash, display_name, created_at)
        VALUES (
          ${user.id},
          ${user.email},
          ${user.passwordHash},
          ${user.displayName},
          ${user.createdAt}
        )
        RETURNING *
      `;
      return mapUser(row);
    } catch (error) {
      if (isUniqueViolation(error)) return null;
      throw error;
    }
  }

  async findUserByEmail(email: string): Promise<StoredUser | null> {
    const sql = getSql();
    const [row] = await sql<UserRow[]>`
      SELECT * FROM users WHERE email = ${email}
    `;
    return row ? mapUser(row) : null;
  }

  async findUserById(id: string): Promise<StoredUser | null> {
    const sql = getSql();
    const [row] = await sql<UserRow[]>`
      SELECT * FROM users WHERE id = ${id}
    `;
    return row ? mapUser(row) : null;
  }

  async listHistory(userId: string): Promise<HistoryEntry[]> {
    const sql = getSql();
    const rows = await sql<HistoryRow[]>`
      SELECT * FROM history
      WHERE user_id = ${userId}
      ORDER BY created_at DESC
    `;
    return rows.map(mapHistory);
  }

  async findHistory(userId: string, id: string): Promise<HistoryEntry | null> {
    const sql = getSql();
    const [row] = await sql<HistoryRow[]>`
      SELECT * FROM history
      WHERE user_id = ${userId} AND id = ${id}
    `;
    return row ? mapHistory(row) : null;
  }

  async createHistory(entry: NewHistoryEntry, maxPerUser: number): Promise<void> {
    const sql = getSql();
    await sql.begin(async (transaction) => {
      await transaction`
        SELECT id FROM users WHERE id = ${entry.userId} FOR UPDATE
      `;
      await transaction`
        INSERT INTO history (
          id, user_id, created_at, title, platform, code, result
        )
        VALUES (
          ${entry.id},
          ${entry.userId},
          ${entry.createdAt},
          ${entry.title},
          ${entry.platform},
          ${entry.code},
          ${transaction.json(entry.result as never)}
        )
      `;
      await transaction`
        DELETE FROM history
        WHERE id IN (
          SELECT id FROM history
          WHERE user_id = ${entry.userId}
          ORDER BY created_at DESC
          OFFSET ${maxPerUser}
        )
      `;
    });
  }

  async deleteHistory(userId: string, id: string): Promise<boolean> {
    const result = await getSql()`
      DELETE FROM history WHERE user_id = ${userId} AND id = ${id}
    `;
    return result.count === 1;
  }
}
