import fs from "node:fs";
import path from "node:path";
import * as XLSX from "xlsx";

type Row = Record<string, unknown>;

function usage(): void {
  console.log("Usage: tsx scripts/read-xlsx.ts --file <path-to-xlsx> [--sheet <name|index>]");
}

function parseArgs(argv: string[]) {
  const args: Record<string, string> = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const val = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[i + 1] : "";
      if (val) i++;
      args[key] = val;
    }
  }
  return args;
}

function main() {
  const args = parseArgs(process.argv);
  const fileArg = args.file || "5 YEAR FINANCIAL FORECAST.xlsx";
  const sheetArg = args.sheet; // optional

  const filePath = path.resolve(process.cwd(), fileArg);
  if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    usage();
    process.exit(1);
  }

  const wb = XLSX.readFile(filePath, { cellDates: true });
  const sheetNames = wb.SheetNames;

  let targetSheetName: string | undefined = undefined;
  if (sheetArg) {
    if (/^\d+$/.test(sheetArg)) {
      const idx = parseInt(sheetArg, 10);
      targetSheetName = sheetNames[idx];
    } else if (sheetNames.includes(sheetArg)) {
      targetSheetName = sheetArg;
    } else {
      console.error(`Sheet not found: ${sheetArg}. Available: ${sheetNames.join(", ")}`);
      process.exit(1);
    }
  }

  const results: Record<string, { headers: string[]; rows: Row[] }> = {};

  const namesToRead = targetSheetName ? [targetSheetName] : sheetNames;
  for (const name of namesToRead) {
    const ws = wb.Sheets[name];
    // Convert to JSON keeping raw headers
    const rows: Row[] = XLSX.utils.sheet_to_json(ws, { defval: null, raw: true });
    const headers: string[] = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, blankrows: false })[0] as string[];
    results[name] = {
      headers: Array.isArray(headers) ? headers : [],
      rows: rows.slice(0, 10), // limit output for readability
    };
  }

  // Print a concise summary first
  console.log(JSON.stringify({
    file: path.basename(filePath),
    sheetNames,
  }, null, 2));

  // Then print sample rows
  console.log(JSON.stringify({ sample: results }, null, 2));
}

main();
