/**
 * Художественный слой карточки: категории готовых вариантов отыгрыша.
 *
 * Живёт в каталоге, потому что это свойство карточки, а не выбор игрока. На механику не влияет.
 */

/** Порядок показа категорий. */
export const ROLEPLAY_CATEGORIES = ["short", "atmospheric", "sarcastic"] as const;

export type RoleplayCategory = (typeof ROLEPLAY_CATEGORIES)[number];
