import type { ActiveEffectView } from "@/contract/views";

import type { ConcentrationSummary } from "@/ui/entities/concentration/lib/summary";
import { ACTIVE_SHEET_LABEL, armorClassNote } from "@/ui/widgets/active-effects/ui/ActiveEffectsSheet";
import { SURFACE_CONTROL } from "@/ui/shared/ui/surface";

function repeatableNote(effect: ActiveEffectView | undefined): string {
  return effect?.repeatableAction === undefined ? "" : ` ↻ ${effect.repeatableAction.label}`;
}

function heldNames(
  effects: readonly ActiveEffectView[],
  armorClass: number,
  concentration: ConcentrationSummary | null,
): { key: string; markRu: string; textRu: string; concentrating: boolean }[] {
  const held = effects
    .filter((effect) => !effect.isConcentration)
    .map((effect) => ({
      key: effect.id,
      markRu: "◈",
      textRu: `${effect.nameRu}${armorClassNote(effect, armorClass)}${repeatableNote(effect)}`,
      concentrating: false,
    }));
  if (concentration === null) return held;
  const heldByConcentration = effects.find((effect) => effect.isConcentration);
  return [
    {
      key: "concentration",
      markRu: "✦",
      textRu: `${concentration.nameRu}${repeatableNote(heldByConcentration)}`,
      concentrating: true,
    },
    ...held,
  ];
}

export function ActiveEffects({
  effects,
  armorClass,
  concentration,
  onOpen,
}: {
  effects: readonly ActiveEffectView[];
  armorClass: number;
  concentration: ConcentrationSummary | null;
  onOpen: () => void;
}) {
  const held = heldNames(effects, armorClass, concentration);
  const spoken =
    held.length === 0 ? "ничего" : held.map((item) => item.textRu).join(", ");

  return (
    <section aria-label={ACTIVE_SHEET_LABEL} className="text-xs">
      <button
        type="button"
        onClick={onOpen}
        aria-label={`${ACTIVE_SHEET_LABEL}: ${spoken}`}
        className={`flex min-h-11 max-w-full items-center gap-2 px-2 py-1 text-left ${SURFACE_CONTROL}`}
      >
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          {held.length === 0 ? (
            <span className="text-ink-quiet">Ничего не действует</span>
          ) : (
            held.map((item) => (
              <span
                key={item.key}
                className={
                  item.concentrating
                    ? "font-semibold text-concentration"
                    : "text-ink-soft"
                }
              >
                <span aria-hidden="true">{item.markRu}</span> {item.textRu}
              </span>
            ))
          )}
        </span>
        <span aria-hidden="true" className="shrink-0 text-ink-quiet">
          ›
        </span>
      </button>
    </section>
  );
}
