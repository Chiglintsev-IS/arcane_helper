import type { ResourcesView, SheetView, TurnView } from "@/contract/views";

import { ARMOR_CLASS_ADJUSTMENT } from "@/ui/features/edit-armor-class/ui/ArmorClassSheet";
import {
  DERIVED_LABELS,
  SHEET_FIELD_LABELS,
  sizeLabel,
  skillLabel,
} from "@/ui/entities/character/lib/labels";
import { HIT_POINTS_EVENTS } from "@/ui/features/edit-hit-points/ui/HitPointsSheet";
import { MARKS_LABEL } from "@/ui/features/edit-character-sheet/ui/MarksSheet";
import { RESOURCES_EDIT_LABEL } from "@/ui/features/edit-resources/ui/ResourcesSheet";
import { Badge } from "@/ui/shared/ui/Badge";
import { feet } from "@/ui/shared/lib/spellLabels";
import { hitDicePool } from "@/ui/widgets/resource-header/lib/hitDicePool";
import { signed } from "@/shared/language";
import { SURFACE_CONTROL, SURFACE_GROUP } from "@/ui/shared/ui/surface";

const TURN_RESOURCES: readonly {
  labelRu: string;
  spentRu: string;
  spentIn: (turn: TurnView) => boolean;
}[] = [
  {
    labelRu: "Действие",
    spentRu: "Действие израсходовано",
    spentIn: (turn) => !turn.actionAvailable,
  },
  {
    labelRu: "Бонусное",
    spentRu: "Бонусное действие израсходовано",
    spentIn: (turn) => !turn.bonusActionAvailable,
  },
  {
    labelRu: "Реакция",
    spentRu: "Реакция израсходована",
    spentIn: (turn) => !turn.reactionAvailable,
  },
];

function payingSkin({
  pressable,
  available,
}: {
  pressable: boolean;
  available: boolean;
}): string {
  if (!available) return `text-ink-quiet ${SURFACE_GROUP}`;
  return pressable ? SURFACE_CONTROL : SURFACE_GROUP;
}

function TileCaption({ children }: { children: React.ReactNode }) {
  return (
    <span className="block whitespace-nowrap text-[0.625rem] leading-tight text-ink-quiet">
      {children}
    </span>
  );
}

function Tile({
  captionRu,
  value,
  accessibleName,
  available = true,
  onOpen,
}: {
  captionRu: string;
  value: string;
  accessibleName: string;
  available?: boolean;
  onOpen?: () => void;
}) {
  const shown = (
    <>
      <TileCaption>{captionRu}</TileCaption>
      <span className="block text-base font-semibold leading-tight tabular-nums">
        {available ? null : <span aria-hidden="true">✗ </span>}
        {value}
      </span>
    </>
  );
  const skin = `flex-auto ${payingSkin({ pressable: onOpen !== undefined, available })}`;

  // Обёртка `div` обязательна: `button` не может быть прямым потомком `dl` (axe: only-dlitems).
  return (
    <div className={skin}>
      <dt className="sr-only">{accessibleName}</dt>
      <dd>
        {onOpen === undefined ? (
          <div className="px-2 py-1">{shown}</div>
        ) : (
          <button
            type="button"
            onClick={onOpen}
            aria-label={accessibleName}
            className="w-full px-2 py-1 text-left"
          >
            {shown}
          </button>
        )}
      </dd>
    </div>
  );
}

function slotName(slot: ResourcesView["slots"][number]): string {
  return `Ячейки ${slot.level} уровня: ${slot.remaining} из ${slot.maximum}`;
}

function SlotRow({ slots, onEdit }: { slots: ResourcesView["slots"]; onEdit: () => void }) {
  return (
    <button
      type="button"
      onClick={onEdit}
      aria-label={`${slots.map((slot) => slotName(slot)).join(", ")}. ${RESOURCES_EDIT_LABEL}`}
      className="flex w-full gap-0.5"
    >
      {slots.map((slot) => (
        <span
          key={slot.level}
          className={`flex-1 px-1 py-1 text-center ${payingSkin({
            pressable: true,
            available: slot.remaining > 0,
          })}`}
        >
          <TileCaption>{slot.level} ур.</TileCaption>
          <span className="block text-sm font-semibold leading-tight tabular-nums">
            {slot.remaining}/{slot.maximum}
          </span>
        </span>
      ))}
    </button>
  );
}

function QuietStat({
  captionRu,
  value,
  accessibleName,
}: {
  captionRu: string;
  value: string;
  accessibleName?: string;
}) {
  return (
    <div className="flex items-baseline gap-0.5 whitespace-nowrap">
      <dt>
        {accessibleName === undefined ? (
          captionRu
        ) : (
          <>
            <span className="sr-only">{accessibleName}</span>
            <span aria-hidden="true">{captionRu}</span>
          </>
        )}
      </dt>
      <dd className="font-semibold text-ink-soft tabular-nums">{value}</dd>
    </div>
  );
}

function armorClassCaption(adjustment: number): string {
  return adjustment === 0 ? "КД" : `КД ${signed(adjustment)}`;
}

function hitPointsCaption(temporary: number): string {
  return temporary === 0 ? "Хиты" : `Хиты +${temporary}`;
}

export function ResourceHeader({
  sheet,
  resources,
  onOpenArmorClass,
  onOpenHitPoints,
  onEditResources,
}: {
  sheet: SheetView;
  resources: ResourcesView;
  onOpenArmorClass: () => void;
  onOpenHitPoints: () => void;
  onEditResources: () => void;
}) {
  const { hitPoints } = sheet;
  const dice = hitDicePool(hitPoints.hitDice);
  const { runes } = resources;

  return (
    <section aria-label="Ресурсы" className="flex flex-col gap-1">
      <dl className="flex gap-1">
        <Tile
          captionRu={armorClassCaption(resources.armorClassAdjustment)}
          value={`${sheet.armorClass}`}
          accessibleName={`КД ${sheet.armorClass}. ${ARMOR_CLASS_ADJUSTMENT}`}
          onOpen={onOpenArmorClass}
        />
        <Tile
          captionRu={hitPointsCaption(hitPoints.temporary)}
          value={`${hitPoints.current}/${hitPoints.maximum}`}
          accessibleName={`Хиты ${hitPoints.current}/${hitPoints.maximum}. ${HIT_POINTS_EVENTS}`}
          onOpen={onOpenHitPoints}
        />
        <Tile
          captionRu="Руны"
          value={`${runes.remaining}/${runes.maximum}`}
          accessibleName={`Руны: ${runes.remaining} из ${runes.maximum}. ${RESOURCES_EDIT_LABEL}`}
          available={runes.remaining > 0}
          onOpen={onEditResources}
        />
        <Tile
          captionRu={dice.nameRu}
          value={dice.remaining}
          accessibleName={`${dice.nameRu}: ${dice.remaining}`}
          available={dice.available}
        />
      </dl>

      <SlotRow slots={resources.slots} onEdit={onEditResources} />

      {/*
       * Перенос разрешён только этой строке: на 320 px три величины в неё не встают, и выбор здесь
       * между второй строкой и спрятанной величиной. Ряды выше переноса не знают — переехавшая
       * плитка ломала бы место, где её ищет взгляд.
       */}
      <dl className="flex min-h-5 flex-wrap items-baseline gap-x-1.5 text-[0.625rem] text-ink-quiet">
        <QuietStat captionRu={SHEET_FIELD_LABELS.speed} value={feet(sheet.speed)} />
        <QuietStat captionRu={SHEET_FIELD_LABELS.size} value={sizeLabel(sheet.size)} />
        <QuietStat
          captionRu={skillLabel("perception")}
          value={`${resources.passivePerception}`}
          accessibleName={DERIVED_LABELS.passivePerception}
        />
      </dl>
    </section>
  );
}

/**
 * Рамка остаётся размером со значок, а нажимается зона в 44 точки: раздутая метка разъехалась бы с
 * соседними, за которыми двери нет, и ряд читался бы как два разных ряда.
 */
function MarkButton({
  accessibleName,
  onOpen,
  children,
}: {
  accessibleName: string;
  onOpen: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={accessibleName}
      className="flex min-h-11 items-center"
    >
      {children}
    </button>
  );
}

export function ResourceBadges({
  sheet,
  resources,
  turn,
  onOpenMarks,
}: {
  sheet: SheetView;
  resources: ResourcesView;
  turn: TurnView;
  onOpenMarks: () => void;
}) {
  const { hitPoints } = sheet;
  const { inFight } = turn;

  return (
    <ul aria-label="Прочие ресурсы" className="flex flex-wrap items-center gap-2 text-xs">
      {hitPoints.maximumReduction > 0 ? (
        <li>
          <Badge tone="reaction" icon="✖">
            Максимум снижен на {hitPoints.maximumReduction}
          </Badge>
        </li>
      ) : null}
      {sheet.exhaustion > 0 ? (
        <li>
          <MarkButton
            accessibleName={`Истощение: ступень ${sheet.exhaustion}. ${MARKS_LABEL}`}
            onOpen={onOpenMarks}
          >
            <Badge tone="reaction" icon="✖">
              Истощение {sheet.exhaustion}
            </Badge>
          </MarkButton>
        </li>
      ) : null}
      {sheet.inspiration ? (
        <li>
          <MarkButton accessibleName={`Вдохновение. ${MARKS_LABEL}`} onOpen={onOpenMarks}>
            <Badge tone="action" icon="✦">
              Вдохновение
            </Badge>
          </MarkButton>
        </li>
      ) : null}
      {resources.suppression.firedUpon ? (
        <li>
          <Badge tone="reaction" icon="✖">
            Особенности подавлены: урон огнём
          </Badge>
        </li>
      ) : null}
      {resources.suppression.underDirectSunlight ? (
        <li>
          <Badge tone="reaction" icon="✖">
            Особенности подавлены: солнечный свет
          </Badge>
        </li>
      ) : null}
      {!inFight
        ? null
        : TURN_RESOURCES.filter((resource) => resource.spentIn(turn)).map((resource) => (
            <li key={resource.labelRu} aria-label={resource.spentRu}>
              <Badge tone="muted" icon="✗">
                {resource.labelRu}
              </Badge>
            </li>
          ))}
    </ul>
  );
}
