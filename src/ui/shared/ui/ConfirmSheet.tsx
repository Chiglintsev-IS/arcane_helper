/**
 * Подтверждение выбора между двумя вариантами.
 *
 * Подтверждение появляется только там, где цена ошибки высока: долгий отдых уничтожает состояние боя
 *, а вопрос «бой закончен?» меняет
 * здоровье. Каждое лишнее нажатие
 * расходует бюджет, поэтому больше подтверждений в
 * приложении нет.
 *
 * Слова вариантов приходят от того, кто спрашивает. Там, где выбирают между двумя делами, каждое
 * названо собой: за столом читают кнопку, а не вопрос над ней. Там, где второй вариант — просто
 * уход, первый носит общее слово согласия: дело уже названо заголовком, и второе его имя на кнопке
 * добавляло бы к словарю глагол, ничего не различая.
 */

"use client";

import { useId } from "react";
import { SURFACE_CONTROL, SURFACE_PANEL, SURFACE_PRIMARY } from "@/ui/shared/ui/surface";

export function ConfirmSheet({
  title,
  body,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
}: {
  title: string;
  body: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const titleId = useId();

  return (
    <section
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      className={`fixed inset-x-0 bottom-0 z-20 flex flex-col gap-3 p-3 ${SURFACE_PANEL}`}
    >
      <h2 id={titleId} className="text-base font-semibold">
        {title}
      </h2>
      <p className="text-sm text-ink-soft">{body}</p>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={onConfirm}
          className={`min-h-11 flex-1 ${SURFACE_PRIMARY} px-3 text-sm font-semibold`}
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
    </section>
  );
}
