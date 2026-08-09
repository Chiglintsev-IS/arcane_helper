/**
 * «Магия крови» строкой списка «Игры».
 *
 * Обмен хитов на очки заклинаний расходует действие — то же самое действие, что и заклинание
 *. Значит и выбирается он там же, где
 * выбирают заклинание: конкуренция за действие видна глазами, а не выводится из памяти.
 *
 * Строка устроена как строка заклинания и подчиняется тем же фильтрам — отбор делает `PlayScreen`
 * по `BLOOD_MAGIC_TRAITS`. Пока она стояла особняком, она оставалась на экране при любом фильтре, и
 * список, обещавший «вот всё, что подходит», врал.
 */

import type { CastingView } from "@/contract/views";
import { BLOOD_MAGIC_TRAITS } from "@/ui/shared/model/actionTraits";
import type { TurnEconomy } from "@/core/domain/encounter/encounter";
import { Fragment } from "react";

import { Badge } from "@/ui/shared/ui/Badge";
import { combatRole } from "@/ui/entities/spell/lib/format";
import { resolutionBadge } from "@/ui/shared/lib/spellLabels";
import type { CharacterState } from "@/core/domain/assembly/state";
import { ascensionTierRate } from "@/core/domain/arcana/slots";
import { bloodMagicAvailable } from "@/core/domain/vitality/blood";
import { withPlural } from "@/core/shared/language";
import { ACTION_SPENT_MESSAGES } from "@/core/application/casting/availability";

export function BloodMagicRow({
  character,
  casting,
  economy,
  onOpen,
}: {
  character: CharacterState;
  /** Числа заклинателя: обмен называет их тем же значком, что и заклинание. */
  casting: CastingView;
  economy: TurnEconomy;
  onOpen: () => void;
}) {
  const rate = ascensionTierRate(character.level);
  // Причина — целая фраза, как у заклинания: одно слово «действие» не говорит, что с ним не так.
  const reason = !bloodMagicAvailable(character.suppression)
    ? "Особенности подавлены"
    : !economy.actionAvailable
      ? ACTION_SPENT_MESSAGES.action
      : null;

  const facts = [
    `${withPlural(rate, ["хит", "хита", "хитов"])} за очко`,
    `Очков ${character.spellPoints.remaining}`,
  ];

  // Обмен хитов на очки не бросает ничего, и говорит об этом тем же значком, что заклинание:
  // собственная подпись здесь однажды разошлась со словом заклинания.
  const resolution = resolutionBadge({ type: "automatic" }, casting);

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
            {combatRole(BLOOD_MAGIC_TRAITS.role).label}
          </span>
        </span>

        <span className="flex flex-wrap items-center gap-x-1 gap-y-0.5">
          <Badge tone="action" icon="●">
            Действие
          </Badge>
          <Badge tone="muted" icon={resolution.icon}>
            {resolution.label}
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
