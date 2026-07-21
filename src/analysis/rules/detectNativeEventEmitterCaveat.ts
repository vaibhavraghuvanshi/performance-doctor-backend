import type { NodePath } from "@babel/traverse";
import * as t from "@babel/types";

/**
 * Soft warning: NativeEventEmitter without obvious cleanup in the same function scope.
 * Heuristic only — many patterns use separate hooks or helpers.
 */
export function detectNativeEventEmitterCaveat(path: NodePath, issues: unknown[]) {
  if (!path.isNewExpression()) return;
  const callee = path.node.callee;
  if (!t.isIdentifier(callee, { name: "NativeEventEmitter" })) return;

  const fn = path.findParent(
    (p) =>
      p.isFunctionDeclaration() ||
      p.isFunctionExpression() ||
      p.isArrowFunctionExpression(),
  );
  if (!fn) return;

  const fnNode = fn.node as
    | t.FunctionDeclaration
    | t.FunctionExpression
    | t.ArrowFunctionExpression;
  const bodyNode = fnNode.body;
  if (!t.isBlockStatement(bodyNode)) return;

  let hasCleanup = false;
  t.traverseFast(bodyNode, (node) => {
    if (hasCleanup) return t.traverseFast.stop;
    if (t.isCallExpression(node)) {
      const c = node.callee;
      if (t.isMemberExpression(c) && t.isIdentifier(c.property, { name: "remove" })) {
        hasCleanup = true;
        return t.traverseFast.stop;
      }
      if (t.isIdentifier(c, { name: "remove" })) {
        hasCleanup = true;
        return t.traverseFast.stop;
      }
    }
    if (
      t.isOptionalMemberExpression(node) &&
      t.isIdentifier(node.property, { name: "remove" })
    ) {
      hasCleanup = true;
      return t.traverseFast.stop;
    }
  });

  if (hasCleanup) return;

  issues.push({
    id: `native-event-emitter-${path.node.start}`,
    severity: "low",
    type: "native-event-emitter",
    title: "NativeEventEmitter: verify subscription cleanup",
    location: { start: path.node.start ?? 0, end: path.node.end ?? 0 },
    impact: {},
    explanation:
      "Subscriptions from NativeEventEmitter should be removed on unmount (subscription.remove()) to avoid leaks and duplicate handlers. This is a heuristic scan; your cleanup may live in a child hook.",
  });
}
