import * as SecureStore from "expo-secure-store";

export type NotificationInboxItem = {
  id: string;
  title: string;
  body: string;
  receivedAt: string;
  readAt: string | null;
};

type NotificationInboxSnapshot = {
  items: NotificationInboxItem[];
  unreadCount: number;
};

type NotificationInboxListener = (snapshot: NotificationInboxSnapshot) => void;

type NotificationInboxInput = {
  id?: string | null;
  title?: string | null;
  body?: string | null;
  receivedAt?: string | null;
};

const NOTIFICATION_INBOX_KEY = "budget_app.notification_inbox.v1";
const MAX_ITEMS = 40;

let inboxItems: NotificationInboxItem[] = [];
let didLoad = false;
let writeChain: Promise<void> = Promise.resolve();
const listeners = new Set<NotificationInboxListener>();

function getUnreadCount(items: NotificationInboxItem[]): number {
  return items.reduce((count, item) => (item.readAt ? count : count + 1), 0);
}

function getSnapshot(): NotificationInboxSnapshot {
  return {
    items: inboxItems,
    unreadCount: getUnreadCount(inboxItems),
  };
}

function emit(): void {
  const snapshot = getSnapshot();
  listeners.forEach((listener) => {
    try {
      listener(snapshot);
    } catch {
      // ignore
    }
  });
}

function persistItems(nextItems: NotificationInboxItem[]): Promise<void> {
  writeChain = writeChain.then(async () => {
    await SecureStore.setItemAsync(NOTIFICATION_INBOX_KEY, JSON.stringify(nextItems));
  }).catch(() => {
    // ignore
  });
  return writeChain;
}

function normalizeLoadedItems(raw: unknown): NotificationInboxItem[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((value) => {
      if (!value || typeof value !== "object") return null;
      const row = value as Record<string, unknown>;
      const id = typeof row.id === "string" ? row.id.trim() : "";
      if (!id) return null;
      return {
        id,
        title: typeof row.title === "string" ? row.title : "BudgetIn Check",
        body: typeof row.body === "string" ? row.body : "",
        receivedAt: typeof row.receivedAt === "string" && row.receivedAt ? row.receivedAt : new Date().toISOString(),
        readAt: typeof row.readAt === "string" && row.readAt ? row.readAt : null,
      } satisfies NotificationInboxItem;
    })
    .filter((item): item is NotificationInboxItem => Boolean(item));
}

async function ensureLoaded(): Promise<void> {
  if (didLoad) return;
  didLoad = true;
  try {
    const raw = await SecureStore.getItemAsync(NOTIFICATION_INBOX_KEY);
    if (!raw) {
      inboxItems = [];
      return;
    }
    const parsed = JSON.parse(raw) as unknown;
    inboxItems = normalizeLoadedItems(parsed).slice(0, MAX_ITEMS);
  } catch {
    inboxItems = [];
  }
}

export async function getNotificationInboxSnapshot(): Promise<NotificationInboxSnapshot> {
  await ensureLoaded();
  return getSnapshot();
}

export async function appendNotificationInboxItem(input: NotificationInboxInput): Promise<void> {
  await ensureLoaded();

  const title = (input.title ?? "").trim() || "BudgetIn Check";
  const body = (input.body ?? "").trim();
  const sourceId = (input.id ?? "").trim();
  const fallbackId = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const id = sourceId || fallbackId;

  if (inboxItems.some((item) => item.id === id)) {
    return;
  }

  const nextItem: NotificationInboxItem = {
    id,
    title,
    body,
    receivedAt: (input.receivedAt ?? "").trim() || new Date().toISOString(),
    readAt: null,
  };

  inboxItems = [nextItem, ...inboxItems].slice(0, MAX_ITEMS);
  emit();
  await persistItems(inboxItems);
}

export async function markAllNotificationInboxRead(): Promise<void> {
  await ensureLoaded();
  if (!inboxItems.some((item) => !item.readAt)) return;

  const readAt = new Date().toISOString();
  inboxItems = inboxItems.map((item) => (item.readAt ? item : { ...item, readAt }));
  emit();
  await persistItems(inboxItems);
}

export async function markNotificationInboxItemRead(id: string): Promise<void> {
  await ensureLoaded();
  const targetId = (id ?? "").trim();
  if (!targetId) return;

  const idx = inboxItems.findIndex((item) => item.id === targetId);
  if (idx < 0) return;
  if (inboxItems[idx].readAt) return;

  const readAt = new Date().toISOString();
  inboxItems = inboxItems.map((item) => (item.id === targetId ? { ...item, readAt } : item));
  emit();
  await persistItems(inboxItems);
}

export async function deleteNotificationInboxItem(id: string): Promise<void> {
  await ensureLoaded();
  const targetId = (id ?? "").trim();
  if (!targetId) return;

  if (!inboxItems.some((item) => item.id === targetId)) return;

  inboxItems = inboxItems.filter((item) => item.id !== targetId);
  emit();
  await persistItems(inboxItems);
}

export function subscribeNotificationInbox(listener: NotificationInboxListener): () => void {
  listeners.add(listener);
  void ensureLoaded().then(() => {
    listener(getSnapshot());
  });

  return () => {
    listeners.delete(listener);
  };
}
