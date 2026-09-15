"use client";

import { Sheet } from "@/ui/shared/ui/Sheet";
import { RULE_MARK } from "@/ui/shared/ui/rule";
import { SURFACE_CONTROL, SURFACE_PRIMARY } from "@/ui/shared/ui/surface";
import { TONE_TEXT } from "@/ui/shared/ui/tone";

/**
 * Вопрос перед действием: заголовок, что случится, и два ответа. Ответы стоят в том же порядке, что
 * и во всякой другой шторке, — палец запоминает место, а не слово.
 *
 * Уводящее насовсем не носит заливку основного действия: она читается как «делай смело», а рука,
 * привыкшая бить по ней в форме правки, попала бы по удалению.
 */
export function ConfirmSheet({
  title,
  body,
  confirmLabel,
  cancelLabel,
  removing = false,
  onConfirm,
  onCancel,
}: {
  title: string;
  body: string;
  confirmLabel: string;
  cancelLabel: string;
  /** Ответ уводит записанное: у такого вопроса согласие выглядит опасным, а не основным. */
  removing?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Sheet
      titleRu={title}
      footer={
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onConfirm}
            className={`min-h-11 flex-1 px-3 text-sm font-semibold ${
              removing ? `${TONE_TEXT.reaction} ${RULE_MARK.reaction}` : SURFACE_PRIMARY
            }`}
          >
            {confirmLabel}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className={`min-h-11 shrink-0 px-3 text-sm ${SURFACE_CONTROL}`}
          >
            {cancelLabel}
          </button>
        </div>
      }
    >
      <p className="text-sm text-ink-soft">{body}</p>
    </Sheet>
  );
}
