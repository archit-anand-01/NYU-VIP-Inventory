"use client";

import { useEffect, useState } from "react";
import { getImage } from "@/lib/images";

// Photos come from IndexedDB, so cache them per render key to avoid a read on
// every table repaint. `version` (the item's updatedAt) busts the cache.
const cache = new Map<string, string | null>();

export function useItemPhoto(id: string, hasImage: boolean, version: string) {
  const key = `${id}|${version}`;
  const [fetched, setFetched] = useState<{ key: string; src: string | null } | null>(null);

  useEffect(() => {
    if (!hasImage || cache.has(key)) return;
    let live = true;
    getImage(id).then((data) => {
      cache.set(key, data ?? null);
      if (live) setFetched({ key, src: data ?? null });
    });
    return () => {
      live = false;
    };
  }, [id, hasImage, key]);

  if (!hasImage) return null;
  if (cache.has(key)) return cache.get(key) ?? null;
  return fetched?.key === key ? fetched.src : null;
}

export default function ItemPhoto({
  id,
  name,
  hasImage,
  version,
  onOpen,
  className = "h-11 w-11",
}: {
  id: string;
  name: string;
  hasImage: boolean;
  version: string;
  onOpen?: (src: string) => void;
  className?: string;
}) {
  const src = useItemPhoto(id, hasImage, version);

  if (!src) {
    return (
      <div
        className={`${className} flex shrink-0 items-center justify-center rounded-lg border border-line bg-background text-[0.65rem] font-bold text-muted`}
        aria-hidden
      >
        {name.slice(0, 2).toUpperCase() || "—"}
      </div>
    );
  }

  const frame = `${className} shrink-0 overflow-hidden rounded-lg border border-line bg-background`;
  /* eslint-disable-next-line @next/next/no-img-element */
  const picture = <img src={src} alt={name} className="h-full w-full object-cover" />;

  if (!onOpen) return <div className={frame}>{picture}</div>;

  return (
    <button type="button" onClick={() => onOpen(src)} title="View photo" className={frame}>
      {picture}
    </button>
  );
}
