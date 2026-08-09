import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import FigmaImportedApp from "@/components/figma/figma-imported-app";

type Params = {
  params: Promise<{ id: string }>;
};

export default async function CardDetailPage({ params }: Params) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const { id } = await params;
  const cardId = Number(id);
  if (!Number.isFinite(cardId)) {
    redirect("/cards");
  }

  return <FigmaImportedApp initialView="card-detail" initialCardId={cardId} appInstanceKey={`card-${cardId}`} />;
}
