import type { NodePath } from "@babel/traverse";
import * as t from "@babel/types";

/**
 * Returns true if `path` sits inside a function body that contains at least one
 * return of JSX (heuristic for "render-like" React / RN components).
 */
export function isInsideFunctionReturningJSX(path: NodePath): boolean {
  const fn = path.findParent(
    (p) =>
      p.isArrowFunctionExpression() ||
      p.isFunctionExpression() ||
      p.isFunctionDeclaration(),
  );
  if (!fn) return false;

  if (fn.isArrowFunctionExpression() && !fn.get("body").isBlockStatement()) {
    const b = fn.get("body");
    if (b.isJSXElement() || b.isJSXFragment()) return true;
    if (b.isParenthesizedExpression()) {
      const inner = b.node.expression;
      if (t.isJSXElement(inner) || t.isJSXFragment(inner)) return true;
    }
  }

  let hasJsxReturn = false;
  fn.traverse({
    ReturnStatement(retPath) {
      const arg = retPath.node.argument;
      if (!arg) return;
      if (t.isJSXElement(arg) || t.isJSXFragment(arg)) {
        hasJsxReturn = true;
        return;
      }
      if (t.isParenthesizedExpression(arg)) {
        const inner = arg.expression;
        if (t.isJSXElement(inner) || t.isJSXFragment(inner)) hasJsxReturn = true;
      }
    },
  });

  return hasJsxReturn;
}
