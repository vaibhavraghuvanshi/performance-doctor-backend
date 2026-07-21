import { afterEach, describe, it, expect } from "vitest";
import request from "supertest";
import { createApp } from "./app";

const originalNodeEnv = process.env.NODE_ENV;

afterEach(() => {
  delete process.env.CORS_ORIGINS;
  delete process.env.ANALYZE_API_KEY;
  if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = originalNodeEnv;
});

describe("deployment endpoints", () => {
  it("reports database readiness", async () => {
    const app = createApp({ healthCheck: async () => undefined });
    await request(app).get("/health").expect(200, { status: "ok" });
  });

  it("returns 503 when the database is unavailable", async () => {
    const app = createApp({
      healthCheck: async () => {
        throw new Error("offline");
      },
    });
    await request(app)
      .get("/health")
      .expect(503, { status: "unavailable" });
  });

  it("allows only configured browser origins", async () => {
    process.env.CORS_ORIGINS = "https://app.example.com";
    const app = createApp({ healthCheck: async () => undefined });
    const allowed = await request(app)
      .get("/health")
      .set("Origin", "https://app.example.com")
      .expect(200);
    expect(allowed.headers["access-control-allow-origin"]).toBe(
      "https://app.example.com",
    );

    const denied = await request(app)
      .get("/health")
      .set("Origin", "https://attacker.example.com")
      .expect(200);
    expect(denied.headers["access-control-allow-origin"]).toBeUndefined();
    expect(denied.body).toEqual({ status: "ok" });
  });
});

describe("POST /analyze", () => {
  it("enforces the configured API key in production", async () => {
    process.env.NODE_ENV = "production";
    process.env.ANALYZE_API_KEY = "test-analyze-key";
    const app = createApp();

    await request(app)
      .post("/analyze")
      .send({ code: "export default function Example() { return null; }" })
      .expect(401, { error: "Invalid or missing analyze API key" });
  });

  it("returns JSON with issues for static analysis", async () => {
    const app = createApp();
    const res = await request(app)
      .post("/analyze")
      .send({
        code: "export default function Example() { return null; }",
      })
      .expect(200);

    expect(res.body).toMatchObject({
      overallScore: expect.any(Number),
      optimizedScore: expect.any(Number),
    });
    expect(Array.isArray(res.body.issues)).toBe(true);
    expect(res.body.metrics).toBeDefined();
    expect(typeof res.body.optimizedCode).toBe("string");
  });

  it("returns 400 when code is missing", async () => {
    const app = createApp();
    const res = await request(app).post("/analyze").send({}).expect(400);
    expect(res.body.error).toBeDefined();
  });

  it("requires authentication before running AI analysis", async () => {
    const app = createApp();
    await request(app)
      .post("/analyze?ai=1")
      .send({ code: "export default function Example() { return null; }" })
      .expect(401, { error: "Missing or invalid Authorization header" });
  });
});
