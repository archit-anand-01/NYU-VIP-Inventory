/** Items with no VIP set still need a prefix. */
export const NO_VIP_PREFIX = "GEN";

/**
 * First three alphanumeric characters of the VIP name, uppercased:
 * "Desire Path" -> "DES", "Technology and Innovation catalyst" -> "TEC".
 */
export function prefixFromVip(vip: string): string {
  const letters = (vip ?? "").replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  if (!letters) return NO_VIP_PREFIX;
  return (letters + "XXX").slice(0, 3);
}

/**
 * Item id: the VIP prefix plus a 4-digit number that counts up within that
 * prefix — DES0001, DES0002, TEC0001. The number is the lowest one not already
 * in use, so deleting an item frees its slot. Past 9999 the number simply grows
 * a digit rather than failing.
 */
export function generateItemId(vip: string, taken: Iterable<string> = []): string {
  const used = new Set(taken);
  const prefix = prefixFromVip(vip);
  for (let n = 1; ; n++) {
    const id = `${prefix}${String(n).padStart(4, "0")}`;
    if (!used.has(id)) return id;
  }
}

/** Opaque id for issue records. */
export function generateRecordId(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`.toUpperCase();
}
