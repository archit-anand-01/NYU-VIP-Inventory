"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Issue, Item } from "@/lib/types";
import { generateItemId } from "@/lib/id";
import { generateRecordId } from "@/lib/id";
import { getDb } from "./db";
import { requireFaculty } from "./dal";
import { computeIssuedOut } from "./queries";
import { createSession, destroySession, passwordMatches } from "./session";

export type Result<T = null> = { ok: true; data: T } | { ok: false; error: string };

const fail = (error: string): Result<never> => ({ ok: false, error });
const done = <T>(data: T): Result<T> => ({ ok: true, data });

function refresh() {
  revalidatePath("/");
  revalidatePath("/issued");
}

function toInt(value: unknown): number {
  const n = Math.floor(Number(value));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/** Every mutation re-checks the session: these are reachable by direct POST. */
async function guard(): Promise<string | null> {
  try {
    await requireFaculty();
    return null;
  } catch {
    return "You need to be signed in as faculty to do that.";
  }
}

// ---------------------------------------------------------------- auth

export async function loginAction(_prev: unknown, formData: FormData): Promise<Result> {
  const password = String(formData.get("password") ?? "");
  if (!password) return fail("Enter the faculty password.");

  // Slow down guessing a little without blocking a legitimate sign-in.
  await new Promise((r) => setTimeout(r, 350));

  let matched = false;
  try {
    matched = passwordMatches(password);
  } catch {
    return fail("The server is missing its FACULTY_PASSWORD setting.");
  }
  if (!matched) return fail("That password is not right.");

  await createSession();
  redirect("/");
}

export async function logoutAction(): Promise<void> {
  await destroySession();
  refresh();
  redirect("/");
}

// ---------------------------------------------------------------- items

export type ItemDraft = {
  name: string;
  totalQuantity: number;
  vip: string;
  location: string;
  notes: string;
};

export async function addItemAction(draft: ItemDraft): Promise<Result<Item>> {
  const denied = await guard();
  if (denied) return fail(denied);

  const name = draft.name.trim();
  if (!name) return fail("Item name is required.");

  const db = getDb();
  const existing = await db.listItems();
  const now = new Date().toISOString();
  const item: Item = {
    id: generateItemId(draft.vip, existing.map((i) => i.id)),
    name,
    totalQuantity: toInt(draft.totalQuantity),
    vip: draft.vip.trim(),
    location: draft.location.trim(),
    notes: draft.notes.trim(),
    hasImage: false,
    createdAt: now,
    updatedAt: now,
  };
  await db.insertItem(item);
  refresh();
  return done(item);
}

export async function updateItemAction(
  id: string,
  patch: Partial<ItemDraft>,
): Promise<Result> {
  const denied = await guard();
  if (denied) return fail(denied);

  const db = getDb();
  const [items, issues] = await Promise.all([db.listItems(), db.listIssues()]);
  const item = items.find((i) => i.id === id);
  if (!item) return fail("That item no longer exists.");

  const out = computeIssuedOut(issues)[id] ?? 0;
  const nextTotal =
    patch.totalQuantity === undefined ? item.totalQuantity : toInt(patch.totalQuantity);
  if (nextTotal < out) {
    return fail(`${out} unit${out === 1 ? "" : "s"} are still issued out — total can't go below that.`);
  }

  await db.updateItem(id, {
    ...(patch.name !== undefined ? { name: patch.name.trim() } : {}),
    ...(patch.vip !== undefined ? { vip: patch.vip.trim() } : {}),
    ...(patch.location !== undefined ? { location: patch.location.trim() } : {}),
    ...(patch.notes !== undefined ? { notes: patch.notes.trim() } : {}),
    totalQuantity: nextTotal,
    updatedAt: new Date().toISOString(),
  });
  refresh();
  return done(null);
}

const MAX_PHOTO_BYTES = 3 * 1024 * 1024;

export async function setItemPhotoAction(
  id: string,
  dataUrl: string | null,
): Promise<Result> {
  const denied = await guard();
  if (denied) return fail(denied);

  const db = getDb();
  if (!dataUrl) {
    await db.deletePhoto(id);
    await db.updateItem(id, { hasImage: false, updatedAt: new Date().toISOString() });
    refresh();
    return done(null);
  }

  const match = /^data:(image\/(?:jpeg|png|webp));base64,(.+)$/.exec(dataUrl);
  if (!match) return fail("That photo is not a supported image.");
  const data = Buffer.from(match[2], "base64");
  if (data.byteLength > MAX_PHOTO_BYTES) return fail("That photo is too large.");

  await db.putPhoto(id, { data, contentType: match[1] });
  await db.updateItem(id, { hasImage: true, updatedAt: new Date().toISOString() });
  refresh();
  return done(null);
}

export async function deleteItemAction(id: string): Promise<Result> {
  const denied = await guard();
  if (denied) return fail(denied);

  const db = getDb();
  await db.deletePhoto(id);
  await db.deleteItem(id);
  refresh();
  return done(null);
}

export async function addVipAction(name: string): Promise<Result<string>> {
  const denied = await guard();
  if (denied) return fail(denied);

  const value = name.trim();
  if (!value) return fail("Enter a VIP name.");
  await getDb().addVip(value);
  refresh();
  return done(value);
}

// ---------------------------------------------------------------- issuing

export type IssueDraft = {
  itemId: string;
  personName: string;
  netId: string;
  phone: string;
  quantity: number;
  date: string;
  note: string;
};

export async function issueItemAction(draft: IssueDraft): Promise<Result<Issue>> {
  const denied = await guard();
  if (denied) return fail(denied);

  const db = getDb();
  const [items, issues] = await Promise.all([db.listItems(), db.listIssues()]);
  const item = items.find((i) => i.id === draft.itemId);
  if (!item) return fail("That item no longer exists.");

  const available = Math.max(0, item.totalQuantity - (computeIssuedOut(issues)[item.id] ?? 0));
  const qty = toInt(draft.quantity);
  if (qty < 1) return fail("Quantity must be at least 1.");
  if (qty > available) return fail(`Only ${available} in stock right now.`);
  if (!draft.personName.trim()) return fail("Name is required.");
  if (!draft.netId.trim()) return fail("NetID is required.");
  if (!draft.date) return fail("Pick a date.");

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
  await db.insertIssue(record);
  refresh();
  return done(record);
}

export async function returnIssueAction(issueId: string, qty: number): Promise<Result> {
  const denied = await guard();
  if (denied) return fail(denied);

  const db = getDb();
  const issue = (await db.listIssues()).find((i) => i.id === issueId);
  if (!issue) return fail("That record no longer exists.");

  const returned = Math.min(issue.quantity, Math.max(0, issue.returnedQty + toInt(qty)));
  await db.updateIssue(issueId, { returnedQty: returned });
  refresh();
  return done(null);
}

export async function deleteIssueAction(issueId: string): Promise<Result> {
  const denied = await guard();
  if (denied) return fail(denied);

  await getDb().deleteIssue(issueId);
  refresh();
  return done(null);
}
