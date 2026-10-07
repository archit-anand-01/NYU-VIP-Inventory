import { redirect } from "next/navigation";
import IssuedLog from "@/components/IssuedLog";
import { StoreProvider } from "@/lib/store";
import { isFaculty } from "@/server/dal";
import { getFacultyData } from "@/server/queries";

export const dynamic = "force-dynamic";

export default async function IssuedPage() {
  // Students never reach this data: the redirect happens before any of it is
  // fetched, and getFacultyData() checks the session again on its own.
  if (!(await isFaculty())) redirect("/login?next=/issued");

  const { items, issues, vips } = await getFacultyData();
  return (
    <StoreProvider items={items} issues={issues} vips={vips}>
      <IssuedLog />
    </StoreProvider>
  );
}
