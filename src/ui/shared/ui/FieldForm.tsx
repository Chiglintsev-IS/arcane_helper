"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

import { BUTTON_LABELS, editName } from "@/ui/shared/ui/buttonLabels";
import { RULE_ACTIVE, RULE_MARK } from "@/ui/shared/ui/rule";
import { SURFACE_CONTROL, SURFACE_GROUP_BARE, SURFACE_PRIMARY } from "@/ui/shared/ui/surface";

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
 * Записанное закрывает форму, и строка под пальцем уже несёт новое значение; отказ оставляет
 * набранное в полях, а причину — над ответами.
 */
export function FieldForm({
  titleRu,
  answerRu = BUTTON_LABELS.write,
  onWrite,
  onClose,
  children,
}: {
  titleRu: string;
  answerRu?: string;
  onWrite: () => WriteAnswer | typeof UNSENT;
  onClose: () => void;
  children: ReactNode;
}) {
  const form = useRef<HTMLFormElement>(null);
  const [reasonRu, setReasonRu] = useState<string | null>(null);
  const [writing, setWriting] = useState(false);

  /* Форма раскрывается под строкой и может уйти за нижний край вместе с ответами. */
  useEffect(() => {
    form.current?.scrollIntoView?.({ block: "nearest" });
  }, []);

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
    <form
      ref={form}
      aria-label={editName(titleRu)}
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        void write();
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") onClose();
      }}
      className={`flex flex-col gap-2 p-3 ${SURFACE_GROUP_BARE} ${RULE_ACTIVE}`}
    >
      <span className="text-[0.625rem] tracking-[0.14em] text-accent">
        {titleRu.toLocaleUpperCase("ru")}
      </span>

      {children}

      {reasonRu === null ? null : (
        <p role="alert" className={`${RULE_MARK.reaction} p-2 text-sm`}>
          {reasonRu}
        </p>
      )}

      <div className="flex gap-2">
        <button
          type="submit"
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
    </form>
  );
}
