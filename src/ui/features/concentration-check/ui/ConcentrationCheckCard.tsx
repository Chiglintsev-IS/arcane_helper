/**
 * Карточка проверки концентрации после урона.
 *
 * Кубик бросает игрок, приложение говорит, что бросить и что нужно выбросить, и фиксирует
 * результат. Успех состояние не меняет — записи в логе у него нет.
 *
 * Провал не завершает эффект сразу, пока доступны руна и реакция: «Знаки ограждения» превращают
 * провал спасброска в успех, и предложить их обязательно до завершения. Забытая руна стоит
 * игроку и эффекта, и ячейки.
 */

import { RULE_MARK } from "@/ui/shared/ui/rule";
import { useId, useState } from "react";

import type { ConcentrationCheckView } from "@/contract/views";
import { checkGuidanceRu } from "@/ui/features/concentration-check/lib/checkGuidance";
import { signed } from "@/shared/language";
import { SURFACE_CONTROL, SURFACE_GROUP_BARE, SURFACE_PANEL } from "@/ui/shared/ui/surface";

export function ConcentrationCheckCard({
  check,
  spellNameRu,
  runeAvailable,
  onSuccess,
  onSpendRune,
  onFail,
}: {
  check: ConcentrationCheckView;
  spellNameRu: string;
  runeAvailable: boolean;
  onSuccess: () => void;
  onSpendRune: () => void;
  onFail: () => void;
}) {
  const [runeOffered, setRuneOffered] = useState(false);
  const titleId = useId();

  return (
    <section
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      className={`fixed inset-x-0 bottom-0 z-20 flex flex-col gap-3 p-3 ${SURFACE_PANEL}`}
    >
      <div>
        <h2 id={titleId} className="text-sm font-semibold">
          Проверка концентрации: «{spellNameRu}»
        </h2>
        <p className="text-sm">
          Спасбросок Телосложения против КС {check.dc}, модификатор {signed(check.modifier)}
        </p>
        <p className="text-base font-semibold">{checkGuidanceRu(check)}</p>
      </div>

      {runeOffered ? (
        <>
          <p className={`${RULE_MARK.ritual} p-2 text-sm ${SURFACE_GROUP_BARE}`}>
            <span aria-hidden="true">❖</span> Знаки ограждения: реакция и руна превратят провал в
            успех
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onSpendRune}
              className={`min-h-11 flex-1 px-3 text-sm font-semibold ${SURFACE_CONTROL}`}
            >
              Потратить руну
            </button>
            <button
              type="button"
              onClick={onFail}
              className={`min-h-11 flex-1 px-3 text-sm ${SURFACE_CONTROL}`}
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
            className={`min-h-11 flex-1 px-3 text-sm font-semibold ${SURFACE_CONTROL}`}
          >
            Успех
          </button>
          <button
            type="button"
            onClick={() => (runeAvailable ? setRuneOffered(true) : onFail())}
            className={`min-h-11 flex-1 px-3 text-sm font-semibold ${SURFACE_CONTROL}`}
          >
            Провал
          </button>
        </div>
      )}
    </section>
  );
}
