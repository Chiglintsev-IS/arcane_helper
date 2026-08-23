/**
 * «Знаки ограждения» строкой списка действий.
 *
 * Особенность подкласса, а не заклинание: в книге её нет и быть не может, а спрашивают о ней там
 * же, где «чем ответить», — реакцией она и тратится. Пока ответ на провал спасброска жил за
 * отдельной дверью, он был единственным ответом, которого нет в списке, и искали его не там, где
 * остальные.
 *
 * Строка стоит среди того, что не стоит ячейки: руна ячейки не тратит. Кончившиеся руны строку не
 * убирают — о ней спрашивают ровно тогда, когда её уже нет.
 */

import type { ResourcesView } from "@/contract/views";
import { castingTimeBadge, combatRole } from "@/ui/entities/spell/lib/format";
import { wardingSigilTraits } from "@/ui/shared/model/actionTraits";
import { Badge } from "@/ui/shared/ui/Badge";

/** Правило словами: что руна покупает и чем за это платят. */
export const WARDING_SIGIL_SHORT_RU =
  "Проваленный спасбросок Силы, Ловкости или Телосложения считается успешным. Тратит реакцию и " +
  "руну, ячейку — нет.";

export function WardingSigilRow({
  resources,
  onOpen,
}: {
  resources: ResourcesView;
  onOpen: () => void;
}) {
  const { runes } = resources;
  const spent = runes.remaining <= 0;
  const castingTime = castingTimeBadge(wardingSigilTraits(runes.nameRu).castingTime);

  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className="flex w-full flex-col items-start gap-1 p-2 text-left"
      >
        <span className="flex w-full items-baseline justify-between gap-2">
          <span className="font-medium leading-tight">{runes.nameRu}</span>
          <span className="shrink-0 text-[0.625rem] text-ink-quiet">
            {combatRole(wardingSigilTraits(runes.nameRu).role).label}
          </span>
        </span>

        <span className="flex flex-wrap items-center gap-x-1 gap-y-0.5">
          <Badge tone={castingTime.tone} icon={castingTime.icon}>
            {castingTime.label}
          </Badge>
          {/*
           Запас смыслового цвета не берёт: восемь тонов заняты правилами, и он читался бы как ещё
           одно свойство строки. Отвечают знак и само число — так же, как у последней подсказки.
           */}
          <Badge tone="muted" icon={spent ? "✗" : "✚"}>
            {runes.remaining}/{runes.maximum}
          </Badge>
        </span>

        <span className="text-xs text-ink-soft">{WARDING_SIGIL_SHORT_RU}</span>
      </button>
    </li>
  );
}
