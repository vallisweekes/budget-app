import type { useDebtScreenController } from "@/hooks";

export type DebtScreenController = ReturnType<typeof useDebtScreenController>;

export type DebtProjectionCardProps = {
  controller: DebtScreenController;
};

export type AddDebtSheetProps = {
  controller: DebtScreenController;
};