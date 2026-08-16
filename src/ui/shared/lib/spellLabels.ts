/**
 * Подписи полей заклинания, нужные больше одному слайсу интерфейса.
 *
 * Лежат ниже слайсов сущностей, потому что слайсы одного слоя друг о друге не знают: пока строка
 * списка и блок концентрации держали свои копии, они разошлись и в слове, и в знаке минуса.
 *
 * Игровых формул здесь нет: числа приходят из состояния персонажа и движка правил, а модуль
 * выбирает слово и падеж.
 */

import type { CastingView, SpellRowView } from "@/contract/views";
import {
  AREA_SHAPES_RU,
  CHECK_DIE_RU,
  NO_ROLL_RU,
  plural,
  SAVING_THROW_NAMES,
  signed,
} from "@/shared/language";

/** Заголовок списка: строка обмена стоит среди заклинаний, но заклинанием не является. */
export function spellListLabel(withActions: boolean): string {
  return withActions ? "Заклинания и действия" : "Заклинания";
}

/**
 * Способ разрешения одной схемой: что бросают и против чего.
 *
 * Текст отвечает на вопрос числом, которое произносят вслух, — «d20+8», «КС 16». Иконка отвечает,
 * кто бросает: заклинатель, цель или никто. Цвета подпись не несёт: восемь смысловых цветов заняты
 * экономией хода, ролью в бою, концентрацией и ритуалом, и синий на числе атаки означал бы, что
 * заклинание тратит действие дважды.
 *
 * Отсюда же видно, произносят ли подпись вслух: бросок называют мастеру, отсутствие броска — нет.
 * Решает это владелец подписи, потому что только он знает, у каких способов внутри есть число.
 */
export function resolutionBadge(
  resolution: SpellRowView["resolution"],
  casting: CastingView,
): { label: string; icon: string; spoken: boolean } {
  switch (resolution.type) {
    case "spell_attack":
      return {
        label: `Атака ${CHECK_DIE_RU}${signed(casting.spellAttackModifier)}`,
        icon: "✶",
        spoken: true,
      };
    case "saving_throw":
      return {
        label: `${savingThrowName(resolution.savingThrow)} КС ${casting.spellSaveDc}`,
        icon: "◇",
        spoken: true,
      };
    default:
      return { label: NO_ROLL_RU, icon: "○", spoken: false };
  }
}

/**
 * Слова правил приезжают строками, поэтому имя ищется, а не берётся ключом. Списком слов владеет
 * ядро, здесь — только их падеж.
 */
const SAVING_THROWS: Readonly<Record<string, string>> = SAVING_THROW_NAMES;
const AREA_SHAPES: Readonly<Record<string, string>> = AREA_SHAPES_RU;

/** Спасбросок с характеристикой или без неё: не назвать её честнее, чем выдумать. */
function savingThrowName(ability: string | undefined): string {
  const named = ability === undefined ? undefined : SAVING_THROWS[ability];
  return named === undefined ? "Спасбросок" : `Спасбросок ${named}`;
}

function shapeName(shape: string): string {
  return AREA_SHAPES[shape] ?? shape;
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
export function rangeLabel(range: SpellRowView["range"]): string {
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
export function rangePhrase(range: SpellRowView["range"]): string {
  return range.type === "special" ? "Особая дальность" : rangeLabel(range);
}

/** Область под ярлыком: запятая отделяет фигуру от размера. */
export function areaLabel(area: NonNullable<SpellRowView["area"]>): string {
  return `${shapeName(area.shape)}, ${feet(area.sizeFeet)}`;
}

/** Область в ряду фактов: «от себя» отвечает на вопрос, откуда её отмерять. */
export function areaPhrase(area: NonNullable<SpellRowView["area"]>, fromSelf: boolean): string {
  const shape = `${shapeName(area.shape)} ${feet(area.sizeFeet)}`;
  return fromSelf ? `${shape} от себя` : shape;
}
