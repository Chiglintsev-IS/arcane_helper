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
import type { BannedSpell } from "@/core/domain/spellbook/restrictions";

import absorbElements from "./spells/absorb-elements.json";
import arcaneVigor from "./spells/arcane-vigor.json";
import blink from "./spells/blink.json";
import counterspell from "./spells/counterspell.json";
import detectMagic from "./spells/detect-magic.json";
import dimensionDoor from "./spells/dimension-door.json";
import disguiseSelf from "./spells/disguise-self.json";
import dispelMagic from "./spells/dispel-magic.json";
import featherFall from "./spells/feather-fall.json";
import findFamiliar from "./spells/find-familiar.json";
import fly from "./spells/fly.json";
import hypnoticPattern from "./spells/hypnotic-pattern.json";
import identify from "./spells/identify.json";
import invisibility from "./spells/invisibility.json";
import lightningBolt from "./spells/lightning-bolt.json";
import mageArmor from "./spells/mage-armor.json";
import mending from "./spells/mending.json";
import message from "./spells/message.json";
import mirrorImage from "./spells/mirror-image.json";
import mistyStep from "./spells/misty-step.json";
import polymorph from "./spells/polymorph.json";
import rayOfFrost from "./spells/ray-of-frost.json";
import rimesBindingIce from "./spells/rimes-binding-ice.json";
import shield from "./spells/shield.json";
import shockingGrasp from "./spells/shocking-grasp.json";
import tashasMindWhip from "./spells/tashas-mind-whip.json";
import unseenServant from "./spells/unseen-servant.json";
import vortexWarp from "./spells/vortex-warp.json";
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
  disguiseSelf,
  findFamiliar,
  detectMagic,
  identify,
  unseenServant,

  mistyStep,
  mirrorImage,
  arcaneVigor,
  web,
  invisibility,
  rimesBindingIce,
  vortexWarp,
  tashasMindWhip,

  counterspell,
  dispelMagic,
  hypnoticPattern,
  lightningBolt,
  blink,
  fly,

  polymorph,
  dimensionDoor,
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
    const result = spellSchema.safeParse(raw);
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
 * Причина, по которой заклинание недоступно Торну.
 *
 * Тип живёт в движке правил: реестр — данные конкретного персонажа, а понятие запрета общее.
 */

/**
 * Реестр запретов. Огонь определяется по типу урона в данных заклинания и здесь не перечисляется
 *; поимённо перечисляется только
 * то, что нельзя вывести из данных.
 */
export const BANNED_SPELLS: readonly BannedSpell[] = [
  {
    nameRu: "Понимание языков",
    nameEn: "Comprehend Languages",
    reason: "dungeon_master",
    explanationRu:
      "Запрещено мастером: свободный перевод любых языков обесценивает исследование и тайны кампании.",
  },
];

/** Типы урона, вредные виду персонажа: заклинание с таким уроном запрещено без записи в реестре. */
export const HARMFUL_DAMAGE_TYPES: readonly string[] = ["огонь"];
