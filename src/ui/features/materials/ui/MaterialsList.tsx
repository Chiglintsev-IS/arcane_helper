"use client";

import type { CharacterState } from "@/core/domain/character/state";
import type { Spell } from "@/core/domain/catalog/spell";

/** Компонент, который фокусировка не заменяет: со стоимостью или расходуемый. */
export function costlyComponents(spells: readonly Spell[]): Spell[] {
  return spells.filter(
    (spell) =>
      spell.components.material &&
      (spell.components.costGp !== undefined || spell.components.consumed === true),
  );
}

export function MaterialsList({
  spells,
  character,
  onToggle,
}: {
  spells: readonly Spell[];
  character: CharacterState;
  onToggle: (spellId: string) => void;
}) {
  const components = character.equipment.components;
  const needed = costlyComponents(spells);
  if (components === undefined || needed.length === 0) return null;

  return (
    <section aria-label="Компоненты" className="flex flex-col gap-1">
      <h2 className="text-xs font-medium uppercase tracking-wide text-slate-500">
        Купить и носить
      </h2>
      <ul className="flex flex-col gap-1">
        {needed.map((spell) => {
          const owned = components.materialsForSpellIds.includes(spell.id);
          return (
            <li key={spell.id}>
              <button
                type="button"
                aria-pressed={owned}
                onClick={() => onToggle(spell.id)}
                className={`flex min-h-11 w-full items-center gap-2 rounded-lg border px-2 py-1 text-left text-xs ${
                  owned
                    ? "border-action/50 bg-action/5"
                    : "border-reaction/50 bg-reaction/5"
                }`}
              >
                <span aria-hidden="true">{owned ? "✓" : "✖"}</span>
                <span className="flex-1 leading-tight">
                  <span className="font-medium">{spell.nameRu}</span> —{" "}
                  {spell.components.materialText}
                  {spell.components.consumed === true ? " · расходуется" : ""}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {/* Фокусировка закрывает всё остальное, и напоминать о ней в списке покупок незачем. */}
      <p className="text-xs text-slate-500">
        {components.spellcastingFocus
          ? "Остальные компоненты закрывает фокусировка."
          : "Фокусировки нет: нужен мешочек с компонентами."}
      </p>
    </section>
  );
}
