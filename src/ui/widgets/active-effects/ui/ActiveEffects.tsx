/**
 * Что действует прямо сейчас: концентрация и активные эффекты.
 *
 * Блок стоит во всех четырёх режимах, в отличие от шапки ресурсов. Концентрация не может уйти с
 * экрана незаметно, а эффект со сроком в раундах истекает сам — оба видны там же, где игрок
 * находится, а не только там, где он тратит.
 *
 * Компонент презентационный: состояние приходит параметрами, действия — из экрана.
 */

import { ConcentrationCard } from "@/ui/entities/concentration/ui/ConcentrationCard";
import type { ActiveEffect, CharacterState } from "@/core/domain/character/state";
import { effectiveArmorClass } from "@/core/domain/effects/armorClass";
import type { ConcentrationSummary } from "@/ui/entities/concentration/lib/summary";

/**
 * Подпись вклада эффекта в КД: отвечает на вопрос «почему КД 17, а не 14».
 *
 * Приложение не хранит цель эффекта, поэтому «Доспехи мага» на союзника поднимут КД Торна. Подпись
 * делает это видимым: неверный эффект снимается вручную.
 */
function armorClassNote(effect: ActiveEffect, armorClass: number): string {
  return effect.armorClass === undefined ? "" : ` · КД ${armorClass}`;
}

export function ActiveEffects({
  character,
  concentration,
  onOpenConcentration,
  onEndEffect,
}: {
  character: CharacterState;
  concentration: ConcentrationSummary | null;
  onOpenConcentration: () => void;
  onEndEffect: (effectId: string) => void;
}) {
  const armorClass = effectiveArmorClass(character);
  const concentrationEffect = character.activeEffects.find((effect) => effect.isConcentration);
  const otherEffects = character.activeEffects.filter((effect) => !effect.isConcentration);

  // Пустой блок забрал бы промежуток родителя — 8 пикселей, которых на iPhone SE не бывает лишних.
  if (concentration === null && otherEffects.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      <ConcentrationCard
        summary={concentration}
        armorClassNote={
          concentrationEffect === undefined ? "" : armorClassNote(concentrationEffect, armorClass)
        }
        onOpen={onOpenConcentration}
      />

      {otherEffects.length > 0 ? (
        <ul aria-label="Активные эффекты" className="flex flex-col gap-0.5 text-xs">
          {otherEffects.map((effect) => (
            <li
              key={effect.id}
              className="flex items-center justify-between gap-2 text-slate-700 dark:text-slate-300"
            >
              <span>
                <span aria-hidden="true">◈</span> {effect.nameRu}
                {armorClassNote(effect, armorClass)} · {effect.endConditionRu}
                {/*
                 * Что придётся делать каждый ход, пока эффект держится. Приложение бросок не делает
                 * и таймера не ведёт — оно напоминает, что бросок нужен: «Мерцание» без напоминания
                 * забывают на втором раунде.
                 */}
                {effect.repeatableAction === undefined ? null : (
                  <span
                    className="block text-[0.6875rem] text-action-strong dark:text-action"
                    title={effect.repeatableAction.description}
                  >
                    ↻ {effect.repeatableAction.label}
                  </span>
                )}
              </span>
              <button
                type="button"
                onClick={() => onEndEffect(effect.id)}
                aria-label={`Завершить: ${effect.nameRu}`}
                className="min-h-11 shrink-0 px-2 text-slate-500"
              >
                <span aria-hidden="true">✕</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
