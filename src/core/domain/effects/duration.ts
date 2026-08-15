/**
 * Срок действующего: чем он кончится.
 *
 * Кончает срок либо время, либо само заклинание, либо рука игрока — и от этого зависит судьба
 * эффекта при долгом отдыхе. Отвечает на это сам срок: слово, прочитанное на месте вызова, молча
 * раздало бы новому сроку чужую судьбу.
 */

import { z } from "zod";

const DURATION_TYPES = [
  "rounds",
  "minutes",
  "hours",
  /** Отмеряет не время, а само заклинание: рассеивание, исчезновение вызванной сущности. */
  "until_spell_ends",
  /** Отмеряет рука игрока: статус и поправка, заведённые за столом. */
  "until_removed",
] as const;

type EffectDurationType = (typeof DURATION_TYPES)[number];

/**
 * Переживает ли срок долгий отдых. Таблица полна по объявлению: срок, заведённый без ответа на этот
 * вопрос, чужой судьбы не наследует — его не примет компилятор.
 *
 * Отмеряемое временем отдых закрывает, потому что столько времени он и занимает. Отмеряемое не
 * временем он не кончает: за время сна магия сама не рассеивается, вызванная сущность сама не
 * исчезает, и рука игрока сама эффекта не снимает.
 */
const OUTLASTS_LONG_REST: Record<EffectDurationType, boolean> = {
  rounds: false,
  minutes: false,
  hours: false,
  until_spell_ends: true,
  until_removed: true,
};

export const effectDurationSchema = z.object({
  type: z.enum(DURATION_TYPES),
  value: z.number().int().positive().optional(),
});

export function outlastsLongRest(duration: { readonly type: EffectDurationType }): boolean {
  return OUTLASTS_LONG_REST[duration.type];
}
