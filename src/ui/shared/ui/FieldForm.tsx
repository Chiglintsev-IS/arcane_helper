"use client";

import type { ReactNode } from "react";

import { BUTTON_LABELS } from "@/ui/shared/ui/buttonLabels";
import { RULE_ACTIVE } from "@/ui/shared/ui/rule";
import { SURFACE_CONTROL, SURFACE_GROUP_BARE, SURFACE_PRIMARY } from "@/ui/shared/ui/surface";

/**
 * Форма правки: заголовок, поля и два ответа — записать или уйти ни с чем. Правка везде выглядит
 * одинаково и нигде не вступает в силу сама: набранное в поле — ещё не решение игрока, а за столом
 * поле легко задеть рукой и не заметить, что записалось.
 *
 * Пара ответов стоит в том же порядке, что и во всякой шторке приложения: палец запоминает место, а
 * не слово, и переставленная пара срабатывает раньше, чем прочитан текст.
 *
 * Открывают форму там же, где стоит правимое значение: ответ, появившийся не под пальцем, ищут
 * глазами.
 */
export function FieldForm({
  titleRu,
  onWrite,
  onCancel,
  children,
}: {
  titleRu: string;
  onWrite: () => void;
  onCancel: () => void;
  children: ReactNode;
}) {
  return (
    <div className={`flex flex-col gap-2 p-3 ${SURFACE_GROUP_BARE} ${RULE_ACTIVE}`}>
      <span className="text-[0.625rem] tracking-[0.14em] text-accent">
        {titleRu.toLocaleUpperCase("ru")}
      </span>

      {children}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={onWrite}
          className={`min-h-11 flex-1 px-3 text-sm font-semibold ${SURFACE_PRIMARY}`}
        >
          {BUTTON_LABELS.write}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className={`min-h-11 shrink-0 px-3 text-sm ${SURFACE_CONTROL}`}
        >
          {BUTTON_LABELS.dismiss}
        </button>
      </div>
    </div>
  );
}
