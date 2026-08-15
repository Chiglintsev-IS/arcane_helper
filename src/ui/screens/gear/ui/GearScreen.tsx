"use client";

import { useState } from "react";

import type { Command } from "@/contract/commands";
import { useSession, useStores } from "@/ui/shared/model/storeContext";
import { Gear } from "@/ui/widgets/gear/ui/Gear";
import { ItemSheet } from "@/ui/features/edit-character-sheet/ui/ItemSheet";
import { applyEdit } from "@/ui/shared/model/editing";

export function GearScreen() {
  const { session: sessionStore } = useStores();
  const { bag, choices } = useSession((state) => state.snapshot)!;

  const [openedId, setOpenedId] = useState<string | null>(null);
  const [refusal, setRefusal] = useState<string | null>(null);

  const execute = sessionStore.getState().execute;

  /** Правка уходит владельцу: прошла — шторка закрывается, отказал — причина остаётся в шторке. */
  const save = async (command: Command): Promise<void> => {
    const reason = await applyEdit(sessionStore, command);
    setRefusal(reason);
    if (reason === null) setOpenedId(null);
  };

  const closeSheet = (): void => {
    setRefusal(null);
    setOpenedId(null);
  };

  const openedItem =
    openedId === null ? null : (bag.items.find((item) => item.id === openedId) ?? null);

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3 pt-2">
      <Gear
        bag={bag}
        stats={choices.stats}
        onOpenItem={(id) => {
          setRefusal(null);
          setOpenedId(id);
        }}
        onAddItem={(kind, nameRu) => void execute({ kind: "add_item", nameRu, itemKind: kind })}
        onAdjustWornCount={(id, delta) =>
          void execute({ kind: "adjust_worn_count", itemId: id, delta })
        }
      />

      {openedItem === null ? null : (
        <ItemSheet
          key={openedItem.id}
          item={openedItem}
          choices={choices}
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
              setOpenedId(null);
            }
          }}
        />
      )}
    </div>
  );
}
