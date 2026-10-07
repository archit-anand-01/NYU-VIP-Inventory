import { redirect } from "next/navigation";
import LoginForm from "@/components/LoginForm";
import { isFaculty } from "@/server/dal";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (await isFaculty()) redirect("/");
  return <LoginForm />;
}
