import { describe, it, expect } from "vitest";
import { mapLlmIssuesToIssues } from "./mapLlmIssues";

describe("mapLlmIssuesToIssues", () => {
  it("maps Groq-shaped rows to Issue with id and fix", () => {
    const out = mapLlmIssuesToIssues([
      {
        title: "Heavy render",
        severity: "high",
        explanation: "Too many re-renders",
        suggestedFix: "Wrap in useMemo",
      },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].id).toMatch(/^llm-/);
    expect(out[0].type).toBe("llm-insight");
    expect(out[0].severity).toBe("high");
    expect(out[0].fix?.code).toBe("Wrap in useMemo");
    expect(out[0].location).toEqual({ start: 0, end: 0 });
  });

  it("defaults invalid severity to medium", () => {
    const out = mapLlmIssuesToIssues([
      { title: "X", severity: "nope", suggestedFix: "fix" },
    ]);
    expect(out[0].severity).toBe("medium");
  });

  it("preserves explicit string id when provided", () => {
    const out = mapLlmIssuesToIssues([
      { id: "custom-1", title: "T", severity: "low", suggestedFix: "" },
    ]);
    expect(out[0].id).toBe("custom-1");
  });
});
