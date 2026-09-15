import { Character } from "@/core/domain/assembly/character";
import { characterStateSchema, type CharacterState } from "@/core/domain/assembly/state";
import {
  arcaneRecoveryBudget,
  bloodSlotCost,
  slotsInOrder,
  spellSlotsForLevel,
} from "@/core/domain/arcana/slots";
import { runesMaximum } from "@/core/domain/arcana/runes";
import { RELIABLE_FIELD_KIT } from "@/core/domain/crafting/apparatus";
import { proficiencyBonus } from "@/core/domain/character/abilities";
import { CANTRIP_LEVEL } from "@/core/domain/catalog/spell";
import { loadThorneSpells } from "@/core/infrastructure/catalog/thorne";
import { Items } from "@/core/domain/items/items";
import type { RevealedProperty } from "@/core/domain/items/ingredient";

/**
 * Волшебник для прогонов правил. Его числа названы здесь и за листом Торна не едут: повышение уровня
 * за столом их не двигает, и прогон формулы переживает его молча. Он снаряжён — знает и подготовил
 * весь встроенный каталог и носит фокусировку, мантию и плащ, — чтобы прогону правила не приходилось
 * собирать книгу и вещи заново; кому нужно обратное, снимает операцией.
 *
 * Начальный персонаж не достигается операциями: он ими меняется. Поэтому здесь литерал, как и у
 * самого Торна.
 */
const WIZARD_LEVEL = 7;

const WIZARD_SLOTS = spellSlotsForLevel(WIZARD_LEVEL);
const WIZARD_RECOVERY = arcaneRecoveryBudget(WIZARD_LEVEL);
const WIZARD_RUNES = runesMaximum(proficiencyBonus(WIZARD_LEVEL));

function knownByLevel(cantrips: boolean): string[] {
  return loadThorneSpells()
    .filter((spell) => (spell.level === CANTRIP_LEVEL) === cantrips)
    .map((spell) => spell.id);
}

export function createWizard(): CharacterState {
  const spellbookSpellIds = knownByLevel(false);
  return characterStateSchema.parse({
    id: "wizard",
    name: "Волшебник",
    className: "Волшебник",
    level: WIZARD_LEVEL,
    species: "Тролль",
    subclass: "Рунист",
    features: [
      {
        nameRu: "Почерк рун",
        summaryRu: "Минута над записью отвечает, один ли у двух записей автор.",
      },
    ],

    abilities: {
      strength: 8,
      dexterity: 14,
      constitution: 16,
      intelligence: 18,
      wisdom: 12,
      charisma: 8,
    },
    saveProficiencies: ["intelligence", "wisdom"],
    skills: {
      arcana: "proficient",
      investigation: "proficient",
      nature: "proficient",
      perception: "proficient",
      sleightOfHand: "proficient",
      survival: "proficient",
    },

    cantripIds: knownByLevel(true),
    spellbookSpellIds,
    preparedSpellIds: spellbookSpellIds,
    spellNotes: {},

    spellSlots: WIZARD_SLOTS,
    arcaneRecovery: { maximum: WIZARD_RECOVERY, remaining: WIZARD_RECOVERY },
    runes: { maximum: WIZARD_RUNES, remaining: WIZARD_RUNES },

    activeEffects: [],

    hitPoints: { current: 60, maximumBase: 60, bloodReduction: 0, masterReduction: 0 },
    hitDice: { total: WIZARD_LEVEL, size: 6, remaining: WIZARD_LEVEL },
    suppression: { firedUponTurnStarts: 0, underDirectSunlight: false },
    alchemyApparatus: RELIABLE_FIELD_KIT,

    itemDefinitions: [
      {
        id: "spellcasting-focus",
        nameRu: "Фокусировка",
        kinds: ["gear"],
        spellcastingFocus: true,
        bonuses: { spellSaveDc: 1, spellAttackModifier: 1 },
      },
      { id: "robe", nameRu: "Мантия", kinds: ["gear"], bonuses: { armorClass: 1 } },
      {
        id: "cloak-of-protection",
        nameRu: "Плащ",
        kinds: ["gear"],
        bonuses: {
          armorClass: 1,
          "save:strength": 1,
          "save:dexterity": 1,
          "save:constitution": 1,
          "save:intelligence": 1,
          "save:wisdom": 1,
          "save:charisma": 1,
        },
      },
    ],
    equipment: {
      bag: [],
      worn: [
        { itemId: "spellcasting-focus", count: 1 },
        { itemId: "robe", count: 1 },
        { itemId: "cloak-of-protection", count: 1 },
      ],
      components: { componentPouch: false },
    },
  });
}

export function withSpentSlots(
  character: CharacterState,
  level: number,
  count: number,
): CharacterState {
  const root = Character.of(character);
  let arcana = root.arcana;
  for (let spent = 0; spent < count; spent += 1) {
    arcana = arcana.spendSlot(level);
  }
  return root.withArcana(arcana).toState();
}

export function withoutSlots(character: CharacterState): CharacterState {
  return slotsInOrder(character.spellSlots).reduce(
    (current, slot) => withSpentSlots(current, slot.level, slot.remaining),
    character,
  );
}

export function withSlotDebt(
  character: CharacterState,
  level: number,
): CharacterState {
  const drained = Character.of(withoutSlots(character));
  return drained
    .withArcana(drained.arcana.spendSlot(level, { allowOverdraft: true }))
    .toState();
}

export function withDamage(
  character: CharacterState,
  damage: number,
): CharacterState {
  const root = Character.of(character);
  return root.withVitality(root.vitality.takeDamage(damage).vitality).toState();
}

export function withBloodPaid(
  character: CharacterState,
  castLevel: number,
): CharacterState {
  const root = Character.of(character);
  return root
    .withVitality(
      root.vitality.payWithBlood(bloodSlotCost(castLevel, root.base.level)),
    )
    .toState();
}

export function withoutIngredientKnowledge(character: CharacterState): CharacterState {
  const root = Character.of(character);
  return root
    .withCrafting(root.crafting.forgetRecipes())
    .withItems(
      root.items.ingredients.reduce(
        (items, item) => items.removeDefinition(item.id),
        root.items,
      ),
    )
    .withEquipment(
      root.items.ingredients.reduce(
        (equipment, item) => equipment.setBagCount(item.id, 0),
        root.equipment,
      ),
    )
    .toState();
}

export function withoutItems(character: CharacterState): CharacterState {
  const root = Character.of(character);
  const emptied = root.items.all.reduce((equipment, item) => {
    const worn = equipment.wornCount(item.id);
    return (worn === 0 ? equipment : equipment.unequip(item.id, worn)).setBagCount(item.id, 0);
  }, root.equipment);

  return root
    .withItems(root.items.all.reduce((items, item) => items.removeDefinition(item.id), root.items))
    .withEquipment(emptied)
    .toState();
}

export function withIngredientKnowledge(
  character: CharacterState,
  nameRu: string,
  properties: readonly RevealedProperty[] = [],
): CharacterState {
  const root = Character.of(character);
  const itemId = Items.idFromName(nameRu);
  const noted = root.items.addDefinition({ nameRu, kinds: [] }).startAlchemy(itemId);
  return root
    .withItems(
      properties.reduce((items, property) => items.revealProperty(itemId, property), noted),
    )
    .toState();
}

export function withoutRunes(character: CharacterState): CharacterState {
  const root = Character.of(character);
  let arcana = root.arcana;
  for (let spent = 0; spent < character.runes.remaining; spent += 1) {
    arcana = arcana.spendRune();
  }
  return root.withArcana(arcana).toState();
}

export function withoutLastHint(character: CharacterState): CharacterState {
  const root = Character.of(character);
  return root
    .withArcana(root.arcana.shiftLastHint(-character.lastHint.remaining))
    .toState();
}

export function withMasterReduction(
  character: CharacterState,
  amount: number,
): CharacterState {
  const root = Character.of(character);
  return root.withVitality(root.vitality.withMasterReduction(amount)).toState();
}

export function withSpentHitDice(
  character: CharacterState,
  count: number,
): CharacterState {
  const root = Character.of(character);
  return root.withVitality(root.vitality.spendHitDice(count)).toState();
}

export function withoutHitDice(character: CharacterState): CharacterState {
  const pool = character.hitDice;
  if (pool === undefined) return character;
  return withSpentHitDice(character, pool.remaining);
}

export function withForeignSlots(
  character: CharacterState,
  slots: CharacterState["spellSlots"],
): CharacterState {
  return { ...character, spellSlots: slots };
}

export function withoutComponentRecord(
  character: CharacterState,
): CharacterState {
  const { components: _unknown, ...equipment } = character.equipment;
  return { ...character, equipment };
}

export function withoutSpellcastingFocus(
  character: CharacterState,
): CharacterState {
  return Character.of(character)
    .items.all.filter((item) => item.spellcastingFocus === true)
    .reduce((state, focus) => {
      const root = Character.of(state);
      return root.withEquipment(root.equipment.unequip(focus.id, 1)).toState();
    }, character);
}

export function withoutArcaneRecovery(
  character: CharacterState,
): CharacterState {
  const budget = character.arcaneRecovery.remaining;
  if (budget === 0) return character;
  const root = Character.of(withSpentSlots(character, 1, budget));
  return root
    .withArcana(root.arcana.useArcaneRecovery({ 1: budget }))
    .toState();
}

/** Снимает подготовку со всего: прогону про подготовку нужна книга, в которой есть что готовить. */
export function withoutPreparation(character: CharacterState): CharacterState {
  const root = Character.of(character);
  const stripped = character.preparedSpellIds.reduce(
    (spellbook, spellId) => spellbook.togglePreparation(spellId, spellId, 1, 0).spellbook,
    root.spellbook,
  );
  return root.withSpellbook(stripped).toState();
}

/** Подготовлено ровно названное: прогон про список называет его состав сам, а не берёт чужой. */
export function preparing(
  character: CharacterState,
  ...spellIds: readonly string[]
): CharacterState {
  const root = Character.of(withoutPreparation(character));
  const prepared = spellIds.reduce(
    (spellbook, spellId) =>
      spellbook.togglePreparation(spellId, spellId, 1, spellIds.length).spellbook,
    root.spellbook,
  );
  return root.withSpellbook(prepared).toState();
}

/**
 * Рабочий набор подготовки для прогонов списка: ровно по предел листа, ритуалов в нём нет, и ни одно
 * не творится бонусным действием. Состав назван здесь, чтобы прогон про список не зависел от того,
 * что персонаж подготовил сегодня за столом.
 */
const READY_SPELL_IDS: readonly string[] = [
  "shield",
  "absorb-elements",
  "mage-armor",
  "magic-missile",
  "web",
  "counterspell",
  "lightning-bolt",
  "slow",
  "thunder-step",
  "intellect-fortress",
  "storm-sphere",
];

export function preparedForPlay(character: CharacterState): CharacterState {
  return preparing(character, ...READY_SPELL_IDS);
}

export function knowing(
  character: CharacterState,
  spellId: string,
): CharacterState {
  if (character.spellbookSpellIds.includes(spellId)) return character;
  return {
    ...character,
    spellbookSpellIds: [...character.spellbookSpellIds, spellId],
  };
}
