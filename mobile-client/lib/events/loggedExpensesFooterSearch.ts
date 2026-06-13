import { useSyncExternalStore } from "react";

let loggedExpensesFooterSearchQuery = "";
const subscribers = new Set<() => void>();

function emitLoggedExpensesFooterSearchChange() {
  subscribers.forEach((subscriber) => subscriber());
}

export function getLoggedExpensesFooterSearchQuery() {
  return loggedExpensesFooterSearchQuery;
}

export function setLoggedExpensesFooterSearchQuery(query: string) {
  if (loggedExpensesFooterSearchQuery === query) return;
  loggedExpensesFooterSearchQuery = query;
  emitLoggedExpensesFooterSearchChange();
}

export function useLoggedExpensesFooterSearchQuery() {
  return useSyncExternalStore(
    (subscriber) => {
      subscribers.add(subscriber);
      return () => subscribers.delete(subscriber);
    },
    getLoggedExpensesFooterSearchQuery,
    getLoggedExpensesFooterSearchQuery,
  );
}