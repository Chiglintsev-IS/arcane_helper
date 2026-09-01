import { ALCHEMY_DIRECTIONS, type AlchemyDirection } from "@/core/domain/catalog/alchemy";

/**
 * Направление, закрытое решением стола: приложение по нему не считает сложность и не выпускает
 * партию. Причина стоит рядом с запретом — отказ обязан назвать её словами, а не гасить кнопку.
 *
 * Закрыто именно ремесло, а не перечень свойств: свойства синтеза ядов остаются, ими описывают
 * вредное действие найденного ингредиента, и без них не работает очистка состава.
 */
const CLOSED_DIRECTIONS: Readonly<Partial<Record<AlchemyDirection, string>>> = {
  poisons: "Направление закрыто контрактом с фамильяром: этой рукой ядов не варят",
};

function closedDirectionReason(direction: AlchemyDirection): string | undefined {
  return CLOSED_DIRECTIONS[direction];
}

export function closedRefusal(directions: readonly AlchemyDirection[]): string | undefined {
  for (const direction of directions) {
    const reasonRu = closedDirectionReason(direction);
    if (reasonRu !== undefined) return reasonRu;
  }
  return undefined;
}

export function closedDirections(): readonly { direction: AlchemyDirection; reasonRu: string }[] {
  return ALCHEMY_DIRECTIONS.flatMap((direction) => {
    const reasonRu = closedDirectionReason(direction);
    return reasonRu === undefined ? [] : [{ direction, reasonRu }];
  });
}
