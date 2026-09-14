import { z } from "zod";

const word = z.string().min(1);

const numeric = z.number();

function command<K extends string, S extends z.ZodRawShape>(kind: K, shape: S) {
  return z.object({ kind: z.literal(kind), ...shape });
}

/**
 * Замысел состава целиком: его набирают на верстаке, им спрашивают цену, им закладывают партию и им
 * же записывают рецепт. Значения — слова справочника, и сверяет их с перечнями владелец правил.
 */
export const recipeFormulaSchema = z.object({
  kinds: z.array(word),
  mainProperty: word.nullable(),
  mainRarity: word,
  duration: word.nullable(),
  onset: word,
  fullRepeats: numeric,
  reach: word,
  application: word,
  resistance: word,
  purified: z.boolean(),
  suppressed: z.array(z.object({ nameRu: word, rarityRu: word })),
  limitations: z.array(word),
});

export const paymentSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("slot"), slotLevel: numeric }),
  z.object({ kind: z.literal("blood"), castLevel: numeric }),
  z.object({ kind: z.literal("none") }),
]);

export const commandSchema = z.discriminatedUnion("kind", [
  command("cast_spell", {
    spellId: word,
    mode: word,
    payment: paymentSchema,
    rune: word.optional(),
    runeTarget: word.optional(),
    allowAnyway: z.boolean().optional(),
    replaceConcentration: z.boolean().optional(),
    hitDice: z.object({ count: numeric, rolled: numeric }).optional(),
  }),

  command("start_combat", {}),
  command("begin_turn", {}),
  command("end_combat", {}),

  command("end_concentration", { reason: word }),
  command("spend_rune_on_warding_sigil", {}),
  command("spend_rune_on_animal_speech", {}),
  command("start_manual_effect", { nameRu: word, armorClassBonus: numeric.optional() }),
  command("set_armor_class_adjustment", { value: numeric }),
  command("end_effect", { effectId: word }),

  command("adjust_runes", { delta: numeric }),
  command("adjust_last_hint", { delta: numeric }),
  command("spend_spell_slot", { slotLevel: numeric }),
  command("refund_spell_slot", { slotLevel: numeric }),

  command("take_damage", { damage: numeric, fire: z.boolean().optional() }),
  command("heal", { amount: numeric }),
  command("grant_temporary_hit_points", { amount: numeric }),
  command("recover_hit_point_maximum", {}),
  command("set_sunlight", { underSunlight: z.boolean() }),

  command("long_rest", {}),
  command("short_rest", {}),
  command("use_arcane_recovery", { plan: z.record(word, numeric) }),

  command("toggle_preparation", { spellId: word }),
  command("toggle_material", { spellId: word }),
  command("set_spell_note", { spellId: word, note: z.string() }),

  command("add_world_note", { text: word }),
  command("edit_world_note", { noteId: word, text: word }),
  command("remove_world_note", { noteId: word }),

  command("add_item", { nameRu: word, itemKinds: z.array(word) }),
  command("edit_item", { item: z.looseObject({ id: word, nameRu: word }) }),
  command("remove_item", { itemId: word }),
  command("toggle_wanted", { itemId: word }),
  command("record_item", { nameRu: word, wanted: z.boolean() }),
  command("adjust_bag_count", { itemId: word, delta: numeric }),
  command("set_bag_count", { itemId: word, count: numeric }),
  command("adjust_worn_count", { itemId: word, delta: numeric }),
  command("edit_money", { money: z.record(word, numeric) }),

  command("craft_batch", {
    formula: recipeFormulaSchema,
    portions: numeric,
    allowAnyway: z.boolean().optional(),
  }),

  command("record_recipe", { formula: recipeFormulaSchema }),

  command("note_ingredient", { nameRu: word }),
  command("note_ingredient_reference", {
    itemId: word,
    findDc: numeric.optional(),
    gatherDc: numeric.optional(),
    yieldRu: word.optional(),
    portionRu: word.optional(),
    priceGold: numeric.optional(),
  }),
  command("reveal_property", {
    itemId: word,
    number: numeric,
    propertyRu: word,
    directionRu: word.optional(),
  }),
  command("drop_property", { itemId: word, number: numeric }),
  command("set_portion_size", { itemId: word, pieces: numeric }),

  command("add_item_note", { itemId: word, textRu: word }),
  command("edit_item_note", { itemId: word, noteId: word, textRu: word }),
  command("remove_item_note", { itemId: word, noteId: word }),

  command("set_alchemy_workshop", { apparatus: word.optional() }),

  command("edit_identity", { patch: z.looseObject({}) }),
  command("edit_ability", {
    ability: word,
    score: numeric,
    saveProficient: z.boolean(),
    skills: z.record(word, word),
  }),
  command("edit_marks", { exhaustion: numeric, inspiration: z.boolean() }),
  command("edit_health", { maximumBase: numeric, masterReduction: numeric }),
  command("change_level", { level: numeric, hitPointMaximumBase: numeric }),

  command("undo_last", {}),
  command("import_snapshot", { raw: z.string() }),
  command("restore_built_in_catalog", {}),
  command("reset", {}),
]);

export type RecipeFormulaView = z.infer<typeof recipeFormulaSchema>;

export type Command = z.infer<typeof commandSchema>;

export type CommandOf<TKind extends Command["kind"]> = Extract<Command, { kind: TKind }>;

export const envelopeSchema = z.object({
  commandId: word,
  command: commandSchema,
});

export type Envelope = z.infer<typeof envelopeSchema>;
