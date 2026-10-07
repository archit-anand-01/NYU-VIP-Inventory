"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { PublicItem } from "@/server/queries";

export default function StudentInventory({ items }: { items: PublicItem[] }) {
  const [query, setQuery] = useState("");
  const [availableOnly, setAvailableOnly] = useState(false);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter(
      (item) =>
        (!availableOnly || item.inStock > 0) && (!q || item.name.toLowerCase().includes(q)),
    );
  }, [items, query, availableOnly]);

  const available = items.filter((i) => i.inStock > 0).length;

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight">What&rsquo;s available</h1>
        <p className="mt-1 text-sm text-muted">
          {available} of {items.length} items are on the shelf right now. To borrow something,
          ask a professor or lab administrator.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input
          className="field max-w-xs flex-1"
          placeholder="Search for an item…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2 text-sm font-semibold">
          <input
            type="checkbox"
            className="h-4 w-4 accent-[#2f6f57]"
            checked={availableOnly}
            onChange={(e) => setAvailableOnly(e.target.checked)}
          />
          In stock only
        </label>
      </div>

      {visible.length === 0 ? (
        <div className="card px-4 py-12 text-center text-muted">
          {items.length === 0 ? "Nothing in the inventory yet." : "No items match that search."}
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((item) => (
            <li key={item.token} className="card flex items-center gap-3 p-3">
              {item.hasImage ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={`/api/photo/${item.token}`}
                  alt={item.name}
                  className="h-14 w-14 shrink-0 rounded-lg border border-line object-cover"
                />
              ) : (
                <div
                  className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg border border-line bg-background text-xs font-bold text-muted"
                  aria-hidden
                >
                  {item.name.slice(0, 2).toUpperCase()}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="font-semibold leading-tight">{item.name}</p>
                <p
                  className={`mt-0.5 text-sm font-bold ${
                    item.inStock === 0 ? "text-danger" : "text-accent"
                  }`}
                >
                  {item.inStock === 0 ? "All out" : `${item.inStock} available`}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}

      <p className="text-center text-xs text-muted">
        Faculty and administrators can{" "}
        <Link href="/login" className="font-semibold underline">
          sign in
        </Link>{" "}
        to issue items.
      </p>
    </div>
  );
}
