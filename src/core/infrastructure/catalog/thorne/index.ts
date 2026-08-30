import { spellSchema, type Spell } from "@/core/domain/catalog/spell";
import { parsedBySchema } from "@/core/domain/shared/schema";
import type { BannedSpell } from "@/core/domain/spellbook/restrictions";

import absorbElements from "./spells/absorb-elements.json";
import alarm from "./spells/alarm.json";
import arcaneLock from "./spells/arcane-lock.json";
import arcaneVigor from "./spells/arcane-vigor.json";
import catapult from "./spells/catapult.json";
import counterspell from "./spells/counterspell.json";
import detectMagic from "./spells/detect-magic.json";
import dispelMagic from "./spells/dispel-magic.json";
import enlargeReduce from "./spells/enlarge-reduce.json";
import featherFall from "./spells/feather-fall.json";
import haste from "./spells/haste.json";
import iceStorm from "./spells/ice-storm.json";
import intellectFortress from "./spells/intellect-fortress.json";
import lightningBolt from "./spells/lightning-bolt.json";
import mageArmor from "./spells/mage-armor.json";
import magicMissile from "./spells/magic-missile.json";
import mending from "./spells/mending.json";
import message from "./spells/message.json";
import polymorph from "./spells/polymorph.json";
import rayOfFrost from "./spells/ray-of-frost.json";
import rimesBindingIce from "./spells/rimes-binding-ice.json";
import seeInvisibility from "./spells/see-invisibility.json";
import shield from "./spells/shield.json";
import shockingGrasp from "./spells/shocking-grasp.json";
import sleetStorm from "./spells/sleet-storm.json";
import slow from "./spells/slow.json";
import spiderClimb from "./spells/spider-climb.json";
import stormSphere from "./spells/storm-sphere.json";
import tashasMindWhip from "./spells/tashas-mind-whip.json";
import thunderStep from "./spells/thunder-step.json";
import tidalWave from "./spells/tidal-wave.json";
import vitriolicSphere from "./spells/vitriolic-sphere.json";
import web from "./spells/web.json";

const RAW_SPELLS: readonly unknown[] = [
  shockingGrasp,
  rayOfFrost,
  message,
  mending,

  shield,
  absorbElements,
  featherFall,
  mageArmor,
  magicMissile,
  catapult,
  alarm,
  detectMagic,

  arcaneLock,
  arcaneVigor,
  web,
  rimesBindingIce,
  tashasMindWhip,
  spiderClimb,
  enlargeReduce,
  seeInvisibility,

  counterspell,
  dispelMagic,
  lightningBolt,
  slow,
  thunderStep,
  haste,
  sleetStorm,
  intellectFortress,
  tidalWave,

  polymorph,
  stormSphere,
  iceStorm,
  vitriolicSphere,
];

export class ContentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ContentError";
  }
}

export function parseSpells(rawSpells: readonly unknown[]): Spell[] {
  const spells: Spell[] = [];
  const seen = new Set<string>();

  for (const [index, raw] of rawSpells.entries()) {
    const result = parsedBySchema(spellSchema, raw);
    if (!result.success) {
      const where = result.error.issues
        .map((issue) => `${issue.path.join(".") || "—"}: ${issue.message}`)
        .join("; ");
      throw new ContentError(`Карточка №${index + 1} не прошла проверку — ${where}`);
    }
    if (seen.has(result.data.id)) {
      throw new ContentError(`Идентификатор «${result.data.id}» встречается дважды`);
    }
    seen.add(result.data.id);
    spells.push(result.data);
  }

  return spells;
}

export function loadThorneSpells(): Spell[] {
  return parseSpells(RAW_SPELLS);
}

export const BANNED_SPELLS: readonly BannedSpell[] = [
  {
    nameRu: "Понимание языков",
    nameEn: "Comprehend Languages",
    reason: "dungeon_master",
    explanationRu:
      "Заклинания нет в мире: свободный перевод любых языков обесценивает исследование и тайны кампании.",
  },
  {
    nameRu: "Гипнотический узор",
    nameEn: "Hypnotic Pattern",
    reason: "dungeon_master",
    explanationRu:
      "Запрещено к применению без исключений: наказывается и само знание, поэтому запись отдана в обмен, а не оставлена без подготовки.",
  },
  {
    nameRu: "Мерцание",
    nameEn: "Blink",
    reason: "dungeon_master",
    explanationRu: "Заклинания нет в мире: мерцать некуда, иных планов не существует.",
  },
  {
    nameRu: "Поиск фамильяра",
    nameEn: "Find Familiar",
    reason: "dungeon_master",
    explanationRu:
      "Не срабатывает: фамильяр — дух в облике зверя, а призывать в этом мире неоткуда, иных планов нет.",
  },
  {
    nameRu: "Полёт",
    nameEn: "Fly",
    reason: "dungeon_master",
    explanationRu:
      "Заклинания нет в мире; сверх того полёт над поселениями запрещён отдельно от списков.",
  },
  {
    nameRu: "Воображаемый убийца",
    nameEn: "Phantasmal Killer",
    reason: "dungeon_master",
    explanationRu: "Запрещено решением мастера, хотя в списках мира не названо.",
  },
  {
    nameRu: "Левитация",
    nameEn: "Levitate",
    reason: "dungeon_master",
    explanationRu:
      "Запрещено решением мастера: подъём над землёй читается как полёт, а он в поселениях недопустим.",
  },
  {
    nameRu: "Психическое копьё Раулотима",
    nameEn: "Raulothim's Psychic Lance",
    reason: "dungeon_master",
    explanationRu: "Запрещено решением мастера: удар по названному имени бьёт цель, которую не видят.",
  },
  {
    nameRu: "Тензеров парящий диск",
    nameEn: "Tenser's Floating Disk",
    reason: "dungeon_master",
    explanationRu: "Запрещено решением мастера, хотя в списках мира не названо.",
  },
  {
    nameRu: "Расщепление разума",
    nameEn: "Mind Sliver",
    reason: "dungeon_master",
    explanationRu: "Запрещено решением мастера: магия разума в этом мире под особым надзором.",
  },
];

export const HARMFUL_DAMAGE_TYPES: readonly string[] = ["огонь"];
