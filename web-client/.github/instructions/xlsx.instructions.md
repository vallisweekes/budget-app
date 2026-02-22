---
name: XLSX workbook handling
description: How AI should read and export the Excel workbook in this repo.
applyTo: "**/*.xlsx"
---

- The workbook is stored at [5 YEAR FINANCIAL FORECAST.xlsx](../../5%20YEAR%20FINANCIAL%20FORECAST.xlsx).
- Use `xlsx` via the provided scripts; do not attempt to write a parser from scratch.
- For quick inspection, run:

```bash
npm run read:xlsx
```

- To target a specific sheet by name or index:

```bash
npx tsx scripts/read-xlsx.ts --file "5 YEAR FINANCIAL FORECAST.xlsx" --sheet "YEARLY TOTALS"
npx tsx scripts/read-xlsx.ts --file "5 YEAR FINANCIAL FORECAST.xlsx" --sheet 0
```

- Export JSON or CSV using:

```bash
npx tsx scripts/export-xlsx.ts --file "5 YEAR FINANCIAL FORECAST.xlsx" --format json --out data/forecast.json
npx tsx scripts/export-xlsx.ts --file "5 YEAR FINANCIAL FORECAST.xlsx" --format csv --out data/forecast.csv
```

- Quote filenames with spaces and prefer workspace-relative links in responses.