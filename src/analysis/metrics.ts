import type { Issue } from "../../types/issue";

export function estimateFPS(issues: Issue[]): {
  current: number;
  optimized: number;
} {
  let current = 60;
  issues.forEach((issue) => {
    if (issue.severity === "critical") current -= 15;
    if (issue.severity === "high") current -= 7;
  });
  return { current: Math.max(current, 10), optimized: 60 };
}

export function estimateRenderTime(issues: Issue[]): {
  current: string;
  optimized: string;
} {
  let current = 180;
  issues.forEach((issue) => {
    if (issue.severity === "critical") current += 60;
    if (issue.severity === "high") current += 30;
  });
  return { current: `${current}ms`, optimized: "45ms" };
}

export function estimateMemory(issues: Issue[]): {
  current: string;
  optimized: string;
} {
  let current = 120;
  issues.forEach((issue) => {
    if (issue.severity === "critical") current += 40;
    if (issue.severity === "high") current += 20;
  });
  return { current: `${current}MB`, optimized: "80MB" };
}

export function estimateReRenders(issues: Issue[]): {
  current: number;
  optimized: number;
} {
  let current = 10;
  issues.forEach((issue) => {
    if (issue.severity === "critical") current += 5;
    if (issue.severity === "high") current += 2;
  });
  return { current, optimized: 4 };
}

export function calculatePerformanceScore(issues: Issue[]): number {
  let score = 100;
  issues.forEach((issue) => {
    if (issue.severity === "critical") score -= 30;
    if (issue.severity === "high") score -= 15;
    if (issue.severity === "medium") score -= 7;
    if (issue.severity === "low") score -= 2;
  });
  return Math.max(score, 0);
}

const SEO_CWV_SCORE_TYPES = new Set<string>([
  "seo-next-head-title",
  "cwv-img-layout",
  "cwv-blocking-script",
  "react-unsafe-html",
]);

/**
 * Separate 0–100 score for SEO / CWV–adjacent static findings (title, CLS hints, blocking scripts, unsafe HTML).
 */
export function estimateSeoReadiness(issues: Issue[]): {
  current: number;
  optimized: number;
} {
  let score = 100;
  for (const issue of issues) {
    if (!SEO_CWV_SCORE_TYPES.has(issue.type)) continue;
    if (issue.severity === "critical") score -= 28;
    else if (issue.severity === "high") score -= 18;
    else if (issue.severity === "medium") score -= 12;
    else if (issue.severity === "low") score -= 5;
  }
  return { current: Math.max(score, 0), optimized: 100 };
}
