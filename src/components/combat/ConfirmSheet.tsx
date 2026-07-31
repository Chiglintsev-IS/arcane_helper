/**
 * Подтверждение выбора между двумя вариантами (ux.md#предупреждения-и-подтверждения).
 *
 * Подтверждение появляется только там, где цена ошибки высока: долгий отдых уничтожает состояние боя
 * ([FR-133](../../../docs/features/F-06-resources.md#fr-133)), а вопрос «бой закончен?» меняет
 * здоровье ([FR-216](../../../docs/features/F-18-screen-modes.md#fr-216)). Каждое лишнее нажатие
 * расходует бюджет [M-03](../../../docs/product.md#метрики), поэтому больше подтверждений в
 * приложении нет.
 *
 * Оба варианта названы делом, а не «Да» и «Нет»: за столом читают кнопку, а не вопрос над ней.
 */

"use client";

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
  return (
    <section
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-x-0 bottom-0 z-20 flex flex-col gap-3 rounded-t-2xl border-t border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950"
    >
      <h2 className="text-base font-semibold">{title}</h2>
      <p className="text-sm text-slate-700 dark:text-slate-300">{body}</p>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={onConfirm}
          className="min-h-11 flex-1 rounded-xl bg-action-strong px-3 text-sm font-semibold text-white"
        >
          {confirmLabel}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="min-h-11 shrink-0 rounded-xl border border-slate-200 px-3 text-sm dark:border-slate-800"
        >
          {cancelLabel}
        </button>
      </div>
    </section>
  );
}
