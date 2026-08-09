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
  bagViewSchema,
  castingViewSchema,
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
  turn: turnViewSchema,
  casting: castingViewSchema,
  spells: z.array(spellRowViewSchema),
  journal: z.array(journalEntryViewSchema),
});

export type Snapshot = z.infer<typeof snapshotSchema>;
