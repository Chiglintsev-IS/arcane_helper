/**
 * Обязательное поле шторки правки: число из набранного и правило незаполненного.
 *
 * Общее для шторок в двух слайсах (`edit-character-sheet`, `edit-hit-points`): слайсы одного слоя
 * друг о друге не знают, а дробное, мусор и пустое поле обязаны дойти до отказа владельца одинаково
 * во всех шторках, а не по-своему в каждой.
 */

"use client";

import { useState } from "react";

/**
 * Целиком набранное как число, без обрезания дробной части: дробное и мусор дойдут до отказа
 * владельца сами — целость числа проверяет его схема. Пустое поле — не ноль, а незаполненное:
 * `Number("")` молча дал бы ноль.
 */
export function requiredFieldNumber(text: string): number {
  return text.trim() === "" ? Number.NaN : Number(text);
}

/** Незаполненное поле — несобранная просьба: владельцу нечего отправлять, и причина остаётся здесь. */
const NOT_TYPED = "Наберите число";

type RequiredNumbers = {
  /** Набрано ли всё: у пустого места не спрашивают ни владельца, ни предпросмотр. */
  allTyped: (values: readonly number[]) => boolean;
  /** Причина под полем: появляется от просьбы и стоит, пока к вводу не прикоснулись. */
  reasonOf: (value: number) => string | null;
  /** Прикосновение к вводу снимает причину: набранное отвечает за себя само. */
  touching: <TNext>(write: (next: TNext) => void) => (next: TNext) => void;
  /** Просьба уходит владельцу только собранной, а несобранная остаётся у своих полей. */
  ask: (values: readonly number[], send: () => void) => void;
};

/**
 * Правило незаполненного поля, одно на все шторки правки.
 *
 * Годность числа шторка по-прежнему не решает — набранное уходит владельцу как есть. Здесь решается
 * то, что до владельца не относится вовсе: пока числа нет, просить не о чем, и его разбор ответил бы
 * игроку сырым отказом схемы вместо человеческих слов.
 */
export function useRequiredNumbers(): RequiredNumbers {
  const [asked, setAsked] = useState(false);
  const allTyped = (values: readonly number[]): boolean =>
    values.every((value) => !Number.isNaN(value));

  return {
    allTyped,
    reasonOf: (value) => (asked && Number.isNaN(value) ? NOT_TYPED : null),
    touching:
      (write) =>
      (next) => {
        setAsked(false);
        write(next);
      },
    ask: (values, send) => {
      setAsked(true);
      if (allTyped(values)) send();
    },
  };
}
