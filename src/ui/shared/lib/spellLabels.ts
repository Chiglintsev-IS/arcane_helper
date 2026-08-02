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
import { NO_ROLL_RU, SAVING_THROW_NAMES, signed } from "@/core/shared/language";

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
    case "saving_throw":
      return {
        label: `Спасбросок ${SAVING_THROW_NAMES[resolution.savingThrow ?? "CON"]} КС ${numbers.spellSaveDc}`,
        icon: "◇",
      };
    default:
      return { label: NO_ROLL_RU, icon: "○" };
  }
}
