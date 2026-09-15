"use client";

import { useState } from "react";

import { BUTTON_LABELS } from "@/ui/shared/ui/buttonLabels";
import { ConfirmSheet } from "@/ui/shared/ui/ConfirmSheet";
import { RULE_GROUP } from "@/ui/shared/ui/rule";
import { TONE_TEXT } from "@/ui/shared/ui/tone";

const CONFIRM = "Да, убрать";

/** Обратимое удаление говорит, где его вернуть: иначе вопрос звучит страшнее, чем он есть. */
export const RETURNED_IN_LOG = "Вернуть сделанное можно в логе.";

/** Заметку не пишут в лог, и потому её уход окончателен — об этом и спрашивают перед ним. */
export const NOTE_REMOVAL = {
  askRu: "Убрать заметку?",
  bodyOf: (textRu: string): string =>
    `«${textRu}» уйдёт совсем: заметки в лог не попадают, и вернуть их оттуда будет нечем.`,
} as const;

/**
 * Удаление спрашивает всегда — в приложении нет ни одного, которое случилось бы от одного нажатия.
 * Кнопка стоит под самым пальцем, а уходит по ней то, что копили за столом неделями; вопрос стоит
 * одного нажатия, а восстановление — вечера.
 */
export function RemoveButton({
  labelRu = BUTTON_LABELS.remove,
  nameRu,
  askRu,
  bodyRu,
  disabled = false,
  onConfirm,
}: {
  labelRu?: string;
  /** Имя убираемого: его произносит кнопка, чтобы читающий вслух знал, что именно уйдёт. */
  nameRu: string;
  askRu: string;
  bodyRu: string;
  disabled?: boolean;
  onConfirm: () => void;
}) {
  const [asking, setAsking] = useState(false);

  return (
    <>
      <button
        type="button"
        aria-label={`${labelRu}: ${nameRu}`}
        disabled={disabled}
        onClick={() => setAsking(true)}
        className={`min-h-11 px-3 text-xs font-medium ${TONE_TEXT.reaction} disabled:text-off ${RULE_GROUP}`}
      >
        {labelRu}
      </button>

      {!asking ? null : (
        <ConfirmSheet
          title={askRu}
          body={bodyRu}
          confirmLabel={CONFIRM}
          cancelLabel={BUTTON_LABELS.dismiss}
          removing
          onConfirm={() => {
            setAsking(false);
            onConfirm();
          }}
          onCancel={() => setAsking(false)}
        />
      )}
    </>
  );
}
