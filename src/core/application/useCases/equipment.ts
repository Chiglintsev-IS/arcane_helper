/**
 * Правка снаряжения и инвентаря.
 *
 * Отдельно от правки листа персонажа, потому что это другой контекст: снятое кольцо не меняет того,
 * кто такой Торн, а меняет то, чем он сейчас располагает. Числа за столом сдвигаются одинаково, и
 * потому обе правки одинаково попадают в журнал и отменяются.
 */

import { Character } from "@/core/domain/character/character";
import { CURRENCIES, type InventoryItem, type Money } from "@/core/domain/character/state";
import { commit, type Clock, type Session } from "@/core/application/session";

/** Сокращения монет для журнала: полные имена — дело экрана, запись должна оставаться строкой. */
const CURRENCY_ABBREVIATIONS: Record<(typeof CURRENCIES)[number], string> = {
  gold: "зм",
  silver: "см",
  copper: "мм",
};

function applied(
  session: Session,
  change: (character: Character) => Character,
  summaryRu: string,
  clock: Clock,
): Session {
  return commit(session, change(Character.of(session.character)), {
    kind: "sheet_edited",
    summaryRu,
  }, clock);
}

export function editArmorClassBase(session: Session, base: number, clock: Clock): Session {
  return applied(
    session,
    (root) => root.withEquipment(root.equipment.withArmorClassBase(base)),
    `База Класса Доспеха: ${base}`,
    clock,
  );
}

/**
 * Заводит вещь. Одноимённая пополняет запас: журнал называет получившееся количество, потому что
 * «Добавлено: зелье лечения» дважды подряд не отвечает на вопрос, сколько их теперь.
 */
export function addItem(session: Session, item: InventoryItem, clock: Clock): Session {
  const found = session.character.equipment.items.find((existing) => existing.id === item.id);
  return applied(
    session,
    (root) => root.withEquipment(root.equipment.addItem(item)),
    found === undefined
      ? `Добавлено: ${item.nameRu}`
      : `Добавлено: ${item.nameRu} (стало ${found.count + item.count})`,
    clock,
  );
}

/** Правка вещи: категория, заметка, цена и прибавки. Отдельно от надевания — то другое событие. */
export function editItem(session: Session, item: InventoryItem, clock: Clock): Session {
  return applied(
    session,
    (root) => root.withEquipment(root.equipment.replaceItem(item)),
    `Правка вещи: ${item.nameRu}`,
    clock,
  );
}

export function removeItem(session: Session, id: string, clock: Clock): Session {
  const removed = session.character.equipment.items.find((item) => item.id === id);
  return applied(
    session,
    (root) => root.withEquipment(root.equipment.removeItem(id)),
    `Убрано: ${removed?.nameRu ?? id}`,
    clock,
  );
}

/** Надеть или снять: числа считаются из надетого, лежащее в сумке к ним не прибавляется. */
export function toggleWorn(session: Session, id: string, clock: Clock): Session {
  const item = session.character.equipment.items.find((existing) => existing.id === id);
  return applied(
    session,
    (root) => root.withEquipment(root.equipment.toggleWorn(id)),
    `${item?.worn === true ? "Снято" : "Надето"}: ${item?.nameRu ?? id}`,
    clock,
  );
}

/**
 * Меняет запас вещи: минус — расход, плюс — пополнение. Журнал называет получившееся число,
 * потому что «Потрачено: зелье» дважды подряд не отвечает, сколько осталось.
 */
export function adjustItemCount(session: Session, id: string, delta: number, clock: Clock): Session {
  const item = session.character.equipment.items.find((existing) => existing.id === id);
  const verb = delta < 0 ? "Потрачено" : "Пополнено";
  return applied(
    session,
    (root) => root.withEquipment(root.equipment.adjustCount(id, delta)),
    `${verb}: ${item?.nameRu ?? id} (осталось ${(item?.count ?? 0) + delta})`,
    clock,
  );
}

/** Правка кошелька. Журнал называет только сдвинувшиеся монеты: «зм 15 → 215». */
export function editMoney(session: Session, money: Money, clock: Clock): Session {
  const before = session.character.equipment.money;
  const changes = CURRENCIES.filter((currency) => before[currency] !== money[currency]).map(
    (currency) =>
      `${CURRENCY_ABBREVIATIONS[currency]} ${before[currency]} → ${money[currency]}`,
  );
  return applied(
    session,
    (root) => root.withEquipment(root.equipment.withMoney(money)),
    changes.length === 0 ? "Деньги: без изменений" : `Деньги: ${changes.join(", ")}`,
    clock,
  );
}
