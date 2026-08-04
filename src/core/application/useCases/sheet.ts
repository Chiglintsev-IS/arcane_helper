/**
 * Правка листа персонажа.
 *
 * Что меняет число — идёт в журнал и отменяется; справочное поле не идёт: журнал возвращает
 * ресурсы, а не текст. Смена уровня — один сценарий, потому что тянет максимумы всех ресурсов, что
 * идут за уровнем, и разложенная на нажатие за ресурс оставила бы половину пересчитанной.
 */

import { abilityModifier, proficiencyBonus } from "@/core/domain/character/abilities";
import { averagePerHitDie } from "@/core/domain/vitality/hitDice";
import { Character } from "@/core/domain/assembly/character";
import { Sheet } from "@/core/domain/sheet/sheet";
import type { DerivedId } from "@/core/domain/sheet/derived";
import {
  ABILITIES,
  SKILL_IDS,
  skillsOfAbility,
  type Ability,
  type SkillId,
  type SkillTraining,
} from "@/core/domain/character/skills";
import type { CharacterState } from "@/core/domain/assembly/state";
import type { ItemBonuses } from "@/core/domain/shared/schema";
import { commit, withoutRecord, type Clock, type Session } from "@/core/application/session";
import { isPossibleCharacterLevel } from "@/core/domain/character/schema";

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
  // Владения правимой характеристики приходят правкой целиком, поэтому прежние здесь снимаются.
  const skills: Partial<Record<SkillId, SkillTraining>> = {};
  for (const id of SKILL_IDS) {
    const training = character.skills[id];
    if (owned.has(id) || training === undefined) continue;
    skills[id] = training;
  }

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

/** Величина, которая идёт за уровнем одним числом: пул ресурса или производное число листа. */
type LeveledValue = "runes" | "arcaneRecovery" | "hitDice" | "preparedLimit";

/** Что сдвинется при смене уровня: величина, её прежнее и новое значение. */
export type LevelChange =
  | { of: "slots"; slotLevel: number; before: number; after: number }
  | { of: LeveledValue; before: number; after: number };

/**
 * Предпросмотр смены уровня: то же состояние, что построит сама смена, названное сравнением с
 * нынешним. Считать последствия отдельным кодом значило бы обещать одно, а делать другое.
 *
 * Прибавка хитов названа слагаемыми: «среднее за кость плюс Телосложение» — то, что игрок иначе
 * считает в уме, глядя в книгу. Костей может не быть вовсе — тогда называть нечего.
 */
type LevelPreview = {
  changes: LevelChange[];
  hitPoints: { perDie: number; dieSize: number; constitution: number; total: number } | null;
};

/**
 * Персонаж на взятом уровне: максимумы ячеек, рун, бюджета восстановления и Костей хитов идут за
 * уровнем. Базовый максимум хитов сюда не входит — кость бросает игрок, а не приложение.
 */
function leveled(character: CharacterState, level: number): Character {
  const root = Character.of(character).withSheet({ level });
  return root
    .withArcana(root.arcana.resizedForLevel(level, proficiencyBonus(level)))
    .withVitality(root.vitality.resizedHitDice(level));
}

/** Сдвиг называется только тогда, когда число другое: «11 → 11» игроку сказать нечего. */
function shifted(of: LeveledValue, before: number, after: number): LevelChange[] {
  return before === after ? [] : [{ of, before, after }];
}

function slotShifts(
  before: CharacterState["spellSlots"],
  after: CharacterState["spellSlots"],
): LevelChange[] {
  const changes: LevelChange[] = [];
  for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
    const slotLevel = Number(key);
    const was = before[slotLevel]?.maximum ?? 0;
    const now = after[slotLevel]?.maximum ?? 0;
    if (was !== now) changes.push({ of: "slots", slotLevel, before: was, after: now });
  }
  return changes;
}

/** Костей хитов может не быть вовсе: чужая выгрузка могла их не знать — тогда и сдвигать нечего. */
function hitDiceShifts(
  before: CharacterState["hitDice"],
  after: CharacterState["hitDice"],
): LevelChange[] {
  if (before === undefined || after === undefined) return [];
  return shifted("hitDice", before.total, after.total);
}

/** Все сдвиги пулов и производных чисел разом: сравнение прежнего состояния с состоянием уровня. */
function levelShifts(before: CharacterState, after: CharacterState): LevelChange[] {
  return [
    ...slotShifts(before.spellSlots, after.spellSlots),
    ...shifted("runes", before.runes.maximum, after.runes.maximum),
    ...shifted("arcaneRecovery", before.arcaneRecovery.maximum, after.arcaneRecovery.maximum),
    ...hitDiceShifts(before.hitDice, after.hitDice),
    // Действующее число листа, а не формула класса: перебитое руками за уровнем не идёт.
    ...shifted(
      "preparedLimit",
      Sheet.of(before).preparationLimit,
      Sheet.of(after).preparationLimit,
    ),
  ];
}

export function previewLevelChange(character: CharacterState, level: number): LevelPreview {
  // Такого уровня не бывает — считать нечего. Отвечает объявление уровня, а не проверка на месте.
  if (!isPossibleCharacterLevel(level)) return { changes: [], hitPoints: null };

  const changes = levelShifts(character, leveled(character, level).toState());

  const { hitDice } = character;
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
  const atLevel = leveled(session.character, next.level);

  return commit(
    session,
    atLevel.withVitality(atLevel.vitality.withMaximumBase(next.hitPointMaximumBase)),
    { kind: "sheet_edited", summaryRu: `Уровень: ${next.level}` },
    clock,
  );
}
