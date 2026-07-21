import type { NodePath } from "@babel/traverse";
import * as t from "@babel/types";

function isMemoCall(expr: t.Expression): boolean {
  if (t.isIdentifier(expr, { name: "memo" })) return true;
  return (
    t.isMemberExpression(expr) &&
    t.isIdentifier(expr.object, { name: "React" }) &&
    t.isIdentifier(expr.property, { name: "memo" })
  );
}

function isMemoCallCallee(callee: t.Expression | t.V8IntrinsicIdentifier): boolean {
  return t.isExpression(callee) && isMemoCall(callee);
}

function functionReturnsJsx(fn: t.Function): boolean {
  if (t.isArrowFunctionExpression(fn) && !t.isBlockStatement(fn.body)) {
    const b = fn.body;
    if (t.isJSXElement(b) || t.isJSXFragment(b)) return true;
    if (t.isParenthesizedExpression(b)) {
      const inner = b.expression;
      return t.isJSXElement(inner) || t.isJSXFragment(inner);
    }
    return false;
  }
  let found = false;
  const visitBlock = (body: t.Statement[]) => {
    for (const st of body) {
      if (!t.isReturnStatement(st) || !st.argument) continue;
      const arg = st.argument;
      if (t.isJSXElement(arg) || t.isJSXFragment(arg)) {
        found = true;
        return;
      }
      if (t.isParenthesizedExpression(arg)) {
        const inner = arg.expression;
        if (t.isJSXElement(inner) || t.isJSXFragment(inner)) found = true;
      }
    }
  };
  if (t.isBlockStatement(fn.body)) {
    visitBlock(fn.body.body);
  }
  return found;
}

/**
 * Builds sets of component names that are already memo-wrapped (heuristic).
 */
function collectMemoBindings(program: t.Program): {
  memoizedBindingNames: Set<string>;
  innerNamesPassedToMemo: Set<string>;
} {
  const memoizedBindingNames = new Set<string>();
  const innerNamesPassedToMemo = new Set<string>();

  const recordMemoCall = (call: t.CallExpression) => {
    if (!isMemoCallCallee(call.callee)) return;
    const arg0 = call.arguments[0];
    if (!arg0 || t.isSpreadElement(arg0) || t.isArgumentPlaceholder(arg0)) return;
    if (t.isIdentifier(arg0)) innerNamesPassedToMemo.add(arg0.name);
    if (t.isFunctionExpression(arg0) && arg0.id) {
      innerNamesPassedToMemo.add(arg0.id.name);
    }
  };

  for (const stmt of program.body) {
    if (t.isVariableDeclaration(stmt)) {
      for (const decl of stmt.declarations) {
        if (!t.isIdentifier(decl.id) || !decl.init) continue;
        if (t.isCallExpression(decl.init) && isMemoCallCallee(decl.init.callee)) {
          memoizedBindingNames.add(decl.id.name);
          recordMemoCall(decl.init);
        }
      }
    }
    if (t.isExportDefaultDeclaration(stmt)) {
      const d = stmt.declaration;
      if (t.isCallExpression(d) && isMemoCallCallee(d.callee)) {
        recordMemoCall(d);
      }
    }
  }

  return { memoizedBindingNames, innerNamesPassedToMemo };
}

function findBindingForName(
  program: t.Program,
  name: string,
): { fn: t.Function; loc: t.Node } | null {
  for (const stmt of program.body) {
    if (t.isFunctionDeclaration(stmt) && stmt.id?.name === name) {
      return { fn: stmt, loc: stmt };
    }
    if (t.isVariableDeclaration(stmt)) {
      for (const decl of stmt.declarations) {
        if (!t.isIdentifier(decl.id, { name }) || !decl.init) continue;
        if (t.isArrowFunctionExpression(decl.init) || t.isFunctionExpression(decl.init)) {
          return { fn: decl.init, loc: decl };
        }
      }
    }
    if (t.isExportDefaultDeclaration(stmt)) {
      const d = stmt.declaration;
      if (t.isFunctionDeclaration(d) && d.id?.name === name) {
        return { fn: d, loc: d };
      }
    }
    if (t.isExportNamedDeclaration(stmt) && t.isFunctionDeclaration(stmt.declaration)) {
      const fd = stmt.declaration;
      if (fd.id?.name === name) return { fn: fd, loc: fd };
    }
  }
  return null;
}

/**
 * Flags top-level function components that return JSX but are not obviously wrapped in React.memo.
 */
export function detectMissingMemo(path: NodePath, issues: any[]) {
  if (!path.isProgram()) return;

  const program = path.node;
  const { memoizedBindingNames, innerNamesPassedToMemo } =
    collectMemoBindings(program);

  const candidates = new Map<string, { start: number; end: number }>();

  const consider = (name: string, locNode: t.Node) => {
    if (!locNode.start) return;
    if (memoizedBindingNames.has(name)) return;
    if (innerNamesPassedToMemo.has(name)) return;
    if (!candidates.has(name)) {
      candidates.set(name, {
        start: locNode.start,
        end: locNode.end ?? locNode.start,
      });
    }
  };

  for (const stmt of program.body) {
    if (t.isFunctionDeclaration(stmt) && stmt.id) {
      if (functionReturnsJsx(stmt)) consider(stmt.id.name, stmt);
    }
    if (t.isVariableDeclaration(stmt)) {
      for (const decl of stmt.declarations) {
        if (!t.isIdentifier(decl.id) || !decl.init) continue;
        if (t.isCallExpression(decl.init) && isMemoCallCallee(decl.init.callee)) {
          continue;
        }
        const init = decl.init;
        if (t.isArrowFunctionExpression(init) || t.isFunctionExpression(init)) {
          if (functionReturnsJsx(init)) consider(decl.id.name, decl);
        }
      }
    }
    if (t.isExportDefaultDeclaration(stmt)) {
      const d = stmt.declaration;
      if (t.isFunctionDeclaration(d) && d.id && functionReturnsJsx(d)) {
        consider(d.id.name, d);
      }
      if (t.isIdentifier(d)) {
        const binding = findBindingForName(program, d.name);
        if (binding && functionReturnsJsx(binding.fn)) consider(d.name, binding.loc);
      }
    }
    if (t.isExportNamedDeclaration(stmt) && t.isFunctionDeclaration(stmt.declaration)) {
      const fd = stmt.declaration;
      if (fd.id && functionReturnsJsx(fd)) consider(fd.id.name, fd);
    }
  }

  for (const [componentName, loc] of candidates) {
    issues.push({
      id: `missing-memo-${componentName}`,
      severity: "medium",
      type: "missing-memo",
      title: `Component '${componentName}' is not wrapped in React.memo`,
      location: { start: loc.start, end: loc.end },
      impact: {},
      explanation: `Function component '${componentName}' returns JSX but is not wrapped in React.memo. This may cause unnecessary re-renders if used in lists or as children.`,
    });
  }
}
