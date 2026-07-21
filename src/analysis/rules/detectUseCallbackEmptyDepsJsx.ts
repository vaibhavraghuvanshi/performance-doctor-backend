import type { NodePath } from "@babel/traverse";
import * as t from "@babel/types";

function hasJsxInFunction(fn: t.Function): boolean {
  let found = false;
  t.traverseFast(fn, (node) => {
    if (found) return t.traverseFast.stop;
    if (t.isJSXElement(node) || t.isJSXFragment(node)) {
      found = true;
      return t.traverseFast.stop;
    }
  });
  return found;
}

function isEmptyDepsArray(
  node: t.Expression | t.SpreadElement | t.ArgumentPlaceholder | undefined,
): boolean {
  return !!(node && t.isArrayExpression(node) && node.elements.length === 0);
}

/**
 * useCallback with [] deps but JSX in the callback often defeats memoization of list item renderers.
 */
export function detectUseCallbackEmptyDepsJsx(path: NodePath, issues: unknown[]) {
  if (!path.isCallExpression()) return;
  const callee = path.node.callee;
  if (!t.isIdentifier(callee, { name: "useCallback" })) return;
  if (path.node.arguments.length < 2) return;
  const fnArg = path.node.arguments[0];
  const deps = path.node.arguments[1];
  if (!isEmptyDepsArray(deps)) return;
  if (!t.isArrowFunctionExpression(fnArg) && !t.isFunctionExpression(fnArg)) return;
  if (!hasJsxInFunction(fnArg)) return;

  issues.push({
    id: `usecallback-empty-jsx-${path.node.start}`,
    severity: "medium",
    type: "usecallback-empty-deps-jsx",
    title: "useCallback with empty deps encloses JSX",
    location: { start: path.node.start ?? 0, end: path.node.end ?? 0 },
    impact: {},
    explanation:
      "An empty dependency array freezes the callback identity, but if the callback closes over changing values or returns unstable element trees, children can still re-render. List renderItem callbacks usually need relevant props in the dependency array or a stable child component.",
  });
}
