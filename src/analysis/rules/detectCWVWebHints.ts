import type { NodePath } from "@babel/traverse";
import * as t from "@babel/types";

function openingHasWidthOrHeight(opening: t.JSXOpeningElement): boolean {
  for (const attr of opening.attributes) {
    if (!t.isJSXAttribute(attr) || !t.isJSXIdentifier(attr.name)) continue;
    const n = attr.name.name;
    if (n === "width" || n === "height") return true;
    if (n === "style" && attr.value && t.isJSXExpressionContainer(attr.value)) {
      const ex = attr.value.expression;
      if (t.isObjectExpression(ex)) {
        for (const prop of ex.properties) {
          if (!t.isObjectProperty(prop) && !t.isObjectMethod(prop)) continue;
          const key = prop.key;
          if (t.isIdentifier(key, { name: "width" }) || t.isIdentifier(key, { name: "height" }))
            return true;
          if (
            t.isStringLiteral(key, { value: "width" }) ||
            t.isStringLiteral(key, { value: "height" })
          )
            return true;
        }
      }
    }
  }
  return false;
}

function scriptLooksRenderBlocking(opening: t.JSXOpeningElement): boolean {
  let hasSrc = false;
  let asyncOrDefer = false;
  for (const attr of opening.attributes) {
    if (!t.isJSXAttribute(attr) || !t.isJSXIdentifier(attr.name)) continue;
    const n = attr.name.name;
    if (n === "src") hasSrc = true;
    if (n === "async" || n === "defer") asyncOrDefer = true;
  }
  return hasSrc && !asyncOrDefer;
}

/**
 * Web Core Web Vitals–adjacent hints (CLS, blocking scripts).
 */
export function detectCWVWebHints(path: NodePath, issues: unknown[]) {
  if (!path.isJSXOpeningElement()) return;
  const name = path.node.name;

  if (t.isJSXIdentifier(name, { name: "img" })) {
    if (openingHasWidthOrHeight(path.node)) return;
    issues.push({
      id: `cwv-img-${path.node.start ?? 0}`,
      severity: "low",
      type: "cwv-img-layout",
      title: "Web <img> missing explicit width/height",
      location: { start: path.node.start ?? 0, end: path.node.end ?? 0 },
      impact: {},
      explanation:
        "Images without reserved space can cause cumulative layout shift (CLS). Set width/height attributes, aspect-ratio in CSS, or use next/image with sizes for responsive layouts.",
    });
    return;
  }

  if (t.isJSXIdentifier(name, { name: "script" }) && scriptLooksRenderBlocking(path.node)) {
    issues.push({
      id: `cwv-script-${path.node.start ?? 0}`,
      severity: "medium",
      type: "cwv-blocking-script",
      title: "Potentially render-blocking <script> (no async/defer)",
      location: { start: path.node.start ?? 0, end: path.node.end ?? 0 },
      impact: {},
      explanation:
        "Parser-blocking scripts delay First Contentful Paint. Prefer async or defer for non-critical scripts, load critical code inline with small footprint, or split with dynamic import after hydration when safe.",
    });
  }
}
