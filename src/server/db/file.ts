import "server-only";
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Issue, Item } from "@/lib/types";
import type { Db, Photo } from "./types";
import { DEFAULT_VIPS } from "@/lib/constants";

/**
 * Local-development driver: one JSON file plus a folder of photos. Good enough
 * for a single person on one machine, which is exactly what `npm run dev` is.
 * Never use it on a deployed instance - serverless filesystems are ephemeral.
 */
const ROOT = path.join(process.cwd(), ".data");
const FILE = path.join(ROOT, "inventory.json");
const PHOTOS = path.join(ROOT, "photos");

type Shape = { items: Item[]; issues: Issue[]; vips: string[] };

const EMPTY: Shape = { items: [], issues: [], vips: [...DEFAULT_VIPS] };

async function load(): Promise<Shape> {
  try {
    const parsed = JSON.parse(await readFile(FILE, "utf8")) as Partial<Shape>;
    return {
      items: parsed.items ?? [],
      issues: parsed.issues ?? [],
      vips: parsed.vips?.length ? parsed.vips : [...DEFAULT_VIPS],
    };
  } catch {
    return { ...EMPTY };
  }
}

// Serialize writes so two requests can't clobber each other's read-modify-write.
let queue: Promise<unknown> = Promise.resolve();

function mutate<T>(fn: (data: Shape) => T | Promise<T>): Promise<T> {
  const run = queue.then(async () => {
    const data = await load();
    const result = await fn(data);
    await mkdir(ROOT, { recursive: true });
    await writeFile(FILE, JSON.stringify(data, null, 2));
    return result;
  });
  queue = run.catch(() => undefined);
  return run;
}

export const fileDb: Db = {
  async listItems() {
    return (await load()).items;
  },
  insertItem(item) {
    return mutate((d) => {
      d.items = [item, ...d.items];
    });
  },
  updateItem(id, patch) {
    return mutate((d) => {
      d.items = d.items.map((i) => (i.id === id ? { ...i, ...patch } : i));
    });
  },
  deleteItem(id) {
    return mutate((d) => {
      d.items = d.items.filter((i) => i.id !== id);
      d.issues = d.issues.filter((i) => i.itemId !== id);
    });
  },

  async listIssues() {
    return (await load()).issues;
  },
  insertIssue(issue) {
    return mutate((d) => {
      d.issues = [issue, ...d.issues];
    });
  },
  updateIssue(id, patch) {
    return mutate((d) => {
      d.issues = d.issues.map((i) => (i.id === id ? { ...i, ...patch } : i));
    });
  },
  deleteIssue(id) {
    return mutate((d) => {
      d.issues = d.issues.filter((i) => i.id !== id);
    });
  },

  async listVips() {
    return (await load()).vips;
  },
  addVip(name) {
    return mutate((d) => {
      if (!d.vips.some((v) => v.toLowerCase() === name.toLowerCase())) {
        d.vips = [...d.vips, name];
      }
    });
  },

  async getPhoto(itemId) {
    try {
      const files = await readdir(PHOTOS);
      const match = files.find((f) => f.startsWith(`${itemId}.`));
      if (!match) return null;
      const data = await readFile(path.join(PHOTOS, match));
      return { data, contentType: match.endsWith(".png") ? "image/png" : "image/jpeg" };
    } catch {
      return null;
    }
  },
  async putPhoto(itemId, photo: Photo) {
    await mkdir(PHOTOS, { recursive: true });
    await this.deletePhoto(itemId);
    const ext = photo.contentType === "image/png" ? "png" : "jpg";
    await writeFile(path.join(PHOTOS, `${itemId}.${ext}`), photo.data);
  },
  async deletePhoto(itemId) {
    for (const ext of ["jpg", "png"]) {
      await rm(path.join(PHOTOS, `${itemId}.${ext}`), { force: true });
    }
  },
};
