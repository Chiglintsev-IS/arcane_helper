/**
 * Карточка проверки концентрации после урона (FR-083).
 *
 * Кубик бросает игрок (OQ-09), приложение говорит, что бросить и что нужно выбросить, и фиксирует
 * результат. Успех состояние не меняет — записи в журнале у него нет.
 *
 * Провал не завершает эффект сразу, пока доступны руна и реакция: «Знаки ограждения» превращают
 * провал спасброска в успех, и предложить их обязательно до завершения (FR-154). Забытая руна стоит
 * игроку и эффекта, и ячейки.
 */

import { useState } from "react";

import { checkGuidanceRu, type ConcentrationCheck } from "@/rules/concentration";

export function ConcentrationCheckCard({
  check,
  spellNameRu,
  runeAvailable,
  onSuccess,
  onSpendRune,
  onFail,
}: {
  check: ConcentrationCheck;
  spellNameRu: string;
  runeAvailable: boolean;
  onSuccess: () => void;
  onSpendRune: () => void;
  onFail: () => void;
}) {
  const [runeOffered, setRuneOffered] = useState(false);

  return (
    <section
      role="dialog"
      aria-modal="true"
      aria-label="Проверка концентрации"
      className="fixed inset-x-0 bottom-0 z-20 flex flex-col gap-3 rounded-t-2xl border-t border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950"
    >
      <div>
        <h2 className="text-sm font-semibold">Проверка концентрации: «{spellNameRu}»</h2>
        <p className="text-sm">
          Спасбросок Телосложения против КС {check.dc}, модификатор{" "}
          {check.modifier < 0 ? check.modifier : `+${check.modifier}`}
        </p>
        <p className="text-base font-semibold">{checkGuidanceRu(check)}</p>
      </div>

      {runeOffered ? (
        <>
          <p className="rounded-lg border border-ritual/50 bg-ritual/10 p-2 text-sm">
            <span aria-hidden="true">❖</span> Знаки ограждения: реакция и руна превратят провал в
            успех
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onSpendRune}
              className="min-h-11 flex-1 rounded-xl border border-ritual px-3 text-sm font-semibold"
            >
              Потратить руну
            </button>
            <button
              type="button"
              onClick={onFail}
              className="min-h-11 flex-1 rounded-xl border border-slate-300 px-3 text-sm dark:border-slate-700"
            >
              Всё равно провал
            </button>
          </div>
        </>
      ) : (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onSuccess}
            className="min-h-11 flex-1 rounded-xl border border-action px-3 text-sm font-semibold"
          >
            Успех
          </button>
          <button
            type="button"
            onClick={() => (runeAvailable ? setRuneOffered(true) : onFail())}
            className="min-h-11 flex-1 rounded-xl border border-reaction px-3 text-sm font-semibold"
          >
            Провал
          </button>
        </div>
      )}
    </section>
  );
}
