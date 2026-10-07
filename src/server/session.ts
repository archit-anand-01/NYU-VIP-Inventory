import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

const COOKIE = "inv_session";
const MAX_AGE_SECONDS = 7 * 24 * 60 * 60;

function secret(): Uint8Array {
  const value = process.env.SESSION_SECRET;
  if (!value || value.length < 16) {
    throw new Error("SESSION_SECRET must be set to a random string of 16+ characters");
  }
  return new TextEncoder().encode(value);
}

export async function createSession(): Promise<void> {
  const token = await new SignJWT({ role: "faculty" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_SECONDS}s`)
    .sign(secret());

  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function destroySession(): Promise<void> {
  (await cookies()).delete(COOKIE);
}

/** True only for a cookie this server signed and that has not expired. */
export async function hasValidSession(): Promise<boolean> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return false;
  try {
    const { payload } = await jwtVerify(token, secret(), { algorithms: ["HS256"] });
    return payload.role === "faculty";
  } catch {
    return false;
  }
}

/** Constant-time compare so a wrong guess leaks nothing through timing. */
export function passwordMatches(attempt: string): boolean {
  const expected = process.env.FACULTY_PASSWORD;
  if (!expected) throw new Error("FACULTY_PASSWORD is not set on the server");
  const a = createHmac("sha256", secret()).update(attempt).digest();
  const b = createHmac("sha256", secret()).update(expected).digest();
  return timingSafeEqual(a, b);
}

/**
 * Opaque per-item handle for public photo URLs. Students need to load an item's
 * picture without learning its ID, which encodes the VIP group.
 */
export function photoToken(itemId: string): string {
  return createHmac("sha256", secret()).update(`photo:${itemId}`).digest("hex").slice(0, 16);
}
