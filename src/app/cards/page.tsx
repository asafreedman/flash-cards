import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import FigmaImportedApp from "@/components/figma/figma-imported-app";

export default async function CardsPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  return <FigmaImportedApp initialView="manage" appInstanceKey="cards" />;
}
