import { NodePath } from "@babel/traverse";
import * as t from "@babel/types";

/**
 * Detects FlatList JSX elements that do not have a keyExtractor prop
 */
export function detectMissingKeyExtractor(path: NodePath, issues: any[]) {
  if (path.isJSXElement()) {
    const opening = path.node.openingElement;
    if (
      t.isJSXIdentifier(opening.name, { name: "FlatList" }) ||
      (t.isJSXMemberExpression(opening.name) &&
        opening.name.property.name === "FlatList")
    ) {
      const hasKeyExtractor = opening.attributes.some(
        (attr) =>
          t.isJSXAttribute(attr) &&
          t.isJSXIdentifier(attr.name, { name: "keyExtractor" }),
      );
      if (!hasKeyExtractor) {
        issues.push({
          id: `missing-key-extractor-${path.node.start}`,
          severity: "high",
          type: "missing-key-extractor",
          title: `FlatList is missing keyExtractor prop`,
          location: { start: path.node.start, end: path.node.end },
          impact: {},
          explanation: `FlatList should define a keyExtractor prop to ensure stable item keys and avoid rendering issues.`,
        });
      }
    }
  }
}
