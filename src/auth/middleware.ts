import type { Request, Response, NextFunction } from "express";
import { verifyToken } from "./jwt";

export interface AuthedRequest extends Request {
  userId?: string;
  userEmail?: string;
}

export function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  const raw = Array.isArray(header) ? header[0] : header;
  const m = raw?.match(/^Bearer\s+(.+)$/i);
  const token = m?.[1]?.trim();
  if (!token) {
    return res.status(401).json({ error: "Missing or invalid Authorization header" });
  }
  const payload = verifyToken(token);
  if (!payload) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
  req.userId = payload.sub;
  req.userEmail = payload.email;
  next();
}
