import type { CastingView, ConcentrationView, SpellRowView } from "@/contract/views";

import { signed } from "@/shared/language";
import { areaPhrase, rangePhrase, resolutionBadge } from "@/ui/shared/lib/spellLabels";

export type ConcentrationBreaker = {
  textRu: string;
  atDiscretion: boolean;
};

export type ConcentrationSummary = {
  spellId: string | null;
  nameRu: string;
  slotLabel: string;
  startLabel: string;
  durationLabel: string;
  mechanicsLabel: string;
  breakLabel: string;
  shortRulesRu: string;
  rulesAvailable: boolean;
  breakers: ConcentrationBreaker[];
};

function mechanicsRu(
  row: SpellRowView,
  damage: ConcentrationView["damage"],
  casting: CastingView,
): string {
  const reach =
    row.area === undefined ? rangePhrase(row.range) : areaPhrase(row.area, row.range.type === "self");
  const damageRu = damage === undefined ? null : `Урон ${damage.formula} (${damage.type})`;

  return [reach, resolutionBadge(row.resolution, casting).label, damageRu]
    .filter((part) => part !== null)
    .join(" · ");
}

function breakers(constitutionModifier: string, minimumDc: number): ConcentrationBreaker[] {
  return [
    {
      textRu: `Урон — спасбросок Телосложения ${constitutionModifier}, КС = максимум(${minimumDc}, половина урона вниз). Провал завершает и концентрацию, и эффект`,
      atDiscretion: false,
    },
    { textRu: "Ещё одно концентрационное заклинание — это заменит", atDiscretion: false },
    { textRu: "Недееспособность или смерть", atDiscretion: false },
    { textRu: "Своё решение — в любой момент, бесплатно", atDiscretion: false },
    { textRu: "Истечение длительности — приложение не отсчитывает", atDiscretion: false },
    {
      textRu: `Сильно отвлекающая обстановка — спасбросок Телосложения ${constitutionModifier} против КС ${minimumDc}`,
      atDiscretion: true,
    },
  ];
}

export function describeConcentration(input: {
  concentration: ConcentrationView;
  row: SpellRowView | null;
  casting: CastingView;
}): ConcentrationSummary {
  const { concentration, row, casting } = input;
  const modifier = signed(concentration.save);

  return {
    spellId: concentration.spellId ?? null,
    nameRu: concentration.nameRu,
    slotLabel:
      concentration.slotLevelUsed === 0
        ? "без ячейки"
        : `ячейка ${concentration.slotLevelUsed} ур.`,
    startLabel: concentration.startApproximate
      ? `раунд ≥ ${concentration.startedOnRound}`
      : `раунд ${concentration.startedOnRound}`,
    durationLabel: concentration.durationRu,
    mechanicsLabel:
      row === null
        ? "Правил нет в контенте: состояние из другой сборки"
        : mechanicsRu(row, concentration.damage, casting),
    breakLabel: `Урон → спасбросок Телосложения ${modifier}, КС от ${concentration.minimumDc}`,
    shortRulesRu: concentration.shortRulesRu,
    rulesAvailable: concentration.spellId !== undefined,
    breakers: breakers(modifier, concentration.minimumDc),
  };
}
