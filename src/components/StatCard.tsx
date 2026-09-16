export default function StatCard({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: number | string;
  tone?: "default" | "accent" | "danger" | "warn";
}) {
  const color =
    tone === "accent"
      ? "text-accent"
      : tone === "danger"
        ? "text-danger"
        : tone === "warn"
          ? "text-warn"
          : "text-foreground";
  return (
    <div className="card px-4 py-3">
      <p className="text-[0.66rem] font-bold uppercase tracking-[0.07em] text-muted">{label}</p>
      <p className={`mt-1 text-2xl font-extrabold tracking-tight ${color}`}>{value}</p>
    </div>
  );
}
