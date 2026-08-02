/**
 * Концентрация и активные эффекты: завершение вручную, по провалу проверки и по замене.
 */

import { Character } from "@/core/domain/character/character";
import type { ActiveEffect, CharacterState } from "@/core/domain/character/state";
import type { ArmorClassEffect } from "@/core/domain/catalog/spell";
import type { ConcentrationEnd } from "@/core/domain/effects/effectBoard";
import { DomainError } from "@/core/domain/shared/errors";
import { commit, type Clock, type Session } from "@/core/application/session";

export type { ConcentrationEnd };

/** Условие окончания ручного эффекта: игрок снимает его сам, приложение сроков не считает. */
const MANUAL_EFFECT_END_CONDITION_RU = "Снимается вручную.";

export type ManualEffectInput = {
  nameRu: string;
  /** Прикрытие союзника и подобные вклады; статус без числа поле не заполняет. */
  armorClass?: ArmorClassEffect;
};

const CONCENTRATION_REASONS: Record<ConcentrationEnd, string> = {
  manual: "снята вручную",
  failed_check: "провалена проверка концентрации",
  replaced: "заменена концентрация",
  long_rest: "долгий отдых",
};

/** Завершает концентрацию и связанный эффект одной операцией. */
export function endConcentration(
  session: Session,
  reason: ConcentrationEnd,
  clock: Clock,
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
    clock,
  );
}

/**
 * Можно ли спасти провал проверки концентрации руной.
 * Проверка концентрации — спасбросок Телосложения, значит «Знаки ограждения» применимы.
 */
export function wardingSigilAvailable(character: CharacterState): boolean {
  return !Character.of(character).arcana.runes.depleted && character.reactionAvailable;
}

/** «Знаки ограждения»: реакция и руна превращают провал спасброска в успех. */
export function spendRuneOnWardingSigil(session: Session, clock: Clock): Session {
  const { character } = session;
  if (!wardingSigilAvailable(character)) {
    throw new DomainError(
      Character.of(character).arcana.runes.depleted
        ? "Рун не осталось"
        : "Реакция уже израсходована",
    );
  }
  const root = Character.of(character);
  const after: CharacterState = {
    ...root.withArcana(root.arcana.spendRune()).toState(),
    reactionAvailable: false,
  };
  return commit(
    session,
    after,
    {
      kind: "rune_spent",
      summaryRu: "Знаки ограждения: провал спасброска считается успехом",
      actionUsed: "reaction",
    },
    clock,
  );
}

/**
 * Заводит активный эффект без заклинания: статус, которого нет в каталоге, либо временный вклад в
 * Класс Доспеха от союзника. Снимается тем же путём, что и любой другой активный эффект.
 */
export function startManualEffect(session: Session, input: ManualEffectInput, clock: Clock): Session {
  const nameRu = input.nameRu.trim();
  if (nameRu === "") {
    throw new DomainError("Название эффекта не может быть пустым");
  }
  if (input.armorClass !== undefined && !Number.isInteger(input.armorClass.value)) {
    throw new DomainError("Вклад в Класс Доспеха должен быть целым числом");
  }
  if (input.armorClass !== undefined && input.armorClass.value <= 0) {
    throw new DomainError("Вклад в Класс Доспеха должен быть положительным");
  }

  const effect: ActiveEffect = {
    id: clock.nextId(),
    nameRu,
    type: "utility",
    startedAt: clock.now(),
    duration: { type: "special" },
    isConcentration: false,
    slotLevelUsed: 0,
    ...(input.armorClass === undefined ? {} : { armorClass: input.armorClass }),
    endConditionRu: MANUAL_EFFECT_END_CONDITION_RU,
  };

  const root = Character.of(session.character);
  return commit(
    session,
    root.withEffects(root.effects.start(effect, clock.now())),
    { kind: "manual_effect_started", summaryRu: `Эффект начат: ${nameRu}` },
    clock,
  );
}

/** Ручное завершение активного эффекта. */
export function endEffect(session: Session, effectId: string, clock: Clock): Session {
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
    clock,
  );
}
