"use client";

import type { ReactNode } from "react";

import { QuickAddField } from "./QuickAddField";
import { SURFACE_GROUP } from "@/ui/shared/ui/surface";

/**
 * Раздел списка вещей: заголовок, строки и строка быстрого ввода.
 *
 * Пустой раздел остаётся на месте и занимает одну строку: раздел, появляющийся с первой вещью,
 * заставлял бы искать, куда её ввести, а карточка ради одного заголовка отодвигает за край то, что
 * в разделе действительно лежит.
 */
export function ItemSection({
  titleRu,
  addLabelRu,
  onAdd,
  children,
}: {
  titleRu: string;
  /** Ярлык быстрого ввода; нет вовсе — в этот раздел не вводят, вещь попадает в него операцией. */
  addLabelRu?: string;
  onAdd?: (nameRu: string) => void;
  /** Строки раздела; `null` — раздел пуст, и тогда он живёт одной строкой со своим вводом. */
  children: ReactNode;
}) {
  const add =
    addLabelRu === undefined || onAdd === undefined ? null : (
      <QuickAddField labelRu={addLabelRu} onAdd={onAdd} />
    );

  if (children === null) {
    return (
      <section className={`flex items-center gap-3 rounded-xl px-3 py-2 ${SURFACE_GROUP}`}>
        <h2 className="shrink-0 text-sm font-semibold">{titleRu}</h2>
        <div className="min-w-0 flex-1">{add}</div>
      </section>
    );
  }

  return (
    <section className={`flex flex-col gap-1 rounded-xl p-3 ${SURFACE_GROUP}`}>
      <h2 className="text-sm font-semibold">{titleRu}</h2>
      {children}
      {add}
    </section>
  );
}
