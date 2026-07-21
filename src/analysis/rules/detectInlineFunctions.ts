import { NodePath } from "@babel/traverse";
import * as t from "@babel/types";

/**
 * Detects inline arrow functions used as JSX prop values (e.g., renderItem={({item}) => ...})
 */
export function detectInlineFunctions(path: NodePath, issues: any[]) {
  if (path.isJSXAttribute()) {
    const value = path.node.value;
    if (
      t.isJSXExpressionContainer(value) &&
      t.isArrowFunctionExpression(value.expression)
    ) {
      issues.push({
        id: `inline-function-${path.node.start}`,
        severity: "high",
        type: "inline-function",
        title: `Inline arrow function used in prop '${path.node.name.name}'`,
        location: { start: path.node.start, end: path.node.end },
        impact: {},
        explanation: `Passing a new arrow function as a prop (e.g., renderItem) creates a new reference on every render, causing unnecessary re-renders. Move the function outside the render or memoize it.`,
      });
    }
  }
}
