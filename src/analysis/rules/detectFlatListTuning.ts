import type { NodePath } from "@babel/traverse";
import * as t from "@babel/types";

function isFlatListOpening(path: NodePath): boolean {
  if (!path.isJSXOpeningElement()) return false;
  const name = path.node.name;
  if (t.isJSXIdentifier(name, { name: "FlatList" })) return true;
  return (
    t.isJSXMemberExpression(name) &&
    t.isJSXIdentifier(name.property, { name: "FlatList" })
  );
}

function hasProp(jsxOpening: t.JSXOpeningElement, propName: string): boolean {
  return jsxOpening.attributes.some(
    (attr) =>
      t.isJSXAttribute(attr) &&
      t.isJSXIdentifier(attr.name, { name: propName }),
  );
}

/**
 * Suggests common FlatList virtualization tuning props (low severity).
 */
export function detectFlatListTuning(path: NodePath, issues: unknown[]) {
  if (!path.isJSXOpeningElement() || !isFlatListOpening(path)) return;

  const opening = path.node;
  const missing: string[] = [];
  if (!hasProp(opening, "windowSize")) missing.push("windowSize");
  if (!hasProp(opening, "maxToRenderPerBatch")) missing.push("maxToRenderPerBatch");
  if (!hasProp(opening, "removeClippedSubviews")) missing.push("removeClippedSubviews");

  if (missing.length === 0) return;

  issues.push({
    id: `flatlist-tuning-${path.node.start}`,
    severity: "low",
    type: "flatlist-tuning",
    title: "FlatList virtualization tuning",
    location: { start: path.node.start ?? 0, end: path.node.end ?? 0 },
    impact: {},
    explanation: `This FlatList omits some common tuning props (${missing.join(", ")}). For long lists, tuning windowSize, maxToRenderPerBatch, and removeClippedSubviews can reduce memory and improve scroll performance. Adjust based on item complexity and target devices.`,
  });
}
