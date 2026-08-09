"use client";

import "./figma-bridge.css";
import "@/components/figma/snapshot/index.css";
import FigmaSnapshotApp from "@/components/figma/snapshot/App";

type Props = {
  initialView?: "select" | "study" | "manage" | "create" | "card-detail";
  initialCardId?: number;
  appInstanceKey?: string;
};

export default function FigmaImportedApp({ initialView, initialCardId, appInstanceKey }: Props) {
  return (
    <div className="figma-import-root">
      <FigmaSnapshotApp key={appInstanceKey} initialView={initialView} initialCardId={initialCardId} />
    </div>
  );
}