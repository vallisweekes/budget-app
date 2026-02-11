#!/usr/bin/env node
/*
  Codemod: rewrite deep relative imports (../...) to @/...

  - Rewrites only module specifiers that start with ".." (keeps "./" local imports).
  - Handles:
    - import ... from "..."
    - export ... from "..."
    - dynamic import("...")

  Usage:
    node scripts/codemod-alias-imports.mjs

  Notes:
    - Requires tsconfig.json to have baseUrl "." and paths { "@/*": ["./*"] }
*/

import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

const repoRoot = process.cwd();

function listFiles(dir, out = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === "node_modules" || entry.name === ".next" || entry.name === ".git") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) listFiles(full, out);
    else if (entry.isFile() && (full.endsWith(".ts") || full.endsWith(".tsx"))) out.push(full);
  }
  return out;
}

function normalizeToPosix(p) {
  return p.split(path.sep).join("/");
}

function stripExt(p) {
  return p.replace(/\.(ts|tsx|js|jsx)$/, "");
}

function resolveRelative(fromFile, spec) {
  const fromDir = path.dirname(fromFile);
  const candidate = path.resolve(fromDir, spec);

  const tryPaths = [
    candidate,
    `${candidate}.ts`,
    `${candidate}.tsx`,
    `${candidate}.js`,
    `${candidate}.jsx`,
    path.join(candidate, "index.ts"),
    path.join(candidate, "index.tsx"),
    path.join(candidate, "index.js"),
    path.join(candidate, "index.jsx"),
  ];

  for (const p of tryPaths) {
    if (fs.existsSync(p) && fs.statSync(p).isFile()) return p;
  }
  return null;
}

function toAliasPath(absPath) {
  const rel = path.relative(repoRoot, absPath);
  const posix = normalizeToPosix(rel);

  // drop extension
  const withoutExt = stripExt(posix);

  // drop trailing /index
  const withoutIndex = withoutExt.endsWith("/index") ? withoutExt.slice(0, -"/index".length) : withoutExt;

  return `@/${withoutIndex}`;
}

function shouldRewrite(spec) {
  return typeof spec === "string" && spec.startsWith("..") && !spec.endsWith(".css");
}

function rewriteFile(filePath) {
  const sourceText = fs.readFileSync(filePath, "utf8");
  const sf = ts.createSourceFile(filePath, sourceText, ts.ScriptTarget.Latest, true, filePath.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);

  /** @type {Array<{start:number,end:number,replace:string}>} */
  const edits = [];

  function recordStringLiteral(lit, newValue) {
    // lit includes quotes in its start/end; getStart/getEnd include them.
    edits.push({ start: lit.getStart(sf) + 1, end: lit.getEnd() - 1, replace: newValue });
  }

  function visit(node) {
    // import ... from "..."
    if (ts.isImportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      const spec = node.moduleSpecifier.text;
      if (shouldRewrite(spec)) {
        const resolved = resolveRelative(filePath, spec);
        if (resolved) recordStringLiteral(node.moduleSpecifier, toAliasPath(resolved));
      }
    }

    // export ... from "..."
    if (ts.isExportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      const spec = node.moduleSpecifier.text;
      if (shouldRewrite(spec)) {
        const resolved = resolveRelative(filePath, spec);
        if (resolved) recordStringLiteral(node.moduleSpecifier, toAliasPath(resolved));
      }
    }

    // dynamic import("...")
    if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      node.arguments.length === 1 &&
      ts.isStringLiteral(node.arguments[0])
    ) {
      const spec = node.arguments[0].text;
      if (shouldRewrite(spec)) {
        const resolved = resolveRelative(filePath, spec);
        if (resolved) recordStringLiteral(node.arguments[0], toAliasPath(resolved));
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sf);

  if (edits.length === 0) return { changed: false, count: 0 };

  // Apply edits from end to start so offsets remain valid
  edits.sort((a, b) => b.start - a.start);
  let nextText = sourceText;
  for (const e of edits) {
    nextText = nextText.slice(0, e.start) + e.replace + nextText.slice(e.end);
  }

  if (nextText !== sourceText) {
    fs.writeFileSync(filePath, nextText, "utf8");
    return { changed: true, count: edits.length };
  }

  return { changed: false, count: 0 };
}

const files = listFiles(repoRoot);
let changedFiles = 0;
let changedImports = 0;

for (const f of files) {
  const res = rewriteFile(f);
  if (res.changed) {
    changedFiles += 1;
    changedImports += res.count;
  }
}

console.log(`alias-imports: updated ${changedImports} imports across ${changedFiles} files`);
