import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("../utils/groqClient", () => ({
  callGroq: vi.fn(),
}));

import { callGroq } from "../utils/groqClient";
import { analyzeCodeWithGroq } from "./analyzer";

describe("analyzeCodeWithGroq hybrid merge", () => {
  beforeEach(() => {
    delete process.env.ANALYZE_LLM_ONLY;
    const groqResponse =
      '[{"title":"FlatList keyExtractor and list performance tuning","severity":"low","explanation":"Consider keys","suggestedFix":""}]\n' +
      "```jsx\nexport default function X(){return null;}\n```";
    vi.mocked(callGroq).mockResolvedValue(groqResponse);
  });

  afterEach(() => {
    vi.clearAllMocks();
    delete process.env.ANALYZE_LLM_ONLY;
  });

  it("merges AST issues with LLM issues by default", async () => {
    const code = `export default function List() {
      return <FlatList data={[]} renderItem={() => <View />} />;
    }`;
    const res = await analyzeCodeWithGroq(code, "android");
    const types = res.issues.map((i) => i.type);
    expect(types).toContain("flatlist");
    expect(types).toContain("missing-key-extractor");
    expect(types.some((t) => t === "llm-insight")).toBe(true);
    expect(res.optimizedCode).toBeTruthy();
    expect(res.metrics).toBeDefined();
    expect(res.topBottleneck).toBeTruthy();
  });

  it("skips AST merge when ANALYZE_LLM_ONLY=1", async () => {
    process.env.ANALYZE_LLM_ONLY = "1";
    const code = `export default function List() {
      return <FlatList data={[]} renderItem={() => <View />} />;
    }`;
    const res = await analyzeCodeWithGroq(code, "both");
    const types = res.issues.map((i) => i.type);
    expect(types).not.toContain("flatlist");
    expect(types.every((t) => t === "llm-insight")).toBe(true);
  });
});
