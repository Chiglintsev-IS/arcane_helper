import { z } from "zod";

import { paymentSchema } from "./commands";

const word = z.string().min(1);

const text = z.string();

const whole = z.number().int();

const statChoiceSchema = z.object({
  id: word,
  kind: word,
  of: word.optional(),
});

export const choicesViewSchema = z.object({
  stats: z.array(statChoiceSchema),
  creatureSizes: z.array(word),
  itemKinds: z.array(word),
  armorCategories: z.array(word),
  currencies: z.array(word),
  skillTrainings: z.array(word),
  runeTargets: z.array(word),
  exhaustionSteps: z.array(whole),
  characterLevel: z.object({ minimum: whole, maximum: whole }),
  abilityScore: z.object({ minimum: whole, maximum: whole }),
  alchemyDirections: z.array(word),
  apparatusGrades: z.array(word),
  alchemicalProperties: z.array(z.object({ nameRu: word, direction: word })),
  alchemicalRarities: z.array(word),
  propertyNumbers: z.array(whole),
  recipeForm: z.object({
    standard: z.object({
      duration: word.nullable(),
      onset: word,
      fullRepeats: whole,
      reach: word,
      application: word,
      resistance: word,
      purification: word.nullable(),
    }),
    durations: z.array(word),
    onsets: z.array(word),
    reaches: z.array(word),
    applications: z.array(word),
    resistances: z.array(word),
    limitations: z.array(word),
    purifications: z.array(word),
  }),
});

const skillViewSchema = z.object({
  id: word,
  value: whole,
  training: word.optional(),
});

const abilityViewSchema = z.object({
  id: word,
  score: whole,
  modifier: whole,
  save: whole,
  saveProficient: z.boolean(),
  skills: z.array(skillViewSchema),
});

const hitPointsViewSchema = z.object({
  current: whole,
  maximum: whole,
  maximumBase: whole,
  bloodReduction: whole,
  masterReduction: whole,
  maximumReduction: whole,
  temporary: whole,
  hitDice: z.object({ remaining: whole, total: whole, size: whole }).optional(),
});

const characterFeatureViewSchema = z.object({ nameRu: word, summaryRu: word });

export const sheetViewSchema = z.object({
  name: text,
  species: text,
  age: whole,
  size: word,
  speed: whole,
  speedBase: whole,
  className: text,
  level: whole,
  subclass: text,

  hitPoints: hitPointsViewSchema,
  armorClass: whole,

  exhaustion: whole,
  inspiration: z.boolean(),

  proficiencyBonus: whole,

  abilities: z.array(abilityViewSchema),

  proficiencies: z.object({
    weapons: z.array(word),
    armor: z.array(word),
    tools: z.array(word),
    languages: z.array(word),
  }),

  features: z.array(characterFeatureViewSchema),
});

const itemViewSchema = z.object({
  id: word,
  nameRu: word,
  kind: word,
  bagCount: whole,
  wornCount: whole,
  price: z.object({ amount: whole, currency: word }).optional(),
  bonuses: z.array(z.object({ stat: word, value: whole })),
  bonusFacts: z.array(
    z.object({
      value: whole,
      targets: z.array(
        z.object({
          kind: word,
          id: word,
        }),
      ),
    }),
  ),
  armor: z.object({ base: whole, category: word.optional() }).optional(),
  spellcastingFocus: z.boolean(),
  note: text.optional(),
  neededForRu: z.array(word),
});

const missingMaterialViewSchema = z.object({
  spellId: word,
  nameRu: word,
  price: z.object({ amount: whole, currency: word }).optional(),
  consumed: z.boolean(),
  neededForRu: z.array(word),
  coveredByFocus: z.boolean(),
  itemId: word.optional(),
  note: text.optional(),
});

export const bagViewSchema = z.object({
  money: z.array(z.object({ currency: word, amount: whole })),
  items: z.array(itemViewSchema),
  missingMaterials: z.array(missingMaterialViewSchema),
  armorClass: z.object({
    value: whole,
    wornArmorNameRu: word.optional(),
  }),
});

const revealedPropertyViewSchema = z.object({
  number: whole,
  nameRu: word,
  rarity: word,
});

const ingredientKnowledgeViewSchema = z.object({
  nameRu: word,
  properties: z.array(revealedPropertyViewSchema),
  propertiesExhausted: z.boolean(),
});

export const craftingViewSchema = z.object({
  ingredients: z.array(ingredientKnowledgeViewSchema),
  workshop: z.object({
    apparatus: z.array(z.object({ direction: word, gradeRu: word })),
    studiedDirections: z.array(word),
  }),
});

export const resourcesViewSchema = z.object({
  slots: z.array(z.object({ level: whole, remaining: whole, maximum: whole })),
  runes: z.object({ nameRu: z.string(), remaining: whole, maximum: whole }),
  lastHint: z.object({ nameRu: z.string(), remaining: whole, maximum: whole }),
  armorClassAdjustment: whole,
  passivePerception: whole,
  initiative: whole,
  wardingSigilAvailable: z.boolean(),
  suppression: z.object({ firedUpon: z.boolean(), underDirectSunlight: z.boolean() }),
});

export const recoveryViewSchema = z.object({
  nextHour: z.object({
    maximumReturned: whole,
    healed: whole,
    unavailabilityRu: word.optional(),
  }),
  combatEndRecovery: whole,
  shortRestDurationRu: word,
  shortRestUnavailabilityRu: word.optional(),
  longRestUnavailabilityRu: word.optional(),
  arcaneRecovery: z.object({
    remaining: whole,
    unavailabilityRu: word.optional(),
    recoverable: z.array(z.object({ level: whole, spent: whole })),
  }),
});

export const activeEffectViewSchema = z.object({
  id: word,
  nameRu: word,
  endConditionRu: word,
  isConcentration: z.boolean(),
  changesArmorClass: z.boolean(),
  noteRu: word.optional(),
  repeatableAction: z.object({ label: word, description: word }).optional(),
});

export const turnViewSchema = z.object({
  round: whole,
  inFight: z.boolean(),
  actionAvailable: z.boolean(),
  bonusActionAvailable: z.boolean(),
  reactionAvailable: z.boolean(),
});

export const castOptionViewSchema = z.object({
  mode: word,
  payment: paymentSchema,
  castLevel: whole.optional(),
  suggested: z.boolean(),
  available: z.boolean(),
  warnings: z.array(z.object({ code: word, reasonRu: word })),
  hitPointCost: whole.optional(),
  extraMinutes: whole.optional(),
  damage: z.object({ formula: word, type: word }).optional(),
});

const pointSchema = z.object({ x: z.number(), y: z.number() });

const diagramFigureSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("circle"),
    at: pointSchema,
    radius: z.number(),
    dashed: z.boolean().optional(),
  }),
  z.object({
    kind: z.literal("line"),
    from: pointSchema,
    to: pointSchema,
    dashed: z.boolean().optional(),
  }),
  z.object({
    kind: z.literal("polyline"),
    points: z.array(pointSchema),
    closed: z.boolean().optional(),
    dashed: z.boolean().optional(),
  }),
  z.object({
    kind: z.literal("arc"),
    from: pointSchema,
    to: pointSchema,
    radius: z.number(),
    largeArc: z.boolean(),
    sweep: z.boolean(),
    dashed: z.boolean().optional(),
  }),
  z.object({ kind: z.literal("number"), at: pointSchema, size: z.number(), value: whole }),
]);

export const diagramViewSchema = z.object({
  side: z.number(),
  marks: z.array(z.object({ layer: word, figures: z.array(diagramFigureSchema) })),
  captionRu: word,
});

export const spellCardViewSchema = z.object({
  nameEn: word,
  school: word,
  fullRulesRu: word,
  higherLevelsRu: word.optional(),
  tacticalAdviceRu: word.optional(),
  targeting: z.object({ type: word, maximumTargets: whole.optional() }),
  successEffectRu: word.optional(),
  failureEffectRu: word.optional(),
  reaction: z.object({ textRu: word }).optional(),
  components: z.object({
    verbal: z.boolean(),
    somatic: z.boolean(),
    material: z.object({ textRu: word, consumed: z.boolean(), costGp: whole.optional() }).optional(),
  }),
  ritualDiagram: diagramViewSchema.optional(),
});

const lines = z.array(word);

export const listCardViewSchema = z.object({
  whereRu: word,
  costMaterialRu: word.optional(),
  effectLinesRu: lines.optional(),
  rollSubjectRu: word.optional(),
  rollNoteRu: word.optional(),
  hitLinesRu: lines.optional(),
  failLinesRu: lines.optional(),
  successLinesRu: lines.optional(),
  noteRu: word.optional(),
});

export const spellRowViewSchema = z.object({
  id: word,
  nameRu: word,
  shortRulesRu: word,
  level: whole,
  castingTime: z.object({ type: word, value: whole.optional() }),
  range: z.object({ type: word, distanceFeet: whole.optional() }),
  area: z.object({ shape: word, sizeFeet: whole }).optional(),
  duration: z.object({ type: word, value: whole.optional() }),
  resolution: z.object({ type: word, savingThrow: word.optional() }),
  concentration: z.boolean(),
  ritual: z.boolean(),
  cantrip: z.boolean(),
  spendsHitDice: z.boolean(),
  ownComponentRequired: z.boolean(),
  ownComponentCarried: z.boolean(),
  materialCoveredByFocus: z.boolean(),
  role: word,

  slotPrice: whole,
  benefitsFromHigherSlot: z.boolean(),
  ritualAvailable: z.boolean(),
  prepared: z.boolean(),
  castableNow: z.boolean(),
  unavailable: z.boolean(),
  unavailableReason: word.optional(),
  active: z.boolean(),
  damage: z.object({ formula: word, type: word }).optional(),
  armorClassIfCast: whole.optional(),

  castOptions: z.tuple([castOptionViewSchema], castOptionViewSchema),
  componentReminders: z.array(word),

  note: text.optional(),
  listCard: listCardViewSchema.optional(),
  card: spellCardViewSchema,
});

export const concentrationCheckViewSchema = z.object({
  dc: whole,
  modifier: whole,
  hasAdvantage: z.boolean(),
  minimumRoll: whole,
  outcome: word,
});

export const concentrationViewSchema = z.object({
  spellId: word.optional(),
  nameRu: word,
  slotLevelUsed: whole,
  startedOnRound: whole,
  startApproximate: z.boolean(),
  durationRu: word,
  shortRulesRu: word,
  damage: z.object({ formula: word, type: word }).optional(),
  save: whole,
  minimumDc: whole,
  checkAfterDamage: concentrationCheckViewSchema.optional(),
});

export const castingViewSchema = z.object({
  spellAttackModifier: whole,
  spellSaveDc: whole,
  spellcastingModifier: whole,
  preparedLimit: whole,
  preparedCount: whole,
  freeComponentsCovered: z.boolean().optional(),
});

export type ActiveEffectView = z.infer<typeof activeEffectViewSchema>;
export type ConcentrationCheckView = z.infer<typeof concentrationCheckViewSchema>;
export type ConcentrationView = z.infer<typeof concentrationViewSchema>;
export type ResourcesView = z.infer<typeof resourcesViewSchema>;
export type RecoveryView = z.infer<typeof recoveryViewSchema>;
export type TurnView = z.infer<typeof turnViewSchema>;
export type CastOptionView = z.infer<typeof castOptionViewSchema>;
export type DiagramFigure = z.infer<typeof diagramFigureSchema>;
export type DiagramView = z.infer<typeof diagramViewSchema>;
export type SpellCardView = z.infer<typeof spellCardViewSchema>;
export type ListCardView = z.infer<typeof listCardViewSchema>;
export type SpellRowView = z.infer<typeof spellRowViewSchema>;
export type CastingView = z.infer<typeof castingViewSchema>;
export type ItemView = z.infer<typeof itemViewSchema>;
export type MissingMaterialView = z.infer<typeof missingMaterialViewSchema>;
export type BagView = z.infer<typeof bagViewSchema>;
export type CraftingView = z.infer<typeof craftingViewSchema>;
export type IngredientKnowledgeView = z.infer<typeof ingredientKnowledgeViewSchema>;
export type StatChoiceView = z.infer<typeof statChoiceSchema>;
export type ChoicesView = z.infer<typeof choicesViewSchema>;
export type AbilityView = z.infer<typeof abilityViewSchema>;
export type SheetView = z.infer<typeof sheetViewSchema>;
