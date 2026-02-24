#!/usr/bin/env node
import { promises as fs } from "node:fs";
import path from "node:path";

const rootArg = process.argv[2] ?? process.cwd();
const maxLinesArg = Number(process.argv[3] ?? 200);
const root = path.resolve(rootArg);
const maxLines = Number.isFinite(maxLinesArg) && maxLinesArg > 0 ? Math.floor(maxLinesArg) : 200;

const EXCLUDED_DIRS = new Set([
  ".git",
  "node_modules",
  ".next",
  "dist",
  "build",
  "coverage",
  "ios/Pods",
  "ios/build",
  "android/build",
]);

const EXCLUDED_EXTENSIONS = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".ico",
  ".pdf",
  ".lock",
  ".pbxproj",
  ".xcworkspace",
  ".xcodeproj",
  ".json",
  ".sql",
]);

const INCLUDED_EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".css",
  ".md",
]);

function shouldSkipByDir(relativePath) {
  const normalized = relativePath.replace(/\\/g, "/");
  for (const segment of EXCLUDED_DIRS) {
    if (normalized === segment || normalized.startsWith(`${segment}/`) || normalized.includes(`/${segment}/`)) {
      return true;
    }
  }
  return false;
}

async function walk(dir, out = []) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const relPath = path.relative(root, fullPath).replace(/\\/g, "/");

    if (shouldSkipByDir(relPath)) continue;

    if (entry.isDirectory()) {
      await walk(fullPath, out);
      continue;
    }

    const ext = path.extname(entry.name).toLowerCase();
    if (EXCLUDED_EXTENSIONS.has(ext)) continue;
    if (!INCLUDED_EXTENSIONS.has(ext)) continue;

    out.push({ fullPath, relPath });
  }
  return out;
}

async function countLines(filePath) {
  const data = await fs.readFile(filePath, "utf8");
  if (!data) return 0;
  return data.split(/\r\n|\n|\r/).length;
}

async function main() {
  const files = await walk(root);
  const offenders = [];

  for (const file of files) {
    const lines = await countLines(file.fullPath);
    if (lines > maxLines) offenders.push({ ...file, lines });
  }

  offenders.sort((a, b) => b.lines - a.lines || a.relPath.localeCompare(b.relPath));

  if (offenders.length === 0) {
    console.log(`✅ No files above ${maxLines} lines`);
    return;
  }

  console.log(`❌ ${offenders.length} files above ${maxLines} lines`);
  for (const offender of offenders) {
    console.log(`${String(offender.lines).padStart(5, " ")}  ${offender.relPath}`);
  }
  process.exitCode = 1;
}

main().catch((error) => {
  console.error("check-max-lines failed:", error);
  process.exit(1);
});
