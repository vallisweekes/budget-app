XLSX Skill

Overview
- Read Excel `.xlsx` files and output JSON or CSV using the `xlsx` library.

Setup
- Dependencies are already added: `xlsx` and `tsx`.
- Commands run from the project root.

Quick Read
- Prints sheet names and first 10 rows:
- `npm run read:xlsx`
- Custom options:
- `npx tsx scripts/read-xlsx.ts --file "5 YEAR FINANCIAL FORECAST.xlsx" --sheet "YEARLY TOTALS"`

Export
- JSON: `npm run export:xlsx:json`
- CSV: `npm run export:xlsx:csv`
- Custom:
- `npx tsx scripts/export-xlsx.ts --file "5 YEAR FINANCIAL FORECAST.xlsx" --sheet "YEARLY TOTALS" --format json --out data/forecast.json`

Notes
- Sheet can be selected by name or index (`--sheet 0`).
- Filenames with spaces must be quoted.
