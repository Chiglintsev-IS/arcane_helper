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
  castingTimeLabel,
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
  // В бою значка подготовки нет: неподготовленного в списке уже нет, и значок сообщал бы то, что
  // и так верно про каждую строку (FR-209, FR-211).
  const inCombat = character.screenMode === "combat";
  // Эффект уже висит — строка перестаёт претендовать на внимание, но из списка не уходит: повторное
  // применение бывает нужно (FR-210).
  const active = character.activeEffects.some((effect) => effect.spellId === spell.id);
  const castingTime = CASTING_TIME[spell.castingTime.type];
  const preparation = preparationBadge(spell, character.preparedSpellIds);
  const resolution = resolutionBadge(spell.resolution);
  const duration = durationBadge(spell.duration);
  const damage = damageLabel(spell, spell.level, character.level);
  // Вне боя «Без ячейки» не пишется: рядом стоит значок «Заговор» и говорит то же самое (FR-010).
  // В бою значка подготовки нет, и цену сказать больше нечем — иначе строка молчит о стоимости.
  const slotCost = slotCostLabel(spell) ?? (inCombat ? "Без ячейки" : null);

  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className={`flex w-full flex-col items-start gap-1 rounded-lg border border-slate-200 p-2 text-left dark:border-slate-800 ${
          unavailableReason === null && !active ? "" : "opacity-60"
        }`}
      >
        <span className="flex w-full items-baseline justify-between gap-2">
          <span className="font-medium leading-tight">{spell.nameRu}</span>
          <span className="text-[0.625rem] text-slate-500">{spell.nameEn}</span>
        </span>

        <span className="flex flex-wrap items-center gap-x-1 gap-y-0.5">
          <Badge tone={castingTime.tone} icon={castingTime.icon}>
            {castingTimeLabel(spell.castingTime)}
          </Badge>
          {inCombat ? null : (
            <Badge tone={preparation.tone} icon={preparation.icon}>
              {preparation.label}
            </Badge>
          )}
          {active ? (
            <Badge tone="ritual" icon="✦">
              Уже действует
            </Badge>
          ) : null}
          {slotCost === null ? null : (
            <Badge tone="muted" icon="◎">
              {slotCost}
            </Badge>
          )}
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
          <span className="text-xs font-medium text-reaction-strong dark:text-reaction">Недоступно: {unavailableReason}</span>
        )}
      </button>
    </li>
  );
}
