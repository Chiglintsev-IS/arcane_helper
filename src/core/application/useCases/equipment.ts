import { Character } from "@/core/domain/assembly/character";
import { DomainError } from "@/core/domain/shared/errors";
import { Items } from "@/core/domain/items/items";
import type { ItemDefinition, ItemKind } from "@/core/domain/items/schema";
import type { Money } from "@/core/domain/equipment/schema";
import { CURRENCIES } from "@/core/domain/shared/schema";
import { CURRENCY_ABBREVIATIONS } from "@/shared/language";
import { commit, type Occasion, type Session } from "@/core/application/session";

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
  item: { nameRu: string; kind: ItemKind; price?: ItemDefinition["price"] },
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

export function editItem(session: Session, item: ItemDefinition, occasion: Occasion): Session {
  return applied(
    session,
    (root) => root.withItems(root.items.replaceDefinition(item)),
    `Правка вещи: ${item.nameRu}`,
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
    (root) => root.withItems(root.items.removeDefinition(id)),
    `Убрано: ${item?.nameRu ?? id}`,
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
