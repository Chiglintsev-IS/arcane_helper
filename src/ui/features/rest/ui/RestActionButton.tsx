/**
 * Кнопка операции привала: название, а под ним — причина, если операция сейчас не идёт.
 *
 * Один компонент на короткий отдых, долгий отдых, магическое восстановление и час: три места
 * показа («Игра», «Привал») обязаны выглядеть и вести себя одинаково, а не сходиться случайно.
 *
 * Причина стоит текстом внутри кнопки, а не подсказкой при наведении: наводить за столом нечем.
 * Оттого у кнопки нет и собственного доступного имени — его составляют обе строки, и прочитанное
 * вслух совпадает с увиденным.
 */

"use client";

export function RestActionButton({
  onClick,
  name,
  disabledReason,
}: {
  onClick: () => void;
  name: string;
  /** Причина недоступности словами. Кнопка гаснет, но остаётся видимой и объясняет себя. */
  disabledReason?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabledReason !== undefined}
      className="min-h-11 grow rounded-xl border border-slate-200 px-3 py-1.5 text-sm font-medium disabled:text-slate-600 dark:border-slate-800 dark:disabled:text-slate-400"
    >
      <span className="block whitespace-nowrap">{name}</span>{" "}
      {disabledReason === undefined ? null : (
        <span className="block text-xs font-normal">{disabledReason}</span>
      )}
    </button>
  );
}
