/**
 * Содержимое режима «Привал»: операции отдыха.
 *
 * Раньше это была шторка поверх экрана — привал открывали намеренно и ненадолго. Теперь у него
 * своё место в переключателе режимов: за столом на привале успевает произойти больше одной
 * операции, и держать это поверх «Игры» стало тесно. «Прошёл час» сюда не входит: одна кнопка на
 * «Игру» и «Привал» стоит в общем ряду над этой областью, а не внутри неё.
 *
 * Экраном не называется, хотя занимает его целиком: экран владеет шторками и проводкой операций, а
 * здесь — только разметка и обратные вызовы.
 */

"use client";

import type { RecoveryView } from "@/contract/views";
import { CampActions } from "@/ui/features/rest/ui/CampActions";

export function Camp({
  recovery,
  onShortRest,
  onLongRest,
  onArcaneRecovery,
}: {
  recovery: RecoveryView;
  onShortRest: () => void;
  onLongRest: () => void;
  onArcaneRecovery: () => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <CampActions
        recovery={recovery}
        onShortRest={onShortRest}
        onLongRest={onLongRest}
        onArcaneRecovery={onArcaneRecovery}
      />
    </div>
  );
}
