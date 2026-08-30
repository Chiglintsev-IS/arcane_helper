import type { ResourcesView } from "@/contract/views";
import { combatRole } from "@/ui/entities/spell/lib/format";
import { lastHintTraits } from "@/ui/shared/model/actionTraits";
import { ActionRow } from "@/ui/shared/ui/ActionRow";

export const LAST_HINT_SHORT_RU =
  "Проваленная проверка Интеллекта про руны, надпись, шифр, ритуал, головоломку или магический " +
  "механизм: бросок повторяется, к новому результату прибавляется бонус мастерства.";

export const LAST_HINT_SPENT_RU = "уже потрачена, вернётся долгим отдыхом";

export function LastHintRow({
  resources,
  onOpen,
}: {
  resources: ResourcesView;
  onOpen: () => void;
}) {
  const { lastHint } = resources;
  const spent = lastHint.remaining <= 0;

  return (
    <ActionRow
      nameRu={lastHint.nameRu}
      role={combatRole(lastHintTraits(lastHint.nameRu).role)}
      onOpen={onOpen}
    >
      <span className="text-[0.84375rem] text-ink-quiet">
        заряд {lastHint.remaining}/{lastHint.maximum}
      </span>

      <span className="text-xs text-ink-soft">{LAST_HINT_SHORT_RU}</span>

      {spent ? (
        <span className="text-xs font-medium text-reaction">
          Недоступно: {LAST_HINT_SPENT_RU}
        </span>
      ) : null}
    </ActionRow>
  );
}
