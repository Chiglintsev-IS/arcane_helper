/**
 * Проверка доступности заклинания (FR-030).
 *
 * Возвращает не «да/нет», а список предупреждений с причинами: приложение не запрещает применение,
 * потому что мастер вправе разрешить исключение (FR-031). Единственное неотменяемое предупреждение —
 * замена концентрации: там нужен осознанный выбор одного из двух (FR-081).
 *
 * Чистая функция: ни React, ни хранилища, ни состояния хода во флагах. Доступность действия и
 * реакции приходит параметром, потому что выводится из журнала (ADR-0008), а не хранится.
 *
 * Чего эта функция пока не проверяет: наличие материального компонента и фокусировки. В модели
 * персонажа таких данных нет — [OQ-06](../../docs/open-questions.md#oq-06). Вместо ложного вердикта
 * компоненты перечисляются напоминанием: «нужна жемчужина за 100 зм, фокусировка её не заменяет».
 */

import type { CharacterState } from "@/data/schemas/character";
import type { Spell } from "@/data/schemas/spell";
import { RulesError } from "./abilities";
import { spellPointCost, hitPointCost } from "./bloodMagic";
import { longCastingTimeRu, type LongCastingUnit } from "./language";
import { CANTRIP_LEVEL, consumesSlot, type CastMode } from "./slots";

/** Что заклинание тратит внутри хода. Минуты и часы вне боевой экономии действий. */
export type TurnResource = "action" | "bonus_action" | "reaction";

/** Доступность ресурсов хода. Структурно совпадает с `TurnEconomy` — её можно передавать как есть. */
export type TurnResources = {
  actionAvailable: boolean;
  bonusActionAvailable: boolean;
  reactionAvailable: boolean;
};

/** Всё доступно: начало хода и выключенный учёт хода (FR-143) выглядят одинаково. */
export const ALL_TURN_RESOURCES: TurnResources = {
  actionAvailable: true,
  bonusActionAvailable: true,
  reactionAvailable: true,
};

/** Фразы целиком: род в русском не выводится из названия, «Реакция израсходовано» недопустимо. */
export const ACTION_SPENT_MESSAGES: Record<TurnResource, string> = {
  action: "Действие уже израсходовано",
  bonus_action: "Бонусное действие уже израсходовано",
  reaction: "Реакция уже израсходована",
};

/** Способ оплаты сотворения: ячейка, очки заклинаний (F-15) или ничего — заговор и ритуал. */
export type PaymentChoice =
  | { kind: "slot"; slotLevel: number }
  | { kind: "spell_points" }
  | { kind: "none" };

export type AvailabilityCode =
  | "not_in_spellbook"
  | "not_prepared"
  | "not_ritual"
  | "action_spent"
  | "bonus_action_spent"
  | "reaction_spent"
  | "long_casting_time"
  | "no_payment"
  | "no_slot"
  | "slot_too_low"
  | "not_enough_spell_points"
  | "concentration_busy";

export type AvailabilityWarning = {
  code: AvailabilityCode;
  /** Причина словами: серый элемент без объяснения оставляет игрока в тупике (ux.md). */
  reasonRu: string;
  /** Можно ли пройти это предупреждение кнопкой «Применить всё равно» (FR-031). */
  overridable: boolean;
};

export type Availability = {
  /** Предупреждений нет вовсе. */
  available: boolean;
  /** Можно ли применить вопреки предупреждениям (FR-031). */
  overridable: boolean;
  warnings: AvailabilityWarning[];
  /** Компоненты, наличие которых приложению неизвестно (OQ-06). */
  componentReminders: string[];
};

export type AvailabilityInput = {
  spell: Spell;
  character: CharacterState;
  turn: TurnResources;
  mode: CastMode;
  payment: PaymentChoice;
};

/** Что заклинание тратит внутри хода; `undefined` — накладывание в минутах или часах. */
export function turnResourceFor(castingTime: Spell["castingTime"]["type"]): TurnResource | undefined {
  switch (castingTime) {
    case "reaction":
      return "reaction";
    case "bonus_action":
      return "bonus_action";
    case "action":
      return "action";
    default:
      return undefined;
  }
}

/** Минуты и часы: ресурс хода не тратят, но и в ход не укладываются (FR-033). */
const LONG_CASTING_UNITS: Partial<Record<Spell["castingTime"]["type"], LongCastingUnit>> = {
  minute: "minute",
  hour: "hour",
};

/**
 * Предупреждение о накладывании дольше хода (FR-033).
 *
 * Называет не только время, но и цену по правилам: действие каждый ход и концентрация всё время
 * накладывания ([rules-engine.md](../../docs/rules-engine.md#накладывание-дольше-одного-хода)).
 *
 * Молчит при выключенном учёте хода ([FR-143](../../docs/features/F-06-resources.md#fr-143)): вне боя
 * ход не считается, и минута ничего не стоит. Иначе каждый ритуал получал бы предупреждение всегда, а
 * предупреждение, которое нельзя не увидеть, перестаёт что-либо значить.
 */
function checkCastingTime(input: AvailabilityInput): AvailabilityWarning[] {
  const { castingTime } = input.spell;
  const unit = LONG_CASTING_UNITS[castingTime.type];
  if (unit === undefined || castingTime.value === undefined) return [];
  // Ходов вне боя нет, значит и тратить в них нечего (FR-143).
  if (input.character.screenMode !== "combat") return [];
  return [
    {
      code: "long_casting_time",
      // Тире, а не двоеточие: строка списка печатает причину после «Недоступно:» (F-02).
      reasonRu:
        `Не уложится в один ход — ${longCastingTimeRu(unit, castingTime.value)},` +
        " действие каждый ход и концентрация",
      overridable: true,
    },
  ];
}

const SPENT_CODES: Record<TurnResource, AvailabilityCode> = {
  action: "action_spent",
  bonus_action: "bonus_action_spent",
  reaction: "reaction_spent",
};

function isAvailable(turn: TurnResources, resource: TurnResource): boolean {
  if (resource === "reaction") return turn.reactionAvailable;
  if (resource === "bonus_action") return turn.bonusActionAvailable;
  return turn.actionAvailable;
}

/** Известно ли заклинание персонажу: заговор — среди заговоров, остальное — в книге. */
function isKnown(spell: Spell, character: CharacterState): boolean {
  return spell.level === CANTRIP_LEVEL
    ? character.cantripIds.includes(spell.id)
    : character.spellbookSpellIds.includes(spell.id);
}

function checkPreparation(input: AvailabilityInput): AvailabilityWarning[] {
  const { spell, character, mode } = input;

  if (!isKnown(spell, character)) {
    return [
      { code: "not_in_spellbook", reasonRu: "Заклинания нет в книге заклинаний", overridable: true },
    ];
  }

  const warnings: AvailabilityWarning[] = [];

  if (mode === "ritual" && !spell.ritual) {
    warnings.push({
      code: "not_ritual",
      reasonRu: `«${spell.nameRu}» нельзя сотворить ритуалом`,
      overridable: true,
    });
  }

  // Заговор подготовки не требует (FR-102), ритуал доступен прямо из книги (FR-103).
  const needsPreparation = spell.level !== CANTRIP_LEVEL && mode !== "ritual";
  if (needsPreparation && !character.preparedSpellIds.includes(spell.id)) {
    warnings.push({ code: "not_prepared", reasonRu: "Заклинание не подготовлено", overridable: true });
  }

  return warnings;
}

function checkPayment(input: AvailabilityInput): AvailabilityWarning[] {
  const { spell, character, mode, payment } = input;

  if (!consumesSlot(spell.level, mode)) {
    // Ошибка вызывающего, а не игровая ситуация: предупреждать пользователя тут не о чем.
    if (payment.kind !== "none") {
      throw new RulesError(
        spell.level === CANTRIP_LEVEL
          ? "Заговор не расходует ячейку"
          : "Ритуальное применение не расходует ячейку",
      );
    }
    return [];
  }

  if (payment.kind === "none") {
    return [
      {
        code: "no_payment",
        reasonRu: "Не выбран способ оплаты: ячейка или очки заклинаний",
        overridable: true,
      },
    ];
  }

  if (payment.kind === "spell_points") {
    const points = spellPointCost(spell.level);
    if (character.spellPoints.remaining >= points) return [];
    return [
      {
        code: "not_enough_spell_points",
        reasonRu:
          `Очков заклинаний ${character.spellPoints.remaining}, нужно ${points}` +
          ` — это ${hitPointCost(spell.level, character.level)} хитов кровью`,
        overridable: true,
      },
    ];
  }

  const { slotLevel } = payment;
  if (slotLevel < spell.level) {
    return [
      {
        code: "slot_too_low",
        reasonRu: `Ячейка ${slotLevel} уровня ниже уровня заклинания — нужен ${spell.level}`,
        overridable: true,
      },
    ];
  }

  const slot = character.spellSlots[slotLevel];
  if (slot === undefined) {
    return [
      { code: "no_slot", reasonRu: `Ячеек ${slotLevel} уровня у персонажа нет`, overridable: true },
    ];
  }
  if (slot.remaining <= 0) {
    return [
      { code: "no_slot", reasonRu: `Нет свободной ячейки ${slotLevel} уровня`, overridable: true },
    ];
  }
  return [];
}

/**
 * Замена концентрации (FR-081). Единственное предупреждение, которое нельзя пройти «всё равно»:
 * цена ошибки — молча потерянный эффект, поэтому нужен выбор между двумя вариантами.
 */
function checkConcentration(input: AvailabilityInput): AvailabilityWarning[] {
  const { spell, character } = input;
  const current = character.concentration;
  if (!spell.concentration || current === undefined) return [];

  const effect = character.activeEffects.find(
    (candidate) => candidate.isConcentration && candidate.spellId === current.spellId,
  );
  const nameRu = effect === undefined ? current.spellId : effect.nameRu;
  return [
    {
      code: "concentration_busy",
      reasonRu: `Уже идёт концентрация: «${nameRu}» завершится`,
      overridable: false,
    },
  ];
}

/**
 * Что нужно сделать, чтобы сотворить заклинание — словами, а не аббревиатурами.
 *
 * «В, С, М» за столом не читается: игрок должен видеть действие, а не букву. Формулировка одна на
 * весь проект, потому что она нужна и в проверке доступности, и в карточке, и в мастере применения.
 *
 * Наличия компонентов приложение не знает и не притворяется, что знает (OQ-06): это перечень
 * требований, а не вердикт.
 */
export function componentRequirements(components: Spell["components"]): string[] {
  const requirements: string[] = [];

  if (components.verbal) requirements.push("Произнести вслух");
  if (components.somatic) requirements.push("Жест свободной рукой");

  if (components.material && components.materialText !== undefined) {
    const notes: string[] = [];
    // Фокусировка заменяет компоненты без стоимости; со стоимостью — нет, и это предупреждение
    // обязательно, даже если фокусировка есть (F-03, «Материальный компонент со стоимостью»).
    if (components.costGp !== undefined) {
      notes.push(`${components.costGp} зм, фокусировка не заменяет`);
    }
    if (components.consumed === true) notes.push("расходуется");
    const suffix = notes.length === 0 ? "" : ` — ${notes.join(", ")}`;
    requirements.push(`Компонент: ${components.materialText}${suffix}`);
  }

  return requirements;
}

/** Все условия FR-030 за один проход. Порядок предупреждений — от подготовки к оплате. */
export function checkAvailability(input: AvailabilityInput): Availability {
  const resource = turnResourceFor(input.spell.castingTime.type);

  const warnings: AvailabilityWarning[] = [
    ...checkPreparation(input),
    ...(resource !== undefined && !isAvailable(input.turn, resource)
      ? [
          {
            code: SPENT_CODES[resource],
            reasonRu: ACTION_SPENT_MESSAGES[resource],
            overridable: true,
          },
        ]
      : []),
    ...checkCastingTime(input),
    ...checkPayment(input),
    ...checkConcentration(input),
  ];

  return {
    available: warnings.length === 0,
    overridable: warnings.every((warning) => warning.overridable),
    warnings,
    componentReminders: componentRequirements(input.spell.components),
  };
}

/** Причины одного вида — для интерфейса и тестов: искать по коду удобнее, чем по тексту. */
export function reasonsOf(availability: Availability, code: AvailabilityCode): string[] {
  return availability.warnings
    .filter((warning) => warning.code === code)
    .map((warning) => warning.reasonRu);
}
