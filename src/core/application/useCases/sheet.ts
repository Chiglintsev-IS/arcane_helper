/**
 * Правка листа персонажа.
 *
 * Что меняет число — идёт в журнал и отменяется; справочное поле не идёт: журнал возвращает
 * ресурсы, а не текст. Смена уровня — один сценарий, потому что тянет максимумы трёх ресурсов, и
 * разложенная на четыре нажатия она оставила бы половину пересчитанной.
 */

import { abilityModifier, preparedLimit, proficiencyBonus } from "@/core/domain/character/abilities";
import { spellSlotsForLevel } from "@/core/domain/arcana/slots";
import { averagePerHitDie } from "@/core/domain/vitality/hitDice";
import { Character } from "@/core/domain/assembly/character";
import { DomainError } from "@/core/domain/shared/errors";
import type { DerivedId } from "@/core/domain/sheet/derived";
import {
  ABILITIES,
  skillsOfAbility,
  type Ability,
  type SkillId,
  type SkillTraining,
} from "@/core/domain/character/skills";
import type { CharacterState } from "@/core/domain/assembly/state";
import type { ItemBonuses } from "@/core/domain/shared/schema";
import { commit, withoutRecord, type Clock, type Session } from "@/core/application/session";

/** Справочные поля: имени и возраста журнал не касается. */
export type Identity = Partial<
  Pick<
    CharacterState,
    "name" | "species" | "subclass" | "className" | "age" | "size" | "speed" | "proficiencies"
  >
>;

export function editIdentity(session: Session, patch: Identity): Session {
  return withoutRecord(session, Character.of(session.character).withSheet(patch));
}

/**
 * Правка одной характеристики со всем, что к ней относится: значение, владение спасброском,
 * владения её навыками.
 *
 * Одной командой, а не тремя, потому что на листе это один блок: разложенная на три записи журнала,
 * правка отменялась бы по частям и оставляла бы характеристику с чужими владениями.
 */
export function editAbility(
  session: Session,
  change: {
    ability: Ability;
    score: number;
    saveProficient: boolean;
    /** Только навыки этой характеристики: чужие остаются как были. */
    skills: Partial<Record<SkillId, SkillTraining>>;
  },
  clock: Clock,
): Session {
  const { character } = session;
  const owned = new Set(skillsOfAbility(change.ability));
  const skills = Object.fromEntries(
    Object.entries(character.skills).filter(([id]) => !owned.has(id as SkillId)),
  ) as Partial<Record<SkillId, SkillTraining>>;

  return commit(
    session,
    Character.of(character).withSheet({
      abilities: { ...character.abilities, [change.ability]: change.score },
      // Порядок листа, а не порядок нажатий: устойчивый порядок сравним между выгрузками.
      saveProficiencies: ABILITIES.filter((ability) =>
        ability === change.ability
          ? change.saveProficient
          : character.saveProficiencies.includes(ability),
      ),
      skills: { ...skills, ...change.skills },
    }),
    { kind: "sheet_edited", summaryRu: "Правка характеристики" },
    clock,
  );
}



/** `null` снимает перебивку: число возвращается к формуле. */
export function setOverride(
  session: Session,
  id: DerivedId,
  value: number | null,
  clock: Clock,
): Session {
  const { overrides } = session.character;
  const { [id]: _dropped, ...rest } = overrides;
  const next: CharacterState["overrides"] =
    value === null ? { ...rest } : { ...overrides, [id]: value };
  return commit(
    session,
    Character.of(session.character).withSheet({ overrides: next }),
    {
      kind: "sheet_edited",
      summaryRu: value === null ? "Число возвращено к формуле" : `Число введено руками: ${value}`,
    },
    clock,
  );
}

/**
 * Перебивка базы КД: действует вместо выведенной из надетого доспеха, `null` возвращает счёт.
 *
 * Живёт рядом с остальными перебивками, а не в общем их сценарии: база КД — не производное число
 * листа, у неё своя формула и своя шторка.
 */
export function setArmorClassBaseOverride(
  session: Session,
  value: number | null,
  clock: Clock,
): Session {
  if (value !== null && (!Number.isInteger(value) || value <= 0)) {
    throw new DomainError(`База Класса Доспеха должна быть целым положительным, получено: ${value}`);
  }
  const { overrides } = session.character;
  const { armorClassBase: _dropped, ...rest } = overrides;
  const next: CharacterState["overrides"] =
    value === null ? { ...rest } : { ...overrides, armorClassBase: value };
  return commit(
    session,
    Character.of(session.character).withSheet({ overrides: next }),
    {
      kind: "sheet_edited",
      summaryRu:
        value === null ? "База Класса Доспеха: по надетому" : `База Класса Доспеха: ${value}`,
    },
    clock,
  );
}

/** Прочие прибавки: свойство самого персонажа — благословение, дар, обучение. */
export function editMiscBonuses(
  session: Session,
  miscBonuses: ItemBonuses,
  clock: Clock,
): Session {
  return commit(
    session,
    Character.of(session.character).withSheet({ miscBonuses }),
    { kind: "sheet_edited", summaryRu: "Правка прочих прибавок" },
    clock,
  );
}

export function editMarks(
  session: Session,
  marks: { exhaustion: number; inspiration: boolean },
  clock: Clock,
): Session {
  return commit(
    session,
    Character.of(session.character).withSheet(marks),
    {
      kind: "sheet_edited",
      summaryRu:
        marks.exhaustion > 0 ? `Истощение: ступень ${marks.exhaustion}` : "Отметки мастера изменены",
    },
    clock,
  );
}

export function editHealth(
  session: Session,
  change: { maximumBase: number; masterReduction: number },
  clock: Clock,
): Session {
  const root = Character.of(session.character);
  const vitality = root.vitality
    .withMaximumBase(change.maximumBase)
    .withMasterReduction(change.masterReduction);
  return commit(
    session,
    root.withVitality(vitality),
    { kind: "sheet_edited", summaryRu: `Максимум хитов: ${vitality.maximum}` },
    clock,
  );
}

/**
 * Смена уровня. Максимумы ячеек, рун и Костей хитов идут за уровнем; базовый максимум хитов вводит
 * игрок — кость бросает он, а не приложение.
 */
/** Что сдвинется при смене уровня: величина, её прежнее и новое значение. */
export type LevelChange =
  | { of: "slots"; slotLevel: number; before: number; after: number }
  | { of: "runes"; before: number; after: number }
  | { of: "hitDice"; before: number; after: number }
  | { of: "preparedLimit"; before: number; after: number };

/**
 * Предпросмотр смены уровня: тот же набор правил, что и у самой смены, прочитанный вперёд.
 *
 * Прибавка хитов названа слагаемыми: «среднее за кость плюс Телосложение» — то, что игрок иначе
 * считает в уме, глядя в книгу. Костей может не быть вовсе — тогда называть нечего.
 */
export type LevelPreview = {
  changes: LevelChange[];
  hitPoints: { perDie: number; dieSize: number; constitution: number; total: number } | null;
};

export function previewLevelChange(character: CharacterState, level: number): LevelPreview {
  const before = spellSlotsForLevel(character.level);
  const after = spellSlotsForLevel(level);
  const changes: LevelChange[] = [];

  for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
    const slotLevel = Number(key);
    const was = before[slotLevel]?.maximum ?? 0;
    const now = after[slotLevel]?.maximum ?? 0;
    if (was !== now) changes.push({ of: "slots", slotLevel, before: was, after: now });
  }

  const runesBefore = proficiencyBonus(character.level);
  const runesAfter = proficiencyBonus(level);
  if (runesBefore !== runesAfter) {
    changes.push({ of: "runes", before: runesBefore, after: runesAfter });
  }

  const { hitDice } = character;
  if (hitDice !== undefined && hitDice.total !== level) {
    changes.push({ of: "hitDice", before: hitDice.total, after: level });
  }

  const limitBefore = preparedLimit(character.abilities.intelligence, character.level);
  const limitAfter = preparedLimit(character.abilities.intelligence, level);
  if (limitBefore !== limitAfter) {
    changes.push({ of: "preparedLimit", before: limitBefore, after: limitAfter });
  }

  const constitution = abilityModifier(character.abilities.constitution);
  if (hitDice === undefined) return { changes, hitPoints: null };

  const perDie = averagePerHitDie(hitDice.size);
  return {
    changes,
    hitPoints: { perDie, dieSize: hitDice.size, constitution, total: perDie + constitution },
  };
}

export function changeLevel(
  session: Session,
  next: { level: number; hitPointMaximumBase: number },
  clock: Clock,
): Session {
  const root = Character.of(session.character);
  const withLevel = root.withSheet({ level: next.level });
  const arcana = withLevel.arcana.resizedForLevel(next.level, proficiencyBonus(next.level));
  const vitality = withLevel.vitality
    .resizedHitDice(next.level)
    .withMaximumBase(next.hitPointMaximumBase);

  return commit(
    session,
    withLevel.withArcana(arcana).withVitality(vitality),
    { kind: "sheet_edited", summaryRu: `Уровень: ${next.level}` },
    clock,
  );
}
