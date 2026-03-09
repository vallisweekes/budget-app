import type { useDebtScreenController } from "@/lib/hooks/useDebtScreenController";

export type DebtScreenController = ReturnType<typeof useDebtScreenController>;

export type DebtProjectionCardProps = {
  controller: DebtScreenController;
};

export type AddDebtSheetProps = {
  controller: DebtScreenController;
};