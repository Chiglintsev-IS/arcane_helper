/**
 * Содержимое режима «Привал»: операции отдыха и список покупок.
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

import type { CharacterState } from "@/core/domain/assembly/state";
import type { Spell } from "@/core/domain/catalog/spell";
import { CampActions } from "@/ui/features/rest/ui/CampActions";
import { MaterialsList } from "@/ui/features/materials/ui/MaterialsList";

export function Camp({
  character,
  inFight,
  spells,
  onShortRest,
  onLongRest,
  onArcaneRecovery,
  onToggleMaterial,
}: {
  character: CharacterState;
  /** Идёт ли бой прямо сейчас: ни один из отдыхов внутри раунда не проходит. */
  inFight: boolean;
  spells: readonly Spell[];
  onShortRest: () => void;
  onLongRest: () => void;
  onArcaneRecovery: () => void;
  onToggleMaterial: (spellId: string) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <CampActions
        character={character}
        inFight={inFight}
        onShortRest={onShortRest}
        onLongRest={onLongRest}
        onArcaneRecovery={onArcaneRecovery}
      />

      <MaterialsList spells={spells} character={character} onToggle={onToggleMaterial} />
    </div>
  );
}
