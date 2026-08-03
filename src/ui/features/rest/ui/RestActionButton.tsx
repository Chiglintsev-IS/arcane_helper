/**
 * Кнопка операции привала — одна строка и только название.
 *
 * Один компонент на короткий отдых, долгий отдых, магическое восстановление и час: три места
 * показа («Игра», «Привал») обязаны выглядеть и вести себя одинаково, а не сходиться случайно.
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
      {...(disabledReason === undefined ? {} : { title: disabledReason })}
      aria-label={disabledReason === undefined ? undefined : `${name} — ${disabledReason}`}
      className="min-h-11 grow whitespace-nowrap rounded-xl border border-slate-200 px-3 text-sm font-medium disabled:opacity-50 dark:border-slate-800"
    >
      {name}
    </button>
  );
}
