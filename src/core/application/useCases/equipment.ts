/**
 * Правка снаряжения и вещей.
 *
 * Отдельно от правки листа персонажа, потому что это другой контекст: снятое кольцо не меняет того,
 * кто такой Торн, а меняет то, чем он сейчас располагает. Числа за столом сдвигаются одинаково, и
 * потому обе правки одинаково попадают в журнал и отменяются.
 *
 * Заведение вещи и её подбор — два аграгата разом: вещь появляется у «Вещей», запас — у
 * «Снаряжения». Одна правка листа держит оба сдвига вместе, чтобы отмена возвращала оба разом.
 */

import { Character } from "@/core/domain/assembly/character";
import { DomainError } from "@/core/domain/shared/errors";
import { Items } from "@/core/domain/items/items";
import type { ItemDefinition, ItemKind } from "@/core/domain/items/schema";
import { CURRENCIES, type Money } from "@/core/domain/equipment/schema";
import { CURRENCY_ABBREVIATIONS } from "@/core/shared/language";
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

/**
 * Заводит вещь и сразу кладёт одну в сумку — быстрый ввод со строки сумки не разделяет эти два
 * шага. Одноимённая вещь той же категории уже заведена — заводится не вторая запись, а пополняется
 * её запас: журнал называет получившееся количество, потому что «Добавлено: зелье лечения» дважды
 * подряд не отвечает на вопрос, сколько их теперь.
 */
export function addItem(
  session: Session,
  item: { nameRu: string; kind: ItemKind },
  clock: Clock,
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
    clock,
  );
}

/** Правка вещи: категория, заметка, цена и прибавки. Отдельно от надевания — то другое событие. */
export function editItem(session: Session, item: ItemDefinition, clock: Clock): Session {
  return applied(
    session,
    (root) => root.withItems(root.items.replaceDefinition(item)),
    `Правка вещи: ${item.nameRu}`,
    clock,
  );
}

/** Убирает вещь целиком: только когда от неё не осталось ни следа — ни в сумке, ни на теле. */
export function removeItem(session: Session, id: string, clock: Clock): Session {
  const { equipment, items } = Character.of(session.character);
  const item = items.find(id);
  if (equipment.bagCount(id) > 0 || equipment.wornCount(id) > 0) {
    throw new DomainError(`«${item?.nameRu ?? id}»: сперва потратьте или снимите весь запас`);
  }
  return applied(
    session,
    (root) => root.withItems(root.items.removeDefinition(id)),
    `Убрано: ${item?.nameRu ?? id}`,
    clock,
  );
}

/**
 * Меняет запас вещи в сумке: минус — расход, плюс — пополнение. Журнал называет получившееся число,
 * потому что «Потрачено: зелье» дважды подряд не отвечает, сколько осталось.
 */
export function adjustBagCount(session: Session, id: string, delta: number, clock: Clock): Session {
  const item = Character.of(session.character).items.find(id);
  const verb = delta < 0 ? "Потрачено" : "Пополнено";
  return applied(
    session,
    (root) => root.withEquipment(root.equipment.adjustBagCount(id, delta)),
    `${verb}: ${item?.nameRu ?? id} (в сумке ${(Character.of(session.character).equipment.bagCount(id)) + delta})`,
    clock,
  );
}

/**
 * Надеть или снять: число — сколько экземпляров переходит между сумкой и надетым. Отрицательное
 * число снимает, положительное надевает — строка сумки просит один и тот же жест кнопкой.
 */
export function adjustWornCount(session: Session, id: string, delta: number, clock: Clock): Session {
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
