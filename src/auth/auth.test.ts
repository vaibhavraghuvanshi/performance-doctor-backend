import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, writeFileSync, rmSync } from "fs";
import { tmpdir } from "os";
import path from "path";
import request from "supertest";
import { createApp } from "../app";

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), "pd-auth-test-"));
  process.env.AUTH_STORE_PATH = path.join(dir, "store.json");
  writeFileSync(process.env.AUTH_STORE_PATH, JSON.stringify({ users: [], history: [] }), "utf8");
});

afterEach(() => {
  delete process.env.AUTH_STORE_PATH;
  rmSync(dir, { recursive: true, force: true });
});

function sampleResult() {
  return {
    overallScore: 55,
    optimizedScore: 100,
    issues: [],
    metrics: {
      fps: { current: 50, optimized: 60 },
      renderTime: { current: "100ms", optimized: "45ms" },
      memory: { current: "100MB", optimized: "80MB" },
      reRenders: { current: 8, optimized: 4 },
      seoReadiness: { current: 95, optimized: 100 },
    },
    optimizedCode: "// ok",
    topBottleneck: null,
    analyzedAt: new Date().toISOString(),
  };
}

describe("auth + history API", () => {
  it("registers, normalizes email, and returns a JWT", async () => {
    const app = createApp();
    const res = await request(app)
      .post("/auth/register")
      .send({ email: "  Hello@Example.COM ", password: "longenough", displayName: "Hi" })
      .expect(201);
    expect(typeof res.body.token).toBe("string");
    expect(res.body.user.email).toBe("hello@example.com");
    expect(res.body.user.displayName).toBe("Hi");
  });

  it("rejects duplicate registration", async () => {
    const app = createApp();
    await request(app)
      .post("/auth/register")
      .send({ email: "x@y.co", password: "password1" })
      .expect(201);
    await request(app)
      .post("/auth/register")
      .send({ email: "X@y.co", password: "password2" })
      .expect(409);
  });

  it("logs in with correct password", async () => {
    const app = createApp();
    await request(app)
      .post("/auth/register")
      .send({ email: "a@b.co", password: "secret1234" })
      .expect(201);
    const res = await request(app)
      .post("/auth/login")
      .send({ email: "a@b.co", password: "secret1234" })
      .expect(200);
    expect(res.body.token).toBeTruthy();
  });

  it("saves history and lists it for the same user", async () => {
    const app = createApp();
    const reg = await request(app)
      .post("/auth/register")
      .send({ email: "hist@z.co", password: "secret1234" })
      .expect(201);
    const token = reg.body.token as string;

    await request(app)
      .post("/history")
      .set("Authorization", `Bearer ${token}`)
      .send({
        code: "export default function X(){return 1}",
        platform: "both",
        result: sampleResult(),
        title: "My run",
      })
      .expect(201);

    const list = await request(app)
      .get("/history")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    expect(list.body.items).toHaveLength(1);
    expect(list.body.items[0].title).toBe("My run");

    const id = list.body.items[0].id as string;
    const one = await request(app)
      .get(`/history/${id}`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    expect(one.body.code).toContain("export default");
  });
});
