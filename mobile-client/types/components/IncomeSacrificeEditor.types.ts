import type { IncomeSacrificeCustomItem, IncomeSacrificeFixed } from "@/lib/apiTypes";

export type SacrificeType = "allowance" | "savings" | "emergency" | "investment" | "custom";

export type IncomeSacrificeEditorProps = {
  currency: string;
  fixed: IncomeSacrificeFixed;
  customItems: IncomeSacrificeCustomItem[];
  customTotal: number;
  totalSacrifice: number;
  saving: boolean;
  creating: boolean;
  deletingId: string | null;
  newType: SacrificeType;
  newName: string;
  newAmount: string;
  onChangeFixed: (key: keyof IncomeSacrificeFixed, value: string) => void;
  onSaveFixed: () => void;
  onChangeCustomAmount: (id: string, value: string) => void;
  onSaveCustomAmounts: () => void;
  onDeleteCustom: (id: string) => void;
  onSetNewType: (value: SacrificeType) => void;
  onSetNewName: (value: string) => void;
  onSetNewAmount: (value: string) => void;
  onCreateCustom: () => void;
};