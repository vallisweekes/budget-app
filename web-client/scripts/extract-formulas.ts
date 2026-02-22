import path from "node:path";
import fs from "node:fs";
import * as XLSX from "xlsx";

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
    process.exit(1);
  }

  const wb = XLSX.readFile(filePath, { cellDates: true });
  const sheetNames = wb.SheetNames;

  let targetSheetName: string | undefined;
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
  const out: Record<string, Array<{ addr: string; formula: string; value: unknown }>> = {};

  for (const name of namesToRead) {
    const ws = wb.Sheets[name];
    const ref = ws["!ref"];
    if (!ref) continue;
    const range = XLSX.utils.decode_range(ref);
    const formulas: Array<{ addr: string; formula: string; value: unknown }> = [];
    for (let r = range.s.r; r <= range.e.r; r++) {
      for (let c = range.s.c; c <= range.e.c; c++) {
        const addr = XLSX.utils.encode_cell({ r, c });
        const cell = ws[addr];
        if (cell && typeof cell.f === "string") {
          formulas.push({ addr, formula: cell.f, value: cell.v });
        }
      }
    }
    out[name] = formulas;
  }

  console.log(JSON.stringify({ file: path.basename(filePath), sheetNames: namesToRead, formulas: out }, null, 2));
}

main();
