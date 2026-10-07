import "server-only";
import type { Issue, Item } from "@/lib/types";
import { getDb } from "./db";
import { requireFaculty } from "./dal";
import { photoToken } from "./session";

export type FacultyData = { items: Item[]; issues: Issue[]; vips: string[] };

/** What a signed-out visitor is allowed to know: name, picture, availability. */
export type PublicItem = {
  token: string;
  name: string;
  inStock: number;
  hasImage: boolean;
};

/** Units currently out with someone, per item id. */
export function computeIssuedOut(issues: Issue[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const issue of issues) {
    const open = Math.max(0, issue.quantity - issue.returnedQty);
    if (open > 0) out[issue.itemId] = (out[issue.itemId] ?? 0) + open;
  }
  return out;
}

export function availableFor(item: Item, issuedOut: Record<string, number>): number {
  return Math.max(0, item.totalQuantity - (issuedOut[item.id] ?? 0));
}

export async function getFacultyData(): Promise<FacultyData> {
  await requireFaculty();
  const db = getDb();
  const [items, issues, vips] = await Promise.all([
    db.listItems(),
    db.listIssues(),
    db.listVips(),
  ]);
  return { items, issues, vips };
}

/**
 * Issue records are read here only to work out how many units are on the shelf.
 * Nothing from them leaves this function - no borrower, no netID, no item id.
 */
export async function getPublicItems(): Promise<PublicItem[]> {
  const db = getDb();
  const [items, issues] = await Promise.all([db.listItems(), db.listIssues()]);
  const issuedOut = computeIssuedOut(issues);
  return items
    .map((item) => ({
      token: photoToken(item.id),
      name: item.name,
      inStock: availableFor(item, issuedOut),
      hasImage: item.hasImage,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Maps a public photo token back to the item it belongs to. */
export async function itemIdForPhotoToken(token: string): Promise<string | null> {
  const items = await getDb().listItems();
  return items.find((item) => photoToken(item.id) === token)?.id ?? null;
}
