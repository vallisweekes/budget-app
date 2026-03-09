export type IncomeSacrificeChartPointRow = {
  key: string;
  label: string;
  value: number;
  color: string;
};

export type IncomeSacrificeChartProps = {
  rows: IncomeSacrificeChartPointRow[];
  currency: string;
};