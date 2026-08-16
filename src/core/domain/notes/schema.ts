/**
 * Подсхема заметок: что игрок записал о мире.
 *
 * Записанное словами не участвует ни в одном счёте, поэтому полей у записи ровно два и ещё
 * идентичность: текст и время появления. Третье поле означало бы, что запись перед сохранением надо
 * разобрать на части, — а разбирают её за столом вслух.
 */

import { z } from "zod";

import { isoDateTime, nonEmpty, parsedOrRefused } from "@/core/domain/shared/schema";
import type { DeepReadonly } from "@/core/domain/shared/readonly";

/**
 * Запись про мир: своя идентичность, время появления и текст.
 *
 * Идентичность отдельно от текста, потому что запись — сущность: два одинаковых текста остаются
 * двумя разными записями, и убрать надо ту, на которую смотрят.
 */
const worldNoteSchema = z.object({
  id: nonEmpty,
  at: isoDateTime,
  text: nonEmpty,
});

export type WorldNote = DeepReadonly<z.infer<typeof worldNoteSchema>>;

/**
 * Запись, годная к хранению: проверенная объявлением и отвергнутая с причиной.
 *
 * Наружу отдаётся сужение, а не схема: пусти схему за границу, и её начнут расширять на месте.
 */
export function worldNoteOf(value: unknown): WorldNote {
  return parsedOrRefused(worldNoteSchema, value, "заметка про мир");
}

/** Поля контекста для сборки полной схемы состояния. */
export const NOTES_FIELDS = {
  worldNotes: z.array(worldNoteSchema).default([]),
};
