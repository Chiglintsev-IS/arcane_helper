/**
 * Отыгрыш: готовые варианты карточки и пометки игрока на них.
 *
 * Игрового состояния не меняет, поэтому журнала не касается и отмене не подлежит: журнал — механизм
 * возврата ресурсов, а не история правок текста.
 */

import { Character } from "@/core/domain/assembly/character";
import type { CharacterState } from "@/core/domain/assembly/state";
import type { RoleplayPreference } from "@/core/domain/spellbook/schema";
import type { Spell } from "@/core/domain/catalog/spell";
import { ROLEPLAY_CATEGORIES, type RoleplayCategory } from "@/core/domain/catalog/roleplay";
import { DomainError } from "@/core/domain/shared/errors";
import { withoutRecord, type Clock, type Session } from "@/core/application/session";

export { ROLEPLAY_CATEGORIES };
export type { RoleplayCategory };

export type RoleplayVariant = {
  id: string;
  text: string;
  category: RoleplayCategory;
  /** Написан игроком: идёт первым в своей категории. */
  own: boolean;
  favorite: boolean;
  disabled: boolean;
  usedTimes: number;
};

/**
 * Идентификатор готового варианта — категория и место в карточке.
 *
 * Не сам текст: правка опечатки стирала бы и «любимое», и счётчик ротации. Обратная сторона
 * честная — перестановка вариантов в карточке оставит пометки на местах, а не на текстах.
 */
export function roleplayVariantId(category: RoleplayCategory, index: number): string {
  return `${category}-${index}`;
}

/**
 * Место варианта в списке: свои, любимые, остальные, отключённые.
 *
 * Счётчик использований сюда не входит намеренно: сортируй список по нему — и он пересобирался бы
 * под пальцем ровно тогда, когда игрок в него целится.
 */
function roleplayRank(variant: RoleplayVariant): number {
  if (variant.disabled) return 3;
  if (variant.own) return 0;
  return variant.favorite ? 1 : 2;
}

/** Варианты категории в порядке показа, включая отключённые. */
export function roleplayVariants(
  character: CharacterState,
  spell: Spell,
  category: RoleplayCategory,
): RoleplayVariant[] {
  const preference = Character.of(character).spellbook.preferencesFor(spell.id);
  const describe = (id: string, text: string, own: boolean): RoleplayVariant => ({
    id,
    text,
    category,
    own,
    favorite: preference.favoriteVariantIds.includes(id),
    disabled: preference.disabledVariantIds.includes(id),
    usedTimes: preference.usageCount[id] ?? 0,
  });

  const variants = [
    ...preference.customVariants
      .filter((custom) => custom.category === category)
      .map((custom) => describe(custom.id, custom.text, true)),
    ...spell.roleplay.completeVariants[category].map((text, index) =>
      describe(roleplayVariantId(category, index), text, false),
    ),
  ];
  // Сортировка устойчива, поэтому внутри группы сохраняется порядок карточки.
  return variants.sort((left, right) => roleplayRank(left) - roleplayRank(right));
}

/** Категории, в которых остался хоть один включённый вариант. */
export function roleplayCategories(character: CharacterState, spell: Spell): RoleplayCategory[] {
  return ROLEPLAY_CATEGORIES.filter((category) =>
    roleplayVariants(character, spell, category).some((variant) => !variant.disabled),
  );
}

/**
 * Что показать в категории при открытии: реже других использованный вариант.
 *
 * При равенстве счётчиков берётся первый по порядку показа. `undefined` значит, что в категории не
 * осталось включённых вариантов.
 */
export function defaultRoleplayVariant(
  character: CharacterState,
  spell: Spell,
  category: RoleplayCategory,
): RoleplayVariant | undefined {
  const enabled = roleplayVariants(character, spell, category).filter(
    (variant) => !variant.disabled,
  );
  return enabled.reduce<RoleplayVariant | undefined>(
    (rarest, variant) =>
      rarest === undefined || variant.usedTimes < rarest.usedTimes ? variant : rarest,
    undefined,
  );
}

function change(
  session: Session,
  spellId: string,
  edit: (current: RoleplayPreference) => RoleplayPreference,
): Session {
  const root = Character.of(session.character);
  return withoutRecord(session, root.withSpellbook(root.spellbook.changePreferences(spellId, edit)));
}

function toggledId(ids: string[], id: string): string[] {
  return ids.includes(id) ? ids.filter((candidate) => candidate !== id) : [...ids, id];
}

/** «Любимое» ставится и снимается одним нажатием. */
export function toggleRoleplayFavorite(
  session: Session,
  spellId: string,
  variantId: string,
): Session {
  return change(session, spellId, (current) => ({
    ...current,
    favoriteVariantIds: toggledId(current.favoriteVariantIds, variantId),
  }));
}

/**
 * Отключение нежелательного варианта и возврат его обратно.
 *
 * Отключить все варианты категории можно — тогда категория скрывается. Все категории скрыть нельзя:
 * шаг отыгрыша остался бы пустым экраном, а нажатие, которое ничего не сделало и ничего не сказало,
 * читается как поломка.
 */
export function toggleRoleplayDisabled(session: Session, spell: Spell, variantId: string): Session {
  const disabling = !Character.of(session.character)
    .spellbook.preferencesFor(spell.id)
    .disabledVariantIds.includes(variantId);

  const next = change(session, spell.id, (current) => ({
    ...current,
    disabledVariantIds: toggledId(current.disabledVariantIds, variantId),
  }));

  if (disabling && roleplayCategories(next.character, spell).length === 0) {
    throw new DomainError(
      "Последний вариант отыгрыша: хотя бы одна категория должна остаться доступной",
    );
  }
  return next;
}

/** Собственный вариант отыгрыша. Хранится рядом с готовыми и ведёт себя как они. */
export function addRoleplayVariant(
  session: Session,
  spellId: string,
  category: RoleplayCategory,
  text: string,
  clock: Clock,
): Session {
  const trimmed = text.trim();
  if (trimmed === "") {
    throw new DomainError("Свой вариант отыгрыша не может быть пустым");
  }
  return change(session, spellId, (current) => ({
    ...current,
    customVariants: [...current.customVariants, { id: clock.nextId(), category, text: trimmed }],
  }));
}

/**
 * Отметка использования: счётчик ротации.
 *
 * Растёт и от выбора варианта, и от копирования — оба жеста значат «беру этот текст». Различать их
 * незачем: счётчик решает, что показать в следующий раз, а не ведёт статистику.
 */
export function useRoleplayVariant(session: Session, spellId: string, variantId: string): Session {
  return change(session, spellId, (current) => ({
    ...current,
    usageCount: { ...current.usageCount, [variantId]: (current.usageCount[variantId] ?? 0) + 1 },
  }));
}
