import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();

async function listRouteFiles(dir) {
	const entries = await readdir(dir, { withFileTypes: true });
	const files = [];
	for (const entry of entries) {
		const fullPath = path.join(dir, entry.name);
		if (entry.isDirectory()) {
			files.push(...(await listRouteFiles(fullPath)));
			continue;
		}
		if (entry.isFile() && entry.name === "route.ts") {
			files.push(fullPath);
		}
	}
	return files;
}

function toPosix(p) {
	return p.split(path.sep).join("/");
}

function indexToLineCol(text, index) {
	const upTo = text.slice(0, index);
	const lines = upTo.split(/\r?\n/);
	const line = lines.length;
	const col = lines.at(-1)?.length ?? 0;
	return { line, col };
}

function findFirst(text, regex) {
	const match = regex.exec(text);
	if (!match) return null;
	return { index: match.index, match: match[0] };
}

async function main() {
	const errors = [];

	const bffRoot = path.join(ROOT, "app", "api", "bff");
	let routeFiles = [];
	try {
		routeFiles = await listRouteFiles(bffRoot);
	} catch (e) {
		console.error(`check-bff-auth: cannot read ${bffRoot}`);
		console.error(e);
		process.exit(2);
	}

	const disallowNoArgGetSessionUserId = /getSessionUserId\s*\(\s*\)/g;
	const disallowGetServerSession = /getServerSession\s*\(/g;
	const disallowNextHeadersImport = /from\s+["']next\/headers["']/g;

	for (const filePath of routeFiles) {
		const rel = toPosix(path.relative(ROOT, filePath));
		const text = await readFile(filePath, "utf8");

		{
			disallowNoArgGetSessionUserId.lastIndex = 0;
			const found = findFirst(text, disallowNoArgGetSessionUserId);
			if (found) {
				const pos = indexToLineCol(text, found.index);
				errors.push(`${rel}:${pos.line}:${pos.col} uses getSessionUserId() with no request`);
			}
		}
		{
			disallowGetServerSession.lastIndex = 0;
			const found = findFirst(text, disallowGetServerSession);
			if (found) {
				const pos = indexToLineCol(text, found.index);
				errors.push(`${rel}:${pos.line}:${pos.col} uses getServerSession() inside BFF route`);
			}
		}
		{
			disallowNextHeadersImport.lastIndex = 0;
			const found = findFirst(text, disallowNextHeadersImport);
			if (found) {
				const pos = indexToLineCol(text, found.index);
				errors.push(`${rel}:${pos.line}:${pos.col} imports next/headers (disallowed in BFF routes)`);
			}
		}
	}

	// Ensure the auth helper itself doesn't regress back to global headers.
	const bffAuthPath = path.join(ROOT, "lib", "api", "bffAuth.ts");
	try {
		const bffAuthRel = toPosix(path.relative(ROOT, bffAuthPath));
		const bffAuthText = await readFile(bffAuthPath, "utf8");
		const idx = bffAuthText.indexOf("next/headers");
		if (idx !== -1) {
			const pos = indexToLineCol(bffAuthText, idx);
			errors.push(`${bffAuthRel}:${pos.line}:${pos.col} references next/headers (disallowed)`);
		}
	} catch (e) {
		console.error(`check-bff-auth: cannot read lib/api/bffAuth.ts`);
		console.error(e);
		process.exit(2);
	}

	if (errors.length > 0) {
		console.error("\nBFF auth guard failed:\n");
		for (const err of errors) console.error(`- ${err}`);
		console.error("\nFix by passing the Request into getSessionUserId(request), and avoid getServerSession() in BFF routes.");
		process.exit(1);
	}

	console.log(`check-bff-auth: ok (${routeFiles.length} route files checked)`);
}

main().catch((e) => {
	console.error("check-bff-auth: unexpected error");
	console.error(e);
	process.exit(2);
});
