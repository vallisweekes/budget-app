export interface IncomeAddFormProps {
  currency: string;
  name: string;
  amount: string;
  setName: (v: string) => void;
  setAmount: (v: string) => void;
  distributeMonths: boolean;
  setDistributeMonths: (v: boolean) => void;
  distributeYears: boolean;
  setDistributeYears: (v: boolean) => void;
  onAdd: () => void;
  saving: boolean;
}
