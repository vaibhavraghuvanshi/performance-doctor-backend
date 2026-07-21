import {
  detectBridgeNativeInRender,
  detectBundleHeuristics,
  detectCWVWebHints,
  detectFlatList,
  detectFlatListKeyIndex,
  detectFlatListTuning,
  detectHeavyComputation,
  detectImageDimensions,
  detectInlineFunctions,
  detectInlineObjects,
  detectJsonStringifyCost,
  detectMissingKeyExtractor,
  detectMissingMemo,
  detectNativeEventEmitterCaveat,
  detectNextJsDataFetching,
  detectReactWebPatterns,
  detectSectionList,
  detectUseCallbackEmptyDepsJsx,
  createNextHeadTracker,
  trackNextHeadAndTitle,
  finalizeMissingTitleIssue,
} from "./rules";
import { parse } from "@babel/parser";
import traverse from "@babel/traverse";
import type { AnalysisResult, Issue } from "../types/analysis";
import type { Issue as MetricsIssue } from "../../types/issue";
import { mergeAstAndLlmIssues, pickTopBottleneckFromIssues } from "./mergeIssues";
import { callGroq } from "../utils/groqClient";
import { mapLlmIssuesToIssues } from "./mapLlmIssues";
import {
  estimateFPS,
  estimateRenderTime,
  estimateMemory,
  estimateReRenders,
  calculatePerformanceScore,
  estimateSeoReadiness,
} from "./metrics";

export function analyzeCode(code: string): AnalysisResult {
  const ast = parse(code, {
    sourceType: "module",
    plugins: ["typescript", "jsx"],
  });
  const issues: any[] = [];
  const nextHeadTracker = createNextHeadTracker();
  traverse(ast, {
    enter(path: any) {
      trackNextHeadAndTitle(path, nextHeadTracker);
      detectFlatList(path, issues);
      detectFlatListTuning(path, issues);
      detectFlatListKeyIndex(path, issues);
      detectSectionList(path, issues);
      detectBridgeNativeInRender(path, issues);
      detectJsonStringifyCost(path, issues);
      detectNativeEventEmitterCaveat(path, issues);
      detectImageDimensions(path, issues);
      detectHeavyComputation(path, issues);
      detectInlineFunctions(path, issues);
      detectInlineObjects(path, issues);
      detectMissingKeyExtractor(path, issues);
      detectMissingMemo(path, issues);
      detectUseCallbackEmptyDepsJsx(path, issues);
      detectReactWebPatterns(path, issues);
      detectNextJsDataFetching(path, issues);
      detectBundleHeuristics(path, issues);
      detectCWVWebHints(path, issues);
    },
  });
  finalizeMissingTitleIssue(nextHeadTracker, issues);
  // Metrics & scoring
  const mi = issues as MetricsIssue[];
  const fps = estimateFPS(mi);
  const renderTime = estimateRenderTime(mi);
  const memory = estimateMemory(mi);
  const reRenders = estimateReRenders(mi);
  const score = calculatePerformanceScore(mi);
  const seoReadiness = estimateSeoReadiness(mi);
  const topBottleneck = pickTopBottleneckFromIssues(issues as Issue[]);
  return {
    overallScore: score,
    optimizedScore: 100,
    issues,
    metrics: {
      fps,
      renderTime,
      memory,
      reRenders,
      seoReadiness,
    },
    optimizedCode: "",
    topBottleneck,
    analyzedAt: new Date().toISOString(),
  };
}

/**
 * Extracts JSON array from LLM response text
 */
function extractIssuesJSON(responseText: string): any[] {
  try {
    // Try to find JSON array in the response
    const match = responseText.match(/\[\s*\{[\s\S]*?\}\s*\]/);
    if (!match) {
      console.warn("[Groq] No issues JSON array found in response.");
      return [];
    }

    let jsonStr = match[0];

    // Try parsing directly
    try {
      return JSON.parse(jsonStr);
    } catch (jsonErr) {
      // Try to fix common JSON issues
      // Remove trailing commas
      jsonStr = jsonStr.replace(/,(\s*[}\]])/g, "$1");

      // Try parsing again
      try {
        return JSON.parse(jsonStr);
      } catch (err2) {
        // Last resort: find the last valid closing bracket
        const lastBracket = jsonStr.lastIndexOf("]");
        if (lastBracket !== -1) {
          jsonStr = jsonStr.slice(0, lastBracket + 1);
          return JSON.parse(jsonStr);
        }
        throw err2;
      }
    }
  } catch (err) {
    console.error("[Groq] Failed to parse issues JSON:", err);
    return [];
  }
}

/**
 * Extracts code block from LLM response, removing JSON and markdown artifacts
 */
function extractOptimizedCode(responseText: string): string {
  try {
    console.log("[Groq] Starting code extraction...");

    // Strategy 1: Find code block that comes AFTER the JSON array
    // Split by the JSON array first to get everything after it
    const jsonMatch = responseText.match(/\[\s*\{[\s\S]*?\}\s*\]/);
    let textAfterJSON = responseText;

    if (jsonMatch) {
      const jsonEndIndex = jsonMatch.index! + jsonMatch[0].length;
      textAfterJSON = responseText.slice(jsonEndIndex);
      console.log("[Groq] Extracted text after JSON array");
    }

    // Strategy 2: Find code block with various markdown formats
    const codeBlockPatterns = [
      /```(?:jsx|tsx|javascript|typescript|js|ts|react)\s*\n([\s\S]*?)```/i,
      /```\s*\n([\s\S]*?)```/,
      /```([\s\S]*?)```/,
    ];

    let extractedCode = "";

    for (const pattern of codeBlockPatterns) {
      const match = textAfterJSON.match(pattern);
      if (match && match[1]) {
        extractedCode = match[1].trim();
        console.log("[Groq] Found code block with pattern:", pattern);
        break;
      }
    }

    // Strategy 3: If no code block found, try to extract everything after JSON
    // that looks like code (starts with import/export/function/const/etc)
    if (!extractedCode && textAfterJSON.trim()) {
      const codeStart = textAfterJSON.search(
        /^\s*(import |export |function |const |let |var |class |interface |type )/m,
      );

      if (codeStart !== -1) {
        extractedCode = textAfterJSON.slice(codeStart).trim();
        console.log("[Groq] Extracted code without markdown block");
      }
    }

    if (!extractedCode) {
      console.warn("[Groq] No code block found in LLM response.");
      return "";
    }

    // Clean up the extracted code
    extractedCode = cleanExtractedCode(extractedCode);

    console.log("[Groq] Successfully extracted optimized code");
    return extractedCode;
  } catch (err) {
    console.error("[Groq] Error extracting optimized code:", err);
    return "";
  }
}

/**
 * Cleans up extracted code by removing artifacts and normalizing formatting
 */
function cleanExtractedCode(code: string): string {
  // Remove any remaining markdown code fence markers
  code = code.replace(
    /^```(?:jsx|tsx|javascript|typescript|js|ts|react)?\s*\n?/i,
    "",
  );
  code = code.replace(/```\s*$/, "");

  // Remove any JSON-like content that might have leaked in
  // (remove lines that look like JSON objects/arrays at the start)
  const lines = code.split("\n");
  let startIndex = 0;

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    // Skip lines that are pure JSON artifacts
    if (
      trimmed.match(/^[\[\{]/) ||
      trimmed.match(/^"(title|severity|explanation|suggestedFix)":/)
    ) {
      startIndex = i + 1;
    } else if (
      trimmed.match(
        /^(import |export |function |const |let |var |class |interface |type |\/\/|\/\*)/,
      )
    ) {
      // Found start of actual code
      break;
    }
  }

  if (startIndex > 0) {
    code = lines.slice(startIndex).join("\n");
  }

  // Trim the code to end at the last meaningful code character
  // (remove any trailing markdown or explanatory text)
  const lastMeaningfulIndex = Math.max(
    code.lastIndexOf("}"),
    code.lastIndexOf(">"),
    code.lastIndexOf(";"),
  );

  if (lastMeaningfulIndex !== -1) {
    // Check if there's substantial content after this point
    const afterLast = code.slice(lastMeaningfulIndex + 1).trim();
    // If what's after is just whitespace or looks like markdown/explanation, cut it
    if (
      !afterLast ||
      afterLast.match(/^(```|Here|This|The|Note:|Explanation:)/i)
    ) {
      code = code.slice(0, lastMeaningfulIndex + 1);
    }
  }

  return code.trim();
}

function shouldMergeAstWithLlm(): boolean {
  return process.env.ANALYZE_LLM_ONLY !== "1";
}

// Async Groq-powered analyzer
export async function analyzeCodeWithGroq(
  code: string,
  platform: string = "both",
): Promise<AnalysisResult> {
  const prompt = `
Analyze the following React / React Native code for performance, SSR, bundle size, SEO, and Core Web Vitals–related issues.

Target platform focus: ${platform} (ios | android | both). For web-only or Next.js code, still report SSR, data-fetching, head/metadata, image/layout, and script-loading concerns even when the platform is mobile-focused.

## React (web) & hydration
- Expensive render work, missing memoization, unstable props, context misuse.
- dangerouslySetInnerHTML and other XSS-prone patterns.
- Deprecated APIs (e.g. findDOMNode) and patterns that break concurrent rendering.

## Next.js (Pages / App Router when inferable)
- getServerSideProps / getStaticProps / getStaticPaths: TTFB, caching, ISR/revalidate tradeoffs.
- next/head or metadata: unique title, meta description, Open Graph basics where relevant.
- next/image vs raw <img>, next/script loading strategy (async/defer), dynamic import and client boundaries.

## Bundle size
- Heavy barrel imports (lodash default, large icon barrels), duplicative dependencies, oversized client chunks.

## SEO & Core Web Vitals (heuristic; no lab measurement here)
- CLS risks: images without dimensions, late-loading fonts without fallbacks (if visible in code).
- INP / main-thread: long synchronous handlers, huge effects on mount.
- LCP: hero image priority, avoid blocking scripts in critical path.

## JS bridge / native interop (React Native — consider carefully)
- NativeModules, TurboModuleRegistry.get, and synchronous native work during render or tight loops.
- NativeEventEmitter subscriptions: ensure remove/cleanup on unmount; avoid leaking listeners.
- Large object clones or chatty native calls across the bridge; batch or defer where possible.
- After navigation or animations, defer non-urgent work with InteractionManager.runAfterInteractions when appropriate.

## Memory (high-level; avoid false precision)
- Images and assets: dimensions, caching, and avoiding unbounded in-memory lists of decoded images.
- Global caches, module-level singletons holding large graphs, and unbounded list state.
- useEffect cleanups for subscriptions, timers, and listeners; closure captures of large arrays/objects in long-lived callbacks.
- On Android vs iOS, call out platform-relevant notes when ${platform} is not "both".

## Lists / lists virtualization
- FlatList / SectionList: keyExtractor, stable keys, item/row memoization, and tuning props (windowSize, maxToRenderPerBatch, removeClippedSubviews) for long lists.

When an issue relates to bridge, memory, or lists, reflect that in the title (e.g. include words like "bridge", "native", "memory", "FlatList", "subscription") so it can be deduplicated against static checks.

YOU MUST respond in this EXACT format:
1. First, output a JSON array of issues with this structure:
[
  {
    "title": "Issue name",
    "severity": "critical|high|medium|low",
    "explanation": "Why this is an issue",
    "suggestedFix": "How to fix it"
  }
]

2. Then, IMMEDIATELY after the JSON array, output the optimized code in a markdown code block like this:
\`\`\`jsx
// Your optimized code here
\`\`\`

DO NOT include any explanatory text between the JSON and the code block.
DO NOT include any text after the code block.

Code to analyze:
${code}
`;

  let llmIssues: Issue[] = [];
  let optimizedCode = "";

  try {
    console.log("[Groq] About to call Groq LLM...");
    const responseText = await callGroq(prompt);
    console.log(
      "[Groq] LLM response received (first 500 chars):",
      responseText.slice(0, 500),
    );

    llmIssues = mapLlmIssuesToIssues(extractIssuesJSON(responseText));

    if (llmIssues.length > 0) {
      console.log(
        `[Groq] Found ${llmIssues.length} issues from LLM`,
      );
    } else {
      console.warn("[Groq] No issues found in response");
    }

    optimizedCode = extractOptimizedCode(responseText);

    if (!optimizedCode) {
      console.warn("[Groq] Failed to extract optimized code, using original");
      optimizedCode = code;
    }
  } catch (err) {
    console.error("[Groq] API error in analyzer:", err);
    llmIssues = mapLlmIssuesToIssues([
      {
        title: "Groq API Error",
        severity: "critical",
        explanation: "Failed to analyze code with AI.",
        suggestedFix: "Check API key, network connection, and try again.",
      },
    ]);
    optimizedCode = code;
  }

  const issues: Issue[] = shouldMergeAstWithLlm()
    ? mergeAstAndLlmIssues(analyzeCode(code).issues as Issue[], llmIssues)
    : llmIssues;

  const mi = issues as MetricsIssue[];
  const fps = estimateFPS(mi);
  const renderTime = estimateRenderTime(mi);
  const memory = estimateMemory(mi);
  const reRenders = estimateReRenders(mi);
  const score = calculatePerformanceScore(mi);
  const seoReadiness = estimateSeoReadiness(mi);
  const topBottleneck = pickTopBottleneckFromIssues(issues);

  return {
    overallScore: score,
    optimizedScore: 100,
    issues,
    metrics: {
      fps,
      renderTime,
      memory,
      reRenders,
      seoReadiness,
    },
    optimizedCode,
    topBottleneck,
    analyzedAt: new Date().toISOString(),
  };
}
