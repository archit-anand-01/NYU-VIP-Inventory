import { NextResponse } from "next/server";
import { getDb } from "@/server/db";
import { isFaculty } from "@/server/dal";
import { itemIdForPhotoToken } from "@/server/queries";

/**
 * Faculty request photos by item id; the public page uses an opaque token, so
 * a signed-out visitor never sees an id (which carries the VIP prefix).
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const itemId = (await isFaculty()) ? id : await itemIdForPhotoToken(id);
  if (!itemId) return new NextResponse("Not found", { status: 404 });

  const photo = await getDb().getPhoto(itemId);
  if (!photo) return new NextResponse("Not found", { status: 404 });

  return new NextResponse(new Uint8Array(photo.data), {
    headers: {
      "Content-Type": photo.contentType,
      // The URL carries the item's updatedAt, so a changed photo busts this.
      "Cache-Control": "private, max-age=3600",
    },
  });
}
