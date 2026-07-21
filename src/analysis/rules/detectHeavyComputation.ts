import type { NodePath } from "@babel/traverse";
import * as t from "@babel/types";
import { isInsideFunctionReturningJSX } from "./renderPath";

/**
 * Detects heavy computation (loops, Array.map/filter/reduce) inside render-like paths.
 */
export function detectHeavyComputation(path: NodePath, issues: any[]) {
  if (
    path.isForStatement() ||
    path.isWhileStatement() ||
    path.isDoWhileStatement()
  ) {
    if (!isInsideFunctionReturningJSX(path)) return;
    issues.push({
      id: `heavy-computation-${path.node.start}`,
      severity: "medium",
      type: "heavy-computation",
      title: `Heavy computation (loop) detected in render`,
      location: { start: path.node.start, end: path.node.end },
      impact: {},
      explanation: `Loops inside render or function components can cause performance issues. Move heavy computation outside render or memoize results.`,
    });
    return;
  }

  if (path.isCallExpression()) {
    const callee = path.node.callee;
    if (
      t.isMemberExpression(callee) &&
      t.isIdentifier(callee.property) &&
      ["map", "filter", "reduce"].includes(callee.property.name)
    ) {
      if (!isInsideFunctionReturningJSX(path)) return;
      issues.push({
        id: `heavy-computation-${path.node.start}`,
        severity: "medium",
        type: "heavy-computation",
        title: `Heavy computation (${callee.property.name}) detected in render`,
        location: { start: path.node.start, end: path.node.end },
        impact: {},
        explanation: `Array.${callee.property.name} inside render or function components can cause performance issues. Move heavy computation outside render or memoize results.`,
      });
    }
  }
}
