import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import FigmaImportedApp from "@/components/figma/figma-imported-app";

export default async function StudyPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  return <FigmaImportedApp initialView="select" appInstanceKey="study" />;
}
