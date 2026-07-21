export type Severity = "critical" | "high" | "medium" | "low";

export interface Issue {
  id: string;
  severity: Severity;
  type: string;
  title: string;
  location: { start: number; end: number };
  impact: Record<string, any>;
  explanation?: string;
  fix?: { description: string; code: string; alternatives?: string[] };
  codeSnippet?: string;
}

export interface Metrics {
  fps: { current: number; optimized: number };
  renderTime: { current: string; optimized: string };
  memory: { current: string; optimized: string };
  reRenders: { current: number; optimized: number };
  /** SEO / CWV–related readiness (0–100); higher is better. */
  seoReadiness: { current: number; optimized: number };
}

export interface AnalysisResult {
  overallScore: number;
  optimizedScore: number;
  issues: Issue[];
  metrics: Metrics;
  optimizedCode: string;
  topBottleneck: string | null;
  analyzedAt: string;
}
