/**
 * «Магия крови» строкой боевого списка.
 *
 * Обмен хитов на очки заклинаний расходует действие — то же самое действие, что и заклинание
 *. Значит и выбирается он там же, где
 * выбирают заклинание: конкуренция за действие видна глазами, а не выводится из памяти.
 *
 * Строка устроена как строка заклинания и подчиняется тем же фильтрам — отбор делает `CombatScreen`
 * по `BLOOD_MAGIC_TRAITS`. Пока она стояла особняком, она оставалась на экране при любом фильтре, и
 * список, обещавший «вот всё, что подходит», врал.
 */

import { BLOOD_MAGIC_TRAITS } from "@/ui/shared/model/actionTraits";
import { turnTracked, type TurnEconomy } from "@/core/application/useCases/turn";
import { Fragment } from "react";

import { Badge } from "@/ui/shared/ui/Badge";
import { COMBAT_ROLE } from "@/ui/entities/spell/lib/format";
import type { CharacterState } from "@/core/domain/character/state";
import { ascensionTierRate, bloodMagicAvailable } from "@/core/domain/vitality/blood";
import { withPlural } from "@/core/shared/language";

export function BloodMagicRow({
  character,
  economy,
  onOpen,
}: {
  character: CharacterState;
  economy: TurnEconomy;
  onOpen: () => void;
}) {
  const rate = ascensionTierRate(character.level);
  // Недоступность объясняется словами, как и у заклинаний: серое без причины оставляет в тупике.
  const reason = !bloodMagicAvailable(character.suppression)
    ? "особенности подавлены"
    : turnTracked(character) && !economy.actionAvailable
      ? "действие"
      : null;

  const facts = [
    `${withPlural(rate, ["хит", "хита", "хитов"])} за очко`,
    `Очков ${character.spellPoints.remaining}`,
  ];

  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className={`flex w-full flex-col items-start gap-1 rounded-lg border border-slate-200 p-2 text-left dark:border-slate-800 ${
          reason === null ? "" : "opacity-60"
        }`}
      >
        <span className="flex w-full items-baseline justify-between gap-2">
          <span className="font-medium leading-tight">Магия крови</span>
          <span className="shrink-0 text-[0.625rem] text-slate-500">
            {COMBAT_ROLE[BLOOD_MAGIC_TRAITS.role].label}
          </span>
        </span>

        <span className="flex flex-wrap items-center gap-x-1 gap-y-0.5">
          <Badge tone="action" icon="●">
            Действие
          </Badge>
          <Badge tone="muted" icon="○">
            Без броска
          </Badge>
        </span>

        <span className="flex flex-wrap items-center gap-x-1 text-[0.6875rem] leading-4 text-slate-600 dark:text-slate-400">
          {facts.map((fact, index) => (
            <Fragment key={fact}>
              {index === 0 ? null : (
                <span aria-hidden="true" className="text-slate-400">
                  ·
                </span>
              )}
              <span>{fact}</span>
            </Fragment>
          ))}
        </span>

        <span className="text-xs text-slate-700 dark:text-slate-300">
          Здоровье в очки заклинаний. Потраченное снижает максимум до долгого отдыха.
        </span>

        {reason === null ? null : (
          <span className="text-xs font-medium text-reaction-strong dark:text-reaction">
            Недоступно: {reason}
          </span>
        )}
      </button>
    </li>
  );
}
