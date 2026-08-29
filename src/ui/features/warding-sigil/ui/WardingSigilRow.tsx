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
import { ActionRow } from "@/ui/shared/ui/ActionRow";
import { TONE_TEXT } from "@/ui/shared/ui/tone";

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
  const traits = wardingSigilTraits(runes.nameRu);
  const castingTime = castingTimeBadge(traits.castingTime);

  return (
    <ActionRow nameRu={runes.nameRu} role={combatRole(traits.role)} onOpen={onOpen}>
      {/*
       * Строка каста как у заклинания: реакция цветом, цена серым — руна, а не ячейка. Запас
       * смыслового цвета не берёт: отвечают слово и само число.
       */}
      <span className="flex w-full items-baseline justify-between gap-3 text-[0.84375rem]">
        <span className="whitespace-nowrap">
          <span className={`font-semibold ${TONE_TEXT[castingTime.tone]}`}>
            <span aria-hidden="true">{castingTime.icon}</span> {castingTime.label}
          </span>
          <span className="text-ink-quiet">
            {" "}· руна {runes.remaining}/{runes.maximum}
            {spent ? " — истрачены" : ""}
          </span>
        </span>
      </span>

      <span className="text-xs text-ink-soft">{WARDING_SIGIL_SHORT_RU}</span>
    </ActionRow>
  );
}
