/**
 * Лист активной концентрации (FR-084).
 *
 * Отвечает на два вопроса, за которыми игрок иначе полез бы в книгу: как работает этот эффект и чем
 * он прерывается. Полные правила заклинания здесь не дублируются — к ним ведёт переход в его
 * карточку.
 *
 * Компонент презентационный: текст приходит готовым, состояние меняет экран боя.
 */

import type { ConcentrationSummary } from "@/rules/concentration";

export function ConcentrationPanel({
  summary,
  onOpenSpell,
  onDrop,
  onClose,
}: {
  summary: ConcentrationSummary;
  onOpenSpell: () => void;
  onDrop: () => void;
  onClose: () => void;
}) {
  return (
    <section
      role="dialog"
      aria-modal="true"
      aria-label={`Концентрация: ${summary.nameRu}`}
      className="fixed inset-0 z-10 flex flex-col bg-slate-50 dark:bg-slate-950"
    >
      <header className="flex items-start justify-between gap-2 border-b border-slate-200 p-3 dark:border-slate-800">
        <div>
          <h2 className="text-lg font-semibold leading-tight text-concentration-strong dark:text-concentration">
            <span aria-hidden="true">✦</span> {summary.nameRu}
          </h2>
          <p className="text-xs text-slate-500">
            {summary.slotLabel} · начата в {summary.startLabel} · {summary.durationLabel}
          </p>
          <p className="text-xs text-slate-500">Отсчёта нет — за длительностью следит игрок</p>
        </div>
        <button type="button" onClick={onClose} className="min-h-11 px-2 text-sm text-slate-500 underline">
          Закрыть
        </button>
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-3 text-sm">
        <section className="flex flex-col gap-2">
          <h3 className="text-xs font-semibold uppercase text-slate-500">Как работает</h3>
          <p>{summary.shortRulesRu}</p>
          <p className="text-xs text-slate-600 dark:text-slate-400">{summary.mechanicsLabel}</p>
          {summary.rulesAvailable ? (
            <button
              type="button"
              onClick={onOpenSpell}
              className="min-h-11 self-start rounded-lg border border-slate-200 px-3 text-sm dark:border-slate-800"
            >
              Полные правила <span aria-hidden="true">›</span>
            </button>
          ) : null}
        </section>

        <section className="flex flex-col gap-2">
          <h3 className="text-xs font-semibold uppercase text-slate-500">Прерывается</h3>
          <ul aria-label="Чем прерывается" className="flex flex-col gap-1">
            {summary.breakers.map((breaker) => (
              <li key={breaker.textRu} className="flex gap-2">
                <span aria-hidden="true">•</span>
                <span>
                  {breaker.atDiscretion ? (
                    <span className="text-slate-500">На усмотрение мастера: </span>
                  ) : null}
                  {breaker.textRu}
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <footer className="flex gap-2 border-t border-slate-200 p-3 dark:border-slate-800">
        <button
          type="button"
          onClick={onDrop}
          className="min-h-11 flex-1 rounded-xl border border-slate-300 px-3 text-sm dark:border-slate-700"
        >
          Снять концентрацию
        </button>
      </footer>
    </section>
  );
}
