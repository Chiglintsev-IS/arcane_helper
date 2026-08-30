"use client";

import type { SheetView } from "@/contract/views";

import { DERIVED_LABELS, SAVE_ABBR } from "@/ui/entities/character/lib/labels";
import { RULE_ROW } from "@/ui/shared/ui/rule";
import { SURFACE_GROUP } from "@/ui/shared/ui/surface";
import { signed } from "@/shared/language";

import {
  abilityLedger,
  PROFICIENT_MARK,
  type LedgerAbility,
  type SheetEdit,
  type TrainingMark,
} from "../model/rows";

export function AbilityLedger({
  sheet,
  onEdit,
}: {
  sheet: SheetView;
  onEdit: (edit: SheetEdit) => void;
}) {
  return (
    <div className="flex flex-col gap-[5px]">
      <ProficiencyBar bonus={signed(sheet.proficiencyBonus)} />
      {abilityLedger(sheet).map((ability) => (
        <AbilityGroup key={ability.id} ability={ability} onEdit={onEdit} />
      ))}
    </div>
  );
}

function ProficiencyBar({ bonus }: { bonus: string }) {
  return (
    <div className={`flex h-[26px] items-center justify-between px-2.5 ${SURFACE_GROUP}`}>
      <span className="whitespace-nowrap text-xs text-ink-soft">
        {DERIVED_LABELS.proficiencyBonus}{" "}
        <b className="text-[0.9375rem] font-bold text-ink">{bonus}</b>
      </span>
      <span className="whitespace-nowrap text-[0.6875rem] text-ink-quiet">
        <span aria-hidden="true" className="text-accent">
          {PROFICIENT_MARK.glyph}
        </span>{" "}
        {PROFICIENT_MARK.labelRu}
      </span>
    </div>
  );
}

function Training({ mark }: { mark: TrainingMark | undefined }) {
  if (mark === undefined) return null;
  return (
    <>
      {" "}
      <span aria-hidden="true" className="text-[0.5625rem] text-accent">
        {mark.glyph}
      </span>
      <span className="sr-only">{mark.labelRu}</span>
    </>
  );
}

function AbilityGroup({
  ability,
  onEdit,
}: {
  ability: LedgerAbility;
  onEdit: (edit: SheetEdit) => void;
}) {
  return (
    <section className={SURFACE_GROUP}>
      <button
        type="button"
        onClick={() => onEdit(ability.edit)}
        aria-label={ability.accessibleName}
        className="grid h-11 w-full grid-cols-[1fr_48px_92px] items-center px-2.5 text-left"
      >
        <span className="whitespace-nowrap text-[0.84375rem] font-semibold">
          {ability.titleRu}{" "}
          <span className="text-[0.71875rem] font-normal text-ink-quiet">{ability.score}</span>
        </span>
        <span className="text-right text-lg font-bold tabular-nums">{ability.modifier}</span>
        <span className="whitespace-nowrap text-right text-base font-bold tabular-nums">
          <span className="text-[0.625rem] font-normal text-ink-quiet">{SAVE_ABBR} </span>
          {ability.save}
          <Training mark={ability.saveTraining} />
        </span>
      </button>

      {ability.skills.length === 0 ? null : (
        <ul aria-label={ability.titleRu} className="grid grid-cols-2 gap-x-2.5 px-2.5 pb-0.5">
          {ability.skills.map((skill) => (
            <li
              key={skill.id}
              className={`flex h-[22px] items-center justify-between whitespace-nowrap ${RULE_ROW}`}
            >
              <span className="text-xs text-ink-soft">{skill.labelRu}</span>
              <span className="text-sm font-semibold tabular-nums">
                {skill.value}
                <Training mark={skill.training} />
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
