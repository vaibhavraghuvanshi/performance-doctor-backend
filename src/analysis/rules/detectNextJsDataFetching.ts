import type { NodePath } from "@babel/traverse";
import * as t from "@babel/types";

function pushDataFetchingIssue(name: string, node: t.Node, issues: unknown[]) {
  const start = node.start ?? 0;
  const end = node.end ?? 0;
  if (name === "getServerSideProps") {
    issues.push({
      id: `next-gssp-${start}`,
      severity: "low",
      type: "next-ssr-gssp",
      title: "Next.js: getServerSideProps (per-request SSR)",
      location: { start, end },
      impact: {},
      explanation:
        "Runs on the server for every document request to this route. Useful for fresh data but can raise TTFB and server load versus static generation or ISR. Consider caching (Cache-Control), streaming, or moving stable data to getStaticProps when acceptable.",
    });
  } else if (name === "getStaticProps") {
    issues.push({
      id: `next-gsp-${start}`,
      severity: "low",
      type: "next-ssr-gsp",
      title: "Next.js: getStaticProps (SSG / ISR data)",
      location: { start, end },
      impact: {},
      explanation:
        "Runs at build time and optionally on revalidation. Good for throughput; watch for slow upstream calls during build and tune revalidate to balance freshness vs cost.",
    });
  } else if (name === "getStaticPaths") {
    issues.push({
      id: `next-gspaths-${start}`,
      severity: "low",
      type: "next-ssr-gspaths",
      title: "Next.js: getStaticPaths (dynamic SSG segments)",
      location: { start, end },
      impact: {},
      explanation:
        "Controls which dynamic route params are pre-rendered. fallback: 'blocking' can add latency on first uncached hits—prebuild high-traffic paths and monitor cold-cache behavior.",
    });
  }
}

/**
 * Pages Router data hooks — SSR / SSG implications for performance review.
 */
export function detectNextJsDataFetching(path: NodePath, issues: unknown[]) {
  if (!path.isExportNamedDeclaration()) return;
  const declaration = path.node.declaration;
  if (t.isFunctionDeclaration(declaration) && declaration.id) {
    pushDataFetchingIssue(declaration.id.name, declaration, issues);
    return;
  }
  if (t.isVariableDeclaration(declaration)) {
    for (const d of declaration.declarations) {
      if (t.isIdentifier(d.id)) {
        pushDataFetchingIssue(d.id.name, d, issues);
      }
    }
  }
}
