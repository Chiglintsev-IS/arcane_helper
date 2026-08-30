"use client";

import { SURFACE_CONTROL } from "@/ui/shared/ui/surface";

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
  labelRu: string;
  autoFocus?: boolean;
  onChange: (value: string) => void;
  onSubmit: (value: string) => void;
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
