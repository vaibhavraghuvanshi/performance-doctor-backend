import type { Issue, Severity } from "../types/analysis";

const VALID_SEVERITY = new Set<string>([
  "critical",
  "high",
  "medium",
  "low",
]);

function simpleIdPart(title: string, index: number): string {
  let h = 0;
  for (let i = 0; i < title.length; i++) {
    h = (Math.imul(31, h) + title.charCodeAt(i)) | 0;
  }
  return `${Math.abs(h).toString(36)}-${index}`;
}

/**
 * Normalizes Groq / LLM-shaped issues into the Issue model expected by the UI.
 */
export function mapLlmIssuesToIssues(raw: unknown[]): Issue[] {
  if (!Array.isArray(raw)) return [];

  return raw.map((item, index) => {
    const row = item && typeof item === "object" ? (item as Record<string, unknown>) : {};

    const title =
      typeof row.title === "string" && row.title.trim()
        ? row.title.trim()
        : `Issue ${index + 1}`;

    const sevRaw = row.severity;
    const severity: Severity =
      typeof sevRaw === "string" && VALID_SEVERITY.has(sevRaw)
        ? (sevRaw as Severity)
        : "medium";

    const explanation =
      typeof row.explanation === "string" ? row.explanation : undefined;

    const suggestedFix =
      typeof row.suggestedFix === "string" ? row.suggestedFix.trim() : "";

    const id =
      typeof row.id === "string" && row.id.trim()
        ? row.id.trim()
        : `llm-${simpleIdPart(title, index)}`;

    return {
      id,
      severity,
      type: "llm-insight",
      title,
      location: { start: 0, end: 0 },
      impact: {},
      explanation,
      fix: suggestedFix
        ? { description: "Suggested fix", code: suggestedFix }
        : undefined,
    };
  });
}
