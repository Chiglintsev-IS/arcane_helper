"use client";

import { useState } from "react";

import type { Command } from "@/contract/commands";
import { Items } from "@/core/domain/items/items";
import { Equipment } from "@/core/domain/equipment/equipment";
import { useSession, useStores } from "@/ui/shared/model/storeContext";
import { Bag } from "@/ui/widgets/bag/ui/Bag";
import { ItemSheet } from "@/ui/features/edit-character-sheet/ui/ItemSheet";
import { MoneySheet } from "@/ui/features/edit-character-sheet/ui/MoneySheet";
import { applyEdit } from "@/ui/shared/model/editing";

/**
 * Что открыто поверх сумки. Вещь названа своим полем, а не приставкой в строке: строка требует
 * разбора обратно, и разбор однажды разойдётся с тем, кто её собрал.
 */
type BagEdit = { of: "money" } | { of: "item"; id: string };

export function BagScreen() {
  const { session: sessionStore } = useStores();
  const session = useSession((state) => state.session)!;

  const [open, setOpen] = useState<BagEdit | null>(null);
  const [refusal, setRefusal] = useState<string | null>(null);

  const { character } = session;
  const execute = sessionStore.getState().execute;

  /** Правка уходит владельцу: прошла — шторка закрывается, отказал — причина остаётся в шторке. */
  const save = async (command: Command): Promise<void> => {
    const reason = await applyEdit(sessionStore, command);
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

  const openedItem = open?.of !== "item" ? null : (Items.of(character).find(open.id) ?? null);
  const equipment = Equipment.of(character);

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3 pt-2">
      <Bag
        character={character}
        onEditMoney={() => openSheet({ of: "money" })}
        onOpenItem={(id) => openSheet({ of: "item", id })}
        onAddItem={(kind, nameRu) => void execute({ kind: "add_item", nameRu, itemKind: kind })}
        onAdjustBagCount={(id, delta) => void execute({ kind: "adjust_bag_count", itemId: id, delta })}
        onAdjustWornCount={(id, delta) => void execute({ kind: "adjust_worn_count", itemId: id, delta })}
      />

      {open?.of === "money" ? (
        <MoneySheet
          money={character.equipment.money}
          error={refusal}
          onCancel={closeSheet}
          onSave={(money) => void save({ kind: "edit_money", money })}
        />
      ) : null}

      {openedItem === null ? null : (
        <ItemSheet
          key={openedItem.id}
          item={openedItem}
          bagCount={equipment.bagCount(openedItem.id)}
          wornCount={equipment.wornCount(openedItem.id)}
          error={refusal}
          onCancel={closeSheet}
          onSave={(item) => void save({ kind: "edit_item", item })}
          onAdjustBagCount={(delta) =>
            void execute({ kind: "adjust_bag_count", itemId: openedItem.id, delta })
          }
          onAdjustWornCount={(delta) =>
            void execute({ kind: "adjust_worn_count", itemId: openedItem.id, delta })
          }
          onRemove={async () => {
            if ((await execute({ kind: "remove_item", itemId: openedItem.id })) === null) {
              setOpen(null);
            }
          }}
        />
      )}
    </div>
  );
}

