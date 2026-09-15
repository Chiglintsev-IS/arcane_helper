import { Character } from "@/core/domain/assembly/character";
import { DomainError } from "@/core/domain/shared/errors";
import { Items } from "@/core/domain/items/items";
import { wearable } from "@/core/domain/items/schema";
import type { ItemDefinition, ItemDraft, ItemKind } from "@/core/domain/items/schema";
import type { Money } from "@/core/domain/equipment/schema";
import { CURRENCIES } from "@/core/domain/shared/schema";
import { CURRENCY_ABBREVIATIONS } from "@/shared/language";
import { commit, withoutRecord, type Occasion, type Session } from "@/core/application/session";

function applied(
  session: Session,
  change: (character: Character) => Character,
  summaryRu: string,
  occasion: Occasion,
): Session {
  return commit(session, change(Character.of(session.character)), {
    kind: "sheet_edited",
    summaryRu,
  }, occasion);
}

export function addItem(
  session: Session,
  item: { nameRu: string; kinds: readonly ItemKind[]; price?: ItemDefinition["price"] },
  occasion: Occasion,
): Session {
  const id = Items.idFromName(item.nameRu);
  const before = Character.of(session.character).equipment.bagCount(id);
  return applied(
    session,
    (root) => {
      const items = root.items.addDefinition(item);
      return root.withItems(items).withEquipment(root.equipment.adjustBagCount(id, 1));
    },
    `Добавлено: ${item.nameRu} (стало ${before + 1})`,
    occasion,
  );
}

/** Вещь, переставшая быть экипировкой, остаётся при персонаже, но снятой: надетой её уже не носят. */
export function editItem(session: Session, item: ItemDraft, occasion: Occasion): Session {
  return applied(
    session,
    (root) => {
      const items = root.items.replaceDefinition(item);
      const edited = items.find(item.id);
      const worn = root.equipment.wornCount(item.id);
      return worn === 0 || (edited !== undefined && wearable(edited))
        ? root.withItems(items)
        : root.withItems(items).withEquipment(root.equipment.unequip(item.id, worn));
    },
    `Правка вещи: ${item.nameRu}`,
    occasion,
  );
}

/**
 * Переименовать вещь: правка одного ярлыка, которую делают там, где имя прочли, — и в карточке, и
 * в книге алхимика. Остальной природы вещи она не называет, потому и потерять её не может.
 */
export function renameItem(
  session: Session,
  itemId: string,
  nameRu: string,
  occasion: Occasion,
): Session {
  const before = Character.of(session.character).items.find(itemId)?.nameRu ?? itemId;
  return applied(
    session,
    (root) => root.withItems(root.items.rename(itemId, nameRu)),
    `Переименовано: ${before} → ${nameRu}`,
    occasion,
  );
}

export function removeItem(session: Session, id: string, occasion: Occasion): Session {
  const { equipment, items } = Character.of(session.character);
  const item = items.find(id);
  if (equipment.bagCount(id) > 0 || equipment.wornCount(id) > 0) {
    throw new DomainError(`«${item?.nameRu ?? id}»: сперва потратьте или снимите весь запас`);
  }
  return applied(
    session,
    (root) =>
      root
        .withItems(root.items.removeDefinition(id))
        .withEquipment(root.equipment.withWanted(id, false)),
    `Убрано: ${item?.nameRu ?? id}`,
    occasion,
  );
}

export function recordItem(
  session: Session,
  nameRu: string,
  wanted: boolean,
  occasion: Occasion,
): Session {
  const id = Items.idFromName(nameRu);
  return applied(
    session,
    (root) =>
      root
        .withItems(root.items.addDefinition({ nameRu, kinds: [] }))
        .withEquipment(root.equipment.withWanted(id, wanted)),
    wanted ? `В покупки: ${nameRu}` : `Записано: ${nameRu}`,
    occasion,
  );
}

export function toggleWanted(session: Session, id: string, occasion: Occasion): Session {
  const { equipment, items } = Character.of(session.character);
  const nameRu = items.find(id)?.nameRu ?? id;
  const wanted = !equipment.wants(id);
  return applied(
    session,
    (root) => root.withEquipment(root.equipment.withWanted(id, wanted)),
    wanted ? `В покупки: ${nameRu}` : `Из покупок: ${nameRu}`,
    occasion,
  );
}

/** Слова записи о покупке: откуда вещь взялась, видно у неё самой, а не только в журнале. */
const BOUGHT_NOTE_RU = "куплено по списку покупок";

export function buyItem(session: Session, id: string, occasion: Occasion): Session {
  const character = Character.of(session.character);
  const item = character.items.find(id);
  return applied(
    session,
    (root) =>
      root
        .withItems(root.items.addNote(id, { id: occasion.nextId(), textRu: BOUGHT_NOTE_RU }))
        .withEquipment(root.equipment.adjustBagCount(id, 1)),
    `Куплено: ${item?.nameRu ?? id} (в сумке ${character.equipment.bagCount(id) + 1})`,
    occasion,
  );
}

export function adjustBagCount(session: Session, id: string, delta: number, occasion: Occasion): Session {
  const item = Character.of(session.character).items.find(id);
  const verb = delta < 0 ? "Потрачено" : "Пополнено";
  return applied(
    session,
    (root) => root.withEquipment(root.equipment.adjustBagCount(id, delta)),
    `${verb}: ${item?.nameRu ?? id} (в сумке ${(Character.of(session.character).equipment.bagCount(id)) + delta})`,
    occasion,
  );
}

export function setBagCount(session: Session, id: string, count: number, occasion: Occasion): Session {
  const item = Character.of(session.character).items.find(id);
  return applied(
    session,
    (root) => root.withEquipment(root.equipment.setBagCount(id, count)),
    `Запас: ${item?.nameRu ?? id} (в сумке ${count})`,
    occasion,
  );
}

export function adjustWornCount(session: Session, id: string, delta: number, occasion: Occasion): Session {
  const character = Character.of(session.character);
  const item = character.items.find(id);
  const verb = delta < 0 ? "Снято" : "Надето";
  return applied(
    session,
    (root) =>
      root.withEquipment(
        delta < 0 ? root.equipment.unequip(id, -delta) : root.equipment.equip(id, delta, root.items),
      ),
    `${verb}: ${item?.nameRu ?? id}`,
    occasion,
  );
}

export function addItemNote(
  session: Session,
  itemId: string,
  textRu: string,
  occasion: Occasion,
): Session {
  const root = Character.of(session.character);
  return withoutRecord(
    session,
    root.withItems(root.items.addNote(itemId, { id: occasion.nextId(), textRu })),
  );
}

export function editItemNote(
  session: Session,
  itemId: string,
  id: string,
  textRu: string,
): Session {
  const root = Character.of(session.character);
  return withoutRecord(session, root.withItems(root.items.rewriteNote(itemId, id, textRu)));
}

export function removeItemNote(session: Session, itemId: string, id: string): Session {
  const root = Character.of(session.character);
  return withoutRecord(session, root.withItems(root.items.dropNote(itemId, id)));
}

export function editMoney(session: Session, money: Money, occasion: Occasion): Session {
  const before = session.character.equipment.money;
  const changes = CURRENCIES.filter((currency) => before[currency] !== money[currency]).map(
    (currency) =>
      `${CURRENCY_ABBREVIATIONS[currency]} ${before[currency]} → ${money[currency]}`,
  );
  return applied(
    session,
    (root) => root.withEquipment(root.equipment.withMoney(money)),
    changes.length === 0 ? "Деньги: без изменений" : `Деньги: ${changes.join(", ")}`,
    occasion,
  );
}
