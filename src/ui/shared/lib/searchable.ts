function searchable(value: string): string {
  return value.trim().toLocaleLowerCase("ru").replaceAll("ё", "е");
}

export function matchesQuery(text: string, query: string): boolean {
  const sought = searchable(query);
  return sought === "" || searchable(text).includes(sought);
}
