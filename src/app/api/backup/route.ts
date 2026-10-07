import { NextResponse } from "next/server";
import { getDb } from "@/server/db";
import { isFaculty } from "@/server/dal";

/** Faculty-only snapshot of everything, photos included, as one JSON file. */
export async function GET() {
  if (!(await isFaculty())) return new NextResponse("Not found", { status: 404 });

  const db = getDb();
  const [items, issues, vips] = await Promise.all([
    db.listItems(),
    db.listIssues(),
    db.listVips(),
  ]);

  const images: Record<string, string> = {};
  for (const item of items.filter((i) => i.hasImage)) {
    const photo = await db.getPhoto(item.id);
    if (photo) {
      images[item.id] = `data:${photo.contentType};base64,${photo.data.toString("base64")}`;
    }
  }

  const body = JSON.stringify({
    kind: "inventory-backup",
    version: 1,
    exportedAt: new Date().toISOString(),
    items,
    issues,
    vips,
    images,
  });

  return new NextResponse(body, {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="inventory-backup-${new Date()
        .toISOString()
        .slice(0, 10)}.json"`,
    },
  });
}
