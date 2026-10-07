import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Issue, Item } from "@/lib/types";
import type { Db, Photo } from "./types";
import { DEFAULT_VIPS } from "@/lib/constants";

const BUCKET = "item-photos";

let client: SupabaseClient | null = null;

/**
 * Uses the service-role key, so this module must never be imported from a
 * client component. Row Level Security denies everything by default (see
 * supabase/schema.sql); the service role bypasses it, which is why every read
 * and write goes through server code that has already checked the session.
 */
function db(): SupabaseClient {
  if (!client) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set");
    }
    client = createClient(url, key, { auth: { persistSession: false } });
  }
  return client;
}

type ItemRow = {
  id: string;
  name: string;
  total_quantity: number;
  vip: string;
  location: string;
  notes: string;
  has_image: boolean;
  created_at: string;
  updated_at: string;
};

type IssueRow = {
  id: string;
  item_id: string;
  item_name: string;
  person_name: string;
  net_id: string;
  phone: string;
  quantity: number;
  date: string;
  returned_qty: number;
  note: string;
  created_at: string;
};

const toItem = (r: ItemRow): Item => ({
  id: r.id,
  name: r.name,
  totalQuantity: r.total_quantity,
  vip: r.vip ?? "",
  location: r.location ?? "",
  notes: r.notes ?? "",
  hasImage: r.has_image,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

const toItemRow = (i: Partial<Item>): Partial<ItemRow> => {
  const row: Partial<ItemRow> = {};
  if (i.id !== undefined) row.id = i.id;
  if (i.name !== undefined) row.name = i.name;
  if (i.totalQuantity !== undefined) row.total_quantity = i.totalQuantity;
  if (i.vip !== undefined) row.vip = i.vip;
  if (i.location !== undefined) row.location = i.location;
  if (i.notes !== undefined) row.notes = i.notes;
  if (i.hasImage !== undefined) row.has_image = i.hasImage;
  if (i.createdAt !== undefined) row.created_at = i.createdAt;
  if (i.updatedAt !== undefined) row.updated_at = i.updatedAt;
  return row;
};

const toIssue = (r: IssueRow): Issue => ({
  id: r.id,
  itemId: r.item_id,
  itemName: r.item_name,
  personName: r.person_name,
  netId: r.net_id ?? "",
  phone: r.phone ?? "",
  quantity: r.quantity,
  date: r.date,
  returnedQty: r.returned_qty,
  note: r.note ?? "",
  createdAt: r.created_at,
});

const toIssueRow = (i: Partial<Issue>): Partial<IssueRow> => {
  const row: Partial<IssueRow> = {};
  if (i.id !== undefined) row.id = i.id;
  if (i.itemId !== undefined) row.item_id = i.itemId;
  if (i.itemName !== undefined) row.item_name = i.itemName;
  if (i.personName !== undefined) row.person_name = i.personName;
  if (i.netId !== undefined) row.net_id = i.netId;
  if (i.phone !== undefined) row.phone = i.phone;
  if (i.quantity !== undefined) row.quantity = i.quantity;
  if (i.date !== undefined) row.date = i.date;
  if (i.returnedQty !== undefined) row.returned_qty = i.returnedQty;
  if (i.note !== undefined) row.note = i.note;
  if (i.createdAt !== undefined) row.created_at = i.createdAt;
  return row;
};

function check(error: { message: string } | null, what: string) {
  if (error) throw new Error(`${what}: ${error.message}`);
}

export const supabaseDb: Db = {
  async listItems() {
    const { data, error } = await db()
      .from("items")
      .select("*")
      .order("created_at", { ascending: false });
    check(error, "list items");
    return (data as ItemRow[]).map(toItem);
  },
  async insertItem(item) {
    const { error } = await db().from("items").insert(toItemRow(item));
    check(error, "insert item");
  },
  async updateItem(id, patch) {
    const { error } = await db().from("items").update(toItemRow(patch)).eq("id", id);
    check(error, "update item");
  },
  async deleteItem(id) {
    // issues.item_id is ON DELETE CASCADE, so the log rows go with it.
    const { error } = await db().from("items").delete().eq("id", id);
    check(error, "delete item");
  },

  async listIssues() {
    const { data, error } = await db()
      .from("issues")
      .select("*")
      .order("date", { ascending: false })
      .order("created_at", { ascending: false });
    check(error, "list issues");
    return (data as IssueRow[]).map(toIssue);
  },
  async insertIssue(issue) {
    const { error } = await db().from("issues").insert(toIssueRow(issue));
    check(error, "insert issue");
  },
  async updateIssue(id, patch) {
    const { error } = await db().from("issues").update(toIssueRow(patch)).eq("id", id);
    check(error, "update issue");
  },
  async deleteIssue(id) {
    const { error } = await db().from("issues").delete().eq("id", id);
    check(error, "delete issue");
  },

  async listVips() {
    const { data, error } = await db()
      .from("vips")
      .select("name")
      .order("created_at", { ascending: true });
    check(error, "list vips");
    const names = (data as { name: string }[]).map((r) => r.name);
    return names.length ? names : [...DEFAULT_VIPS];
  },
  async addVip(name) {
    const { error } = await db().from("vips").upsert({ name }, { onConflict: "name" });
    check(error, "add vip");
  },

  async getPhoto(itemId) {
    const { data, error } = await db().storage.from(BUCKET).download(`${itemId}.jpg`);
    if (error || !data) return null;
    return { data: Buffer.from(await data.arrayBuffer()), contentType: "image/jpeg" };
  },
  async putPhoto(itemId, photo: Photo) {
    const { error } = await db()
      .storage.from(BUCKET)
      .upload(`${itemId}.jpg`, photo.data, {
        contentType: photo.contentType,
        upsert: true,
      });
    check(error, "upload photo");
  },
  async deletePhoto(itemId) {
    await db().storage.from(BUCKET).remove([`${itemId}.jpg`]);
  },
};
