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
import { skillsOfAbility, type SkillTraining } from "@/core/domain/character/skills";
import {
  ABILITIES,
  SKILL_IDS,
  type Ability,
  type SkillId,
} from "@/core/domain/shared/stats";
import type { CharacterState } from "@/core/domain/assembly/state";
import { DomainError } from "@/core/domain/shared/errors";
import { commit, withoutRecord, type Occasion, type Session } from "@/core/application/session";
import {
  isPossibleCharacterLevel,
  type PermanentContribution,
} from "@/core/domain/character/schema";

/**
 * Справочные поля: имени и возраста журнал не касается.
 *
 * Перечнем, а не одним лишь типом: тем же списком отбирается справочная часть правки, пришедшей
 * снаружи. Второе перечисление разошлось бы с первым, и поле, забытое в одном из двух мест, молча
 * перестало бы правиться.
 */
const IDENTITY_FIELDS = [
  "name",
  "species",
  "subclass",
  "className",
  "age",
  "size",
  "speed",
  "proficiencies",
] as const;

export type Identity = Partial<Pick<CharacterState, (typeof IDENTITY_FIELDS)[number]>>;

/**
 * Справочная часть присланной правки. Прочие поля состояния отбрасываются: правка листа не дверь к
 * ячейкам, и снаружи через неё меняют только то, чем она объявлена.
 */
export function identityOf(patch: Partial<CharacterState>): Identity {
  const identity: Identity = {};
  for (const field of IDENTITY_FIELDS) {
    if (patch[field] !== undefined) Object.assign(identity, { [field]: patch[field] });
  }
  return identity;
}

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
  occasion: Occasion,
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
    occasion,
  );
}



/**
 * Заводит или заменяет постоянный вклад: раса, дар, слово мастера — без вещи и без срока.
 *
 * Правка базы, а не эффект, и потому обратима журналом, как всякая правка листа. Одноимённый вклад
 * заменяется, а не удваивается: игрок правит уже записанное, а не заводит второе такое же.
 */
export function setPermanentContribution(
  session: Session,
  permanent: PermanentContribution,
  occasion: Occasion,
): Session {
  const kept = session.character.permanentContributions.filter(
    (existing) => existing.nameRu !== permanent.nameRu,
  );
  return commit(
    session,
    Character.of(session.character).withSheet({
      permanentContributions: [...kept, permanent],
    }),
    { kind: "sheet_edited", summaryRu: `Постоянный вклад: ${permanent.nameRu}` },
    occasion,
  );
}

/** Снимает постоянный вклад по имени: снятое возвращается журналом, как всякая правка. */
export function removePermanentContribution(
  session: Session,
  nameRu: string,
  occasion: Occasion,
): Session {
  const kept = session.character.permanentContributions.filter(
    (existing) => existing.nameRu !== nameRu,
  );
  if (kept.length === session.character.permanentContributions.length) {
    throw new DomainError(`Постоянного вклада «${nameRu}» у персонажа нет`);
  }
  return commit(
    session,
    Character.of(session.character).withSheet({ permanentContributions: kept }),
    { kind: "sheet_edited", summaryRu: `Постоянный вклад снят: ${nameRu}` },
    occasion,
  );
}

export function editMarks(
  session: Session,
  marks: { exhaustion: number; inspiration: boolean },
  occasion: Occasion,
): Session {
  return commit(
    session,
    Character.of(session.character).withSheet(marks),
    {
      kind: "sheet_edited",
      summaryRu:
        marks.exhaustion > 0 ? `Истощение: ступень ${marks.exhaustion}` : "Отметки мастера изменены",
    },
    occasion,
  );
}

export function editHealth(
  session: Session,
  change: { maximumBase: number; masterReduction: number },
  occasion: Occasion,
): Session {
  const root = Character.of(session.character);
  const vitality = root.vitality
    .withMaximumBase(change.maximumBase)
    .withMasterReduction(change.masterReduction);
  return commit(
    session,
    root.withVitality(vitality),
    { kind: "sheet_edited", summaryRu: `Максимум хитов: ${vitality.maximum}` },
    occasion,
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
      Character.of(before).sheet.value("preparedLimit"),
      Character.of(after).sheet.value("preparedLimit"),
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
  occasion: Occasion,
): Session {
  const atLevel = leveled(session.character, next.level);

  return commit(
    session,
    atLevel.withVitality(atLevel.vitality.withMaximumBase(next.hitPointMaximumBase)),
    { kind: "sheet_edited", summaryRu: `Уровень: ${next.level}` },
    occasion,
  );
}
