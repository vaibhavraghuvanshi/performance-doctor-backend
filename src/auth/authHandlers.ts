import { randomUUID } from "crypto";
import type { NextFunction, Request, Response } from "express";
import type { AnalysisResult } from "../types/analysis";
import { signToken } from "./jwt";
import type { AuthedRequest } from "./middleware";
import { hashPassword, verifyPassword } from "./password";
import type { AuthRepository } from "./repository";
import type { PublicUser, StoredUser } from "./types";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_CODE_LEN = 400_000;
const MAX_HISTORY_PER_USER = 200;

function normalizeEmail(email: unknown): string | null {
  if (typeof email !== "string") return null;
  const normalized = email.trim().toLowerCase();
  return EMAIL_RE.test(normalized) ? normalized : null;
}

function toPublicUser(user: StoredUser): PublicUser {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    createdAt: user.createdAt,
  };
}

function isAnalysisResult(value: unknown): value is AnalysisResult {
  if (!value || typeof value !== "object") return false;
  const result = value as Record<string, unknown>;
  const metrics = result.metrics as Record<string, unknown> | null;
  return (
    isScore(result.overallScore) &&
    isScore(result.optimizedScore) &&
    Array.isArray(result.issues) &&
    result.issues.every(isIssue) &&
    isMetrics(metrics) &&
    typeof result.optimizedCode === "string" &&
    (result.topBottleneck === null ||
      typeof result.topBottleneck === "string") &&
    typeof result.analyzedAt === "string" &&
    Number.isFinite(Date.parse(result.analyzedAt))
  );
}

function isScore(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= 0 &&
    value <= 100
  );
}

function isIssue(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const issue = value as Record<string, unknown>;
  const location = issue.location as Record<string, unknown> | null;
  return (
    typeof issue.id === "string" &&
    ["critical", "high", "medium", "low"].includes(String(issue.severity)) &&
    typeof issue.type === "string" &&
    typeof issue.title === "string" &&
    location !== null &&
    typeof location === "object" &&
    typeof location.start === "number" &&
    typeof location.end === "number" &&
    issue.impact !== null &&
    typeof issue.impact === "object"
  );
}

function isMetrics(value: Record<string, unknown> | null): boolean {
  if (!value || typeof value !== "object") return false;
  return (
    hasNumericPair(value.fps) &&
    hasStringPair(value.renderTime) &&
    hasStringPair(value.memory) &&
    hasNumericPair(value.reRenders) &&
    hasNumericPair(value.seoReadiness)
  );
}

function hasNumericPair(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const pair = value as Record<string, unknown>;
  return (
    typeof pair.current === "number" &&
    Number.isFinite(pair.current) &&
    typeof pair.optimized === "number" &&
    Number.isFinite(pair.optimized)
  );
}

function hasStringPair(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const pair = value as Record<string, unknown>;
  return (
    typeof pair.current === "string" && typeof pair.optimized === "string"
  );
}

export function createAuthHandlers(repository: AuthRepository) {
  return {
    postRegister: async (req: Request, res: Response, next: NextFunction) => {
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
          return res
            .status(400)
            .json({ error: "Password must be at least 8 characters" });
        }
        if (Buffer.byteLength(password, "utf8") > 72) {
          return res
            .status(400)
            .json({ error: "Password must not exceed 72 UTF-8 bytes" });
        }

        const id = randomUUID();
        const createdAt = new Date().toISOString();
        const user = await repository.createUser({
          id,
          email,
          passwordHash: await hashPassword(password),
          displayName:
            displayNameRaw.slice(0, 80) || email.split("@")[0] || "User",
          createdAt,
        });
        if (!user) {
          return res
            .status(409)
            .json({ error: "An account with this email already exists" });
        }

        const token = signToken(user.id, user.email);
        return res.status(201).json({ token, user: toPublicUser(user) });
      } catch (error) {
        next(error);
      }
    },

    postLogin: async (req: Request, res: Response, next: NextFunction) => {
      try {
        const body = req.body as Record<string, unknown>;
        const email = normalizeEmail(body.email);
        const password = typeof body.password === "string" ? body.password : "";
        if (!email || !password) {
          return res
            .status(400)
            .json({ error: "Email and password are required" });
        }
        if (Buffer.byteLength(password, "utf8") > 72) {
          return res
            .status(400)
            .json({ error: "Password must not exceed 72 UTF-8 bytes" });
        }

        const user = await repository.findUserByEmail(email);
        if (!user || !(await verifyPassword(password, user.passwordHash))) {
          return res.status(401).json({ error: "Invalid email or password" });
        }

        return res.json({
          token: signToken(user.id, user.email),
          user: toPublicUser(user),
        });
      } catch (error) {
        next(error);
      }
    },

    getMe: async (req: AuthedRequest, res: Response, next: NextFunction) => {
      try {
        const user = await repository.findUserById(req.userId!);
        if (!user) {
          return res.status(401).json({ error: "User no longer exists" });
        }
        return res.json({ user: toPublicUser(user) });
      } catch (error) {
        next(error);
      }
    },

    getHistoryList: async (
      req: AuthedRequest,
      res: Response,
      next: NextFunction,
    ) => {
      try {
        const history = await repository.listHistory(req.userId!);
        return res.json({
          items: history.map((entry) => ({
            id: entry.id,
            createdAt: entry.createdAt,
            title: entry.title,
            platform: entry.platform,
            overallScore: entry.result.overallScore,
            optimizedScore: entry.result.optimizedScore,
            issueCount: entry.result.issues.length,
            topBottleneck: entry.result.topBottleneck,
            analyzedAt: entry.result.analyzedAt,
          })),
        });
      } catch (error) {
        next(error);
      }
    },

    getHistoryOne: async (
      req: AuthedRequest,
      res: Response,
      next: NextFunction,
    ) => {
      try {
        const id = req.params.id;
        if (!id) return res.status(400).json({ error: "Missing id" });
        const entry = await repository.findHistory(req.userId!, id);
        if (!entry) {
          return res.status(404).json({ error: "History entry not found" });
        }
        return res.json(entry);
      } catch (error) {
        next(error);
      }
    },

    postHistory: async (
      req: AuthedRequest,
      res: Response,
      next: NextFunction,
    ) => {
      try {
        const body = req.body as Record<string, unknown>;
        const code = typeof body.code === "string" ? body.code : "";
        const platform =
          typeof body.platform === "string"
            ? body.platform.trim() || "both"
            : "both";
        const titleRaw =
          typeof body.title === "string" ? body.title.trim() : "";
        const result = body.result;

        if (!code.trim()) {
          return res.status(400).json({ error: "code is required" });
        }
        if (code.length > MAX_CODE_LEN) {
          return res
            .status(400)
            .json({ error: "code exceeds maximum length" });
        }
        if (!isAnalysisResult(result)) {
          return res
            .status(400)
            .json({ error: "result must be a full analysis object" });
        }
        if (!["ios", "android", "both"].includes(platform)) {
          return res
            .status(400)
            .json({ error: "platform must be ios, android, or both" });
        }

        const id = randomUUID();
        const createdAt = new Date().toISOString();
        await repository.createHistory(
          {
            id,
            userId: req.userId!,
            createdAt,
            title:
              titleRaw.slice(0, 120) ||
              `Analysis · ${result.overallScore}/100 · ${new Date(
                result.analyzedAt,
              ).toLocaleString()}`,
            platform,
            code,
            result,
          },
          MAX_HISTORY_PER_USER,
        );
        return res.status(201).json({ id });
      } catch (error) {
        next(error);
      }
    },

    deleteHistory: async (
      req: AuthedRequest,
      res: Response,
      next: NextFunction,
    ) => {
      try {
        const id = req.params.id;
        if (!id) return res.status(400).json({ error: "Missing id" });
        if (!(await repository.deleteHistory(req.userId!, id))) {
          return res.status(404).json({ error: "History entry not found" });
        }
        return res.status(204).end();
      } catch (error) {
        next(error);
      }
    },
  };
}
