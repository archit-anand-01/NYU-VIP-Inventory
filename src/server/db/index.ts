import "server-only";
import type { Db } from "./types";
import { fileDb } from "./file";
import { supabaseDb } from "./supabase";

/** Supabase when it is configured, otherwise the local JSON file. */
export function getDb(): Db {
  return process.env.SUPABASE_URL ? supabaseDb : fileDb;
}

export const usingSupabase = () => Boolean(process.env.SUPABASE_URL);
export type { Db } from "./types";
