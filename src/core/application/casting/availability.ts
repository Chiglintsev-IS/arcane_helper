/**
 * Проверка доступности заклинания.
 *
 * Возвращает не «да/нет», а список предупреждений с причинами: приложение не запрещает применение,
 * потому что мастер вправе разрешить исключение. Единственное неотменяемое предупреждение —
 * замена концентрации: там нужен осознанный выбор одного из двух.
 *
 * Чистая функция: ни React, ни хранилища, ни состояния хода во флагах. Доступность действия и
 * реакции приходит параметром, потому что выводится из журнала, а не хранится.
 *
 * Чего эта функция пока не проверяет: наличие материального компонента и фокусировки. В модели
 * персонажа таких данных нет. Вместо ложного вердикта
 * компоненты перечисляются напоминанием: «нужна жемчужина за 100 зм, фокусировка её не заменяет».
 */

import { Character } from "@/core/domain/character/character";
import { DomainError } from "@/core/domain/shared/errors";
import type { CharacterState } from "@/core/domain/character/state";
import type { Spell } from "@/core/domain/catalog/spell";
import { spellPointCost, hitPointCost } from "@/core/domain/vitality/blood";
import { longCastingTimeRu, type LongCastingUnit } from "@/core/shared/language";
import { CANTRIP_LEVEL, consumesSlot, type CastMode } from "@/core/domain/arcana/slots";

/** Что заклинание тратит внутри хода. Минуты и часы вне боевой экономии действий. */
export type TurnResource = "action" | "bonus_action" | "reaction";

/** Доступность ресурсов хода. Структурно совпадает с `TurnEconomy` — её можно передавать как есть. */
export type TurnResources = {
  actionAvailable: boolean;
  bonusActionAvailable: boolean;
  reactionAvailable: boolean;
  /** Отмечен ли бой начатым. Выводится из журнала, а не хранится, поэтому приходит параметром. */
  inFight: boolean;
  /**
   * Ведётся ли счёт ходов.
   *
   * Признак приходит параметром, а не читается из состояния: правило не вправе зависеть от того,
   * какую вкладку открыл игрок. Кто и по чему решает, что ходы идут, — дело вызывающего.
   */
  tracksTurn: boolean;
};

/**
 * Всё доступно: начало хода и выключенный учёт хода выглядят одинаково.
 *
 * `inFight: false` здесь безопасно: проверка начала боя сначала смотрит на режим и вне «Боя» молчит
 * вовсе — так же устроен `checkCastingTime`.
 */
export const ALL_TURN_RESOURCES: TurnResources = {
  actionAvailable: true,
  bonusActionAvailable: true,
  reactionAvailable: true,
  inFight: false,
  tracksTurn: false,
};

/** Фразы целиком: род в русском не выводится из названия, «Реакция израсходовано» недопустимо. */
export const ACTION_SPENT_MESSAGES: Record<TurnResource, string> = {
  action: "Действие уже израсходовано",
  bonus_action: "Бонусное действие уже израсходовано",
  reaction: "Реакция уже израсходована",
};

/** Одна формулировка на оба мастера: у заклинания и у обмена причина буквально одна. */
export const COMBAT_NOT_STARTED_MESSAGE = "Бой не начат — сначала «Начать бой»";

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
  | "combat_not_started"
  | "no_payment"
  | "no_slot"
  | "slot_too_low"
  | "not_enough_spell_points"
  | "concentration_busy"
  | "no_component";

export type AvailabilityWarning = {
  code: AvailabilityCode;
  /** Причина словами: серый элемент без объяснения оставляет игрока в тупике (ux.md). */
  reasonRu: string;
  /** Можно ли пройти это предупреждение кнопкой «Применить всё равно». */
  overridable: boolean;
};

export type Availability = {
  /** Предупреждений нет вовсе. */
  available: boolean;
  /** Можно ли применить вопреки предупреждениям. */
  overridable: boolean;
  warnings: AvailabilityWarning[];
  /** Компоненты, наличие которых приложению неизвестно. */
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

/** Минуты и часы: ресурс хода не тратят, но и в ход не укладываются. */
const LONG_CASTING_UNITS: Partial<Record<Spell["castingTime"]["type"], LongCastingUnit>> = {
  minute: "minute",
  hour: "hour",
};

/**
 * Предупреждение о накладывании дольше хода.
 *
 * Называет не только время, но и цену по правилам: действие каждый ход и концентрация всё время
 * накладывания (rules-engine.md).
 *
 * Молчит при выключенном учёте хода: вне боя
 * ход не считается, и минута ничего не стоит. Иначе каждый ритуал получал бы предупреждение всегда, а
 * предупреждение, которое нельзя не увидеть, перестаёт что-либо значить.
 */
function checkCastingTime(input: AvailabilityInput): AvailabilityWarning[] {
  const { castingTime } = input.spell;
  const unit = LONG_CASTING_UNITS[castingTime.type];
  if (unit === undefined || castingTime.value === undefined) return [];
  // Ходов вне схватки нет, значит и тратить в них нечего.
  if (!input.turn.tracksTurn) return [];
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

/**
 * Применение до начала боя.
 *
 * Пока бой не отмечен начатым, счёт раундов и экономия действий ни на чём не основаны: приложение
 * показывает «раунд 1» и три целых ресурса, потому что журналу не от чего считать, а не потому, что
 * так обстоят дела. Заклинание при этом творится, ячейка списывается, и игрок узнаёт о расхождении
 * позже — когда числа перестанут сходиться с тем, что называет мастер.
 *
 * Причина, а не запрет: бой мог начаться до того, как игрок взял телефон, и тупик здесь
 * дороже лишнего нажатия.
 *
 * Молчит вне режима «Бой»: там ходов не идёт, начинать нечего, и предупреждение стояло бы
 * на каждой строке «Книги».
 */
function checkCombatStarted(input: AvailabilityInput): AvailabilityWarning[] {
  if (!input.turn.tracksTurn || input.turn.inFight) return [];
  return [
    {
      code: "combat_not_started",
      reasonRu: COMBAT_NOT_STARTED_MESSAGE,
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

function checkPreparation(input: AvailabilityInput): AvailabilityWarning[] {
  const { spell, character, mode } = input;
  const spellbook = Character.of(character).spellbook;

  if (!spellbook.knows(spell.id, spell.level)) {
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

  // Заговор подготовки не требует, ритуал доступен прямо из книги.
  const needsPreparation = spell.level !== CANTRIP_LEVEL && mode !== "ritual";
  if (needsPreparation && !spellbook.isPrepared(spell.id)) {
    warnings.push({ code: "not_prepared", reasonRu: "Заклинание не подготовлено", overridable: true });
  }

  return warnings;
}

function checkPayment(input: AvailabilityInput): AvailabilityWarning[] {
  const { spell, character, mode, payment } = input;

  if (!consumesSlot(spell.level, mode)) {
    // Ошибка вызывающего, а не игровая ситуация: предупреждать пользователя тут не о чем.
    if (payment.kind !== "none") {
      throw new DomainError(
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
 * Замена концентрации. Единственное предупреждение, которое нельзя пройти «всё равно»:
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
 * Наличие материального компонента.
 *
 * Компонент без стоимости заменяет фокусировка или мешочек — их наличие приложение теперь знает
 * ( закрыт ответом игрока). Компонент со стоимостью или
 * расходуемый фокусировка не заменяет: он должен лежать в сумке штучно.
 *
 * Без записи о снаряжении вердикта нет вовсе: состояние могло прийти импортом из сборки, которая
 * про снаряжение не знала, и «компонента нет» было бы выдумкой про чужого персонажа.
 */
function checkComponents(input: AvailabilityInput): AvailabilityWarning[] {
  const { spell, character } = input;
  const equipment = Character.of(character).equipment;
  const { components } = spell;
  if (!equipment.known || !components.material) return [];

  const costly = components.costGp !== undefined || components.consumed === true;
  if (costly) {
    if (equipment.hasMaterialFor(spell.id)) return [];
    const cost = components.costGp === undefined ? "" : ` (${components.costGp} зм)`;
    return [
      {
        code: "no_component",
        reasonRu: `Нет компонента${cost}: ${components.materialText ?? "материальный компонент"}`,
        overridable: true,
      },
    ];
  }

  if (equipment.replacesFreeComponents) return [];
  return [
    {
      code: "no_component",
      reasonRu: "Нет ни фокусировки, ни мешочка с компонентами",
      overridable: true,
    },
  ];
}

/**
 * Что нужно сделать, чтобы сотворить заклинание — словами, а не аббревиатурами.
 *
 * «В, С, М» за столом не читается: игрок должен видеть действие, а не букву. Формулировка одна на
 * весь проект, потому что она нужна и в проверке доступности, и в карточке, и в мастере применения.
 *
 * Это перечень требований, а не вердикт: вердикт о наличии даёт `checkComponents` по записи о
 * снаряжении, а перечень нужен и там, где снаряжение неизвестно.
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

/** Все условия за один проход. Порядок предупреждений — от подготовки к оплате. */
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
    ...checkCombatStarted(input),
    ...checkPayment(input),
    ...checkComponents(input),
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
