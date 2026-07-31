/**
 * Контент Торна: заклинания и запреты.
 *
 * Каждая карточка проходит ту же Zod-схему, что и пользовательский импорт (ADR-0004), поэтому ошибка
 * в JSON обнаруживается в CI, а не за игровым столом. Состав первой партии — docs/content.md.
 */

import { spellSchema, type Spell } from "@/data/schemas/spell";

import absorbElements from "./spells/absorb-elements.json";
import detectMagic from "./spells/detect-magic.json";
import disguiseSelf from "./spells/disguise-self.json";
import findFamiliar from "./spells/find-familiar.json";
import identify from "./spells/identify.json";
import mageArmor from "./spells/mage-armor.json";
import mending from "./spells/mending.json";
import message from "./spells/message.json";
import rayOfFrost from "./spells/ray-of-frost.json";
import shield from "./spells/shield.json";
import shockingGrasp from "./spells/shocking-grasp.json";
import unseenServant from "./spells/unseen-servant.json";

/** Сырые карточки в порядке уровня, затем по алфавиту. Импорты явные: каталог сам себя не соберёт. */
const RAW_SPELLS: readonly unknown[] = [
  shockingGrasp,
  rayOfFrost,
  message,
  mending,
  shield,
  absorbElements,
  mageArmor,
  disguiseSelf,
  findFamiliar,
  detectMagic,
  identify,
  unseenServant,
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

/** Контент Торна целиком. */
export function loadThorneSpells(): Spell[] {
  return parseSpells(RAW_SPELLS);
}

/** Причина, по которой заклинание недоступно Торну (F-14). */
export type BanReason = "harmful_to_species" | "dungeon_master";

export type BannedSpell = {
  nameRu: string;
  nameEn: string;
  reason: BanReason;
  explanationRu: string;
};

/**
 * Реестр запретов. Огонь определяется по типу урона в данных заклинания и здесь не перечисляется
 * ([FR-160](../../../../docs/features/F-14-campaign-restrictions.md)); поимённо перечисляется только
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
