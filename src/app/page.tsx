import FacultyInventory from "@/components/FacultyInventory";
import StudentInventory from "@/components/StudentInventory";
import { StoreProvider } from "@/lib/store";
import { isFaculty } from "@/server/dal";
import { getFacultyData, getPublicItems } from "@/server/queries";

// The page differs per visitor, so it is rendered per request.
export const dynamic = "force-dynamic";

export default async function InventoryPage() {
  if (!(await isFaculty())) {
    return <StudentInventory items={await getPublicItems()} />;
  }

  const { items, issues, vips } = await getFacultyData();
  return (
    <StoreProvider items={items} issues={issues} vips={vips}>
      <FacultyInventory />
    </StoreProvider>
  );
}
