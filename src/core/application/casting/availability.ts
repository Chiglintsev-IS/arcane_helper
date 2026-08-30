import { Character } from "@/core/domain/assembly/character";
import { DomainError } from "@/core/domain/shared/errors";
import type { CharacterState } from "@/core/domain/assembly/state";
import type { Spell } from "@/core/domain/catalog/spell";
import { bloodSlotCost, hasSlotLevel, noSlotLevelRu, slotLevelPrice } from "@/core/domain/arcana/slots";
import { suppressionReason, woundsWarningRu } from "@/core/domain/vitality/blood";
import {
  CURRENCY_ABBREVIATIONS,
  longCastingTimeRu,
  type LongCastingUnit,
} from "@/shared/language";
import { consumesSlot, type CastMode } from "@/core/domain/arcana/slots";
import { CANTRIP_LEVEL } from "@/core/domain/catalog/spell";
import { materialCoveredByFocus, materialOf } from "@/core/application/casting/material";

export type TurnResource = "action" | "bonus_action" | "reaction";

export type TurnResources = {
  actionAvailable: boolean;
  bonusActionAvailable: boolean;
  reactionAvailable: boolean;
  inFight: boolean;
};

export const ALL_TURN_RESOURCES: TurnResources = {
  actionAvailable: true,
  bonusActionAvailable: true,
  reactionAvailable: true,
  inFight: false,
};

export const ACTION_SPENT_MESSAGES: Record<TurnResource, string> = {
  action: "Действие уже израсходовано",
  bonus_action: "Бонусное действие уже израсходовано",
  reaction: "Реакция уже израсходована",
};

export type PaymentChoice =
  | { kind: "slot"; slotLevel: number }
  | { kind: "blood"; castLevel: number }
  | { kind: "none" };

export function castLevelOf(payment: PaymentChoice): number | undefined {
  if (payment.kind === "slot") return payment.slotLevel;
  if (payment.kind === "blood") return payment.castLevel;
  return undefined;
}

export function bloodPrice(
  castLevel: number,
  character: CharacterState,
): { hitPoints: number; levelPrice: number } {
  return {
    hitPoints: bloodSlotCost(castLevel, character.level),
    levelPrice: slotLevelPrice(castLevel),
  };
}

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
  | "cast_level_too_low"
  | "blood_suppressed"
  | "not_enough_hit_points"
  | "wounds_from_blood"
  | "concentration_busy"
  | "no_component";

type Enforcement = "advisory" | "gm_exception" | "ending_concentration";

type Consent = Exclude<Enforcement, "advisory">;

type AvailabilityWarning = {
  code: AvailabilityCode;
  reasonRu: string;
  enforcement: Enforcement;
};

export type Availability = {
  available: boolean;
  warnings: AvailabilityWarning[];
};

export type Consents = Partial<Record<Consent, boolean>>;

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

export function closesWholeTurn(warning: { code: string }): boolean {
  return Object.values<string>(SPENT_CODES).includes(warning.code);
}

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
        reasonRu: "Не выбран способ оплаты: ячейка или кровь",
        enforcement: "advisory",
      },
    ];
  }

  if (payment.kind === "blood") {
    const { castLevel } = payment;
    if (castLevel < spell.level) {
      return [
        {
          code: "cast_level_too_low",
          reasonRu: `Ячейкой ${castLevel} уровня заклинание ${spell.level} уровня не сотворить`,
          enforcement: "gm_exception",
        },
      ];
    }

    if (!hasSlotLevel(character.spellSlots, castLevel)) {
      return [{ code: "no_slot", reasonRu: noSlotLevelRu(castLevel), enforcement: "advisory" }];
    }

    const suppression = suppressionReason(character.suppression);
    if (suppression !== null) {
      return [{ code: "blood_suppressed", reasonRu: suppression, enforcement: "gm_exception" }];
    }

    const price = bloodPrice(castLevel, character);
    const { current } = character.hitPoints;
    if (price.hitPoints > current) {
      return [
        {
          code: "not_enough_hit_points",
          reasonRu: `Кровью не хватит: ячейка стоит ${price.hitPoints} хитов, в наличии ${current}`,
          enforcement: "gm_exception",
        },
      ];
    }
    if (price.hitPoints === current) {
      return [
        { code: "wounds_from_blood", reasonRu: woundsWarningRu(price.levelPrice), enforcement: "advisory" },
      ];
    }
    return [];
  }

  const { slotLevel } = payment;
  if (slotLevel < spell.level) {
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
        reasonRu: noSlotLevelRu(slotLevel),
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

export function checkAvailability(input: AvailabilityInput): Availability {
  const resource = turnResourceFor(input.spell.castingTime.type);

  const warnings: AvailabilityWarning[] = [
    ...checkPreparation(input),
    ...(resource !== undefined && !isAvailable(input.turn, resource)
      ? [
          {
            code: SPENT_CODES[resource],
            reasonRu: ACTION_SPENT_MESSAGES[resource],
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
