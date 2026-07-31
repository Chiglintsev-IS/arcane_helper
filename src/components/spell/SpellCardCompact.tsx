/**
 * Краткая карточка — строка боевого списка (FR-010).
 *
 * Задача строки — ответить на вопрос «что это для меня» без чтения: чем тратится, готово ли к
 * применению, кто бросает, сколько урона и кончается ли эффект сразу. Числа подставлены под этого
 * персонажа, а не взяты из книги: 2d8 у заговора — это его уровень, а не общий случай.
 *
 * Причина недоступности пишется словами: серый цвет без объяснения оставляет игрока в тупике
 * (ux.md#цветовая-система).
 */

import {
  CASTING_TIME,
  damageLabel,
  durationBadge,
  preparationBadge,
  rangeLabel,
  resolutionBadge,
  slotCostLabel,
} from "@/components/spell/format";
import { Badge } from "@/components/ui/Badge";
import type { CharacterState } from "@/data/schemas/character";
import type { Spell } from "@/data/schemas/spell";

export function SpellCardCompact({
  spell,
  character,
  unavailableReason,
  onOpen,
}: {
  spell: Spell;
  character: CharacterState;
  /** Первая причина недоступности или `null`, если применить можно. */
  unavailableReason: string | null;
  onOpen: () => void;
}) {
  const castingTime = CASTING_TIME[spell.castingTime.type];
  const preparation = preparationBadge(spell, character.preparedSpellIds);
  const resolution = resolutionBadge(spell.resolution);
  const duration = durationBadge(spell.duration);
  const damage = damageLabel(spell, spell.level, character.level);

  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className={`flex w-full flex-col items-start gap-1 rounded-lg border p-2 text-left ${
          unavailableReason === null
            ? "border-slate-200 dark:border-slate-800"
            : "border-slate-200 opacity-60 dark:border-slate-800"
        }`}
      >
        <span className="flex w-full items-baseline justify-between gap-2">
          <span className="font-medium leading-tight">{spell.nameRu}</span>
          <span className="text-[0.625rem] text-slate-500">{spell.nameEn}</span>
        </span>

        <span className="flex flex-wrap items-center gap-x-1 gap-y-0.5">
          <Badge tone={castingTime.tone} icon={castingTime.icon}>
            {castingTime.label}
          </Badge>
          <Badge tone={preparation.tone} icon={preparation.icon}>
            {preparation.label}
          </Badge>
          <Badge tone="muted" icon="◎">
            {slotCostLabel(spell)}
          </Badge>
          <Badge tone={resolution.tone} icon={resolution.icon}>
            {resolution.label}
          </Badge>
          {damage === null ? null : <Badge tone="muted">Урон {damage}</Badge>}
          <Badge tone="muted" icon={duration.icon}>
            {duration.label}
          </Badge>
          <Badge tone="muted">{rangeLabel(spell.range)}</Badge>
          {spell.concentration ? (
            <Badge tone="concentration" icon="✦">
              Концентрация
            </Badge>
          ) : null}
        </span>

        {/* Две строки: список должен оставаться просматриваемым, полный пересказ — в карточке. */}
        <span className="line-clamp-2 text-xs text-slate-700 dark:text-slate-300">
          {spell.shortRulesRu}
        </span>

        {unavailableReason === null ? null : (
          <span className="text-xs font-medium text-reaction">Недоступно: {unavailableReason}</span>
        )}
      </button>
    </li>
  );
}
