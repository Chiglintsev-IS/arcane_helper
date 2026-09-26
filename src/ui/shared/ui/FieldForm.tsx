"use client";

import { useId, useState, type ReactNode } from "react";

import { BUTTON_LABELS, editName } from "@/ui/shared/ui/buttonLabels";
import { RULE_MARK } from "@/ui/shared/ui/rule";
import { Sheet } from "@/ui/shared/ui/Sheet";
import { SURFACE_CONTROL, SURFACE_PRIMARY } from "@/ui/shared/ui/surface";

/** Ответ владельца на запись: причина отказа его словами или `null`, когда записано. */
export type WriteAnswer = Promise<string | null>;

export const WRITTEN: WriteAnswer = Promise.resolve(null);

/** Набранное владельцу не ушло: чего в нём не хватает, говорит само поле. */
export const UNSENT = "unsent";

/**
 * Форма правки: заголовок, поля и два ответа — записать или уйти ни с чем. Правка везде выглядит
 * одинаково и нигде не вступает в силу сама: набранное в поле — ещё не решение игрока, а за столом
 * поле легко задеть рукой и не заметить, что записалось.
 *
 * Где набирают с клавиатуры, форма занимает экран: клавиатура телефона закрывает его низ, и поле у
 * строки уезжало бы вместе со страницей. Где только выбирают, форма выезжает шторкой снизу.
 *
 * Записанное закрывает форму, и строка уже несёт новое значение; отказ оставляет набранное в
 * полях, а причину — над ответами.
 */
export function FieldForm({
  titleRu,
  subtitleRu = null,
  answerRu = BUTTON_LABELS.write,
  choice = false,
  onWrite,
  onClose,
  children,
}: {
  titleRu: string;
  /** Чьё правят: заголовок называет поле, подпись — вещь, вид или заклинание, которому оно принадлежит. */
  subtitleRu?: string | null;
  answerRu?: string;
  /** Правка выбором, без клавиатуры. */
  choice?: boolean;
  onWrite: () => WriteAnswer | typeof UNSENT;
  onClose: () => void;
  children: ReactNode;
}) {
  const formId = useId();
  const [reasonRu, setReasonRu] = useState<string | null>(null);
  const [writing, setWriting] = useState(false);

  const write = async (): Promise<void> => {
    if (writing) return;
    const answer = onWrite();
    if (answer === UNSENT) return setReasonRu(null);
    setWriting(true);
    const refused = await answer;
    setWriting(false);
    if (refused === null) onClose();
    else setReasonRu(refused);
  };

  return (
    <Sheet
      titleRu={titleRu}
      nameRu={editName(titleRu)}
      subtitleRu={subtitleRu}
      presentation={choice ? "auto" : "page"}
      overSheet
      footer={
        <div className="flex gap-2">
          <button
            type="submit"
            form={formId}
            className={`min-h-11 flex-1 px-3 text-sm font-semibold ${SURFACE_PRIMARY}`}
          >
            {answerRu}
          </button>
          <button
            type="button"
            onClick={onClose}
            className={`min-h-11 shrink-0 px-3 text-sm ${SURFACE_CONTROL}`}
          >
            {BUTTON_LABELS.dismiss}
          </button>
        </div>
      }
    >
      <form
        id={formId}
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          void write();
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") onClose();
        }}
        className="flex flex-col gap-3"
      >
        {children}

        {reasonRu === null ? null : (
          <p role="alert" className={`${RULE_MARK.reaction} p-2 text-sm`}>
            {reasonRu}
          </p>
        )}
      </form>
    </Sheet>
  );
}
