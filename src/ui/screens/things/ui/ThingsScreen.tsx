"use client";

import { useEffect, useState } from "react";

import type { Command } from "@/contract/commands";
import type { ItemView } from "@/contract/views";
import { ItemPage, type ItemPatch } from "@/ui/features/edit-character-sheet/ui/ItemPage";
import { applyEdit } from "@/ui/shared/model/editing";
import { readRemembered, writeRemembered } from "@/ui/shared/model/rememberedChoice";
import { useSession, useStores } from "@/ui/shared/model/storeContext";
import { BUTTON_LABELS } from "@/ui/shared/ui/buttonLabels";
import { FooterAction } from "@/ui/shared/ui/FooterAction";
import { GrowingField } from "@/ui/shared/ui/GrowingField";
import { RULE_TAB_OFF, RULE_TAB_ON } from "@/ui/shared/ui/rule";
import { SURFACE_GROUP_BARE, SURFACE_PANEL } from "@/ui/shared/ui/surface";
import { Bag } from "@/ui/widgets/bag/ui/Bag";
import { MetItems } from "@/ui/widgets/met-items/ui/MetItems";
import { Shopping } from "@/ui/widgets/shopping/ui/Shopping";

const TABS = ["bag", "met", "buy"] as const;

type Tab = (typeof TABS)[number];

const TAB_TITLES: Record<Tab, string> = {
  bag: "Рюкзак",
  met: "Встречалось",
  buy: "Покупки",
};

const DEFAULT_TAB: Tab = "bag";

const TAB_KEY = "thingsPart";

const RECORD_ITEM = "Записать вещь";

const ADD_WANTED = "Добавить в покупки";

const NAME_FIELD = "Название со слов мастера";

const SPENT_RU = "Списано";

export function ThingsScreen({
  initialTab,
  initialItemId,
  onOpenAlchemy,
}: {
  initialTab?: Tab;
  /** Вещь, ради которой на экран вернулись: карточка открывается сразу, а не после поиска в списке. */
  initialItemId?: string;
  onOpenAlchemy?: (itemId: string) => void;
} = {}) {
  const { session: sessionStore } = useStores();
  const { bag, choices, crafting } = useSession((state) => state.snapshot)!;

  const [tab, setTab] = useState<Tab>(() => initialTab ?? DEFAULT_TAB);
  const [openedId, setOpenedId] = useState<string | null>(initialItemId ?? null);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");
  const [refusalRu, setRefusalRu] = useState<string | null>(null);
  const [spent, setSpent] = useState<string | null>(null);
  const [emptied, setEmptied] = useState<readonly string[]>([]);
  const [bought, setBought] = useState<readonly string[]>([]);

  useEffect(() => {
    if (initialTab === undefined) setTab(readRemembered(TAB_KEY, TABS, DEFAULT_TAB));
  }, [initialTab]);

  const send = (command: Command, whenDone?: () => void): void => {
    void applyEdit(sessionStore, command).then((reason) => {
      setRefusalRu(reason);
      if (reason === null) whenDone?.();
    });
  };

  const changeTab = (next: Tab): void => {
    setTab(next);
    setSpent(null);
    setRefusalRu(null);
    setAdding(false);
    setDraft("");
    writeRemembered(TAB_KEY, next);
  };

  const opened = bag.items.find((item) => item.id === openedId) ?? null;
  const openedIngredient = crafting.ingredients.find((one) => one.itemId === openedId);

  /* Строка, опустевшая под пальцем, остаётся на месте: ноль — состояние вещи, а не её отсутствие. */
  const atHand = (item: ItemView): boolean => item.ownedCount > 0 || emptied.includes(item.id);

  const spend = (item: ItemView): void => {
    send({ kind: "adjust_bag_count", itemId: item.id, delta: -1 }, () => {
      setSpent(item.nameRu);
      if (item.ownedCount === 1) setEmptied([...emptied, item.id]);
    });
  };

  const buy = (item: ItemView): void =>
    send({ kind: "buy_item", itemId: item.id }, () => setBought([...bought, item.id]));

  const record = (nameRu: string): void => {
    const command: Command =
      tab === "bag"
        ? { kind: "add_item", nameRu, itemKinds: [] }
        : { kind: "record_item", nameRu, wanted: tab === "buy" };
    send(command, () => {
      setAdding(false);
      setDraft("");
    });
  };

  if (opened !== null) {
    return (
      <ItemPage
        key={opened.id}
        item={opened}
        choices={choices}
        ingredient={openedIngredient}
        backTitleRu={TAB_TITLES[tab]}
        onBack={() => {
          setRefusalRu(null);
          setOpenedId(null);
        }}
        onWrite={(patch: ItemPatch) => send({ kind: "edit_item", item: patch })}
        onToggleWanted={() => send({ kind: "toggle_wanted", itemId: opened.id })}
        onAdjustBagCount={(delta) =>
          send({ kind: "adjust_bag_count", itemId: opened.id, delta })
        }
        onAdjustWornCount={(delta) =>
          send({ kind: "adjust_worn_count", itemId: opened.id, delta })
        }
        onAddNote={(textRu) => send({ kind: "add_item_note", itemId: opened.id, textRu })}
        onRewriteNote={(noteId, textRu) =>
          send({ kind: "edit_item_note", itemId: opened.id, noteId, textRu })
        }
        onDropNote={(noteId) => send({ kind: "remove_item_note", itemId: opened.id, noteId })}
        onRemove={() => send({ kind: "remove_item", itemId: opened.id }, () => setOpenedId(null))}
        onOpenAlchemy={() => onOpenAlchemy?.(opened.id)}
        onStartAlchemy={() => send({ kind: "note_ingredient", nameRu: opened.nameRu })}
      />
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <nav aria-label="Что показать" className="flex shrink-0 gap-1 px-3 pt-1.5">
        {TABS.map((one) => (
          <button
            key={one}
            type="button"
            aria-current={one === tab ? "page" : undefined}
            onClick={() => changeTab(one)}
            className={`flex-1 text-[0.8125rem] font-semibold ${
              one === tab
                ? `${SURFACE_GROUP_BARE} text-accent ${RULE_TAB_ON}`
                : `text-ink-quiet ${RULE_TAB_OFF}`
            }`}
          >
            {TAB_TITLES[one]}
          </button>
        ))}
      </nav>

      {tab === "bag" ? (
        <Bag
          items={bag.items.filter(atHand)}
          money={bag.money}
          stats={choices.stats}
          openedId={openedId}
          onOpenItem={setOpenedId}
          onSpend={(id) => {
            const item = bag.items.find((one) => one.id === id);
            if (item !== undefined) spend(item);
          }}
          onStock={(id) => send({ kind: "adjust_bag_count", itemId: id, delta: 1 })}
          onWriteMoney={(money) => send({ kind: "edit_money", money })}
        />
      ) : tab === "met" ? (
        <MetItems
          items={bag.items}
          openedId={openedId}
          onOpenItem={setOpenedId}
          onToggleWanted={(id) => send({ kind: "toggle_wanted", itemId: id })}
        />
      ) : (
        <Shopping
          items={bag.items.filter((item) => item.wanted)}
          money={bag.money}
          shopping={bag.shopping}
          bought={bought}
          onBuy={(id) => {
            const item = bag.items.find((one) => one.id === id);
            if (item !== undefined) buy(item);
          }}
        />
      )}

      {refusalRu === null ? null : (
        <p role="alert" className={`shrink-0 px-3 py-2 text-xs text-reaction ${SURFACE_PANEL}`}>
          {refusalRu}
        </p>
      )}

      {spent === null ? null : (
        <div className={`flex shrink-0 items-center gap-2 px-3 py-1 ${SURFACE_PANEL}`}>
          <span className="min-w-0 flex-1 text-[0.6875rem] text-ink-soft">
            {SPENT_RU}: {spent}
          </span>
          <button
            type="button"
            onClick={() => send({ kind: "undo_last" }, () => setSpent(null))}
            className="shrink-0 px-3 text-[0.8125rem] font-semibold text-accent"
          >
            {BUTTON_LABELS.undo}
          </button>
        </div>
      )}

      <FooterAction
        labelRu={tab === "buy" ? ADD_WANTED : RECORD_ITEM}
        above={
          !adding ? null : (
            <div className="p-3">
              <GrowingField
                labelRu={NAME_FIELD}
                placeholderRu={NAME_FIELD}
                value={draft}
                autoFocus
                onChange={setDraft}
                onSubmit={record}
                onCancel={() => setAdding(false)}
              />
            </div>
          )
        }
        onAct={() => setAdding(!adding)}
      />
    </div>
  );
}
