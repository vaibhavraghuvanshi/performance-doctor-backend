import { Request, Response, NextFunction } from "express";

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
) {
  if (process.env.NODE_ENV === "production") {
    console.error("Request failed", err instanceof Error ? err.name : "UnknownError");
  } else {
    console.error(err);
  }
  const candidate = err as { status?: unknown; message?: unknown };
  const status =
    typeof candidate.status === "number" ? candidate.status : 500;
  const publicMessage =
    status < 500 && typeof candidate.message === "string"
      ? candidate.message
      : "Internal Server Error";
  res.status(status).json({ error: publicMessage });
}
