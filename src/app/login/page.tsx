import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { LoginScreen } from "@/components/auth/auth-screens";

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) {
    redirect("/study");
  }

  return <LoginScreen />;
}
