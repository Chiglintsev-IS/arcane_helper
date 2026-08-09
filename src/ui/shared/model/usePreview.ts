/**
 * Предпросмотр набранного: пока игрок печатает, ядро отвечает, чем это станет.
 *
 * Вопрос сравнивается по значению, а не по ссылке: он данные, и объект, собранный при рендере,
 * каждый раз новый — по ссылке спрашивали бы бесконечно.
 *
 * Ответ на устаревший вопрос выбрасывается: набранное меняется быстрее, чем идёт ответ, и пришедший
 * последним не обязан быть ответом на последнее.
 */

"use client";

import { useEffect, useState } from "react";

import type { Preview, Question } from "@/contract/questions";

import { useStores } from "./storeContext";

export function usePreview(question: Question | null): Preview | null {
  const { session } = useStores();
  const [preview, setPreview] = useState<Preview | null>(null);
  const asked = question === null ? null : JSON.stringify(question);

  useEffect(() => {
    if (question === null) {
      setPreview(null);
      return;
    }

    let current = true;
    void session
      .getState()
      .ask(question)
      .then((answer) => {
        if (current) setPreview(answer);
      });
    return () => {
      current = false;
    };
    // Перезапрос идёт по набранному, а не по ссылке на объект вопроса.
  }, [asked, session]);

  return preview;
}
