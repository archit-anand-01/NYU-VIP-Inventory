import type { Issue, Item } from "@/lib/types";

export type Photo = { data: Buffer; contentType: string };

/**
 * Everything the app needs from storage. Two drivers implement it: a JSON file
 * for local development, and Supabase for the deployed app. Keeping the surface
 * this small is what makes swapping them safe.
 */
export interface Db {
  listItems(): Promise<Item[]>;
  insertItem(item: Item): Promise<void>;
  updateItem(id: string, patch: Partial<Item>): Promise<void>;
  deleteItem(id: string): Promise<void>;

  listIssues(): Promise<Issue[]>;
  insertIssue(issue: Issue): Promise<void>;
  updateIssue(id: string, patch: Partial<Issue>): Promise<void>;
  deleteIssue(id: string): Promise<void>;

  listVips(): Promise<string[]>;
  addVip(name: string): Promise<void>;

  getPhoto(itemId: string): Promise<Photo | null>;
  putPhoto(itemId: string, photo: Photo): Promise<void>;
  deletePhoto(itemId: string): Promise<void>;
}
