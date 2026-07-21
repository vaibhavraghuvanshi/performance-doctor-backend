import dotenv from "dotenv";

dotenv.config();

import express from "express";
import cors from "cors";
import helmet from "helmet";
import { json } from "express";
import rateLimit from "express-rate-limit";

import {
  getCorsOrigins,
  getJsonLimit,
  getPositiveInteger,
} from "./config";
import { checkDatabase } from "./db";
import { errorHandler } from "./middleware/errorHandler";
import { analyzeCode, analyzeCodeWithGroq } from "./analysis/analyzer";
import { createAuthHandlers } from "./auth/authHandlers";
import { requireAuth, type AuthedRequest } from "./auth/middleware";
import {
  PostgresAuthRepository,
  type AuthRepository,
} from "./auth/repository";

function optionalAnalyzeApiKey(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
) {
  const expected = process.env.ANALYZE_API_KEY?.trim();
  if (!expected) return next();

  /**
   * Only enforce `x-analyze-api-key` in production. Local dev often sets `ANALYZE_API_KEY`
   * by mistake (thinking it is Groq) while the Vite app has no `VITE_ANALYZE_API_KEY`.
   * Set `NODE_ENV=production` in real deployments, or `ANALYZE_API_KEY_FORCE=1` to enforce
   * the header in non-production (e.g. staging).
   */
  const enforce =
    process.env.NODE_ENV === "production" ||
    process.env.ANALYZE_API_KEY_FORCE === "1";
  if (!enforce) return next();

  const provided = req.headers["x-analyze-api-key"];
  const key = Array.isArray(provided) ? provided[0] : provided;
  if (key !== expected) {
    return res.status(401).json({ error: "Invalid or missing analyze API key" });
  }
  next();
}

function requireAiAuthentication(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
) {
  if (req.query.ai !== "1") return next();
  return requireAuth(req as AuthedRequest, res, next);
}

const analyzeLimiter = rateLimit({
  windowMs: 60_000,
  max: getPositiveInteger("ANALYZE_RATE_LIMIT_MAX", 40),
  standardHeaders: true,
  legacyHeaders: false,
});

const authLimiter = rateLimit({
  windowMs: 60_000,
  max: getPositiveInteger("AUTH_RATE_LIMIT_MAX", 30),
  standardHeaders: true,
  legacyHeaders: false,
});

export interface AppOptions {
  authRepository?: AuthRepository;
  healthCheck?: () => Promise<void>;
}

export function createApp(options: AppOptions = {}): express.Application {
  const app = express();
  const auth = createAuthHandlers(
    options.authRepository ?? new PostgresAuthRepository(),
  );
  const healthCheck = options.healthCheck ?? checkDatabase;
  const allowedOrigins = getCorsOrigins();

  app.set("trust proxy", 1);
  app.use(
    cors({
      origin(origin, callback) {
        if (
          !origin ||
          allowedOrigins.length === 0 ||
          allowedOrigins.includes(origin.replace(/\/$/, ""))
        ) {
          callback(null, true);
          return;
        }
        callback(null, false);
      },
    }),
  );
  app.use(helmet());
  app.use(json({ limit: getJsonLimit() }));

  app.get("/health", async (_req, res) => {
    try {
      await healthCheck();
      res.json({ status: "ok" });
    } catch {
      res.status(503).json({ status: "unavailable" });
    }
  });

  app.post("/auth/register", authLimiter, (req, res, next) => {
    void auth.postRegister(req, res, next);
  });
  app.post("/auth/login", authLimiter, (req, res, next) => {
    void auth.postLogin(req, res, next);
  });
  app.get("/auth/me", requireAuth as express.RequestHandler, (req, res, next) => {
    void auth.getMe(req as AuthedRequest, res, next);
  });

  app.get("/history", requireAuth as express.RequestHandler, (req, res, next) => {
    void auth.getHistoryList(req as AuthedRequest, res, next);
  });
  app.get(
    "/history/:id",
    requireAuth as express.RequestHandler,
    (req, res, next) => {
      void auth.getHistoryOne(req as AuthedRequest, res, next);
    },
  );
  app.post("/history", requireAuth as express.RequestHandler, (req, res, next) => {
    void auth.postHistory(req as AuthedRequest, res, next);
  });
  app.delete(
    "/history/:id",
    requireAuth as express.RequestHandler,
    (req, res, next) => {
      void auth.deleteHistory(req as AuthedRequest, res, next);
    },
  );

  app.post(
    "/analyze",
    requireAiAuthentication,
    analyzeLimiter,
    optionalAnalyzeApiKey,
    (req, res, next) => {
      (async () => {
        try {
          const { code, platform } = req.body as {
            code?: unknown;
            platform?: unknown;
          };
          if (typeof code !== "string") {
            return res
              .status(400)
              .json({ error: "Missing or invalid 'code' in request body" });
          }
          const platformStr =
            typeof platform === "string" && platform.trim()
              ? platform.trim()
              : "both";

          if (req.query.ai === "1") {
            const result = await analyzeCodeWithGroq(code, platformStr);
            res.json(result);
          } else {
            const result = analyzeCode(code);
            res.json(result);
          }
        } catch (err) {
          next(err);
        }
      })();
    },
  );

  app.use(errorHandler);

  return app;
}
