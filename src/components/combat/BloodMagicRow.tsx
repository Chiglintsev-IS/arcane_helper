/**
 * «Магия крови» строкой боевого списка (FR-207).
 *
 * Обмен хитов на очки заклинаний расходует действие — то же самое действие, что и заклинание
 * ([FR-170](../../../docs/features/F-15-blood-magic.md#fr-170)). Значит и выбирается он там же, где
 * выбирают заклинание: конкуренция за действие видна глазами, а не выводится из памяти.
 *
 * Раньше вход был кнопкой в шапке, и это склеивало две несвязанные вещи — обмен (действие в бою) и
 * правку хитов (не действие вовсе), — забирая у нескролящейся шапки целый ряд.
 */

import { Badge } from "@/components/ui/Badge";
import type { CharacterState } from "@/data/schemas/character";
import { ascensionTierRate, bloodMagicAvailable } from "@/rules/bloodMagic";
import { withPlural } from "@/rules/language";
import { turnTracked, type TurnEconomy } from "@/store/session";

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
      ? "действие израсходовано"
      : null;

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
          <span className="text-[0.625rem] text-slate-500">особенность вида</span>
        </span>

        <span className="flex flex-wrap items-center gap-x-1 gap-y-0.5">
          <Badge tone="action" icon="●">
            Действие
          </Badge>
          <Badge tone="reaction" icon="✚">
            {withPlural(rate, ["хит", "хита", "хитов"])} за очко
          </Badge>
          <Badge tone="muted">Очков {character.spellPoints.remaining}</Badge>
        </span>

        <span className="text-xs text-slate-700 dark:text-slate-300">
          Обменять здоровье на очки заклинаний. Потраченные хиты снижают максимум до долгого отдыха.
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
