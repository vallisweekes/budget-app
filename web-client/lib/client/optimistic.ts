export function optimisticReplaceById<T extends { id: string }>(items: T[], next: T): T[] {
	return items.map((i) => (i.id === next.id ? next : i));
}

export function optimisticRemoveById<T extends { id: string }>(items: T[], id: string): T[] {
	return items.filter((i) => i.id !== id);
}
