"use client";

import { useState } from "react";

import type { ConcentrationCheckView } from "@/contract/views";
import { checkGuidanceRu } from "@/ui/features/concentration-check/lib/checkGuidance";
import { signed } from "@/shared/language";
import { RULE_MARK } from "@/ui/shared/ui/rule";
import { Sheet } from "@/ui/shared/ui/Sheet";
import { SURFACE_CONTROL, SURFACE_GROUP_BARE } from "@/ui/shared/ui/surface";

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

  return (
    <Sheet
      titleRu={`Проверка концентрации: «${spellNameRu}»`}
      footer={
        runeOffered ? (
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
        )
      }
    >
      <p className="text-sm">
        Спасбросок Телосложения против КС {check.dc}, модификатор {signed(check.modifier)}
      </p>
      <p className="text-base font-semibold">{checkGuidanceRu(check)}</p>
    </Sheet>
  );
}
