Budget App — XLSX Instructions

Purpose
- Read and export the Excel workbook in the repo using the `xlsx` library.

Files
- Reader: scripts/read-xlsx.ts
- Exporter: scripts/export-xlsx.ts
- Workbook: 5 YEAR FINANCIAL FORECAST.xlsx
- Skill notes: .github/skils/xlsx/SKILL.md

Quick Start
- Print sheet names and sample rows:
  npm run read:xlsx
- Export a specific sheet to JSON:
  npx tsx scripts/export-xlsx.ts --file "5 YEAR FINANCIAL FORECAST.xlsx" --sheet "YEARLY TOTALS" --format json --out data/forecast.json
- Export CSV (first or chosen sheet):
  npx tsx scripts/export-xlsx.ts --file "5 YEAR FINANCIAL FORECAST.xlsx" --format csv --out data/forecast.csv

Notes
- Quote filenames with spaces.
- Select a sheet by name or index: --sheet 0