import type { NodePath } from "@babel/traverse";
import * as t from "@babel/types";

function isSectionListOpening(path: NodePath): boolean {
  if (!path.isJSXOpeningElement()) return false;
  const name = path.node.name;
  if (t.isJSXIdentifier(name, { name: "SectionList" })) return true;
  return (
    t.isJSXMemberExpression(name) &&
    t.isJSXIdentifier(name.property, { name: "SectionList" })
  );
}

/**
 * SectionList presence + keyExtractor (parallel to FlatList hygiene).
 */
export function detectSectionList(path: NodePath, issues: unknown[]) {
  if (!path.isJSXOpeningElement() || !isSectionListOpening(path)) return;

  issues.push({
    id: `sectionlist-${path.node.start}`,
    severity: "low",
    type: "sectionlist",
    title: "SectionList usage detected",
    location: { start: path.node.start ?? 0, end: path.node.end ?? 0 },
    impact: {},
    explanation:
      "SectionList can be efficient for grouped content. Review keyExtractor, renderSectionHeader, and item/section memoization for scroll performance.",
  });

  const hasKeyExtractor = path.node.attributes.some(
    (attr) =>
      t.isJSXAttribute(attr) &&
      t.isJSXIdentifier(attr.name, { name: "keyExtractor" }),
  );

  if (!hasKeyExtractor) {
    issues.push({
      id: `sectionlist-key-extractor-${path.node.start}`,
      severity: "high",
      type: "sectionlist-key-extractor",
      title: "SectionList is missing keyExtractor",
      location: { start: path.node.start ?? 0, end: path.node.end ?? 0 },
      impact: {},
      explanation:
        "SectionList should define keyExtractor for stable keys across items and sections to avoid reconciliation issues.",
    });
  }
}
