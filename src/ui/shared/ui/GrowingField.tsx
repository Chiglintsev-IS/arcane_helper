"use client";

import { SURFACE_CONTROL } from "@/ui/shared/ui/surface";

/**
 * Поле высотой в свой текст: набранное стоит в нём целиком.
 *
 * Растёт оно подложенной копией набранного: `textarea` своей высоты не считает, а высота,
 * посчитанная скриптом, отстаёт от набранного на кадр. Копия и поле лежат в одной ячейке сетки,
 * поэтому поле выходит ровно той высоты, какую копия заняла.
 *
 * Подписи у поля нет, а имя есть: слышащий экран получает вопрос целиком там, где зрячему хватает
 * места, на котором поле стоит.
 */

/** Копия и поле обязаны переносить строки одинаково, иначе высота разойдётся с набранным. */
const TEXT_SHAPE = "col-start-1 row-start-1 w-full text-sm leading-snug break-words whitespace-pre-wrap";

export function GrowingField({
  value,
  labelRu,
  autoFocus = false,
  onChange,
  onSubmit,
  onCancel,
}: {
  value: string;
  /** Произносимое имя поля. */
  labelRu: string;
  autoFocus?: boolean;
  onChange: (value: string) => void;
  /** «Ввод». Пустое набранное владельцу не уходит: просить его не о чем. */
  onSubmit: (value: string) => void;
  /** Escape. Нет вовсе — полю нечего закрывать. */
  onCancel?: () => void;
}) {
  return (
    <label className={`grid min-h-11 content-center px-3 py-2 ${SURFACE_CONTROL}`}>
      <span aria-hidden="true" className={`invisible ${TEXT_SHAPE}`}>{`${value} `}</span>
      <textarea
        rows={1}
        value={value}
        aria-label={labelRu}
        autoFocus={autoFocus}
        enterKeyHint="done"
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            const text = value.trim();
            if (text !== "") onSubmit(text);
          }
          if (event.key === "Escape") onCancel?.();
        }}
        className={`resize-none overflow-hidden bg-transparent outline-none ${TEXT_SHAPE}`}
      />
    </label>
  );
}
