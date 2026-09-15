"use client";

import { BUTTON_LABELS } from "@/ui/shared/ui/buttonLabels";
import { FIELD_TEXT } from "@/ui/shared/ui/field";
import { SURFACE_CONTROL } from "@/ui/shared/ui/surface";

const TEXT_SHAPE = "col-start-1 row-start-1 w-full leading-snug break-words whitespace-pre-wrap";

const DISMISS_MARK = "✕";

export function GrowingField({
  value,
  labelRu,
  placeholderRu = "",
  autoFocus = false,
  onChange,
  onSubmit,
  onCancel,
}: {
  value: string;
  labelRu: string;
  /** Подсказка внутри пустого поля: она говорит, откуда берётся то, что сюда пишут. */
  placeholderRu?: string;
  autoFocus?: boolean;
  onChange: (value: string) => void;
  onSubmit: (value: string) => void;
  onCancel?: () => void;
}) {
  const field = (
    <label className={`grid min-h-11 content-center px-3 py-2 ${SURFACE_CONTROL}`}>
      <span aria-hidden="true" className={`invisible ${FIELD_TEXT} ${TEXT_SHAPE}`}>{`${value} `}</span>
      <textarea
        rows={1}
        value={value}
        aria-label={labelRu}
        placeholder={placeholderRu}
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
        className={`resize-none overflow-hidden bg-transparent outline-none ${FIELD_TEXT} ${TEXT_SHAPE}`}
      />
    </label>
  );

  if (onCancel === undefined) return field;

  /* Выход без правки: на телефоне клавиша отмены есть не у всякой клавиатуры, а уйти надо всегда. */
  return (
    <div className="flex items-stretch gap-1">
      <div className="min-w-0 flex-1">{field}</div>
      <button
        type="button"
        aria-label={BUTTON_LABELS.dismiss}
        onClick={onCancel}
        className={`w-11 shrink-0 text-base text-ink-quiet ${SURFACE_CONTROL}`}
      >
        <span aria-hidden="true">{DISMISS_MARK}</span>
      </button>
    </div>
  );
}
