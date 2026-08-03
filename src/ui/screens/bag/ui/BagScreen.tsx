"use client";

import { useState } from "react";

import {
  addItem,
  adjustItemCount,
  editItem,
  editMoney,
  removeItem,
  toggleWorn,
} from "@/core/application/useCases/equipment";
import { setArmorClassBaseOverride } from "@/core/application/useCases/sheet";
import { useSession, useStores } from "@/ui/shared/model/storeContext";
import { Bag } from "@/ui/widgets/bag/ui/Bag";
import { ArmorClassBaseSheet } from "@/ui/features/edit-character-sheet/ui/ArmorClassBaseSheet";
import { ItemSheet } from "@/ui/features/edit-character-sheet/ui/ItemSheet";
import { MoneySheet } from "@/ui/features/edit-character-sheet/ui/MoneySheet";

/**
 * Что открыто поверх сумки. Вещь названа своим полем, а не приставкой в строке: строка требует
 * разбора обратно, и разбор однажды разойдётся с тем, кто её собрал.
 */
type BagEdit = { of: "money" } | { of: "armorClassBase" } | { of: "item"; id: string };

export function BagScreen() {
  const { clock, session: sessionStore } = useStores();
  const session = useSession((state) => state.session)!;

  const [open, setOpen] = useState<BagEdit | null>(null);

  const { character } = session;
  const apply = sessionStore.getState().apply;

  const openedItem =
    open?.of !== "item"
      ? null
      : (character.equipment.items.find((item) => item.id === open.id) ?? null);

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3 pt-2">
      <Bag
        character={character}
        onEditMoney={() => setOpen({ of: "money" })}
        onOpenItem={(id) => setOpen({ of: "item", id })}
        onAddItem={(kind, nameRu) =>
          apply((current) => addItem(current, { nameRu, kind, worn: false, count: 1 }, clock))
        }
        onEditArmor={() => setOpen({ of: "armorClassBase" })}
        onToggleWorn={(id) => apply((current) => toggleWorn(current, id, clock))}
        onAdjustCount={(id, delta) =>
          apply((current) => adjustItemCount(current, id, delta, clock))
        }
      />

      {open?.of === "money" ? (
        <MoneySheet
          money={character.equipment.money}
          onCancel={() => setOpen(null)}
          onSave={(money) => {
            if (apply((current) => editMoney(current, money, clock)) === null) {
              setOpen(null);
            }
          }}
        />
      ) : null}

      {open?.of === "armorClassBase" ? (
        <ArmorClassBaseSheet
          character={character}
          onCancel={() => setOpen(null)}
          onSave={(value) => {
            if (apply((current) => setArmorClassBaseOverride(current, value, clock)) === null) {
              setOpen(null);
            }
          }}
        />
      ) : null}

      {openedItem === null ? null : (
        <ItemSheet
          key={openedItem.id}
          item={openedItem}
          onCancel={() => setOpen(null)}
          onSave={(item) => {
            if (apply((current) => editItem(current, item, clock)) === null) setOpen(null);
          }}
          onAdjustCount={(delta) =>
            apply((current) => adjustItemCount(current, openedItem.id, delta, clock))
          }
          onRemove={() => {
            if (apply((current) => removeItem(current, openedItem.id, clock)) === null) {
              setOpen(null);
            }
          }}
        />
      )}
    </div>
  );
}
