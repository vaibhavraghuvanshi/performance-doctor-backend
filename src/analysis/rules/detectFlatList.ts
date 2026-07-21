import { NodePath } from "@babel/traverse";
import * as t from "@babel/types";

/**
 * Detects usage of FlatList in JSX and adds a basic issue (expand as needed)
 */
export function detectFlatList(path: NodePath, issues: any[]) {
  if (path.isJSXElement()) {
    const opening = path.node.openingElement;
    if (
      t.isJSXIdentifier(opening.name, { name: "FlatList" }) ||
      (t.isJSXMemberExpression(opening.name) &&
        opening.name.property.name === "FlatList")
    ) {
      issues.push({
        id: `flatlist-${path.node.start}`,
        severity: "low",
        type: "flatlist",
        title: `FlatList usage detected`,
        location: { start: path.node.start, end: path.node.end },
        impact: {},
        explanation: `FlatList is used in this component. Review for performance best practices (keyExtractor, memoization, etc.).`,
      });
    }
  }
}
