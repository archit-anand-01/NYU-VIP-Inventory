import "server-only";
import type { Db } from "./types";
import { fileDb } from "./file";
import { supabaseDb } from "./supabase";

/**
 * Supabase when it is configured, otherwise the local JSON file.
 *
 * The file driver is a development convenience. On a serverless host each
 * request gets a throwaway filesystem, so falling back to it in production
 * would quietly show an empty inventory and drop every write. Refuse instead.
 */
export function getDb(): Db {
  if (process.env.SUPABASE_URL) return supabaseDb;

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are not set. A deployed " +
        "instance cannot use the local file store - set both environment " +
        "variables and redeploy.",
    );
  }

  return fileDb;
}

export const usingSupabase = () => Boolean(process.env.SUPABASE_URL);
export type { Db } from "./types";
