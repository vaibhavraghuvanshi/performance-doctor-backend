import type { NodePath } from "@babel/traverse";
import * as t from "@babel/types";

function isFlatListElement(path: NodePath): boolean {
  if (!path.isJSXElement()) return false;
  const opening = path.node.openingElement.name;
  if (t.isJSXIdentifier(opening, { name: "FlatList" })) return true;
  return (
    t.isJSXMemberExpression(opening) &&
    t.isJSXIdentifier(opening.property, { name: "FlatList" })
  );
}

function isIndexLikeKey(name: string): boolean {
  return name === "index" || name === "i" || name === "idx" || name === "rowIndex";
}

/**
 * Warns when key={index} (or similar) appears inside a FlatList renderItem callback.
 */
export function detectFlatListKeyIndex(path: NodePath, issues: unknown[]) {
  if (!path.isJSXAttribute()) return;
  if (!path.get("name").isJSXIdentifier({ name: "key" })) return;

  const val = path.get("value");
  if (!val.isJSXExpressionContainer()) return;
  const expr = val.get("expression");
  if (!expr.isIdentifier()) return;
  if (!isIndexLikeKey(expr.node.name)) return;

  const renderItemAttr = path.findParent(
    (p) =>
      p.isJSXAttribute() &&
      p.get("name").isJSXIdentifier({ name: "renderItem" }),
  );
  if (!renderItemAttr) return;

  const flatList = renderItemAttr.findParent((p) => p.isJSXElement() && isFlatListElement(p));
  if (!flatList) return;

  issues.push({
    id: `flatlist-key-index-${path.node.start}`,
    severity: "medium",
    type: "flatlist-key-index",
    title: "Unstable list key (index) inside FlatList renderItem",
    location: { start: path.node.start ?? 0, end: path.node.end ?? 0 },
    impact: {},
    explanation:
      "Using array index as key can cause incorrect updates and extra work when items reorder or the list mutates. Prefer a stable id from your model (keyExtractor returning item.id).",
  });
}
