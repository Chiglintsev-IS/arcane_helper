import { z } from "zod";

import type { DeepReadonly } from "@/core/domain/shared/readonly";

import { GLYPH_IDS, SEAL_KINDS } from "@/core/domain/catalog/diagram/glyphs";
import { isRune } from "@/core/domain/catalog/diagram/futhark";
import { COMBAT_ROLES } from "@/core/domain/catalog/combatRole";
import { MAXIMUM_CHARACTER_LEVEL, MINIMUM_CHARACTER_LEVEL } from "@/core/domain/shared/levels";
import { nonEmpty } from "@/core/domain/shared/schema";
import { statContributionSchema } from "@/core/domain/shared/stats";

export const CANTRIP_LEVEL = 0;
export const MAXIMUM_SPELL_LEVEL = 9;

const LONG_CASTING_TYPES: readonly string[] = ["minute", "hour"];

const castingTimeSchema = z
  .object({
    type: z.enum(["action", "bonus_action", "reaction", "minute", "hour"]),
    value: z.number().int().positive().optional(),
    reactionTrigger: nonEmpty.optional(),
  })
  .refine((value) => value.type !== "reaction" || value.reactionTrigger !== undefined, {
    message: "Заклинание с временем накладывания «реакция» обязано описывать триггер",
    path: ["reactionTrigger"],
  })
  .refine(
    (value) =>
      !LONG_CASTING_TYPES.includes(value.type) || value.value !== undefined,
    {
      message: "Накладывание в минутах или часах обязано указывать число",
      path: ["value"],
    },
  )
  .refine(
    (value) =>
      LONG_CASTING_TYPES.includes(value.type) || value.value === undefined,
    {
      message: "Число ко времени накладывания «действие», «бонусное действие» и «реакция» не относится",
      path: ["value"],
    },
  );

const rangeSchema = z
  .object({
    type: z.enum(["self", "touch", "distance", "special"]),
    distanceFeet: z.number().int().positive().optional(),
  })
  .refine((value) => value.type !== "distance" || value.distanceFeet !== undefined, {
    message: "Дальность типа «distance» обязана указывать расстояние в футах",
    path: ["distanceFeet"],
  });

const areaSchema = z.object({
  shape: z.enum(["cone", "cube", "line", "sphere", "cylinder"]),
  sizeFeet: z.number().int().positive(),
});

const componentsSchema = z
  .object({
    verbal: z.boolean(),
    somatic: z.boolean(),
    material: z.boolean(),
    materialText: nonEmpty.optional(),
    costGp: z.number().int().positive().optional(),
    consumed: z.boolean().optional(),
  })
  .refine((value) => !value.material || value.materialText !== undefined, {
    message: "Материальный компонент обязан быть описан",
    path: ["materialText"],
  });

const COUNTED_DURATION_TYPES: readonly string[] = ["rounds", "minutes", "hours"];

const durationSchema = z
  .object({
    type: z.enum(["instant", "rounds", "minutes", "hours", "special"]),
    value: z.number().int().positive().optional(),
  })
  .refine(
    (duration) => !COUNTED_DURATION_TYPES.includes(duration.type) || duration.value !== undefined,
    {
      message: "Длительность в раундах, минутах или часах обязана указывать число",
      path: ["value"],
    },
  );

const targetingSchema = z.object({
  type: z.enum(["self", "creature", "creatures", "object", "point", "area"]),
  maximumTargets: z.number().int().positive().optional(),
});

const resolutionSchema = z
  .object({
    type: z.enum(["spell_attack", "saving_throw", "automatic"]),
    savingThrow: z.enum(["STR", "DEX", "CON", "INT", "WIS", "CHA"]).optional(),
    successEffect: nonEmpty.optional(),
    failureEffect: nonEmpty.optional(),
  })
  .refine((value) => value.type !== "saving_throw" || value.savingThrow !== undefined, {
    message: "Заклинание со спасброском обязано указывать характеристику спасброска",
    path: ["savingThrow"],
  });

const scalingSchema = z.record(
  z.coerce.number().int().nonnegative(),
  nonEmpty,
);

const damageSchema = z.object({
  dice: nonEmpty,
  type: nonEmpty,
  scaling: scalingSchema.optional(),
});

const spellContributionsSchema = z.array(statContributionSchema).default([]);

const hitDiceCostSchema = z.object({
  maximumDice: z.number().int().positive(),
  extraDicePerSlotLevel: z.number().int().nonnegative(),
  addsSpellcastingModifier: z.boolean(),
});

const diagramRadius = z.number().gt(0).max(1);

const glyphIdSchema = z.enum(GLYPH_IDS);

const magicSquareSchema = z.object({
  rows: z.array(z.array(z.number().int().positive()).length(3)).length(3),
  radius: diagramRadius,
});

const ritualDiagramSchema = z.object({
  rings: z.array(diagramRadius).min(2).max(4),
  tickRing: z.object({ count: z.union([z.literal(36), z.literal(72)]), radius: diagramRadius }).optional(),
  inscription: z
    .object({ runes: nonEmpty, meaningRu: nonEmpty, radius: diagramRadius })
    .optional(),
  star: z
    .object({
      points: z.number().int().min(5).max(12),
      skip: z.number().int().min(2),
      radius: diagramRadius,
    })
    .optional(),
  radialGlyphs: z.object({ glyphs: z.array(glyphIdSchema).min(3), radius: diagramRadius }).optional(),
  crossAxes: z.object({ count: z.number().int().min(2).max(8), radius: diagramRadius }).optional(),
  magicSquare: magicSquareSchema.optional(),
  centralSeal: z.object({ kind: z.enum(SEAL_KINDS), radius: diagramRadius }),
  cornerMarks: z.array(glyphIdSchema).length(4).optional(),
  captionRu: nonEmpty,
});

export type RitualDiagram = DeepReadonly<z.infer<typeof ritualDiagramSchema>>;

function isMagicSquare(rows: readonly (readonly number[])[]): boolean {
  const columns: number[][] = [];
  const main: number[] = [];
  const anti: number[] = [];

  for (const [rowIndex, row] of rows.entries()) {
    for (const [columnIndex, value] of row.entries()) {
      (columns[columnIndex] ??= []).push(value);
      if (rowIndex === columnIndex) main.push(value);
      if (rowIndex + columnIndex === rows.length - 1) anti.push(value);
    }
  }

  const sums = [...rows, ...columns, main, anti].map((line) =>
    line.reduce((sum, value) => sum + value, 0),
  );
  return sums.every((sum) => sum === sums[0]);
}

type DiagramIssue = { path: (string | number)[]; message: string };

function ritualDiagramIssues(diagram: RitualDiagram): DiagramIssue[] {
  const issues: DiagramIssue[] = [];
  const issue = (message: string, where: (string | number)[]): void => {
    issues.push({ message, path: where });
  };

  if (diagram.rings[0] !== 1) {
    issue("Внешнее кольцо равно 1: схема рисуется от обвода", ["rings", 0]);
  }
  let outer: number | undefined;
  for (const [index, radius] of diagram.rings.entries()) {
    if (outer !== undefined && radius >= outer) {
      issue("Кольца перечисляются снаружи внутрь и строго убывают", ["rings", index]);
    }
    outer = radius;
  }

  if (diagram.star !== undefined && diagram.star.skip >= diagram.star.points / 2) {
    issue(
      `Шаг звезды ${diagram.star.skip} при ${diagram.star.points} вершинах повторяет уже нарисованное`,
      ["star", "skip"],
    );
  }

  if (
    diagram.star !== undefined &&
    diagram.radialGlyphs !== undefined &&
    diagram.radialGlyphs.radius === diagram.star.radius &&
    diagram.radialGlyphs.glyphs.length !== diagram.star.points
  ) {
    issue("Знаки стоят на вершинах звезды: их число равно числу вершин", ["radialGlyphs", "glyphs"]);
  }

  if (diagram.inscription !== undefined) {
    for (const char of diagram.inscription.runes) {
      if (!isRune(char)) {
        issue(`«${char}» — не руна старшего футарка`, ["inscription", "runes"]);
        break;
      }
    }
  }

  if (diagram.magicSquare !== undefined) {
    if (!isMagicSquare(diagram.magicSquare.rows)) {
      issue("Квадрат не магический: суммы строк, столбцов и диагоналей расходятся", [
        "magicSquare",
        "rows",
      ]);
    }
    if (diagram.centralSeal.radius > diagram.magicSquare.radius / 2) {
      issue("Печать не помещается в центральную клетку квадрата", ["centralSeal", "radius"]);
    }
  }

  return issues;
}

export const DAMAGE_PLACEHOLDER = "{damage}";

const lines = z.array(nonEmpty).min(1);

const listCardSchema = z.object({
  whereRu: nonEmpty,
  costMaterialRu: nonEmpty.optional(),
  effectLinesRu: lines.optional(),
  rollSubjectRu: nonEmpty.optional(),
  rollNoteRu: nonEmpty.optional(),
  hitLinesRu: lines.optional(),
  failLinesRu: lines.optional(),
  successLinesRu: lines.optional(),
  noteRu: nonEmpty.optional(),
});

export type ListCard = DeepReadonly<z.infer<typeof listCardSchema>>;

const spellShape = z.object({
  id: nonEmpty,

  nameRu: nonEmpty,
  nameEn: nonEmpty,

  level: z.number().int().min(CANTRIP_LEVEL).max(MAXIMUM_SPELL_LEVEL),
  school: nonEmpty,
  source: nonEmpty.optional(),

  combatRole: z.enum(COMBAT_ROLES).optional(),

  castingTime: castingTimeSchema,
  range: rangeSchema,
  area: areaSchema.optional(),
  components: componentsSchema,
  duration: durationSchema,

  concentration: z.boolean(),
  ritual: z.boolean(),

  targeting: targetingSchema,
  resolution: resolutionSchema,
  damage: damageSchema.optional(),
  contributions: spellContributionsSchema,
  hitDiceCost: hitDiceCostSchema.optional(),

  repeatableAction: z
    .object({ label: nonEmpty, description: nonEmpty })
    .optional(),

  shortRulesRu: nonEmpty,
  fullRulesRu: nonEmpty,
  higherLevelsRu: nonEmpty.optional(),
  tacticalAdviceRu: nonEmpty.optional(),

  listCard: listCardSchema.optional(),
  ritualDiagram: ritualDiagramSchema.optional(),
});

type ListCardIssue = { path: string[]; message: string };

function listCardIssues(spell: z.infer<typeof spellShape>): ListCardIssue[] {
  const card = spell.listCard;
  if (card === undefined) return [];
  const issues: ListCardIssue[] = [];
  const kind = spell.resolution.type;

  if (kind !== "saving_throw" && (card.rollSubjectRu !== undefined || card.failLinesRu !== undefined || card.successLinesRu !== undefined)) {
    issues.push({ path: ["rollSubjectRu"], message: "Бросающий и исходы спасброска есть только у заклинания со спасброском" });
  }
  if (kind === "saving_throw" && card.rollSubjectRu === undefined) {
    issues.push({ path: ["rollSubjectRu"], message: "Заклинание со спасброском называет, кто его бросает" });
  }
  if (kind !== "spell_attack" && card.hitLinesRu !== undefined) {
    issues.push({ path: ["hitLinesRu"], message: "Исход попадания есть только у атаки заклинанием" });
  }
  if (card.costMaterialRu !== undefined && spell.components.costGp === undefined) {
    issues.push({ path: ["costMaterialRu"], message: "Материал в цене называется только у компонента со стоимостью" });
  }

  const texts = [card.whereRu, card.noteRu ?? "", card.rollNoteRu ?? "", ...(card.effectLinesRu ?? []), ...(card.hitLinesRu ?? []), ...(card.failLinesRu ?? []), ...(card.successLinesRu ?? [])];
  const usesPlaceholder = texts.some((text) => text.includes(DAMAGE_PLACEHOLDER));
  if (usesPlaceholder && spell.damage === undefined) {
    issues.push({ path: [], message: "Подстановка урона стоит в строке заклинания, которое урона не несёт" });
  }
  const damageOutcome = kind === "spell_attack" ? card.hitLinesRu : kind === "saving_throw" ? card.failLinesRu : undefined;
  if (spell.damage !== undefined && damageOutcome !== undefined && !damageOutcome.some((line) => line.includes(DAMAGE_PLACEHOLDER))) {
    issues.push({ path: [kind === "spell_attack" ? "hitLinesRu" : "failLinesRu"], message: "Урон в исходе пишется подстановкой, а не числом" });
  }
  return issues;
}

export const spellSchema = spellShape.superRefine((spell, context) => {
  for (const issue of listCardIssues(spell)) {
    context.addIssue({ code: "custom", path: ["listCard", ...issue.path], message: issue.message });
  }

  for (const [index, contribution] of spell.contributions.entries()) {
    if (contribution.kind === "method" || contribution.value > 0) continue;
    context.addIssue({
      code: "custom",
      path: ["contributions", index],
      message: `«${spell.nameRu}»: вклад заклинания в величину не бывает нулевым или отрицательным`,
    });
  }

  if (spell.ritual && spell.ritualDiagram === undefined) {
    context.addIssue({
      code: "custom",
      path: ["ritualDiagram"],
      message: "Ритуальное заклинание обязано иметь схему ритуала",
    });
  }
  if (!spell.ritual && spell.ritualDiagram !== undefined) {
    context.addIssue({
      code: "custom",
      path: ["ritualDiagram"],
      message: "Схема ритуала есть только у ритуального заклинания",
    });
  }
  if (spell.ritualDiagram !== undefined) {
    for (const issue of ritualDiagramIssues(spell.ritualDiagram)) {
      context.addIssue({
        code: "custom",
        path: ["ritualDiagram", ...issue.path],
        message: issue.message,
      });
    }
  }

  if (spell.level === CANTRIP_LEVEL && spell.ritual) {
    context.addIssue({
      code: "custom",
      path: ["ritual"],
      message: "Заговор не может быть ритуальным",
    });
  }

  if (spell.damage?.scaling !== undefined) {
    const thresholds = Object.keys(spell.damage.scaling).map(Number);
    if (spell.level === CANTRIP_LEVEL) {
      for (const threshold of thresholds) {
        if (threshold < MINIMUM_CHARACTER_LEVEL || threshold > MAXIMUM_CHARACTER_LEVEL) {
          context.addIssue({
            code: "custom",
            path: ["damage", "scaling", String(threshold)],
            message: `Порог уровня персонажа должен быть от ${MINIMUM_CHARACTER_LEVEL} до ${MAXIMUM_CHARACTER_LEVEL}`,
          });
        }
      }
    } else {
      for (const threshold of thresholds) {
        if (threshold < spell.level || threshold > MAXIMUM_SPELL_LEVEL) {
          context.addIssue({
            code: "custom",
            path: ["damage", "scaling", String(threshold)],
            message: `Уровень ячейки ${threshold} вне диапазона ${spell.level}…${MAXIMUM_SPELL_LEVEL}`,
          });
        }
      }
    }
  }
});

export type Spell = DeepReadonly<z.infer<typeof spellSchema>>;

export function needsOwnComponent(components: Spell["components"]): boolean {
  return components.material && (components.costGp !== undefined || components.consumed === true);
}
