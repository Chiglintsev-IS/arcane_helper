"use client";

import { useEffect, useState } from "react";

import type { Command } from "@/contract/commands";
import { useSession, useStores } from "@/ui/shared/model/storeContext";
import { Bag } from "@/ui/widgets/bag/ui/Bag";
import { Gear } from "@/ui/widgets/gear/ui/Gear";
import { ItemSheet } from "@/ui/features/edit-character-sheet/ui/ItemSheet";
import { MissingMaterials } from "@/ui/features/materials/ui/MissingMaterials";
import { MoneySheet } from "@/ui/features/edit-character-sheet/ui/MoneySheet";
import { applyEdit } from "@/ui/shared/model/editing";
import { SURFACE_CHOSEN, SURFACE_GROUP } from "@/ui/shared/ui/surface";
import { readRemembered, writeRemembered } from "@/ui/shared/model/rememberedChoice";

const THINGS_PARTS = ["gear", "bag", "shopping"] as const;

type ThingsPart = (typeof THINGS_PARTS)[number];

const PART_TITLES: Record<ThingsPart, string> = {
  gear: "Экипировка",
  bag: "Сумка",
  shopping: "Покупки",
};

const DEFAULT_PART: ThingsPart = "gear";

const STORAGE_KEY = "thingsPart";

type ThingsEdit = { of: "money" } | { of: "item"; id: string };

function PartSwitcher({
  part,
  onChange,
}: {
  part: ThingsPart;
  onChange: (part: ThingsPart) => void;
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Что показать"
      className={`flex gap-0.5 p-0.5 ${SURFACE_GROUP}`}
    >
      {THINGS_PARTS.map((value) => {
        const selected = value === part;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(value)}
            className={`min-h-11 flex-1 px-1 text-sm font-medium ${
              selected
              ? SURFACE_CHOSEN
              : "text-ink-quiet"
            }`}
          >
            {PART_TITLES[value]}
          </button>
        );
      })}
    </div>
  );
}

export function ThingsScreen({ initialPart }: { initialPart?: ThingsPart } = {}) {
  const { session: sessionStore } = useStores();
  const { bag, choices } = useSession((state) => state.snapshot)!;

  const [part, setPart] = useState<ThingsPart>(() => initialPart ?? DEFAULT_PART);
  const [open, setOpen] = useState<ThingsEdit | null>(null);
  const [refusal, setRefusal] = useState<string | null>(null);

  useEffect(() => {
    if (initialPart === undefined) {
      setPart(readRemembered(STORAGE_KEY, THINGS_PARTS, DEFAULT_PART));
    }
  }, [initialPart]);

  const execute = sessionStore.getState().execute;

  const save = async (command: Command): Promise<void> => {
    const reason = await applyEdit(sessionStore, command);
    setRefusal(reason);
    if (reason === null) setOpen(null);
  };

  const openSheet = (edit: ThingsEdit): void => {
    setRefusal(null);
    setOpen(edit);
  };

  const closeSheet = (): void => {
    setRefusal(null);
    setOpen(null);
  };

  const changePart = (next: ThingsPart): void => {
    setPart(next);
    writeRemembered(STORAGE_KEY, next);
  };

  const openItem = (id: string): void => openSheet({ of: "item", id });

  const openedItem =
    open?.of !== "item" ? null : (bag.items.find((item) => item.id === open.id) ?? null);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0 px-3 pt-2">
        <PartSwitcher part={part} onChange={changePart} />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3 pt-2">
        {part === "gear" ? (
          <Gear
            bag={bag}
            stats={choices.stats}
            onOpenItem={openItem}
            onAddItem={(kind, nameRu) => void execute({ kind: "add_item", nameRu, itemKind: kind })}
            onAdjustWornCount={(id, delta) =>
              void execute({ kind: "adjust_worn_count", itemId: id, delta })
            }
          />
        ) : null}

        {part === "bag" ? (
          <Bag
            bag={bag}
            stats={choices.stats}
            onEditMoney={() => openSheet({ of: "money" })}
            onOpenItem={openItem}
            onAddItem={(kind, nameRu) => void execute({ kind: "add_item", nameRu, itemKind: kind })}
            onAdjustBagCount={(id, delta) =>
              void execute({ kind: "adjust_bag_count", itemId: id, delta })
            }
          />
        ) : null}

        {part === "shopping" ? (
          <MissingMaterials
            missing={bag.missingMaterials}
            onBuy={(spellId) => void execute({ kind: "toggle_material", spellId })}
            onOpenItem={openItem}
            onRefill={(itemId) => void execute({ kind: "adjust_bag_count", itemId, delta: 1 })}
          />
        ) : null}
      </div>

      {open?.of === "money" ? (
        <MoneySheet
          money={bag.money}
          error={refusal}
          onCancel={closeSheet}
          onSave={(money) => void save({ kind: "edit_money", money })}
        />
      ) : null}

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
              setOpen(null);
            }
          }}
        />
      )}
    </div>
  );
}
