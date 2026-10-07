"use client";

/** Photos are served by the app, so the browser caches them like any image. */
export function photoUrl(id: string, version: string): string {
  return `/api/photo/${encodeURIComponent(id)}?v=${encodeURIComponent(version)}`;
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
  if (!hasImage) {
    return (
      <div
        className={`${className} flex shrink-0 items-center justify-center rounded-lg border border-line bg-background text-[0.65rem] font-bold text-muted`}
        aria-hidden
      >
        {name.slice(0, 2).toUpperCase() || "—"}
      </div>
    );
  }

  const src = photoUrl(id, version);
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
