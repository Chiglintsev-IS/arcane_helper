import { Character } from "@/core/domain/assembly/character";
import { DomainError } from "@/core/domain/shared/errors";
import type { CharacterState } from "@/core/domain/assembly/state";
import type { Spell } from "@/core/domain/catalog/spell";
import { ascensionTierRate, spellPointCost, hitPointCost } from "@/core/domain/arcana/slots";
import { suppressionReason } from "@/core/domain/vitality/blood";
import {
  CURRENCY_ABBREVIATIONS,
  longCastingTimeRu,
  withPlural,
  type LongCastingUnit,
} from "@/shared/language";
import { consumesSlot, type CastMode } from "@/core/domain/arcana/slots";
import { CANTRIP_LEVEL } from "@/core/domain/catalog/spell";
import { materialCoveredByFocus, materialOf } from "@/core/application/casting/material";

/** Что заклинание тратит внутри хода. Минуты и часы вне боевой экономии действий. */
export type TurnResource = "action" | "bonus_action" | "reaction";

/** Признаки хода приходят параметром: правило не вправе зависеть от того, что открыл игрок. */
export type TurnResources = {
  actionAvailable: boolean;
  bonusActionAvailable: boolean;
  reactionAvailable: boolean;
  /** Отмечен ли бой начатым. Он же признак того, что ведётся счёт ходов. */
  inFight: boolean;
};

export const ALL_TURN_RESOURCES: TurnResources = {
  actionAvailable: true,
  bonusActionAvailable: true,
  reactionAvailable: true,
  inFight: false,
};

/** Фразы целиком: род в русском не выводится из названия, «Реакция израсходовано» недопустимо. */
export const ACTION_SPENT_MESSAGES: Record<TurnResource, string> = {
  action: "Действие уже израсходовано",
  bonus_action: "Бонусное действие уже израсходовано",
  reaction: "Реакция уже израсходована",
};

export type PaymentChoice =
  | { kind: "slot"; slotLevel: number }
  | { kind: "spell_points" }
  | { kind: "none" };

type AvailabilityCode =
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
  | "concentration_busy"
  | "no_component";

/**
 * Что предупреждение делает с подтверждённым сотворением — объявляет сам предикат.
 *
 * `advisory` — предупреждает и не мешает: нарушение видно игроку, а расплатиться за него нечем.
 * Прочие значения — согласие, без которого сотворение отклоняется, и согласия эти не заменяют друг
 * друга: «Применить всё равно» разрешает мастер, а замену концентрации выбирает игрок. Одно
 * согласие на оба означало бы, что игрок, бросивший прежнее заклинание, заодно молча разрешил себе
 * перерасход ячейки.
 */
type Enforcement = "advisory" | "gm_exception" | "ending_concentration";

/** Согласие игрока или мастера, полученное до подтверждения. */
type Consent = Exclude<Enforcement, "advisory">;

type AvailabilityWarning = {
  code: AvailabilityCode;
  reasonRu: string;
  /** Чем снимается. Список кодов у сценария не заводится: он расходится с объявлением. */
  enforcement: Enforcement;
};

export type Availability = {
  available: boolean;
  warnings: AvailabilityWarning[];
};

/** Полученные согласия. Отсутствующее согласие оставляет предупреждение в силе. */
export type Consents = Partial<Record<Consent, boolean>>;

/** Первое предупреждение, на которое нужного согласия нет: оно и есть причина отказа. */
export function withoutConsent(
  warnings: readonly AvailabilityWarning[],
  consents: Consents,
): AvailabilityWarning | undefined {
  return warnings.find(
    (warning) => warning.enforcement !== "advisory" && consents[warning.enforcement] !== true,
  );
}

type AvailabilityInput = {
  spell: Spell;
  character: CharacterState;
  turn: TurnResources;
  mode: CastMode;
  payment: PaymentChoice;
};

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

const LONG_CASTING_UNITS: Partial<Record<Spell["castingTime"]["type"], LongCastingUnit>> = {
  minute: "minute",
  hour: "hour",
};

function checkCastingTime(input: AvailabilityInput): AvailabilityWarning[] {
  const { castingTime } = input.spell;
  const unit = LONG_CASTING_UNITS[castingTime.type];
  if (unit === undefined || castingTime.value === undefined) return [];
  if (!input.turn.inFight) return [];
  return [
    {
      code: "long_casting_time",
      reasonRu:
        `Не уложится в один ход — ${longCastingTimeRu(unit, castingTime.value)},` +
        " действие каждый ход и концентрация",
      enforcement: "advisory",
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
      {
        code: "not_in_spellbook",
        reasonRu: "Заклинания нет в книге заклинаний",
        enforcement: "advisory",
      },
    ];
  }

  const warnings: AvailabilityWarning[] = [];

  if (mode === "ritual" && !spell.ritual) {
    warnings.push({
      code: "not_ritual",
      reasonRu: `«${spell.nameRu}» нельзя сотворить ритуалом`,
      enforcement: "advisory",
    });
  }

  const needsPreparation = spell.level !== CANTRIP_LEVEL && mode !== "ritual";
  if (needsPreparation && !spellbook.isPrepared(spell.id)) {
    warnings.push({
      code: "not_prepared",
      reasonRu: "Заклинание не подготовлено",
      enforcement: "advisory",
    });
  }

  return warnings;
}

function checkPayment(input: AvailabilityInput): AvailabilityWarning[] {
  const { spell, character, mode, payment } = input;

  if (!consumesSlot(spell.level, mode)) {
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
        enforcement: "advisory",
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
        enforcement: "advisory",
      },
    ];
  }

  const { slotLevel } = payment;
  if (slotLevel < spell.level) {
    // Ячейка ниже уровня заклинания сотворения не даёт: списать её значило бы потратить ресурс
    // впустую и записать в журнал заклинание, которого не было.
    return [
      {
        code: "slot_too_low",
        reasonRu: `Ячейка ${slotLevel} уровня ниже уровня заклинания — нужен ${spell.level}`,
        enforcement: "gm_exception",
      },
    ];
  }

  const slot = character.spellSlots[slotLevel];
  if (slot === undefined) {
    return [
      {
        code: "no_slot",
        reasonRu: `Ячеек ${slotLevel} уровня у персонажа нет`,
        enforcement: "advisory",
      },
    ];
  }
  if (slot.remaining <= 0) {
    return [
      {
        code: "no_slot",
        reasonRu: `Нет свободной ячейки ${slotLevel} уровня`,
        enforcement: "advisory",
      },
    ];
  }
  return [];
}

/**
 * Единственное предупреждение, которое не снимается исключением мастера: цена ошибки — молча
 * потерянный эффект, и снять его вправе только осознанный выбор между двумя заклинаниями.
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
      enforcement: "ending_concentration",
    },
  ];
}

/**
 * Материал спрашивают у сумки: он вещь, и наличие его — её запас.
 *
 * Без записи о снаряжении вердикта нет: состояние могло прийти из сборки, которая про компоненты не
 * знала.
 */
function checkComponents(input: AvailabilityInput): AvailabilityWarning[] {
  const { spell, character } = input;
  const { equipment } = Character.of(character);
  const material = materialOf(spell.components);
  if (!equipment.known || material === undefined) return [];
  if (materialCoveredByFocus(spell.components, character)) return [];
  if (equipment.carries(material.id)) return [];

  return [
    {
      code: "no_component",
      reasonRu: `Нет компонента: ${material.nameRu}`,
      enforcement: "advisory",
    },
  ];
}

/**
 * Перечень требований словами, а не вердикт: «В, С, М» за столом не читается.
 *
 * Закрытый компонент не называется вовсе: он ничего не требует, а строка о нём в момент действия
 * заняла бы место того, что делать всё-таки надо.
 */
export function componentRequirements(
  components: Spell["components"],
  materialCovered: boolean,
): string[] {
  const requirements: string[] = [];

  if (components.verbal) requirements.push("Произнести вслух");
  if (components.somatic) requirements.push("Жест свободной рукой");

  const material = materialOf(components);
  if (material !== undefined && !materialCovered) {
    const notes: string[] = [];
    if (components.costGp !== undefined) {
      notes.push(`${components.costGp} ${CURRENCY_ABBREVIATIONS.gold}, фокусировка не заменяет`);
    }
    if (material.consumed) notes.push("расходуется");
    const suffix = notes.length === 0 ? "" : ` — ${notes.join(", ")}`;
    requirements.push(`Компонент: ${material.nameRu}${suffix}`);
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
            // Экономию хода ведёт приложение: молча потраченное второе действие оно и предъявит.
            enforcement: "gm_exception" as const,
          },
        ]
      : []),
    ...checkCastingTime(input),
    ...checkPayment(input),
    ...checkComponents(input),
    ...checkConcentration(input),
  ];

  return { available: warnings.length === 0, warnings };
}

/**
 * Причины, по которым обмен хитов на очки сейчас невозможен, — словами и с числами.
 *
 * `checkAvailability` сюда не подходит: она принимает заклинание, а обмен заклинанием не является.
 * Общими у них остаются формулировки — «Действие уже израсходовано» обязано звучать одинаково в
 * обоих мастерах, и берётся оно из одной таблицы.
 */
export function exchangeWarnings(character: CharacterState, turn: TurnResources): string[] {
  const warnings: string[] = [];

  const suppression = suppressionReason(character.suppression);
  if (suppression !== null) {
    warnings.push(suppression);
  }
  // Вне боя действие не тратится вовсе, поэтому отдельной проверки на бой здесь нет: экономия
  // хода сама отвечает «доступно», пока схватка не начата.
  if (!turn.actionAvailable) {
    warnings.push(ACTION_SPENT_MESSAGES.action);
  }

  const rate = ascensionTierRate(character.level);
  if (character.hitPoints.current < rate) {
    warnings.push(
      `${withPlural(rate, ["хит", "хита", "хитов"])} за очко, в наличии ${character.hitPoints.current}`,
    );
  }

  return warnings;
}
