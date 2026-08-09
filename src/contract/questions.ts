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

import { paymentSchema } from "./commands";

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
  /**
   * Чем обернётся сотворение так, как его набрали в мастере.
   *
   * Способ едет целиком, а не ссылкой на строку способов: спрашивающий уже держит выбранный, и
   * искать его заново по номеру значило бы завести второй способ сказать одно и то же.
   */
  z.object({
    kind: z.literal("cast_preview"),
    spellId: word,
    mode: word,
    payment: paymentSchema,
    targetLabel: word.optional(),
    rune: word.optional(),
    hitDiceCount: numeric.optional(),
    hitDiceRolled: numeric.optional(),
  }),
  /** Во что обойдётся обмен набранного числа очков заклинаний. */
  z.object({ kind: z.literal("blood_exchange_preview"), points: numeric }),
  /**
   * Чем выгрузить состояние прямо сейчас.
   *
   * Вопросом, а не проекцией: в выгрузке стоит время, которого в состоянии нет, — и снимок,
   * несущий «сейчас», перестал бы быть функцией одного состояния.
   */
  z.object({ kind: z.literal("export_preview") }),
  /** Годится ли набранный план магического восстановления и во сколько уровней он обойдётся. */
  z.object({
    kind: z.literal("arcane_recovery_preview"),
    plan: z.record(word, numeric),
  }),
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
  z.object({
    kind: z.literal("cast_preview"),
    /** Что сказать мастеру и чего в этой фразе не хватает. */
    announcement: z.object({
      text: word,
      gaps: z.array(z.object({ placeholder: word.optional(), reasonRu: word })),
    }),
    /** Что сделать за столом — числами этого персонажа и этой ячейки. */
    instructions: z.array(word),
    /**
     * Руна на выбранной ячейке: что даст каждая и почему сейчас ни одной не приложить.
     *
     * «Выбирает ли руна цель» стоит здесь, рядом с эффектом, потому что это правило: цель выбирает
     * одна руна из трёх, и второй ответ на тот же вопрос разошёлся бы с этим молча — предложив
     * выбрать того, кому руна достанется не по выбору.
     */
    runes: z.object({
      effects: z.array(
        z.object({ rune: word, nameRu: word, effectRu: word, choosesTarget: z.boolean() }),
      ),
      unavailabilityRu: word.optional(),
    }),
    /** Кости хитов; нет вовсе — это сотворение их не тратит. */
    hitDice: z
      .object({
        /** Сколько костей позволено бросить выбранной ячейкой. Ноль — бросать нечего. */
        maximum: whole,
        /** Что вообще может выпасть на набранном числе костей; нет вовсе — число не набрано. */
        roll: z.object({ minimum: whole, maximum: whole }).optional(),
        /** Прибавка заклинателя к броску: ноль — это сотворение её не прибавляет. */
        modifier: whole,
        /** Возможно ли названное выпавшее; нет вовсе — выпавшее не названо. */
        rollPossible: z.boolean().optional(),
        /** Сколько хитов вернётся с прибавкой заклинателя; нет вовсе — выпавшее не названо. */
        restored: whole.optional(),
      })
      .optional(),
  }),
  z.object({
    kind: z.literal("blood_exchange_preview"),
    hitPointsSpent: whole,
    hitPointsAfter: whole,
    /** Максимум хитов после обмена: вторая, невосстановимая половина цены. */
    maximumAfter: whole,
    pointsAfter: whole,
    /** Наибольший уровень, который оплатят накопленные очки; `null` — не хватает ни на что. */
    affordableSpellLevel: whole.nullable(),
    instructions: z.array(word),
    announcement: word,
  }),
  z.object({
    kind: z.literal("export_preview"),
    /** Имя файла с датой: папка из десяти «export (3).json» — не резервная копия. */
    fileName: word,
    /** Сам файл текстом: скачивают и кладут в буфер именно его. */
    text: word,
  }),
  z.object({
    kind: z.literal("arcane_recovery_preview"),
    /** Суммарный уровень набранных ячеек: им и меряется дневной бюджет. */
    levelsSpent: whole,
    /** Что мешает вернуть набранное; нет вовсе — план годится. */
    unavailabilityRu: word.optional(),
  }),
]);

export type Question = z.infer<typeof questionSchema>;
export type Preview = z.infer<typeof previewSchema>;
export type PreviewOf<TKind extends Question["kind"]> = Extract<Preview, { kind: TKind }>;
