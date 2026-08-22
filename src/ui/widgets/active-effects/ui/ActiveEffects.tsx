/**
 * Что действует прямо сейчас — одной строкой.
 *
 * Строка стоит во всех режимах, где идёт игра, в отличие от шапки ресурсов: концентрация не может
 * уйти с экрана незаметно, а эффект со сроком в раундах истекает сам.
 *
 * Названо на строке то, чего нет больше нигде: имя того, что держится, и ежеходная работа, о
 * которой иначе забудут на втором раунде. Всё остальное — уровень ячейки, начало, механика и способы
 * прерывания — стоит за раскрытием: способ прерывания один и тот же у любой концентрации, и
 * приложение само называет его числом в тот момент, когда по персонажу попали.
 *
 * Компонент презентационный: состояние приходит параметрами, действия — из экрана.
 */

import type { ActiveEffectView } from "@/contract/views";

import type { ConcentrationSummary } from "@/ui/entities/concentration/lib/summary";
import { ACTIVE_SHEET_LABEL, armorClassNote } from "@/ui/widgets/active-effects/ui/ActiveEffectsSheet";
import { SURFACE_CONTROL } from "@/ui/shared/ui/surface";

/** Что держится: имя, вклад в защиту и ежеходная работа, если она есть. */
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
      textRu: `${effect.nameRu}${armorClassNote(effect, armorClass)}${
        effect.repeatableAction === undefined ? "" : ` ↻ ${effect.repeatableAction.label}`
      }`,
      concentrating: false,
    }));
  if (concentration === null) return held;
  return [
    { key: "concentration", markRu: "✦", textRu: concentration.nameRu, concentrating: true },
    ...held,
  ];
}

export function ActiveEffects({
  effects,
  armorClass,
  concentration,
  onOpen,
}: {
  /** Что висит на персонаже: посчитано ядром. */
  effects: readonly ActiveEffectView[];
  /** Действующая защита: то же число, что в шапке и на «Листе», — его считает лист. */
  armorClass: number;
  concentration: ConcentrationSummary | null;
  /** Раскрытие: подробности, снятие и новый статус живут в шторке. */
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
