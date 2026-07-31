/**
 * Ограничения кампании (F-14): что Торну недоступно и почему.
 *
 * Запрет — данные, а не отсутствие записи. Заклинание, которого просто нет в контенте, через месяц
 * выглядит пробелом, и кто-нибудь добросовестно его «починит»; заклинание с записанной причиной —
 * решение, которое видно ([FR-160](../../docs/features/F-14-campaign-restrictions.md#fr-160)).
 *
 * Две категории живут по-разному. Вред виду выводится из данных: тип урона «огонь» подавляет обе
 * расовые особенности тролля, и перечислять всю огненную школу руками нельзя — пропущенное
 * заклинание было бы ошибкой в пользу опасного выбора. Запрет мастера из данных не выводится: «ломает
 * мир» — суждение о кампании, и такие заклинания перечисляются поимённо.
 */

import type { Spell } from "@/data/schemas/spell";

export type BanCategory = "harmful_to_species" | "dungeon_master";

export type BannedSpell = {
  nameRu: string;
  nameEn: string;
  reason: BanCategory;
  explanationRu: string;
};

/** Нормализация запроса: регистр и «ё» за столом набирают как придётся. */
function normalize(text: string): string {
  return text.trim().toLowerCase().replaceAll("ё", "е");
}

/**
 * Запрет, подходящий под поисковый запрос, — по русскому или английскому названию (FR-162).
 *
 * Совпадение по подстроке, а не точное: игрок ищет «понимание», а не «Понимание языков». Пустой
 * запрос не находит ничего: иначе причина запрета всплывала бы на пустом поле.
 */
export function findBan(
  query: string,
  banned: readonly BannedSpell[],
): BannedSpell | null {
  const needle = normalize(query);
  if (needle === "") return null;
  return (
    banned.find(
      (ban) =>
        normalize(ban.nameRu).includes(needle) || normalize(ban.nameEn).includes(needle),
    ) ?? null
  );
}

/** Подходит ли заклинание под поиск по названию: русскому или английскому. */
export function matchesQuery(spell: Spell, query: string): boolean {
  const needle = normalize(query);
  if (needle === "") return true;
  return (
    normalize(spell.nameRu).includes(needle) || normalize(spell.nameEn).includes(needle)
  );
}
