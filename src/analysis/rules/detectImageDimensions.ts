import type { NodePath } from "@babel/traverse";
import * as t from "@babel/types";

function hasDimensionStyle(styleExpr: t.Expression): boolean {
  if (t.isObjectExpression(styleExpr)) {
    for (const prop of styleExpr.properties) {
      if (!t.isObjectProperty(prop) && !t.isObjectMethod(prop)) continue;
      const key = prop.key;
      if (t.isIdentifier(key, { name: "width" }) || t.isIdentifier(key, { name: "height" }))
        return true;
      if (t.isStringLiteral(key, { value: "width" }) || t.isStringLiteral(key, { value: "height" }))
        return true;
    }
  }
  return false;
}

function openingHasWidthHeight(opening: t.JSXOpeningElement): boolean {
  for (const attr of opening.attributes) {
    if (!t.isJSXAttribute(attr) || !t.isJSXIdentifier(attr.name)) continue;
    const n = attr.name.name;
    if (n === "width" || n === "height") return true;
    if (n === "style" && attr.value && t.isJSXExpressionContainer(attr.value)) {
      const ex = attr.value.expression;
      if (hasDimensionStyle(ex as t.Expression)) return true;
    }
  }
  return false;
}

/**
 * Image without explicit dimensions can cause layout thrash and decode/memory surprises.
 */
export function detectImageDimensions(path: NodePath, issues: unknown[]) {
  if (!path.isJSXOpeningElement()) return;
  const name = path.node.name;
  const isImage =
    t.isJSXIdentifier(name, { name: "Image" }) ||
    (t.isJSXMemberExpression(name) && t.isJSXIdentifier(name.property, { name: "Image" }));
  if (!isImage) return;

  if (openingHasWidthHeight(path.node)) return;

  issues.push({
    id: `image-dimensions-${path.node.start}`,
    severity: "medium",
    type: "image-dimensions",
    title: "Image missing explicit width/height",
    location: { start: path.node.start ?? 0, end: path.node.end ?? 0 },
    impact: {},
    explanation:
      "Remote images without width and height force layout passes after decode. Set width/height (or style dimensions) or use a known aspect ratio to reduce layout thrash and improve perceived performance.",
  });
}
