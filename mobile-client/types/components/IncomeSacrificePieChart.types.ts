export type IncomeSacrificePieChartSlice = {
  key: string;
  label: string;
  value: number;
  color: string;
};

export type IncomeSacrificePieChartProps = {
  currency: string;
  slices: IncomeSacrificePieChartSlice[];
  centerTitle: string;
};