import fs from "node:fs";
import path from "node:path";
import * as XLSX from "xlsx";

type Format = "json" | "csv";

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

function ensureDir(filePath: string) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function main() {
  const args = parseArgs(process.argv);
  const fileArg = args.file || "5 YEAR FINANCIAL FORECAST.xlsx";
  const sheetArg = args.sheet; // optional
  const format: Format = (args.format as Format) || "json";
  const outArg = args.out || (format === "json" ? "data/forecast.json" : "data/forecast.csv");

  const filePath = path.resolve(process.cwd(), fileArg);
  if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
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

  const namesToRead = targetSheetName ? [targetSheetName] : sheetNames;

  let output = "";
  if (format === "csv") {
    if (!targetSheetName && sheetNames.length > 1) {
      console.warn("Multiple sheets detected; exporting the first. Pass --sheet to choose.");
    }
    const name = namesToRead[0];
    const ws = wb.Sheets[name];
    output = XLSX.utils.sheet_to_csv(ws);
  } else {
    const results: Record<string, unknown> = {};
    for (const name of namesToRead) {
      const ws = wb.Sheets[name];
      results[name] = {
        headers: XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, blankrows: false })[0] ?? [],
        rows: XLSX.utils.sheet_to_json(ws, { defval: null, raw: true }),
      };
    }
    output = JSON.stringify({ file: path.basename(filePath), sheets: results }, null, 2);
  }

  const outPath = path.resolve(process.cwd(), outArg);
  ensureDir(outPath);
  fs.writeFileSync(outPath, output);
  console.log(`Exported ${format.toUpperCase()} to: ${path.relative(process.cwd(), outPath)}`);
}

main();
