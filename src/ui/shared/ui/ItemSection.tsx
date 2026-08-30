"use client";

import type { ReactNode } from "react";

import { QuickAddField } from "./QuickAddField";
import { SURFACE_GROUP } from "@/ui/shared/ui/surface";

export function ItemSection({
  titleRu,
  addLabelRu,
  onAdd,
  children,
}: {
  titleRu: string;
  addLabelRu?: string;
  onAdd?: (nameRu: string) => void;
  children: ReactNode;
}) {
  const add =
    addLabelRu === undefined || onAdd === undefined ? null : (
      <QuickAddField labelRu={addLabelRu} onAdd={onAdd} />
    );

  if (children === null) {
    return (
      <section className={`flex items-center gap-3 px-3 py-2 ${SURFACE_GROUP}`}>
        <h2 className="shrink-0 text-sm font-semibold">{titleRu}</h2>
        <div className="min-w-0 flex-1">{add}</div>
      </section>
    );
  }

  return (
    <section className={`flex flex-col gap-1 p-3 ${SURFACE_GROUP}`}>
      <h2 className="text-sm font-semibold">{titleRu}</h2>
      {children}
      {add}
    </section>
  );
}
