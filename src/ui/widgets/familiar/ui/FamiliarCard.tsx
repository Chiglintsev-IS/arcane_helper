"use client";

import type { ReactNode } from "react";

import type { FamiliarView } from "@/contract/views";
import { signed } from "@/shared/language";

import {
  abilityLabel,
  ARMOR_CLASS_LABEL,
  DERIVED_LABELS,
  SHEET_FIELD_LABELS,
} from "@/ui/entities/character/lib/labels";
import { RULE_BETWEEN, RULE_BLOCK, RULE_ROW } from "@/ui/shared/ui/rule";
import { SURFACE_GROUP } from "@/ui/shared/ui/surface";
import { TONE_TEXT } from "@/ui/shared/ui/tone";

const HELD_BY_MASTER = "Бросает мастер: числа здесь, чтобы знать, о чём просить.";

const CHECKS_TITLE = "Чем он отвечает";

const ADVANTAGE = "Преимущество";

const TRAITS_TITLE = "Что он умеет";

const CONTRACT_TITLE = "Контракт";

const CONTRACT_HINT = "Требует от Торна, а не от Фрубита.";

const STATBLOCK_TITLE = "Статблок";

const HIT_POINTS_LABEL = "Хиты";

const SENSES_LABEL = "Чувства";

const LANGUAGES_LABEL = "Языки";

const DANGER_LABEL = "Опасность";

function Card({
  titleRu,
  marked,
  children,
}: {
  titleRu: string;
  marked?: boolean;
  children: ReactNode;
}) {
  return (
    <section
      className={`flex flex-col gap-1.5 p-3 ${SURFACE_GROUP} ${marked === true ? RULE_BLOCK : ""}`}
    >
      <h2 className="text-sm font-semibold">{titleRu}</h2>
      {children}
    </section>
  );
}

function Row({ labelRu, value }: { labelRu: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="shrink-0 text-ink-quiet">{labelRu}</dt>
      <dd className="text-right tabular-nums">{value}</dd>
    </div>
  );
}

function WideRow({ labelRu, value }: { labelRu: string; value: string }) {
  return (
    <div className="flex items-baseline gap-3">
      <dt className="w-24 shrink-0 text-ink-quiet">{labelRu}</dt>
      <dd className="min-w-0 flex-1 leading-snug">{value}</dd>
    </div>
  );
}

export function FamiliarCard({ familiar }: { familiar: FamiliarView }) {
  return (
    <div className="flex flex-col gap-2">
      <section className={`flex flex-col gap-0.5 p-3 ${SURFACE_GROUP}`}>
        <h2 className="text-base font-semibold">{familiar.nameRu}</h2>
        <p className="text-xs text-ink-quiet">{familiar.kindRu}</p>
      </section>

      <Card titleRu={CHECKS_TITLE}>
        <p className="text-xs text-ink-quiet">{HELD_BY_MASTER}</p>
        <ul aria-label={CHECKS_TITLE} className={`flex flex-col ${RULE_BETWEEN}`}>
          {familiar.checks.map((check) => (
            <li key={check.nameRu} className="flex flex-col gap-0.5 py-2 first:pt-0 last:pb-0">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-sm">
                  {check.nameRu}
                  <span className="text-ink-quiet"> · {abilityLabel(check.ability)}</span>
                </span>
                <span className={`text-xl font-semibold tabular-nums ${TONE_TEXT.roll}`}>
                  {signed(check.value)}
                </span>
              </div>
              <p className="text-xs leading-snug text-ink-quiet">
                {ADVANTAGE}: {check.advantageRu}
              </p>
            </li>
          ))}
        </ul>
        <dl className={`flex flex-col pt-1.5 text-sm ${RULE_ROW}`}>
          <Row
            labelRu={DERIVED_LABELS.passivePerception}
            value={String(familiar.passivePerception)}
          />
        </dl>
        <p className="text-xs leading-snug text-ink-quiet">{familiar.proficiencyRu}</p>
      </Card>

      <Card titleRu={TRAITS_TITLE}>
        <ul aria-label={TRAITS_TITLE} className={`flex flex-col ${RULE_BETWEEN}`}>
          {familiar.traits.map((trait) => (
            <li key={trait.nameRu} className="flex flex-col gap-0.5 py-2 first:pt-0 last:pb-0">
              <span className="text-sm font-medium">{trait.nameRu}</span>
              <p className="whitespace-pre-line text-xs leading-snug text-ink-soft">
                {trait.textRu}
              </p>
            </li>
          ))}
        </ul>
      </Card>

      <Card titleRu={CONTRACT_TITLE} marked>
        <p className="text-xs text-ink-quiet">{CONTRACT_HINT}</p>
        <ul aria-label={CONTRACT_TITLE} className={`flex flex-col ${RULE_BETWEEN}`}>
          {familiar.obligationsRu.map((obligation) => (
            <li key={obligation} className="py-1.5 text-sm leading-snug first:pt-0 last:pb-0">
              {obligation}
            </li>
          ))}
        </ul>
      </Card>

      <Card titleRu={STATBLOCK_TITLE}>
        <dl className="flex flex-col text-sm">
          <Row labelRu={ARMOR_CLASS_LABEL} value={String(familiar.armorClass)} />
          <Row labelRu={HIT_POINTS_LABEL} value={familiar.hitPointsRu} />
          <WideRow labelRu={SHEET_FIELD_LABELS.speed} value={familiar.speedsRu.join(", ")} />
          <WideRow labelRu={SENSES_LABEL} value={familiar.sensesRu.join(", ")} />
          <WideRow labelRu={LANGUAGES_LABEL} value={familiar.languagesRu} />
          <Row labelRu={DANGER_LABEL} value={familiar.dangerRu} />
        </dl>
        <ul className="grid grid-cols-2 gap-x-3 text-sm">
          {familiar.scores.map((score) => (
            <li key={score.ability} className="flex items-baseline justify-between gap-2">
              <span className="text-ink-quiet">{abilityLabel(score.ability)}</span>
              <span className="tabular-nums">
                {score.score}
                <span className="ml-1 text-ink-soft">({signed(score.modifier)})</span>
              </span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
