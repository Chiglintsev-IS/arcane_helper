import type { CastingView, SpellRowView } from "@/contract/views";
import {
  AREA_SHAPES_RU,
  CHECK_DIE_RU,
  NO_ROLL_RU,
  plural,
  SAVING_THROW_NAMES,
  signed,
} from "@/shared/language";

export function spellListLabel(withActions: boolean): string {
  return withActions ? "Заклинания и действия" : "Заклинания";
}

export function resolutionBadge(
  resolution: SpellRowView["resolution"],
  casting: CastingView,
): { label: string; icon: string; spoken: boolean } {
  switch (resolution.type) {
    case "spell_attack":
      return {
        label: `Атака ${CHECK_DIE_RU}${signed(casting.spellAttackModifier)}`,
        icon: "✶",
        spoken: true,
      };
    case "saving_throw":
      return {
        label: `${savingThrowName(resolution.savingThrow)} КС ${casting.spellSaveDc}`,
        icon: "◇",
        spoken: true,
      };
    default:
      return { label: NO_ROLL_RU, icon: "○", spoken: false };
  }
}

const SAVING_THROWS: Readonly<Record<string, string>> = SAVING_THROW_NAMES;
const AREA_SHAPES: Readonly<Record<string, string>> = AREA_SHAPES_RU;

function savingThrowName(ability: string | undefined): string {
  const named = ability === undefined ? undefined : SAVING_THROWS[ability];
  return named === undefined ? "Спасбросок" : `Спасбросок ${named}`;
}

function shapeName(shape: string): string {
  return AREA_SHAPES[shape] ?? shape;
}

export function feet(value: number): string {
  return `${value} ${plural(value, ["фут", "фута", "футов"])}`;
}

export function rangeLabel(range: SpellRowView["range"]): string {
  switch (range.type) {
    case "self":
      return "На себя";
    case "touch":
      return "Касание";
    case "distance":
      return feet(range.distanceFeet ?? 0);
    default:
      return "Особая";
  }
}

export function rangePhrase(range: SpellRowView["range"]): string {
  return range.type === "special" ? "Особая дальность" : rangeLabel(range);
}

export function areaLabel(area: NonNullable<SpellRowView["area"]>): string {
  return `${shapeName(area.shape)}, ${feet(area.sizeFeet)}`;
}

export function areaPhrase(area: NonNullable<SpellRowView["area"]>, fromSelf: boolean): string {
  const shape = `${shapeName(area.shape)} ${feet(area.sizeFeet)}`;
  return fromSelf ? `${shape} от себя` : shape;
}
