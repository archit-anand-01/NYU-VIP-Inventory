#!/usr/bin/env node
/**
 * Loads a backup JSON file into whichever store is configured.
 *
 *   node scripts/import-backup.mjs seed/starter-inventory.json
 *
 * With SUPABASE_URL set it writes to Supabase; otherwise it writes the local
 * .data/ files the development server reads. Existing rows are replaced.
 */
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const file = process.argv[2];
if (!file) {
  console.error("usage: node scripts/import-backup.mjs <backup.json>");
  process.exit(1);
}

// Load .env.local the way `next dev` would.
try {
  const env = await readFile(".env.local", "utf8");
  for (const line of env.split("\n")) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
} catch {
  /* no .env.local - rely on the real environment */
}

const backup = JSON.parse(await readFile(file, "utf8"));
if (backup.kind !== "inventory-backup" || !Array.isArray(backup.items)) {
  console.error(`${file} is not an inventory backup`);
  process.exit(1);
}

const items = backup.items;
const issues = backup.issues ?? [];
const vips = backup.vips ?? [];
const images = backup.images ?? {};

function decode(dataUrl) {
  const m = /^data:(image\/[a-z+]+);base64,(.+)$/.exec(dataUrl);
  return m ? { contentType: m[1], data: Buffer.from(m[2], "base64") } : null;
}

if (process.env.SUPABASE_URL) {
  const { createClient } = await import("@supabase/supabase-js");
  const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
  const check = (error, what) => {
    if (error) {
      console.error(`${what}: ${error.message}`);
      process.exit(1);
    }
  };

  check((await db.from("issues").delete().neq("id", "")).error, "clear issues");
  check((await db.from("items").delete().neq("id", "")).error, "clear items");

  check(
    (
      await db.from("items").insert(
        items.map((i) => ({
          id: i.id,
          name: i.name,
          total_quantity: i.totalQuantity,
          vip: i.vip ?? "",
          location: i.location ?? "",
          notes: i.notes ?? "",
          has_image: Boolean(i.hasImage),
          created_at: i.createdAt,
          updated_at: i.updatedAt,
        })),
      )
    ).error,
    "insert items",
  );

  if (issues.length) {
    check(
      (
        await db.from("issues").insert(
          issues.map((i) => ({
            id: i.id,
            item_id: i.itemId,
            item_name: i.itemName,
            person_name: i.personName,
            net_id: i.netId ?? "",
            phone: i.phone ?? "",
            quantity: i.quantity,
            date: i.date,
            returned_qty: i.returnedQty ?? 0,
            note: i.note ?? "",
            created_at: i.createdAt,
          })),
        )
      ).error,
      "insert issues",
    );
  }

  for (const name of vips) {
    check((await db.from("vips").upsert({ name }, { onConflict: "name" })).error, "insert vip");
  }

  for (const [id, dataUrl] of Object.entries(images)) {
    const photo = decode(dataUrl);
    if (!photo) continue;
    const { error } = await db.storage
      .from("item-photos")
      .upload(`${id}.jpg`, photo.data, { contentType: photo.contentType, upsert: true });
    check(error, `upload photo ${id}`);
  }

  console.log(
    `Imported into Supabase: ${items.length} items, ${issues.length} issue records, ` +
      `${vips.length} VIPs, ${Object.keys(images).length} photos.`,
  );
} else {
  const root = path.join(process.cwd(), ".data");
  await mkdir(root, { recursive: true });
  await writeFile(
    path.join(root, "inventory.json"),
    JSON.stringify({ items, issues, vips }, null, 2),
  );

  const photos = path.join(root, "photos");
  await rm(photos, { recursive: true, force: true });
  await mkdir(photos, { recursive: true });
  for (const [id, dataUrl] of Object.entries(images)) {
    const photo = decode(dataUrl);
    if (photo) await writeFile(path.join(photos, `${id}.jpg`), photo.data);
  }

  console.log(
    `Imported into .data/: ${items.length} items, ${issues.length} issue records, ` +
      `${vips.length} VIPs, ${Object.keys(images).length} photos.`,
  );
}
