const REQUIRED_PRODUCTION_ENV = [
  "DATABASE_URL",
  "JWT_SECRET",
  "GROQ_API_KEY",
  "ANALYZE_API_KEY",
  "CORS_ORIGINS",
] as const;

export function validateEnvironment(): void {
  if (process.env.NODE_ENV !== "production") return;

  const missing = REQUIRED_PRODUCTION_ENV.filter(
    (name) => !process.env[name]?.trim(),
  );
  if (missing.length > 0) {
    throw new Error(
      `Missing required production environment variables: ${missing.join(", ")}`,
    );
  }

  if (process.env.JWT_SECRET!.trim().length < 32) {
    throw new Error("JWT_SECRET must contain at least 32 characters in production");
  }

  if (getCorsOrigins().length === 0) {
    throw new Error("CORS_ORIGINS must contain at least one valid origin");
  }

  getPositiveInteger("ANALYZE_RATE_LIMIT_MAX", 40);
  getPositiveInteger("AUTH_RATE_LIMIT_MAX", 30);
  getJsonLimit();
}

export function getCorsOrigins(): string[] {
  return (process.env.CORS_ORIGINS ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean)
    .map((origin) => {
      let url: URL;
      try {
        url = new URL(origin);
      } catch {
        throw new Error(`Invalid CORS origin: ${origin}`);
      }
      if (
        !["http:", "https:"].includes(url.protocol) ||
        url.username ||
        url.password ||
        url.pathname !== "/" ||
        url.search ||
        url.hash
      ) {
        throw new Error(`Invalid CORS origin: ${origin}`);
      }
      return url.origin;
    });
}

export function getPositiveInteger(name: string, fallback: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const parsed = Number(raw);
  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    throw new Error(`${name} must be a positive integer`);
  }
  return parsed;
}

export function getJsonLimit(): string {
  const value = process.env.ANALYZE_JSON_LIMIT?.trim() || "512kb";
  if (!/^(?:[1-9]\d*|[1-9]\d*(?:\.\d+)?(?:kb|mb|gb))$/i.test(value)) {
    throw new Error(
      "ANALYZE_JSON_LIMIT must be a positive byte count or use kb, mb, or gb",
    );
  }
  return value;
}
