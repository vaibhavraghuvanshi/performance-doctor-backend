import type { NodePath } from "@babel/traverse";
import * as t from "@babel/types";

export type NextHeadTracker = { imported: boolean; hasTitle: boolean };

export function createNextHeadTracker(): NextHeadTracker {
  return { imported: false, hasTitle: false };
}

export function trackNextHeadAndTitle(path: NodePath, tracker: NextHeadTracker) {
  if (path.isImportDeclaration()) {
    const mod = path.node.source;
    if (t.isStringLiteral(mod) && mod.value === "next/head") {
      tracker.imported = true;
    }
    return;
  }
  if (path.isJSXOpeningElement()) {
    const n = path.node.name;
    if (t.isJSXIdentifier(n, { name: "title" })) {
      tracker.hasTitle = true;
    }
  }
}

export function finalizeMissingTitleIssue(tracker: NextHeadTracker, issues: unknown[]) {
  if (!tracker.imported || tracker.hasTitle) return;
  issues.push({
    id: "seo-next-head-no-title",
    severity: "medium",
    type: "seo-next-head-title",
    title: "next/head: no <title> element detected",
    location: { start: 0, end: 0 },
    impact: {},
    explanation:
      "Routes should expose a unique document title for SEO and accessibility. With next/head, add <title>…</title> inside Head, or use the App Router metadata export for equivalent behavior.",
  });
}
