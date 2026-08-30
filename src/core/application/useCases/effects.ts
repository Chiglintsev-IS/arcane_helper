import { WARDING_SIGIL_RU } from "@/core/domain/arcana/arcana";
import { Character } from "@/core/domain/assembly/character";
import type { ActiveEffect } from "@/core/domain/effects/schema";
import type { ConcentrationEnd } from "@/core/domain/effects/effectBoard";
import type { StatContribution } from "@/core/domain/shared/stats";
import { DomainError } from "@/core/domain/shared/errors";
import { signed } from "@/shared/language";
import { commit, type Occasion, type Session } from "@/core/application/session";
import { deriveTurnEconomy } from "@/core/application/useCases/turn";
import { ACTION_SPENT_MESSAGES } from "@/core/application/casting/availability";

const MANUAL_EFFECT_END_CONDITION_RU = "Снимается вручную.";

const ARMOR_CLASS_ADJUSTMENT_NAME_RU = "Поправка к КД";

type ManualEffectInput = {
  nameRu: string;
  armorClassBonus?: number;
};

const CONCENTRATION_REASONS: Record<ConcentrationEnd, string> = {
  manual: "снята вручную",
  failed_check: "провалена проверка концентрации",
  replaced: "заменена концентрация",
  long_rest: "долгий отдых",
};

export function endConcentration(
  session: Session,
  reason: ConcentrationEnd,
  occasion: Occasion,
): Session {
  const root = Character.of(session.character);
  const { board, spellId } = root.effects.endConcentration();
  return commit(
    session,
    root.withEffects(board),
    {
      kind: "concentration_ended",
      summaryRu: `Концентрация завершена: ${CONCENTRATION_REASONS[reason]}`,
      spellId,
    },
    occasion,
  );
}

export function wardingSigilAvailable(session: Session): boolean {
  const { character } = session;
  return (
    !Character.of(character).arcana.runes.depleted &&
    deriveTurnEconomy(session).reactionAvailable
  );
}

export function spendRuneOnWardingSigil(session: Session, occasion: Occasion): Session {
  const { character } = session;
  if (!wardingSigilAvailable(session)) {
    throw new DomainError(
      Character.of(character).arcana.runes.depleted
        ? "Рун не осталось"
        : ACTION_SPENT_MESSAGES.reaction,
    );
  }
  const root = Character.of(character);
  return commit(
    session,
    root.withArcana(root.arcana.spendRune()),
    {
      kind: "rune_spent",
      summaryRu: `${WARDING_SIGIL_RU}: провал спасброска считается успехом`,
      actionUsed: "reaction",
    },
    occasion,
  );
}

function buildManualEffect(
  nameRu: string,
  contributions: readonly StatContribution[],
  occasion: Occasion,
  manualKind?: ActiveEffect["manualKind"],
): ActiveEffect {
  return {
    id: occasion.nextId(),
    nameRu,
    startedAt: occasion.now(),
    duration: { type: "until_removed" },
    isConcentration: false,
    slotLevelUsed: 0,
    contributions,
    ...(manualKind === undefined ? {} : { manualKind }),
    endConditionRu: MANUAL_EFFECT_END_CONDITION_RU,
  };
}

function armorClassBonus(value: number): StatContribution {
  return { stat: "armorClass", kind: "bonus", value };
}

export function startManualEffect(session: Session, input: ManualEffectInput, occasion: Occasion): Session {
  const nameRu = input.nameRu.trim();
  if (nameRu === "") {
    throw new DomainError("Название эффекта не может быть пустым");
  }
  if (input.armorClassBonus !== undefined && !Number.isInteger(input.armorClassBonus)) {
    throw new DomainError("Вклад в Класс Доспеха должен быть целым числом");
  }
  if (input.armorClassBonus !== undefined && input.armorClassBonus <= 0) {
    throw new DomainError("Вклад в Класс Доспеха должен быть положительным");
  }

  const root = Character.of(session.character);
  const effect = buildManualEffect(
    nameRu,
    input.armorClassBonus === undefined ? [] : [armorClassBonus(input.armorClassBonus)],
    occasion,
  );
  return commit(
    session,
    root.withEffects(root.effects.start(effect, occasion.now())),
    { kind: "manual_effect_started", summaryRu: `Эффект начат: ${nameRu}` },
    occasion,
  );
}

export function setArmorClassAdjustment(session: Session, value: number, occasion: Occasion): Session {
  if (!Number.isInteger(value)) {
    throw new DomainError("Поправка к КД должна быть целым числом");
  }

  const existing = Character.of(session.character).effects.manualEffect("armorAdjustment");
  if (value === 0) {
    if (existing === undefined) return session;
    return endEffect(session, existing.id, occasion);
  }

  const root = Character.of(session.character);
  const cleared = existing === undefined ? root.effects : root.effects.end(existing.id).board;
  const effect = buildManualEffect(
    ARMOR_CLASS_ADJUSTMENT_NAME_RU,
    [armorClassBonus(value)],
    occasion,
    "armorAdjustment",
  );

  return commit(
    session,
    root.withEffects(cleared.start(effect, occasion.now())),
    { kind: "manual_effect_started", summaryRu: `Поправка к КД: ${signed(value)}` },
    occasion,
  );
}

export function endEffect(session: Session, effectId: string, occasion: Occasion): Session {
  const root = Character.of(session.character);
  const { board, ended } = root.effects.end(effectId);
  return commit(
    session,
    root.withEffects(board),
    {
      kind: "effect_ended",
      summaryRu: `Эффект завершён: ${ended.nameRu}`,
      ...(ended.spellId === undefined ? {} : { spellId: ended.spellId }),
    },
    occasion,
  );
}
