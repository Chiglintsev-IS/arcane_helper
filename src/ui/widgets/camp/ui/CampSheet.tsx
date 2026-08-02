/**
 * Привал поверх экрана, а не блоком в нём.
 *
 * Отдых, восстановление и покупки живут на том же экране, что и заклинания, и уместиться вместе с
 * ними на 320 × 568 они не могут: список перестал бы показывать первую карточку целиком. Поверх —
 * потому что привал открывают намеренно и ненадолго, как «Реакции», а не держат перед глазами.
 */

"use client";

import type { CharacterState } from "@/core/domain/character/state";
import type { Spell } from "@/core/domain/catalog/spell";
import { CampActions } from "@/ui/features/rest/ui/CampActions";
import { MaterialsList } from "@/ui/features/materials/ui/MaterialsList";

export function CampSheet({
  character,
  inFight,
  spells,
  onShortRest,
  onLongRest,
  onArcaneRecovery,
  onRecoverMaximum,
  onToggleMaterial,
  onClose,
}: {
  character: CharacterState;
  /** Идёт ли бой прямо сейчас: внутри раунда час не проходит. */
  inFight: boolean;
  spells: readonly Spell[];
  onShortRest: () => void;
  onLongRest: () => void;
  onArcaneRecovery: () => void;
  onRecoverMaximum: () => void;
  onToggleMaterial: (spellId: string) => void;
  onClose: () => void;
}) {
  return (
    <section
      role="dialog"
      aria-modal="true"
      aria-label="Привал"
      className="fixed inset-x-0 bottom-0 z-20 flex max-h-[85dvh] flex-col gap-3 overflow-y-auto rounded-t-2xl border-t border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950"
    >
      <h2 className="text-base font-semibold">Чем восстановиться</h2>

      <CampActions
        character={character}
        inFight={inFight}
        onShortRest={onShortRest}
        onLongRest={onLongRest}
        onArcaneRecovery={onArcaneRecovery}
        onRecoverMaximum={onRecoverMaximum}
      />

      <MaterialsList spells={spells} character={character} onToggle={onToggleMaterial} />

      <button
        type="button"
        onClick={onClose}
        className="min-h-11 rounded-xl border border-slate-200 px-3 text-sm dark:border-slate-800"
      >
        Закрыть
      </button>
    </section>
  );
}
