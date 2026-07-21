import type { NodePath } from "@babel/traverse";
import * as t from "@babel/types";
import { isInsideFunctionReturningJSX } from "./renderPath";

/**
 * JSON.stringify in hot paths can be expensive for large objects.
 */
export function detectJsonStringifyCost(path: NodePath, issues: unknown[]) {
  if (!path.isCallExpression()) return;
  const callee = path.node.callee;
  if (
    !t.isMemberExpression(callee) ||
    !t.isIdentifier(callee.object, { name: "JSON" }) ||
    !t.isIdentifier(callee.property, { name: "stringify" })
  ) {
    return;
  }

  const inRender = isInsideFunctionReturningJSX(path);
  const parent = path.parentPath;
  const inJsx =
    parent?.isJSXExpressionContainer() ||
    !!path.findParent((p) => p.isJSXAttribute() || p.isJSXOpeningElement());

  if (!inRender && !inJsx) return;

  issues.push({
    id: `json-stringify-${path.node.start}`,
    severity: "low",
    type: "json-stringify-cost",
    title: "JSON.stringify in render or JSX",
    location: { start: path.node.start ?? 0, end: path.node.end ?? 0 },
    impact: {},
    explanation:
      "Serializing large objects with JSON.stringify during render or inside JSX props can allocate heavily and block the JS thread. Precompute a stable string or pass structured props when possible.",
  });
}
