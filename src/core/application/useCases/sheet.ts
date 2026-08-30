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
import { commit, withoutRecord, type Occasion, type Session } from "@/core/application/session";
import { isPossibleCharacterLevel } from "@/core/domain/character/schema";

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

type Identity = Partial<Pick<CharacterState, (typeof IDENTITY_FIELDS)[number]>>;

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

export function editAbility(
  session: Session,
  change: {
    ability: Ability;
    score: number;
    saveProficient: boolean;
    skills: Partial<Record<SkillId, SkillTraining>>;
  },
  occasion: Occasion,
): Session {
  const { character } = session;
  const owned = new Set(skillsOfAbility(change.ability));
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

type LeveledValue = "runes" | "arcaneRecovery" | "hitDice" | "preparedLimit";

type LevelChange =
  | { of: "slots"; slotLevel: number; before: number; after: number }
  | { of: LeveledValue; before: number; after: number };

type LevelPreview = {
  changes: LevelChange[];
  hitPoints: { perDie: number; dieSize: number; constitution: number; total: number } | null;
};

function leveled(character: CharacterState, level: number): Character {
  const root = Character.of(character).withSheet({ level });
  return root
    .withArcana(root.arcana.resizedForLevel(level, proficiencyBonus(level)))
    .withVitality(root.vitality.resizedHitDice(level));
}

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

function hitDiceShifts(
  before: CharacterState["hitDice"],
  after: CharacterState["hitDice"],
): LevelChange[] {
  if (before === undefined || after === undefined) return [];
  return shifted("hitDice", before.total, after.total);
}

function levelShifts(before: CharacterState, after: CharacterState): LevelChange[] {
  return [
    ...slotShifts(before.spellSlots, after.spellSlots),
    ...shifted("runes", before.runes.maximum, after.runes.maximum),
    ...shifted("arcaneRecovery", before.arcaneRecovery.maximum, after.arcaneRecovery.maximum),
    ...hitDiceShifts(before.hitDice, after.hitDice),
    ...shifted(
      "preparedLimit",
      Character.of(before).sheet.value("preparedLimit"),
      Character.of(after).sheet.value("preparedLimit"),
    ),
  ];
}

export function previewLevelChange(character: CharacterState, level: number): LevelPreview {
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
