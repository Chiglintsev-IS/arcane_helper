/**
 * Подписи полей заклинания, нужные больше одному слайсу интерфейса.
 *
 * Лежат ниже слайсов сущностей, потому что слайсы одного слоя друг о друге не знают: пока строка
 * списка и блок концентрации держали свои копии, они разошлись и в слове, и в знаке минуса.
 *
 * Игровых формул здесь нет: числа приходят из состояния персонажа и движка правил, а модуль
 * выбирает слово и падеж.
 */

import type { Sheet } from "@/core/domain/sheet/sheet";
import type { Spell } from "@/core/domain/catalog/spell";
import { AREA_SHAPES_RU, NO_ROLL_RU, plural, SAVING_THROW_NAMES, signed } from "@/core/shared/language";

/** Числа персонажа, из которых собирается подпись разрешения. Считает их лист. */
export type ResolutionNumbers = Pick<Sheet, "spellSaveDc" | "spellAttackModifier">;

/**
 * Способ разрешения одной схемой: что бросают и против чего.
 *
 * Текст отвечает на вопрос числом, которое произносят вслух, — «d20+8», «КС 16». Иконка отвечает,
 * кто бросает: заклинатель, цель или никто. Цвета подпись не несёт: восемь смысловых цветов заняты
 * экономией хода, ролью в бою, концентрацией и ритуалом, и синий на числе атаки означал бы, что
 * заклинание тратит действие дважды.
 */
export function resolutionBadge(
  resolution: Spell["resolution"],
  numbers: ResolutionNumbers,
): { label: string; icon: string } {
  switch (resolution.type) {
    case "spell_attack":
      return { label: `Атака d20${signed(numbers.spellAttackModifier)}`, icon: "✶" };
    case "saving_throw": {
      // Схема требует характеристику при спасброске; без неё состояние испорчено, и назвать один
      // порог честнее, чем выдумать характеристику.
      const ability = resolution.savingThrow;
      const name = ability === undefined ? "Спасбросок" : `Спасбросок ${SAVING_THROW_NAMES[ability]}`;
      return { label: `${name} КС ${numbers.spellSaveDc}`, icon: "◇" };
    }
    default:
      return { label: NO_ROLL_RU, icon: "○" };
  }
}

function feet(value: number): string {
  return `${value} ${plural(value, ["фут", "фута", "футов"])}`;
}

/**
 * Дальность там, где рядом стоит ярлык.
 *
 * Парная к `rangePhrase`: подпись под ярлыком «Дальность» отвечать за себя не обязана, а подпись в
 * ряду фактов через точку — обязана. То же правило действует у времени накладывания и длительности.
 */
export function rangeLabel(range: Spell["range"]): string {
  switch (range.type) {
    case "self":
      return "На себя";
    case "touch":
      return "Касание";
    case "distance":
      return feet(range.distanceFeet ?? 0);
    default:
      return "Особая";
  }
}

/** Дальность там, где ярлыка рядом нет: «Особая» одна не говорит, что именно особое. */
export function rangePhrase(range: Spell["range"]): string {
  return range.type === "special" ? "Особая дальность" : rangeLabel(range);
}

/** Область под ярлыком: запятая отделяет фигуру от размера. */
export function areaLabel(area: NonNullable<Spell["area"]>): string {
  return `${AREA_SHAPES_RU[area.shape]}, ${feet(area.sizeFeet)}`;
}

/** Область в ряду фактов: «от себя» отвечает на вопрос, откуда её отмерять. */
export function areaPhrase(area: NonNullable<Spell["area"]>, fromSelf: boolean): string {
  const shape = `${AREA_SHAPES_RU[area.shape]} ${feet(area.sizeFeet)}`;
  return fromSelf ? `${shape} от себя` : shape;
}
