import type { NodePath } from "@babel/traverse";
import * as t from "@babel/types";

/**
 * React web patterns that affect security, compatibility, or runtime cost.
 */
export function detectReactWebPatterns(path: NodePath, issues: unknown[]) {
  if (path.isJSXAttribute() && t.isJSXIdentifier(path.node.name, { name: "dangerouslySetInnerHTML" })) {
    issues.push({
      id: `react-danger-html-${path.node.start ?? 0}`,
      severity: "medium",
      type: "react-unsafe-html",
      title: "dangerouslySetInnerHTML bypasses React XSS sanitization",
      location: { start: path.node.start ?? 0, end: path.node.end ?? 0 },
      impact: {},
      explanation:
        "Setting inner HTML from strings can introduce XSS if content is user-controlled or concatenated from untrusted sources. Prefer structured JSX, sanitize with a vetted library if HTML is required, and scope CSP headers on the document.",
    });
    return;
  }

  if (!path.isCallExpression()) return;
  const callee = path.node.callee;
  if (t.isIdentifier(callee, { name: "findDOMNode" })) {
    issues.push({
      id: `react-finddomnode-${path.node.start ?? 0}`,
      severity: "high",
      type: "react-find-dom-node",
      title: "findDOMNode is deprecated and breaks concurrent rendering",
      location: { start: path.node.start ?? 0, end: path.node.end ?? 0 },
      impact: {},
      explanation:
        "findDOMNode reaches into the host tree imperatively, couples to implementation details, and is incompatible with modern React. Prefer refs (useRef / callback refs) or composition patterns instead.",
    });
  }
}
