import type { Issue, Severity } from "../types/analysis";

const SEVERITY_RANK: Record<Severity, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

/** AST types where we prefer deterministic findings over overlapping LLM prose */
const AST_PREFERRED_TYPES = new Set<string>([
  "flatlist",
  "missing-key-extractor",
  "missing-get-item-layout",
  "flatlist-key-index",
  "flatlist-tuning",
  "sectionlist",
  "sectionlist-key-extractor",
  "bridge-native-call",
  "json-stringify-cost",
  "native-event-emitter",
  "image-dimensions",
  "usecallback-empty-deps-jsx",
  "react-unsafe-html",
  "react-find-dom-node",
  "next-ssr-gssp",
  "next-ssr-gsp",
  "next-ssr-gspaths",
  "bundle-lodash",
  "bundle-mui-icons",
  "seo-next-head-title",
  "cwv-img-layout",
  "cwv-blocking-script",
]);

function tokenizeTitle(s: string): Set<string> {
  return new Set(
    s
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2),
  );
}

/**
 * Jaccard similarity on title tokens — used to drop redundant LLM issues when AST already covered the topic.
 */
function titlesLikelyDuplicate(a: string, b: string): boolean {
  const A = tokenizeTitle(a);
  const B = tokenizeTitle(b);
  if (A.size === 0 || B.size === 0) return false;
  let inter = 0;
  for (const t of A) {
    if (B.has(t)) inter++;
  }
  const union = A.size + B.size - inter;
  return union > 0 && inter / union >= 0.35;
}

/**
 * Merges AST-derived issues with LLM-normalized issues. AST wins on overlapping list/bridge static topics.
 */
export function mergeAstAndLlmIssues(astIssues: Issue[], llmIssues: Issue[]): Issue[] {
  const merged: Issue[] = [...astIssues];
  const seenIds = new Set(merged.map((i) => i.id));

  for (const li of llmIssues) {
    if (seenIds.has(li.id)) continue;

    if (li.type === "llm-insight") {
      let drop = false;
      for (const a of astIssues) {
        if (AST_PREFERRED_TYPES.has(a.type) && titlesLikelyDuplicate(a.title, li.title)) {
          drop = true;
          break;
        }
        if (a.type !== "llm-insight" && titlesLikelyDuplicate(a.title, li.title)) {
          drop = true;
          break;
        }
      }
      if (drop) continue;
    }

    merged.push(li);
    seenIds.add(li.id);
  }

  return merged;
}

export function pickTopBottleneckFromIssues(issues: Issue[]): string | null {
  if (issues.length === 0) return null;
  const sorted = [...issues].sort(
    (a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity],
  );
  return sorted[0].title;
}
