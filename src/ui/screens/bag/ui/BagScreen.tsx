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
import { BagScreen as BagWidget } from "@/ui/widgets/bag/ui/BagScreen";
import { ArmorClassBaseSheet } from "@/ui/features/edit-character-sheet/ui/ArmorClassBaseSheet";
import { ItemSheet } from "@/ui/features/edit-character-sheet/ui/ItemSheet";
import { MoneySheet } from "@/ui/features/edit-character-sheet/ui/MoneySheet";

export function BagScreen() {
  const { clock, session: sessionStore } = useStores();
  const session = useSession((state) => state.session)!;

  const [openBlockId, setOpenBlockId] = useState<string | null>(null);

  const { character } = session;
  const apply = sessionStore.getState().apply;

  const openedItem =
    character.equipment.items.find((item) => openBlockId === `item:${item.id}`) ?? null;

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3 pt-2">
      <BagWidget
        character={character}
        onEditMoney={() => setOpenBlockId("money")}
        onOpenItem={(id) => setOpenBlockId(`item:${id}`)}
        onAddItem={(kind, nameRu) =>
          apply((current) =>
            addItem(
              current,
              {
                id: nameRu.toLowerCase().replaceAll(" ", "-"),
                nameRu,
                kind,
                worn: false,
                count: 1,
              },
              clock,
            ),
          )
        }
        onEditArmor={() => setOpenBlockId("armorClassBase")}
        onToggleWorn={(id) => apply((current) => toggleWorn(current, id, clock))}
        onAdjustCount={(id, delta) =>
          apply((current) => adjustItemCount(current, id, delta, clock))
        }
      />

      {openBlockId === "money" ? (
        <MoneySheet
          money={character.equipment.money}
          onCancel={() => setOpenBlockId(null)}
          onSave={(money) => {
            if (apply((current) => editMoney(current, money, clock)) === null) {
              setOpenBlockId(null);
            }
          }}
        />
      ) : null}

      {openBlockId === "armorClassBase" ? (
        <ArmorClassBaseSheet
          character={character}
          onCancel={() => setOpenBlockId(null)}
          onSave={(value) => {
            if (apply((current) => setArmorClassBaseOverride(current, value, clock)) === null) {
              setOpenBlockId(null);
            }
          }}
        />
      ) : null}

      {openedItem === null ? null : (
        <ItemSheet
          key={openedItem.id}
          item={openedItem}
          onCancel={() => setOpenBlockId(null)}
          onSave={(item) => {
            if (apply((current) => editItem(current, item, clock)) === null) setOpenBlockId(null);
          }}
          onAdjustCount={(delta) =>
            apply((current) => adjustItemCount(current, openedItem.id, delta, clock))
          }
          onRemove={() => {
            if (apply((current) => removeItem(current, openedItem.id, clock)) === null) {
              setOpenBlockId(null);
            }
          }}
        />
      )}
    </div>
  );
}
