/**
 * Концентрация и активные эффекты: завершение вручную, по провалу проверки и по замене.
 */

import { Character } from "@/core/domain/assembly/character";
import type { ActiveEffect } from "@/core/domain/effects/schema";
import type { ArmorClassEffect } from "@/core/domain/catalog/spell";
import type { ConcentrationEnd } from "@/core/domain/effects/effectBoard";
import { armorClassAdjustmentEffect } from "@/core/domain/sheet/armorClass";
import { DomainError } from "@/core/domain/shared/errors";
import { signed } from "@/core/shared/language";
import { commit, type Clock, type Session } from "@/core/application/session";
import { deriveTurnEconomy } from "@/core/application/useCases/turn";
import { ACTION_SPENT_MESSAGES } from "@/core/application/casting/availability";


/** Условие окончания ручного эффекта: игрок снимает его сам, приложение сроков не считает. */
const MANUAL_EFFECT_END_CONDITION_RU = "Снимается вручную.";

/** Подпись поправки к КД в списке эффектов. Опознаётся поправка признаком, а не этой строкой. */
const ARMOR_CLASS_ADJUSTMENT_NAME_RU = "Поправка к КД";

type ManualEffectInput = {
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
export function wardingSigilAvailable(session: Session): boolean {
  const { character } = session;
  return (
    !Character.of(character).arcana.runes.depleted &&
    deriveTurnEconomy(session).reactionAvailable
  );
}

/** «Знаки ограждения»: реакция и руна превращают провал спасброска в успех. */
export function spendRuneOnWardingSigil(session: Session, clock: Clock): Session {
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
      summaryRu: "Знаки ограждения: провал спасброска считается успехом",
      actionUsed: "reaction",
    },
    clock,
  );
}

/** Активный эффект без заклинания и уровня ячейки: общая форма для статуса и для поправки к КД. */
function buildManualEffect(
  nameRu: string,
  armorClass: ArmorClassEffect | undefined,
  clock: Clock,
  manualKind?: ActiveEffect["manualKind"],
): ActiveEffect {
  return {
    id: clock.nextId(),
    nameRu,
    startedAt: clock.now(),
    duration: { type: "special" },
    isConcentration: false,
    slotLevelUsed: 0,
    ...(armorClass === undefined ? {} : { armorClass }),
    ...(manualKind === undefined ? {} : { manualKind }),
    endConditionRu: MANUAL_EFFECT_END_CONDITION_RU,
  };
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

  const root = Character.of(session.character);
  const effect = buildManualEffect(nameRu, input.armorClass, clock);
  return commit(
    session,
    root.withEffects(root.effects.start(effect, clock.now())),
    { kind: "manual_effect_started", summaryRu: `Эффект начат: ${nameRu}` },
    clock,
  );
}

/**
 * Заводит, заменяет или снимает временную поправку к КД в шапке ресурсов — одним переходом, как и
 * замена концентрации: новое значение вытесняет прежнее, а ноль снимает поправку вовсе.
 */
export function setArmorClassAdjustment(session: Session, value: number, clock: Clock): Session {
  if (!Number.isInteger(value)) {
    throw new DomainError("Поправка к КД должна быть целым числом");
  }

  const existing = armorClassAdjustmentEffect(session.character);
  if (value === 0) {
    if (existing === undefined) return session;
    return endEffect(session, existing.id, clock);
  }

  const root = Character.of(session.character);
  const cleared = existing === undefined ? root.effects : root.effects.end(existing.id).board;
  const effect = buildManualEffect(
    ARMOR_CLASS_ADJUSTMENT_NAME_RU,
    { kind: "bonus", value },
    clock,
    "armorAdjustment",
  );

  return commit(
    session,
    root.withEffects(cleared.start(effect, clock.now())),
    { kind: "manual_effect_started", summaryRu: `Поправка к КД: ${signed(value)}` },
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
