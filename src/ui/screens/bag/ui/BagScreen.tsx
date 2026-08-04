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
import type { Session } from "@/core/application/session";
import { applyEdit } from "@/ui/shared/model/editing";

/**
 * Что открыто поверх сумки. Вещь названа своим полем, а не приставкой в строке: строка требует
 * разбора обратно, и разбор однажды разойдётся с тем, кто её собрал.
 */
type BagEdit = { of: "money" } | { of: "armorClassBase" } | { of: "item"; id: string };

export function BagScreen() {
  const { clock, session: sessionStore } = useStores();
  const session = useSession((state) => state.session)!;

  const [open, setOpen] = useState<BagEdit | null>(null);
  const [refusal, setRefusal] = useState<string | null>(null);

  const { character } = session;
  const apply = sessionStore.getState().apply;

  /** Правка уходит владельцу: прошла — шторка закрывается, отказал — причина остаётся в шторке. */
  const save = (operation: (current: Session) => Session): void => {
    const reason = applyEdit(sessionStore, operation);
    setRefusal(reason);
    if (reason === null) setOpen(null);
  };

  const openSheet = (edit: BagEdit): void => {
    setRefusal(null);
    setOpen(edit);
  };

  const closeSheet = (): void => {
    setRefusal(null);
    setOpen(null);
  };

  const openedItem =
    open?.of !== "item"
      ? null
      : (character.equipment.items.find((item) => item.id === open.id) ?? null);

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3 pt-2">
      <Bag
        character={character}
        onEditMoney={() => openSheet({ of: "money" })}
        onOpenItem={(id) => openSheet({ of: "item", id })}
        onAddItem={(kind, nameRu) =>
          apply((current) => addItem(current, { nameRu, kind, worn: false, count: 1 }, clock))
        }
        onEditArmor={() => openSheet({ of: "armorClassBase" })}
        onToggleWorn={(id) => apply((current) => toggleWorn(current, id, clock))}
        onAdjustCount={(id, delta) =>
          apply((current) => adjustItemCount(current, id, delta, clock))
        }
      />

      {open?.of === "money" ? (
        <MoneySheet
          money={character.equipment.money}
          error={refusal}
          onCancel={closeSheet}
          onSave={(money) => save((current) => editMoney(current, money, clock))}
        />
      ) : null}

      {open?.of === "armorClassBase" ? (
        <ArmorClassBaseSheet
          character={character}
          error={refusal}
          onCancel={closeSheet}
          onSave={(value) => save((current) => setArmorClassBaseOverride(current, value, clock))}
        />
      ) : null}

      {openedItem === null ? null : (
        <ItemSheet
          key={openedItem.id}
          item={openedItem}
          error={refusal}
          onCancel={closeSheet}
          onSave={(item) => save((current) => editItem(current, item, clock))}
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
