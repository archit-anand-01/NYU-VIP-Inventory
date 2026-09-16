"use client";

import { useMemo, useSyncExternalStore } from "react";
import type { Backup, Issue, Item } from "./types";
import { generateItemId, generateRecordId } from "./id";
import { deleteImage, putImage } from "./images";

const ITEMS_KEY = "inventory.items.v1";
const ISSUES_KEY = "inventory.issues.v1";
const VIPS_KEY = "inventory.vips.v1";

/** Shipped with the app; users add more through "+ Add new VIP". */
export const DEFAULT_VIPS = ["Desire Path", "Technology and Innovation catalyst"];

export type ItemDraft = {
  name: string;
  totalQuantity: number;
  vip: string;
  location: string;
  notes: string;
};

export type IssueDraft = {
  itemId: string;
  personName: string;
  netId: string;
  phone: string;
  quantity: number;
  date: string;
  note: string;
};

type Snapshot = { items: Item[]; issues: Issue[]; vips: string[]; ready: boolean };

// The data lives in localStorage; this module is the single external store that
// React subscribes to, so every page and modal sees the same snapshot.
const EMPTY: Snapshot = { items: [], issues: [], vips: DEFAULT_VIPS, ready: false };
let snapshot: Snapshot = EMPTY;
let loaded = false;

const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function read<T>(key: string): T[] {
  try {
    const raw = localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* quota exceeded or private mode - the session keeps working in memory */
  }
}

/** VIP used to be a yes/no flag; keep older saved data readable. */
function normalizeItem(item: Item): Item {
  return typeof item.vip === "string" ? item : { ...item, vip: item.vip ? "VIP" : "" };
}

function readVips(): string[] {
  const stored = read<string>(VIPS_KEY).filter((v) => typeof v === "string" && v.trim());
  return stored.length ? stored : DEFAULT_VIPS;
}

function hydrate() {
  snapshot = {
    items: read<Item>(ITEMS_KEY).map(normalizeItem),
    issues: read<Issue>(ISSUES_KEY),
    vips: readVips(),
    ready: true,
  };
}

function setState(next: Partial<Pick<Snapshot, "items" | "issues" | "vips">>) {
  snapshot = { ...snapshot, ...next, ready: true };
  if (next.items) write(ITEMS_KEY, next.items);
  if (next.issues) write(ISSUES_KEY, next.issues);
  if (next.vips) write(VIPS_KEY, next.vips);
  emit();
}

function onStorage(event: StorageEvent) {
  // Another tab of the same app changed the data.
  if (event.key === ITEMS_KEY || event.key === ISSUES_KEY || event.key === VIPS_KEY) {
    hydrate();
    emit();
  }
}

function subscribe(listener: () => void) {
  if (!loaded) {
    loaded = true;
    hydrate();
    window.addEventListener("storage", onStorage);
  }
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): Snapshot {
  return snapshot;
}

function getServerSnapshot(): Snapshot {
  return EMPTY;
}

function toInt(value: unknown): number {
  const n = Math.floor(Number(value));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/** Units currently out with someone, per item id. */
function computeIssuedOut(issues: Issue[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const issue of issues) {
    const open = Math.max(0, issue.quantity - issue.returnedQty);
    if (open > 0) out[issue.itemId] = (out[issue.itemId] ?? 0) + open;
  }
  return out;
}

export function addItem(draft: ItemDraft): Item {
  const now = new Date().toISOString();
  const created: Item = {
    id: generateItemId(draft.vip, snapshot.items.map((i) => i.id)),
    name: draft.name.trim(),
    totalQuantity: toInt(draft.totalQuantity),
    vip: draft.vip.trim(),
    location: draft.location.trim(),
    notes: draft.notes.trim(),
    hasImage: false,
    createdAt: now,
    updatedAt: now,
  };
  setState({ items: [created, ...snapshot.items] });
  return created;
}

export function updateItem(id: string, patch: Partial<ItemDraft>) {
  setState({
    items: snapshot.items.map((item) =>
      item.id === id
        ? {
            ...item,
            ...patch,
            name: patch.name === undefined ? item.name : patch.name.trim(),
            vip: patch.vip === undefined ? item.vip : patch.vip.trim(),
            totalQuantity:
              patch.totalQuantity === undefined ? item.totalQuantity : toInt(patch.totalQuantity),
            updatedAt: new Date().toISOString(),
          }
        : item,
    ),
  });
}

export async function setItemImage(id: string, dataUrl: string | null) {
  if (dataUrl) await putImage(id, dataUrl);
  else await deleteImage(id);
  setState({
    items: snapshot.items.map((item) =>
      item.id === id
        ? { ...item, hasImage: Boolean(dataUrl), updatedAt: new Date().toISOString() }
        : item,
    ),
  });
}

export function deleteItem(id: string) {
  void deleteImage(id);
  setState({
    items: snapshot.items.filter((item) => item.id !== id),
    issues: snapshot.issues.filter((issue) => issue.itemId !== id),
  });
}

export function issueItem(draft: IssueDraft): Issue {
  const item = snapshot.items.find((i) => i.id === draft.itemId);
  if (!item) throw new Error("That item no longer exists.");
  const available = Math.max(
    0,
    item.totalQuantity - (computeIssuedOut(snapshot.issues)[item.id] ?? 0),
  );
  const qty = toInt(draft.quantity);
  if (qty < 1) throw new Error("Quantity must be at least 1.");
  if (qty > available) throw new Error(`Only ${available} in stock right now.`);

  const record: Issue = {
    id: generateRecordId(),
    itemId: item.id,
    itemName: item.name,
    personName: draft.personName.trim(),
    netId: draft.netId.trim(),
    phone: draft.phone.trim(),
    quantity: qty,
    date: draft.date,
    returnedQty: 0,
    note: draft.note.trim(),
    createdAt: new Date().toISOString(),
  };
  setState({ issues: [record, ...snapshot.issues] });
  return record;
}

export function returnIssue(issueId: string, qty: number) {
  setState({
    issues: snapshot.issues.map((issue) =>
      issue.id === issueId
        ? {
            ...issue,
            returnedQty: Math.min(issue.quantity, Math.max(0, issue.returnedQty + toInt(qty))),
          }
        : issue,
    ),
  });
}

export function deleteIssue(issueId: string) {
  setState({ issues: snapshot.issues.filter((issue) => issue.id !== issueId) });
}

/** Adds a VIP to the dropdown list. Returns the trimmed name. */
export function addVipOption(name: string): string {
  const value = name.trim();
  if (!value) return "";
  const exists = snapshot.vips.some((v) => v.toLowerCase() === value.toLowerCase());
  if (!exists) setState({ vips: [...snapshot.vips, value] });
  return value;
}

export function replaceAll(backup: Pick<Backup, "items" | "issues" | "vips">) {
  const restored = backup.vips?.length ? backup.vips : snapshot.vips;
  setState({ items: backup.items, issues: backup.issues, vips: restored });
}

export function useStore() {
  const state = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  return useMemo(() => {
    const issuedOut = computeIssuedOut(state.issues);
    const inStock: Record<string, number> = {};
    for (const item of state.items) {
      inStock[item.id] = Math.max(0, item.totalQuantity - (issuedOut[item.id] ?? 0));
    }
    return {
      ...state,
      issuedOut,
      /** totalQuantity minus units currently out, per item id. */
      inStock,
      /** The dropdown list plus any VIP already sitting on an item. */
      vipOptions: [...new Set([...state.vips, ...state.items.map((i) => i.vip).filter(Boolean)])],
      addItem,
      addVipOption,
      updateItem,
      setItemImage,
      deleteItem,
      issueItem,
      returnIssue,
      deleteIssue,
      replaceAll,
    };
  }, [state]);
}
