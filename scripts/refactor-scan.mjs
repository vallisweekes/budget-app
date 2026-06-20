#!/usr/bin/env node
import { promises as fs } from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const TARGET_FOLDERS = [
  "mobile-client/components",
  "web-client/components",
];
const EXTENSIONS = new Set([".ts", ".tsx"]);
const EXCLUDED_SEGMENTS = new Set([
  "node_modules",
  ".git",
  ".next",
  "dist",
  "build",
  "coverage",
  "ios/Pods",
  "ios/build",
  "android/build",
]);
const MAX_COMPONENT_LINES = 200;

function normalizeRel(p) {
  return p.replace(/\\/g, "/");
}

function shouldSkip(relPath) {
  const normalized = normalizeRel(relPath);
  for (const segment of EXCLUDED_SEGMENTS) {
    if (normalized === segment || normalized.startsWith(`${segment}/`) || normalized.includes(`/${segment}/`)) {
      return true;
    }
  }
  return false;
}

async function walk(dir, out = []) {
  let entries = [];
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const relPath = normalizeRel(path.relative(repoRoot, fullPath));
    if (shouldSkip(relPath)) continue;

    if (entry.isDirectory()) {
      await walk(fullPath, out);
      continue;
    }

    const ext = path.extname(entry.name).toLowerCase();
    if (!EXTENSIONS.has(ext)) continue;
    out.push({ fullPath, relPath });
  }

  return out;
}

function countLines(content) {
  if (!content) return 0;
  return content.split(/\r\n|\n|\r/).length;
}

function findInlineTypeDecls(content) {
  const lines = content.split(/\r\n|\n|\r/);
  const results = [];

  for (let idx = 0; idx < lines.length; idx += 1) {
    const line = lines[idx];
    const isTypeDecl = /^\s*type\s+[A-Z][A-Za-z0-9_]*\s*=/.test(line);
    const isInterfaceDecl = /^\s*interface\s+[A-Z][A-Za-z0-9_]*\b/.test(line);
    const isAllowedLocalHint = line.includes("refactor-scan: allow-inline-type");

    if ((isTypeDecl || isInterfaceDecl) && !isAllowedLocalHint) {
      results.push({ line: idx + 1, text: line.trim() });
    }
  }

  return results;
}

async function main() {
  const folders = process.argv.slice(2);
  const targets = folders.length > 0 ? folders : TARGET_FOLDERS;

  const files = [];
  for (const folder of targets) {
    const abs = path.resolve(repoRoot, folder);
    await walk(abs, files);
  }

  const lineViolations = [];
  const inlineTypeWarnings = [];

  for (const file of files) {
    const content = await fs.readFile(file.fullPath, "utf8");
    const lines = countLines(content);
    if (lines > MAX_COMPONENT_LINES) {
      lineViolations.push({ relPath: file.relPath, lines });
    }

    const inlineDecls = findInlineTypeDecls(content);
    if (inlineDecls.length > 0) {
      inlineTypeWarnings.push({ relPath: file.relPath, decls: inlineDecls });
    }
  }

  lineViolations.sort((a, b) => b.lines - a.lines || a.relPath.localeCompare(b.relPath));

  console.log("Refactor Scan Report");
  console.log("====================");
  console.log(`Scanned files: ${files.length}`);
  console.log(`Max component line target: ${MAX_COMPONENT_LINES}`);

  if (lineViolations.length === 0) {
    console.log("\n✅ No component files above line target.");
  } else {
    console.log(`\n❌ Component files above ${MAX_COMPONENT_LINES} lines (${lineViolations.length}):`);
    for (const v of lineViolations) {
      console.log(`  ${String(v.lines).padStart(5, " ")}  ${v.relPath}`);
    }
  }

  if (inlineTypeWarnings.length === 0) {
    console.log("\n✅ No inline component type declarations detected.");
  } else {
    console.log(`\n⚠️ Inline type/interface declarations found in components (${inlineTypeWarnings.length} files):`);
    for (const item of inlineTypeWarnings) {
      const samples = item.decls.slice(0, 2).map((d) => `L${d.line} ${d.text}`).join(" | ");
      console.log(`  - ${item.relPath}: ${samples}`);
    }
    console.log("\nHint: move reusable component contracts into the appropriate types folder and import through the existing barrel.");
  }

  if (lineViolations.length > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error("refactor-scan failed:", error);
  process.exit(1);
});
