/**
 * Ограничения кампании (F-14): что Торну недоступно и почему.
 *
 * Запрет — данные, а не отсутствие записи. Заклинание, которого просто нет в контенте, через месяц
 * выглядит пробелом, и кто-нибудь добросовестно его «починит»; заклинание с записанной причиной —
 * решение, которое видно.
 *
 * Две категории живут по-разному. Вред виду выводится из данных: тип урона «огонь» подавляет обе
 * расовые особенности тролля, и перечислять всю огненную школу руками нельзя — пропущенное
 * заклинание было бы ошибкой в пользу опасного выбора. Запрет мастера из данных не выводится: «ломает
 * мир» — суждение о кампании, и такие заклинания перечисляются поимённо.
 */

import type { Spell } from "@/core/domain/catalog/spell";

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
 * Подходит ли строка под поиск по названию: русскому или английскому.
 *
 * Принимает не только заклинание, а любую именованную строку: «Магия крови» в списке «Книги» —
 * не заклинание, но стоит среди них и обязана отвечать на тот же поиск,
 * иначе список для несовпавшего запроса показывал бы то, что явно не подошло.
 */
export function matchesQuery(spell: Pick<Spell, "nameRu" | "nameEn">, query: string): boolean {
  const needle = normalize(query);
  if (needle === "") return true;
  return (
    normalize(spell.nameRu).includes(needle) || normalize(spell.nameEn).includes(needle)
  );
}
