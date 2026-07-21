import type { NodePath } from "@babel/traverse";
import * as t from "@babel/types";

/**
 * Import-level bundle weight heuristics (web / universal code).
 */
export function detectBundleHeuristics(path: NodePath, issues: unknown[]) {
  if (!path.isImportDeclaration()) return;
  const src = path.node.source;
  if (!t.isStringLiteral(src)) return;
  const value = src.value;

  if (value === "lodash") {
    issues.push({
      id: `bundle-lodash-${path.node.start ?? 0}`,
      severity: "high",
      type: "bundle-lodash",
      title: "Importing full lodash package",
      location: { start: path.node.start ?? 0, end: path.node.end ?? 0 },
      impact: {},
      explanation:
        "The default lodash entry pulls a large surface area into the bundle. Prefer per-method imports (lodash/debounce), lodash-es with tree-shaking, or native alternatives where possible.",
    });
    return;
  }

  if (value === "@mui/icons-material") {
    issues.push({
      id: `bundle-mui-icons-${path.node.start ?? 0}`,
      severity: "high",
      type: "bundle-mui-icons",
      title: "Barrel import from @mui/icons-material",
      location: { start: path.node.start ?? 0, end: path.node.end ?? 0 },
      impact: {},
      explanation:
        "The main icons barrel can explode bundle size. Import specific icons from deep paths (e.g. @mui/icons-material/Search) or configure modularizeImports/babel-plugin-imports for your bundler.",
    });
  }
}
