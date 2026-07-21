import { NodePath } from "@babel/traverse";
import * as t from "@babel/types";

/**
 * Detects inline object or array literals used as JSX prop values (e.g., <Comp style={{ color: 'red' }} />)
 */
export function detectInlineObjects(path: NodePath, issues: any[]) {
  if (path.isJSXAttribute()) {
    const value = path.node.value;
    if (
      t.isJSXExpressionContainer(value) &&
      (t.isObjectExpression(value.expression) ||
        t.isArrayExpression(value.expression))
    ) {
      issues.push({
        id: `inline-object-${path.node.start}`,
        severity: "medium",
        type: "inline-object",
        title: `Inline object/array literal used in prop '${path.node.name.name}'`,
        location: { start: path.node.start, end: path.node.end },
        impact: {},
        explanation: `Passing a new object or array literal as a prop causes a new reference on every render, which can lead to unnecessary re-renders. Move the object/array outside the render or memoize it.`,
      });
    }
  }
}
