"use client";

import { useEffect, useState } from "react";

import type { Command } from "@/contract/commands";
import { useSession, useStores } from "@/ui/shared/model/storeContext";
import { Bag, BAG_FILTERS, type BagFilter } from "@/ui/widgets/bag/ui/Bag";
import { ItemBase, BASE_FILTERS, type BaseFilter } from "@/ui/widgets/item-base/ui/ItemBase";
import { ItemSheet } from "@/ui/features/edit-character-sheet/ui/ItemSheet";
import { MoneySheet } from "@/ui/features/edit-character-sheet/ui/MoneySheet";
import { applyEdit } from "@/ui/shared/model/editing";
import { Choices } from "@/ui/shared/ui/Choices";
import { readRemembered, writeRemembered } from "@/ui/shared/model/rememberedChoice";

const THINGS_PARTS = ["bag", "base"] as const;

type ThingsPart = (typeof THINGS_PARTS)[number];

const PART_TITLES: Record<ThingsPart, string> = {
  bag: "Рюкзак",
  base: "Все вещи",
};

const DEFAULT_PART: ThingsPart = "bag";

const DEFAULT_BAG_FILTER: BagFilter = "all";

const DEFAULT_BASE_FILTER: BaseFilter = "all";

const PART_KEY = "thingsPart";

const BAG_FILTER_KEY = "thingsBagFilter";

const BASE_FILTER_KEY = "thingsBaseFilter";

type ThingsEdit = { of: "money" } | { of: "item"; id: string };

export function ThingsScreen({ initialPart }: { initialPart?: ThingsPart } = {}) {
  const { session: sessionStore } = useStores();
  const { bag, choices } = useSession((state) => state.snapshot)!;

  const [part, setPart] = useState<ThingsPart>(() => initialPart ?? DEFAULT_PART);
  const [bagFilter, setBagFilter] = useState<BagFilter>(DEFAULT_BAG_FILTER);
  const [baseFilter, setBaseFilter] = useState<BaseFilter>(DEFAULT_BASE_FILTER);
  const [open, setOpen] = useState<ThingsEdit | null>(null);
  const [refusal, setRefusal] = useState<string | null>(null);

  useEffect(() => {
    if (initialPart === undefined) setPart(readRemembered(PART_KEY, THINGS_PARTS, DEFAULT_PART));
    setBagFilter(readRemembered(BAG_FILTER_KEY, BAG_FILTERS, DEFAULT_BAG_FILTER));
    setBaseFilter(readRemembered(BASE_FILTER_KEY, BASE_FILTERS, DEFAULT_BASE_FILTER));
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
    writeRemembered(PART_KEY, next);
  };

  const changeBagFilter = (next: BagFilter): void => {
    setBagFilter(next);
    writeRemembered(BAG_FILTER_KEY, next);
  };

  const changeBaseFilter = (next: BaseFilter): void => {
    setBaseFilter(next);
    writeRemembered(BASE_FILTER_KEY, next);
  };

  const openedItem =
    open?.of !== "item" ? null : (bag.items.find((item) => item.id === open.id) ?? null);

  const editMoney = (): void => openSheet({ of: "money" });
  const openItem = (id: string): void => openSheet({ of: "item", id });
  const adjustBagCount = (id: string, delta: number): void => {
    void execute({ kind: "adjust_bag_count", itemId: id, delta });
  };
  const setBagCount = (id: string, count: number): void => {
    void execute({ kind: "set_bag_count", itemId: id, count });
  };
  const adjustWornCount = (id: string, delta: number): void => {
    void execute({ kind: "adjust_worn_count", itemId: id, delta });
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0 px-3 pt-2">
        <Choices
          labelRu="Что показать"
          values={THINGS_PARTS}
          titles={PART_TITLES}
          chosen={part}
          onChoose={changePart}
        />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3 pt-2">
        {part === "bag" ? (
          <Bag
            bag={bag}
            stats={choices.stats}
            filter={bagFilter}
            onChangeFilter={changeBagFilter}
            onEditMoney={editMoney}
            onOpenItem={openItem}
            onAddItem={(kinds, nameRu) =>
              void execute({ kind: "add_item", nameRu, itemKinds: [...kinds] })
            }
            onAdjustBagCount={adjustBagCount}
            onAdjustWornCount={adjustWornCount}
          />
        ) : (
          <ItemBase
            bag={bag}
            stats={choices.stats}
            filter={baseFilter}
            onChangeFilter={changeBaseFilter}
            onEditMoney={editMoney}
            onOpenItem={openItem}
            onRecordItem={(nameRu, wanted) => void execute({ kind: "record_item", nameRu, wanted })}
            onAdjustBagCount={adjustBagCount}
            onAdjustWornCount={adjustWornCount}
          />
        )}
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
          onToggleWanted={() => void execute({ kind: "toggle_wanted", itemId: openedItem.id })}
          onAdjustBagCount={(delta) => adjustBagCount(openedItem.id, delta)}
          onSetBagCount={(count) => setBagCount(openedItem.id, count)}
          onAdjustWornCount={(delta) => adjustWornCount(openedItem.id, delta)}
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
