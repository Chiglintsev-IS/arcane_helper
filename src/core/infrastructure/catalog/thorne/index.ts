/**
 * Контент Торна: заклинания и запреты.
 *
 * Каждая карточка проходит ту же Zod-схему, что и пользовательский импорт, поэтому ошибка
 * в JSON обнаруживается в CI, а не за игровым столом.
 *
 * Это встроенный каталог: он действует, пока игрок не загрузил свой файл. Каталог здесь не
 * константа модуля, а функция, потому что владеет им стор сессии — контент подставляется ему
 * зависимостью и заменяется целиком.
 */

import { spellSchema, type Spell } from "@/core/domain/catalog/spell";
import { parsedBySchema } from "@/core/domain/shared/schema";
import type { BannedSpell } from "@/core/domain/spellbook/restrictions";

import absorbElements from "./spells/absorb-elements.json";
import arcaneVigor from "./spells/arcane-vigor.json";
import counterspell from "./spells/counterspell.json";
import detectMagic from "./spells/detect-magic.json";
import dispelMagic from "./spells/dispel-magic.json";
import enlargeReduce from "./spells/enlarge-reduce.json";
import featherFall from "./spells/feather-fall.json";
import findFamiliar from "./spells/find-familiar.json";
import haste from "./spells/haste.json";
import iceStorm from "./spells/ice-storm.json";
import intellectFortress from "./spells/intellect-fortress.json";
import lightningBolt from "./spells/lightning-bolt.json";
import mageArmor from "./spells/mage-armor.json";
import magicMissile from "./spells/magic-missile.json";
import mending from "./spells/mending.json";
import message from "./spells/message.json";
import mirrorImage from "./spells/mirror-image.json";
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
import web from "./spells/web.json";

/** Сырые карточки в порядке уровня, затем по алфавиту. Импорты явные: каталог сам себя не соберёт. */
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
  findFamiliar,
  detectMagic,

  mirrorImage,
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

  polymorph,
  stormSphere,
  iceStorm,
];

export class ContentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ContentError";
  }
}

/**
 * Разбирает и проверяет карточки. Ошибка в одной — ошибка всего контента: частично загруженная
 * книга заклинаний хуже, чем явный отказ.
 *
 * Список принимается параметром, чтобы проверки отказа можно было испытать на битых данных:
 * иначе защитные ветви существуют, но никогда не исполняются, и их поведение неизвестно.
 */
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

/**
 * Встроенный каталог целиком: реализация зависимости `loadBuiltInCatalog` стора сессии.
 *
 * В хранилище эти карточки не попадают: их
 * копия заморозила бы книгу на дате установки, и заклинание, добавленное следующей сборкой, не
 * появилось бы у игрока никогда.
 */
export function loadThorneSpells(): Spell[] {
  return parseSpells(RAW_SPELLS);
}

/**
 * Реестр запретов. Огонь определяется по типу урона в данных заклинания и здесь не перечисляется;
 * поимённо перечисляется только то, что нельзя вывести из данных.
 *
 * Категория допуска запретом не является: заклинание, на которое у Торна есть личное разрешение,
 * остаётся в книге. Здесь стоит лишь то, чего нет в мире, что мир запретил без исключений и что
 * назвал мастер.
 */
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

/** Типы урона, вредные виду персонажа: заклинание с таким уроном запрещено без записи в реестре. */
export const HARMFUL_DAMAGE_TYPES: readonly string[] = ["огонь"];
