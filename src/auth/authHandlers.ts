import { randomUUID } from "crypto";
import type { Request, Response, NextFunction } from "express";
import type { AnalysisResult } from "../types/analysis";
import { hashPassword, verifyPassword } from "./password";
import { readStore, writeStore } from "./store";
import { signToken } from "./jwt";
import type { AuthedRequest } from "./middleware";
import type { PublicUser } from "./types";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_CODE_LEN = 400_000;
const MAX_HISTORY_PER_USER = 200;

function normalizeEmail(email: unknown): string | null {
  if (typeof email !== "string") return null;
  const e = email.trim().toLowerCase();
  if (!EMAIL_RE.test(e)) return null;
  return e;
}

function toPublicUser(u: { id: string; email: string; displayName: string; createdAt: string }): PublicUser {
  return {
    id: u.id,
    email: u.email,
    displayName: u.displayName,
    createdAt: u.createdAt,
  };
}

export async function postRegister(req: Request, res: Response, next: NextFunction) {
  try {
    const body = req.body as Record<string, unknown>;
    const email = normalizeEmail(body.email);
    const password = typeof body.password === "string" ? body.password : "";
    const displayNameRaw =
      typeof body.displayName === "string" ? body.displayName.trim() : "";

    if (!email) {
      return res.status(400).json({ error: "Valid email is required" });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: "Password must be at least 8 characters" });
    }

    const store = readStore();
    if (store.users.some((u) => u.email === email)) {
      return res.status(409).json({ error: "An account with this email already exists" });
    }

    const id = randomUUID();
    const displayName = displayNameRaw.slice(0, 80) || email.split("@")[0] || "User";
    const createdAt = new Date().toISOString();
    const passwordHash = await hashPassword(password);

    store.users.push({
      id,
      email,
      passwordHash,
      displayName,
      createdAt,
    });
    writeStore(store);

    const user = toPublicUser({ id, email, displayName, createdAt });
    const token = signToken(id, email);
    res.status(201).json({ token, user });
  } catch (e) {
    next(e);
  }
}

export async function postLogin(req: Request, res: Response, next: NextFunction) {
  try {
    const body = req.body as Record<string, unknown>;
    const email = normalizeEmail(body.email);
    const password = typeof body.password === "string" ? body.password : "";

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    const store = readStore();
    const user = store.users.find((u) => u.email === email);
    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const token = signToken(user.id, user.email);
    res.json({
      token,
      user: toPublicUser(user),
    });
  } catch (e) {
    next(e);
  }
}

export function getMe(req: AuthedRequest, res: Response) {
  const store = readStore();
  const user = store.users.find((u) => u.id === req.userId);
  if (!user) {
    return res.status(401).json({ error: "User no longer exists" });
  }
  res.json({ user: toPublicUser(user) });
}

function isAnalysisResult(x: unknown): x is AnalysisResult {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  return (
    typeof o.overallScore === "number" &&
    typeof o.optimizedScore === "number" &&
    Array.isArray(o.issues) &&
    o.metrics !== null &&
    typeof o.metrics === "object" &&
    typeof o.optimizedCode === "string" &&
    (o.topBottleneck === null || typeof o.topBottleneck === "string") &&
    typeof o.analyzedAt === "string"
  );
}

export function getHistoryList(req: AuthedRequest, res: Response) {
  const store = readStore();
  const uid = req.userId!;
  const mine = store.history
    .filter((h) => h.userId === uid)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    .map((h) => ({
      id: h.id,
      createdAt: h.createdAt,
      title: h.title,
      platform: h.platform,
      overallScore: h.result.overallScore,
      optimizedScore: h.result.optimizedScore,
      issueCount: h.result.issues.length,
      topBottleneck: h.result.topBottleneck,
      analyzedAt: h.result.analyzedAt,
    }));
  res.json({ items: mine });
}

export function getHistoryOne(req: AuthedRequest, res: Response) {
  const store = readStore();
  const uid = req.userId!;
  const id = req.params.id;
  if (!id) return res.status(400).json({ error: "Missing id" });
  const row = store.history.find((h) => h.id === id && h.userId === uid);
  if (!row) return res.status(404).json({ error: "History entry not found" });
  res.json(row);
}

export function postHistory(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const body = req.body as Record<string, unknown>;
    const code = typeof body.code === "string" ? body.code : "";
    const platform = typeof body.platform === "string" ? body.platform.trim() || "both" : "both";
    const result = body.result;
    const titleRaw = typeof body.title === "string" ? body.title.trim() : "";

    if (!code.trim()) {
      return res.status(400).json({ error: "code is required" });
    }
    if (code.length > MAX_CODE_LEN) {
      return res.status(400).json({ error: "code exceeds maximum length" });
    }
    if (!isAnalysisResult(result)) {
      return res.status(400).json({ error: "result must be a full analysis object" });
    }

    const store = readStore();
    const uid = req.userId!;
    const mine = store.history.filter((h) => h.userId === uid);
    if (mine.length >= MAX_HISTORY_PER_USER) {
      const oldest = mine.sort((a, b) => (a.createdAt > b.createdAt ? 1 : -1))[0];
      store.history = store.history.filter((h) => h.id !== oldest.id);
    }

    const id = randomUUID();
    const createdAt = new Date().toISOString();
    const title =
      titleRaw.slice(0, 120) ||
      `Analysis · ${result.overallScore}/100 · ${new Date(result.analyzedAt).toLocaleString()}`;

    store.history.push({
      id,
      userId: uid,
      createdAt,
      title,
      platform,
      code,
      result,
    });
    writeStore(store);
    res.status(201).json({ id });
  } catch (e) {
    next(e);
  }
}

export function deleteHistory(req: AuthedRequest, res: Response) {
  const store = readStore();
  const uid = req.userId!;
  const id = req.params.id;
  if (!id) return res.status(400).json({ error: "Missing id" });
  const before = store.history.length;
  store.history = store.history.filter((h) => !(h.id === id && h.userId === uid));
  if (store.history.length === before) {
    return res.status(404).json({ error: "History entry not found" });
  }
  writeStore(store);
  res.status(204).end();
}
