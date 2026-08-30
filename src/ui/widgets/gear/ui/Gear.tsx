"use client";

import type { BagView, ChoicesView } from "@/contract/views";
import { ItemRow } from "@/ui/entities/character/ui/ItemRow";
import { ItemSection } from "@/ui/shared/ui/ItemSection";
import { SURFACE_CONTROL, SURFACE_GROUP } from "@/ui/shared/ui/surface";

const GEAR = "gear";

const WORN = "На мне";
const SPARE = "Про запас";

export function Gear({
  bag,
  stats,
  onOpenItem,
  onAddItem,
  onAdjustWornCount,
}: {
  bag: BagView;
  stats: ChoicesView["stats"];
  onOpenItem: (id: string) => void;
  onAddItem: (kind: string, nameRu: string) => void;
  onAdjustWornCount: (id: string, delta: number) => void;
}) {
  const { items, armorClass } = bag;
  const gear = items.filter((item) => item.kind === GEAR);
  const worn = gear.filter((item) => item.wornCount > 0);
  const spare = gear.filter((item) => item.bagCount > 0 || item.wornCount === 0);

  return (
    <div className="flex flex-col gap-2">
      <section className={`flex items-center gap-3 px-3 py-2 ${SURFACE_GROUP}`}>
        <h2 className="shrink-0 text-sm font-semibold">Защита</h2>
        <p className="text-sm tabular-nums">
          КД {armorClass.value}
          <span className="text-ink-quiet">
            {" · "}
            {armorClass.wornArmorNameRu ?? "без доспехов"}
          </span>
        </p>
      </section>

      <ItemSection titleRu={WORN}>
        {worn.length === 0 ? null : (
          <ul aria-label={WORN} className="flex flex-col gap-0.5">
            {worn.map((item) => (
              <ItemRow
                key={item.id}
                item={item}
                stats={stats}
                countRu={`надето ${item.wornCount}`}
                onOpen={() => onOpenItem(item.id)}
              >
                <button
                  type="button"
                  aria-label={`Снять один: ${item.nameRu}`}
                  onClick={() => onAdjustWornCount(item.id, -1)}
                  className={`min-h-11 px-3 text-xs ${SURFACE_CONTROL}`}
                >
                  снять
                </button>
              </ItemRow>
            ))}
          </ul>
        )}
      </ItemSection>

      <ItemSection
        titleRu={SPARE}
        addLabelRu="Новая экипировка"
        onAdd={(nameRu) => onAddItem(GEAR, nameRu)}
      >
        {spare.length === 0 ? null : (
          <ul aria-label={SPARE} className="flex flex-col gap-0.5">
            {spare.map((item) => (
              <ItemRow
                key={item.id}
                item={item}
                stats={stats}
                countRu={`в сумке ${item.bagCount}`}
                onOpen={() => onOpenItem(item.id)}
              >
                {item.bagCount === 0 ? null : (
                  <button
                    type="button"
                    aria-label={`Надеть один: ${item.nameRu}`}
                    onClick={() => onAdjustWornCount(item.id, 1)}
                    className={`min-h-11 px-3 text-xs font-medium text-action ${SURFACE_CONTROL}`}
                  >
                    надеть
                  </button>
                )}
              </ItemRow>
            ))}
          </ul>
        )}
      </ItemSection>
    </div>
  );
}
