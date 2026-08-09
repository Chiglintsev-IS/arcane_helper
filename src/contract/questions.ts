/**
 * Вопрос: единственное, о чём спрашивают помимо состояния.
 *
 * Снимок отвечает про то, что есть. Про то, чего ещё нет, — про набираемые числа, которые игрок
 * видит до подтверждения, — снимок ответить не может: состояние их не содержит. Вопрос везёт
 * набранное и получает предпросмотр.
 *
 * Вопросов заводится ровно столько, сколько мест зависит от ненабранного. Всё, что выводится из
 * состояния, едет проекциями снимка: второй способ узнать то же самое разошёлся бы с первым, и
 * молча.
 *
 * Состояния вопрос не меняет, идентификатора попытки не несёт и в журнал не пишется — повторять его
 * безопасно по устройству, а не по договорённости.
 */

import { z } from "zod";

/** Число как форма. Возможность величины — правило, и отвечает за неё владелец. */
const numeric = z.number();

const whole = z.number().int();

const word = z.string().min(1);

export const questionSchema = z.discriminatedUnion("kind", [
  /** Каким станет действующий максимум хитов от набранных базового и снижения мастера. */
  z.object({
    kind: z.literal("health_preview"),
    maximumBase: numeric,
    masterReduction: numeric,
  }),
  /** Что изменится при переходе на набранный уровень. */
  z.object({ kind: z.literal("level_preview"), level: numeric }),
]);

/**
 * Предпросмотр повторяет вид вопроса: отвечающий называет, на что отвечает, и спрашивавший не
 * гадает, тот ли ответ пришёл.
 */
export const previewSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("health_preview"),
    /** Действующий максимум; `null` — такого максимума не бывает, и набранное не сохранится. */
    effectiveMaximum: whole.nullable(),
  }),
  z.object({
    kind: z.literal("level_preview"),
    /** Что сдвинется: величина словом правил, было и станет. Пусто — сдвигать нечего. */
    changes: z.array(
      z.object({ of: word, slotLevel: whole.optional(), before: whole, after: whole }),
    ),
    /**
     * Сколько в среднем даст взятый уровень: кость бросает игрок, приложение только называет
     * среднее. `null` — костей у персонажа нет, и называть нечего.
     */
    hitPoints: z
      .object({ perDie: whole, dieSize: whole, constitution: whole, total: whole })
      .nullable(),
  }),
]);

export type Question = z.infer<typeof questionSchema>;
export type Preview = z.infer<typeof previewSchema>;
export type PreviewOf<TKind extends Question["kind"]> = Extract<Preview, { kind: TKind }>;
