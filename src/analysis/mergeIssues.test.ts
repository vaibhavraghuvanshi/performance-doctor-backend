import { describe, it, expect } from "vitest";
import type { Issue } from "../types/analysis";
import { mergeAstAndLlmIssues, pickTopBottleneckFromIssues } from "./mergeIssues";

describe("mergeAstAndLlmIssues", () => {
  it("keeps AST list issues and drops redundant llm-insight with overlapping title tokens", () => {
    const ast: Issue[] = [
      {
        id: "a1",
        severity: "high",
        type: "missing-key-extractor",
        title: "FlatList is missing keyExtractor",
        location: { start: 10, end: 20 },
        impact: {},
      },
    ];
    const llm: Issue[] = [
      {
        id: "llm-1",
        severity: "medium",
        type: "llm-insight",
        title: "FlatList keyExtractor missing for stable keys",
        location: { start: 0, end: 0 },
        impact: {},
      },
      {
        id: "llm-2",
        severity: "low",
        type: "llm-insight",
        title: "Unrelated bundle size note",
        location: { start: 0, end: 0 },
        impact: {},
      },
    ];
    const merged = mergeAstAndLlmIssues(ast, llm);
    expect(merged.map((i) => i.id).sort()).toEqual(["a1", "llm-2"].sort());
  });

  it("dedupes by explicit id", () => {
    const ast: Issue[] = [
      {
        id: "dup",
        severity: "low",
        type: "flatlist",
        title: "FlatList usage",
        location: { start: 1, end: 2 },
        impact: {},
      },
    ];
    const llm: Issue[] = [
      {
        id: "dup",
        severity: "high",
        type: "llm-insight",
        title: "Different",
        location: { start: 0, end: 0 },
        impact: {},
      },
    ];
    expect(mergeAstAndLlmIssues(ast, llm)).toHaveLength(1);
  });
});

describe("pickTopBottleneckFromIssues", () => {
  it("returns title of highest-severity issue", () => {
    const issues: Issue[] = [
      {
        id: "1",
        severity: "low",
        type: "flatlist",
        title: "Low",
        location: { start: 0, end: 0 },
        impact: {},
      },
      {
        id: "2",
        severity: "critical",
        type: "llm-insight",
        title: "Critical problem",
        location: { start: 0, end: 0 },
        impact: {},
      },
    ];
    expect(pickTopBottleneckFromIssues(issues)).toBe("Critical problem");
  });

  it("returns null for empty list", () => {
    expect(pickTopBottleneckFromIssues([])).toBeNull();
  });
});
