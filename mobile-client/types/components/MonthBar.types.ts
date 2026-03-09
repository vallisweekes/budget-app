export interface MonthBarProps {
  month: number;
  year: number;
  onPrev: () => void;
  onNext: () => void;
  prevDisabled?: boolean;
}
