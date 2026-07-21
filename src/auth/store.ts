import fs from "fs";
import path from "path";
import type { AuthStore } from "./types";

const DEFAULT_STORE: AuthStore = { users: [], history: [] };

function storePath(): string {
  const override = process.env.AUTH_STORE_PATH?.trim();
  if (override) return path.resolve(override);
  return path.join(process.cwd(), "data", "auth-store.json");
}

function ensureDir(filePath: string): void {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export function readStore(): AuthStore {
  const p = storePath();
  try {
    if (!fs.existsSync(p)) return structuredClone(DEFAULT_STORE);
    const raw = fs.readFileSync(p, "utf8");
    const parsed = JSON.parse(raw) as Partial<AuthStore>;
    return {
      users: Array.isArray(parsed.users) ? parsed.users : [],
      history: Array.isArray(parsed.history) ? parsed.history : [],
    };
  } catch {
    return structuredClone(DEFAULT_STORE);
  }
}

export function writeStore(store: AuthStore): void {
  const p = storePath();
  ensureDir(p);
  const tmp = `${p}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(store, null, 2), "utf8");
  fs.renameSync(tmp, p);
}
