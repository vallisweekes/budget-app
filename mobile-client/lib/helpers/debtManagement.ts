type DebtVisibilityOptions = {
  hasActualDebts?: boolean;
  hasConfiguredDebts?: boolean;
  onboardingHasDebtsToManage?: boolean | null;
  profileHasDebtsToManage?: boolean | null;
};

export function hasPositiveDebtBalance(
  debts: Array<{ currentBalance?: number | string | null } | null | undefined> | null | undefined,
): boolean {
  return (debts ?? []).some((debt) => Number(debt?.currentBalance ?? 0) > 0);
}

export function isDebtManagementEnabled(options: DebtVisibilityOptions): boolean {
  return Boolean(
    options.hasActualDebts
    || options.hasConfiguredDebts
    || options.onboardingHasDebtsToManage === true
    || options.profileHasDebtsToManage === true,
  );
}