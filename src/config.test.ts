import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getCorsOrigins,
  getJsonLimit,
  getPositiveInteger,
  validateEnvironment,
} from "./config";

afterEach(() => {
  vi.unstubAllEnvs();
});

function setValidProductionEnvironment() {
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("DATABASE_URL", "postgresql://localhost/test");
  vi.stubEnv("JWT_SECRET", "a".repeat(32));
  vi.stubEnv("GROQ_API_KEY", "groq-test-key");
  vi.stubEnv("ANALYZE_API_KEY", "analyze-test-key");
  vi.stubEnv("CORS_ORIGINS", "https://app.example.com");
}

describe("production environment validation", () => {
  it("reports missing production variables", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("DATABASE_URL", "");
    vi.stubEnv("JWT_SECRET", "");
    vi.stubEnv("GROQ_API_KEY", "");
    vi.stubEnv("ANALYZE_API_KEY", "");
    vi.stubEnv("CORS_ORIGINS", "");

    expect(() => validateEnvironment()).toThrow(
      /DATABASE_URL, JWT_SECRET, GROQ_API_KEY, ANALYZE_API_KEY, CORS_ORIGINS/,
    );
  });

  it("rejects a weak JWT secret", () => {
    setValidProductionEnvironment();
    vi.stubEnv("JWT_SECRET", "too-short");
    expect(() => validateEnvironment()).toThrow(/at least 32 characters/);
  });

  it("accepts valid production configuration", () => {
    setValidProductionEnvironment();
    expect(() => validateEnvironment()).not.toThrow();
  });

  it("normalizes comma-separated CORS origins", () => {
    vi.stubEnv(
      "CORS_ORIGINS",
      "https://one.example.com/, https://two.example.com",
    );
    expect(getCorsOrigins()).toEqual([
      "https://one.example.com",
      "https://two.example.com",
    ]);
  });

  it("rejects CORS values that include paths", () => {
    vi.stubEnv("CORS_ORIGINS", "https://app.example.com/admin");
    expect(() => getCorsOrigins()).toThrow(/Invalid CORS origin/);
  });

  it("rejects invalid numeric limits", () => {
    vi.stubEnv("AUTH_RATE_LIMIT_MAX", "0");
    expect(() => getPositiveInteger("AUTH_RATE_LIMIT_MAX", 30)).toThrow(
      /positive integer/,
    );
  });

  it("rejects invalid JSON body limits", () => {
    vi.stubEnv("ANALYZE_JSON_LIMIT", "very-large");
    expect(() => getJsonLimit()).toThrow(/positive byte count/);
  });
});
