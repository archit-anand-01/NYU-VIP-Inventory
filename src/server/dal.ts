import "server-only";
import { cache } from "react";
import { hasValidSession } from "./session";

/**
 * Memoized for the duration of one render so a page and its children share a
 * single check. Every server action and route handler calls this itself -
 * server functions are reachable by direct POST, not only through our UI.
 */
export const isFaculty = cache(async (): Promise<boolean> => hasValidSession());

export class NotAuthorizedError extends Error {
  constructor() {
    super("You need to be signed in as faculty to do that.");
    this.name = "NotAuthorizedError";
  }
}

export async function requireFaculty(): Promise<void> {
  if (!(await isFaculty())) throw new NotAuthorizedError();
}
