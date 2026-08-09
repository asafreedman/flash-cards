import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { CreateUserScreen } from "@/components/auth/auth-screens";

export default async function CreateUserPage() {
  const user = await getCurrentUser();
  if (user) {
    redirect("/study");
  }

  return <CreateUserScreen />;
}
