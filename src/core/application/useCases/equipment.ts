/**
 * Правка снаряжения и инвентаря.
 *
 * Отдельно от правки листа персонажа, потому что это другой контекст: снятое кольцо не меняет того,
 * кто такой Торн, а меняет то, чем он сейчас располагает. Числа за столом сдвигаются одинаково, и
 * потому обе правки одинаково попадают в журнал и отменяются.
 */

import { Character } from "@/core/domain/character/character";
import type { InventoryItem, ItemBonuses } from "@/core/domain/character/state";
import { commit, type Clock, type Session } from "@/core/application/session";

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

export function editOtherBonuses(
  session: Session,
  otherBonuses: ItemBonuses,
  clock: Clock,
): Session {
  return applied(
    session,
    (root) => root.withEquipment(root.equipment.withOtherBonuses(otherBonuses)),
    "Правка прибавок без вещи",
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

/** Правка вещи: заметка, количество, вид и прибавки. Отдельно от надевания — то другое событие. */
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

/** Расход одного экземпляра: зелье выпито, ингредиент ушёл в дело. Последний убирает вещь целиком. */
export function spendItem(session: Session, id: string, clock: Clock): Session {
  const item = session.character.equipment.items.find((existing) => existing.id === id);
  return applied(
    session,
    (root) => root.withEquipment(root.equipment.spendItem(id)),
    `Потрачено: ${item?.nameRu ?? id}`,
    clock,
  );
}
