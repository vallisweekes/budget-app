XLSX Instructions

Read The Workbook
- Uses `xlsx` via [scripts/read-xlsx.ts](../../scripts/read-xlsx.ts).
- Default command (prints sheet names and sample rows):

```bash
npm run read:xlsx
```

- Target a specific sheet (by name or index):

```bash
npx tsx scripts/read-xlsx.ts --file "5 YEAR FINANCIAL FORECAST.xlsx" --sheet "YEARLY TOTALS"
npx tsx scripts/read-xlsx.ts --file "5 YEAR FINANCIAL FORECAST.xlsx" --sheet 0
```

Export To JSON/CSV
- Exporter script: [scripts/export-xlsx.ts](../../scripts/export-xlsx.ts).
- JSON (all sheets or chosen sheet):

```bash
npx tsx scripts/export-xlsx.ts --file "5 YEAR FINANCIAL FORECAST.xlsx" --format json --out data/forecast.json
# Choose a sheet
npx tsx scripts/export-xlsx.ts --file "5 YEAR FINANCIAL FORECAST.xlsx" --sheet "YEARLY TOTALS" --format json --out data/yearly.json
```

- CSV (first or chosen sheet):

```bash
npx tsx scripts/export-xlsx.ts --file "5 YEAR FINANCIAL FORECAST.xlsx" --format csv --out data/forecast.csv
npx tsx scripts/export-xlsx.ts --file "5 YEAR FINANCIAL FORECAST.xlsx" --sheet "YEARLY TOTALS" --format csv --out data/yearly.csv
```

Notes
- Filenames with spaces must be quoted.
- Sheet selection accepts name or index.
- Output directories are created automatically.