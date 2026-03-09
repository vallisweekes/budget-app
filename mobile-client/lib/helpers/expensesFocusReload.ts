let pendingExpensesFocusReloadSkipCount = 0;

export function markSkipExpensesFocusReload() {
  pendingExpensesFocusReloadSkipCount += 1;
}

export function consumeSkipExpensesFocusReload() {
  if (pendingExpensesFocusReloadSkipCount <= 0) return false;
  pendingExpensesFocusReloadSkipCount -= 1;
  return true;
}