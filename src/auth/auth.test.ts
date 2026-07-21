import { beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../app";
import type {
  AuthRepository,
  NewHistoryEntry,
  NewUser,
} from "./repository";
import type { HistoryEntry, StoredUser } from "./types";

class MemoryAuthRepository implements AuthRepository {
  users: StoredUser[] = [];
  history: HistoryEntry[] = [];

  async createUser(user: NewUser): Promise<StoredUser | null> {
    if (this.users.some((candidate) => candidate.email === user.email)) {
      return null;
    }
    this.users.push(user);
    return user;
  }

  async findUserByEmail(email: string): Promise<StoredUser | null> {
    return this.users.find((user) => user.email === email) ?? null;
  }

  async findUserById(id: string): Promise<StoredUser | null> {
    return this.users.find((user) => user.id === id) ?? null;
  }

  async listHistory(userId: string): Promise<HistoryEntry[]> {
    return this.history
      .filter((entry) => entry.userId === userId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async findHistory(userId: string, id: string): Promise<HistoryEntry | null> {
    return (
      this.history.find(
        (entry) => entry.userId === userId && entry.id === id,
      ) ?? null
    );
  }

  async createHistory(
    entry: NewHistoryEntry,
    maxPerUser: number,
  ): Promise<void> {
    this.history.push(entry);
    const mine = await this.listHistory(entry.userId);
    for (const excess of mine.slice(maxPerUser)) {
      this.history = this.history.filter((candidate) => candidate.id !== excess.id);
    }
  }

  async deleteHistory(userId: string, id: string): Promise<boolean> {
    const before = this.history.length;
    this.history = this.history.filter(
      (entry) => !(entry.userId === userId && entry.id === id),
    );
    return before !== this.history.length;
  }
}

let repository: MemoryAuthRepository;

beforeEach(() => {
  repository = new MemoryAuthRepository();
});

function app() {
  return createApp({ authRepository: repository });
}

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
    const res = await request(app())
      .post("/auth/register")
      .send({
        email: "  Hello@Example.COM ",
        password: "longenough",
        displayName: "Hi",
      })
      .expect(201);
    expect(typeof res.body.token).toBe("string");
    expect(res.body.user.email).toBe("hello@example.com");
    expect(res.body.user.displayName).toBe("Hi");
  });

  it("rejects duplicate registration", async () => {
    const instance = app();
    await request(instance)
      .post("/auth/register")
      .send({ email: "x@y.co", password: "password1" })
      .expect(201);
    await request(instance)
      .post("/auth/register")
      .send({ email: "X@y.co", password: "password2" })
      .expect(409);
  });

  it("rejects passwords beyond bcrypt's safe byte limit", async () => {
    await request(app())
      .post("/auth/register")
      .send({ email: "long@example.com", password: "🙂".repeat(19) })
      .expect(400, { error: "Password must not exceed 72 UTF-8 bytes" });
  });

  it("logs in with the correct password", async () => {
    const instance = app();
    await request(instance)
      .post("/auth/register")
      .send({ email: "a@b.co", password: "secret1234" })
      .expect(201);
    const res = await request(instance)
      .post("/auth/login")
      .send({ email: "a@b.co", password: "secret1234" })
      .expect(200);
    expect(res.body.token).toBeTruthy();
  });

  it("saves, reads, and deletes history for the same user", async () => {
    const instance = app();
    const registration = await request(instance)
      .post("/auth/register")
      .send({ email: "hist@z.co", password: "secret1234" })
      .expect(201);
    const token = registration.body.token as string;

    await request(instance)
      .post("/history")
      .set("Authorization", `Bearer ${token}`)
      .send({
        code: "export default function X(){return 1}",
        platform: "both",
        result: sampleResult(),
        title: "My run",
      })
      .expect(201);

    const list = await request(instance)
      .get("/history")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    expect(list.body.items).toHaveLength(1);
    expect(list.body.items[0].title).toBe("My run");

    const id = list.body.items[0].id as string;
    const one = await request(instance)
      .get(`/history/${id}`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    expect(one.body.code).toContain("export default");

    await request(instance)
      .delete(`/history/${id}`)
      .set("Authorization", `Bearer ${token}`)
      .expect(204);
  });
});
