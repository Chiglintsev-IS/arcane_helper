/**
 * Совпадение набранного с написанным.
 *
 * Набирают на телефоне и в спешке: регистр не различается, а «ё» лежит под удержанием клавиши «е» и
 * почти никогда не набирается — «полет» обязан находить «Полёт», иначе поиск отвечает пустым списком
 * на верно названное слово.
 *
 * Совпадением считается любая часть, а не начало: искомое слово чаще стоит в середине записи, чем в
 * её первых буквах.
 */
function searchable(value: string): string {
  return value.trim().toLocaleLowerCase("ru").replaceAll("ё", "е");
}

/** Пустой запрос совпадает со всем: это пустая категория отбора, а не отказ. */
export function matchesQuery(text: string, query: string): boolean {
  const sought = searchable(query);
  return sought === "" || searchable(text).includes(sought);
}
