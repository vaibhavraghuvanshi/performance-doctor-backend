import type { NodePath } from "@babel/traverse";
import * as t from "@babel/types";
import { isInsideFunctionReturningJSX } from "./renderPath";

function isTurboModuleRegistryGet(callee: t.Expression): boolean {
  return (
    t.isMemberExpression(callee) &&
    !callee.optional &&
    t.isIdentifier(callee.object, { name: "TurboModuleRegistry" }) &&
    t.isIdentifier(callee.property, { name: "get" })
  );
}

function isNativeModulesMemberChain(callee: t.Expression): boolean {
  let cur: t.Expression | null = callee;
  while (cur && t.isMemberExpression(cur)) {
    if (t.isIdentifier(cur.object, { name: "NativeModules" })) return true;
    cur = cur.object as t.Expression;
  }
  return false;
}

function isNativeInteropCallee(callee: t.Expression): boolean {
  if (isTurboModuleRegistryGet(callee)) return true;
  return isNativeModulesMemberChain(callee);
}

/**
 * NativeModules / TurboModuleRegistry.get calls inside render-like paths may add bridge pressure.
 */
export function detectBridgeNativeInRender(path: NodePath, issues: unknown[]) {
  if (!path.isCallExpression()) return;
  if (!isNativeInteropCallee(path.node.callee as t.Expression)) return;
  if (!isInsideFunctionReturningJSX(path)) return;

  issues.push({
    id: `bridge-native-render-${path.node.start}`,
    severity: "medium",
    type: "bridge-native-call",
    title: "Native module call in render path",
    location: { start: path.node.start ?? 0, end: path.node.end ?? 0 },
    impact: {},
    explanation:
      "Calling NativeModules or TurboModuleRegistry during render can add JS↔native bridge traffic and block the JS thread if the native side does synchronous work. Prefer calling in useEffect, event handlers, or background tasks; cache module references outside render.",
  });
}
