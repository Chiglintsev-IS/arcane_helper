/**
 * Снимок: всё, что ядро рассказывает о себе наружу.
 *
 * Устройства состояния договор не знает и знать не должен: наружу едут посчитанные величины и
 * записи журнала, а не поля, из которых их надо выводить. Экран, чья проекция ещё не написана,
 * считает по временной двери сборки, а не по полю снимка: поле, заведённое «на время», остаётся
 * навсегда.
 *
 * Версия растёт с каждой применённой командой. Она нужна не сегодня, а в тот день, когда между
 * сторонами появится задержка: по ней клиент узнает, что снимок на экране отстал от бэкенда.
 */

import { z } from "zod";

import {
  activeEffectViewSchema,
  bagViewSchema,
  bloodMagicViewSchema,
  castingViewSchema,
  choicesViewSchema,
  concentrationViewSchema,
  craftingViewSchema,
  recoveryViewSchema,
  resourcesViewSchema,
  sheetViewSchema,
  spellRowViewSchema,
  turnViewSchema,
} from "./views";

/**
 * Запись журнала так, как её показывают: время, подпись и то, к чему запись относится.
 *
 * Снимка отмены здесь нет: он состоит из полей состояния, а состояние — устройство ядра. Отменять
 * умеет ядро, экрану довольно знать, что запись есть и как она называется.
 */
export const journalEntryViewSchema = z.object({
  id: z.string().min(1),
  at: z.string().min(1),
  kind: z.string().min(1),
  summaryRu: z.string().min(1),
  spellId: z.string().min(1).optional(),
  slotLevel: z.number().int().optional(),
});

export const snapshotSchema = z.object({
  version: z.number().int().nonnegative(),
  sheet: sheetViewSchema,
  bag: bagViewSchema,
  /** Что узнано об ингредиентах: знание про виды, а не запас — запас едет сумкой. */
  crafting: craftingViewSchema,
  resources: resourcesViewSchema,
  recovery: recoveryViewSchema,
  turn: turnViewSchema,
  /** Что держится вниманием; нет вовсе — не держится ничего. */
  concentration: concentrationViewSchema.optional(),
  /** Что действует прямо сейчас, в порядке появления. */
  effects: z.array(activeEffectViewSchema),
  casting: castingViewSchema,
  bloodMagic: bloodMagicViewSchema,
  spells: z.array(spellRowViewSchema),
  /**
   * Причина, по которой сейчас закрыт весь список разом; нет вовсе — общей причины нет.
   *
   * Экономия хода не спрашивает, какое заклинание выбрано: истраченное действие закрывает всё, что
   * им платит. Такая причина названа один раз, а строки, закрытые ею, своей фразы не несут — иначе
   * одно и то же предложение стоит под двенадцатью строками из пятнадцати.
   */
  spellsRefusalRu: z.string().min(1).optional(),
  /** Из чего выбирают и в каких границах набирают: закрытые списки правил и их пределы. */
  choices: choicesViewSchema,
  /** Чем играют: карточками сборки или загруженными игроком. Слово правил, подпись — за экраном. */
  catalogSource: z.string().min(1),
  journal: z.array(journalEntryViewSchema),
});

export type Snapshot = z.infer<typeof snapshotSchema>;
