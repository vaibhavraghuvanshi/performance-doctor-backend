import { describe, it, expect } from "vitest";
import request from "supertest";
import { createApp } from "./app";

describe("POST /analyze", () => {
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
});
