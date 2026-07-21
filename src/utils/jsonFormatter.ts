import type { AnalysisResult } from "../types/analysis";

export function formatAnalysisResult(result: AnalysisResult): string {
  return JSON.stringify(result, null, 2);
}
