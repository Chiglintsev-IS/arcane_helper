/**
 * Реакции по триггерам (F-05).
 *
 * Реакция срабатывает в чужой ход, когда игрок слушает мастера, а не смотрит в приложение. Поэтому
 * вход в неё начинается не со списка заклинаний, а с вопроса «что произошло»: в этот момент игрок
 * думает о событии, а название заклинания вспоминает вторым ([FR-060](../../docs/features/F-05-reactions.md#fr-060)).
 *
 * Триггер хранится в данных карточки, а не выводится из её текста. Текст триггера написан для
 * человека — «вы получаете урон кислотой, холодом, огнём, электричеством или звуком», — и разбирать
 * его строкой значит менять поведение приложения от запятой в описании.
 */

import type { Spell } from "@/data/schemas/spell";

export const REACTION_TRIGGERS = [
  "attacked",
  "elemental_damage",
  "enemy_casts",
  "falling",
  "enemy_succeeds",
  "failed_save",
] as const;

export type ReactionTrigger = (typeof REACTION_TRIGGERS)[number];

/**
 * Вопрос «что произошло» словами игрока, а не терминами правил.
 *
 * Порядок — по частоте за столом: попадание случается каждый раунд, провал спасброска реже всего.
 */
export const REACTION_TRIGGER_LABEL: Record<ReactionTrigger, string> = {
  attacked: "По мне попали",
  elemental_damage: "Получаю урон стихией",
  enemy_casts: "Враг творит заклинание",
  falling: "Кто-то падает",
  enemy_succeeds: "Враг преуспел в броске",
  failed_save: "Я провалил спасбросок",
};

/** Заклинания-реакции, отвечающие на событие. Порядок исходный: он задан книгой. */
export function reactionsFor(spells: readonly Spell[], trigger: ReactionTrigger): Spell[] {
  return spells.filter(
    (spell) => spell.castingTime.type === "reaction" && spell.castingTime.trigger === trigger,
  );
}

/**
 * Триггеры, на которые в книге есть чем ответить.
 *
 * «Враг преуспел в броске» сюда не попадает: единственным кандидатом была «Искусная острота», а её
 * игрок в книгу не взял ([OQ-04](../../docs/open-questions.md#oq-04)). Показывать вопрос, на который
 * приложению нечего ответить, — то же обещание несуществующего, что и пустой фильтр
 * ([FR-002](../../docs/features/F-01-combat-screen.md#fr-002)).
 *
 * «Я провалил спасбросок» — исключение: на него отвечает не заклинание, а руна «Знаки ограждения»
 * ([FR-153](../../docs/features/F-13-runes.md#fr-153)), и в книге заклинаний её нет по определению.
 */
export function availableTriggers(spells: readonly Spell[]): ReactionTrigger[] {
  return REACTION_TRIGGERS.filter(
    (trigger) => trigger === "failed_save" || reactionsFor(spells, trigger).length > 0,
  );
}
