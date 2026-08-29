/**
 * Подробная карточка заклинания.
 *
 * Отвечает на «что это такое» одной таблицей механики: каждый факт стоит в ней один раз, и ничего из
 * неё не пересказывается ниже другими словами. Совет и полные правила — за раскрытием: за ними
 * тянутся, когда решение уже принято.
 *
 * Пустые поля не показываются: заклинание без урона не должно иметь строки «Урон: —».
 */

"use client";

import { useState } from "react";

import type { CastingView, SpellRowView } from "@/contract/views";

import { RitualDiagramView } from "@/ui/features/ritual-diagram/ui/RitualDiagramView";
import {
  COMPONENT_WORDS,
  castingTimeDetail,
  durationDetail,
  levelLabel,
  slotCostLabel,
  targetingLabel,
} from "@/ui/entities/spell/lib/format";
import { areaLabel, rangeLabel, resolutionBadge } from "@/ui/shared/lib/spellLabels";
import { Badge } from "@/ui/shared/ui/Badge";
import { SURFACE_CONTROL, SURFACE_GROUP, SURFACE_PAGE, SURFACE_PRIMARY } from "@/ui/shared/ui/surface";

/** Второстепенное в этой карточке: тот же тон, каким названы ярлыки, и он проходит контраст. */
const MUTED = "text-ink-quiet";

/**
 * Кто бросает. Род броска приезжает словом правил, а подпись строки отвечает на вопрос, который
 * игрок задаёт первым: мой это бросок или бросок противника.
 */
const ROLL_LABELS: Readonly<Record<string, string>> = {
  spell_attack: "Мой бросок",
  saving_throw: "Бросок цели",
};

function rollLabel(type: string): string {
  return ROLL_LABELS[type] ?? "Бросок";
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className={`flex justify-between gap-2 py-1 ${SURFACE_GROUP}`}>
      <dt className={`shrink-0 ${MUTED}`}>{label}</dt>
      <dd className="text-right">{children}</dd>
    </div>
  );
}

/** Чем оплачен материал. Пусто — платить нечем и незачем: вещь нужна сама по себе. */
function materialFate(row: SpellRowView, consumed: boolean): string {
  if (row.materialCoveredByFocus) return " (заменяет фокусировка)";
  if (!row.ownComponentRequired) return "";
  return consumed ? " (свой предмет, расходуется)" : " (свой предмет)";
}

/**
 * Компоненты одной строкой: только то, что требуется, и чем оплачен материал.
 *
 * Ненужное не называется: строка отвечает «что нужно», и «без материала» в ней — слово ни о чём.
 * Закрытый фокусировкой материал приглушён: он назван, но делать с ним нечего.
 */
function Components({ row }: { row: SpellRowView }) {
  const { verbal, somatic, material } = row.card.components;
  const required: string[] = [
    ...(verbal ? [COMPONENT_WORDS.verbal] : []),
    ...(somatic ? [COMPONENT_WORDS.somatic] : []),
  ];

  return (
    <>
      {required.join(" · ")}
      {material === undefined ? null : (
        <>
          {required.length === 0 ? "" : " · "}
          <span className={row.materialCoveredByFocus ? MUTED : ""}>
            {material.textRu}
            {materialFate(row, material.consumed)}
          </span>
        </>
      )}
    </>
  );
}

export function SpellCardDetails({
  row,
  casting,
  onCast,
  onNoteChange,
  onClose,
}: {
  /** Заклинание целиком: написанное о нём и то, чем оно является для персонажа сейчас. */
  row: SpellRowView;
  /** Числа заклинателя: ими называется бросок. */
  casting: CastingView;
  onCast: () => void;
  onNoteChange: (note: string) => void;
  onClose: () => void;
}) {
  const [diagramOpen, setDiagramOpen] = useState(false);
  const { card } = row;
  const slotCost = slotCostLabel(row);
  const damage = row.damage ?? null;
  const hasBadges = row.concentration || row.ritual;

  return (
    <section
      role="dialog"
      aria-modal="true"
      aria-label={`Заклинание «${row.nameRu}»`}
      className={`fixed inset-0 z-10 flex flex-col ${SURFACE_PAGE}`}
    >
      <header className={`flex items-start justify-between gap-2 p-3 ${SURFACE_GROUP}`}>
        <div>
          <h2 className="text-lg font-semibold leading-tight">{row.nameRu}</h2>
          <p className="text-xs text-ink-quiet">
            {card.nameEn} · {card.school} · {levelLabel(row.level)}
          </p>
        </div>
        <button type="button" onClick={onClose} className="px-2 text-sm text-ink-quiet underline">
          Закрыть
        </button>
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3 text-sm">
        {hasBadges ? (
          <div className="flex flex-wrap gap-1">
            {row.concentration ? <Badge tone="concentration">Концентрация</Badge> : null}
            {row.ritual ? <Badge tone="ritual">Ритуал</Badge> : null}
          </div>
        ) : null}

        {/* Рядом со значками, а не в подвале: за десять минут ритуала схему открывают первой. */}
        {card.ritualDiagram === undefined ? null : (
          <button
            type="button"
            onClick={() => setDiagramOpen(true)}
            className={`min-h-11 px-3 text-sm font-medium text-ritual ${SURFACE_CONTROL}`}
          >
            Схема ритуала
          </button>
        )}

        <p className="text-ink-soft">{row.shortRulesRu}</p>

        <dl aria-label="Механика" className="text-xs">
          {slotCost === null ? null : <Row label="Стоимость">{slotCost}</Row>}
          <Row label="Компоненты">
            <Components row={row} />
          </Row>
          {/* Два времени подряд и подписаны глаголом: сколько творят и сколько действует. */}
          <Row label="Сотворение">{castingTimeDetail(row.castingTime)}</Row>
          <Row label="Действует">{durationDetail(row.duration)}</Row>
          {card.reaction === undefined ? null : (
            <Row label="Триггер реакции">{card.reaction.textRu}</Row>
          )}
          <Row label="Дальность">{rangeLabel(row.range)}</Row>
          <Row label="Цель">{targetingLabel(card.targeting)}</Row>
          {row.area === undefined ? null : <Row label="Область">{areaLabel(row.area)}</Row>}
          <Row label={rollLabel(row.resolution.type)}>
            {resolutionBadge(row.resolution, casting).label}
          </Row>
          {damage === null ? null : (
            <Row label="Урон">
              {damage.formula} {damage.type}
            </Row>
          )}
          {card.successEffectRu === undefined ? null : (
            <Row label="При успехе">{card.successEffectRu}</Row>
          )}
          {card.failureEffectRu === undefined ? null : (
            <Row label="При провале">{card.failureEffectRu}</Row>
          )}
          {card.higherLevelsRu === undefined ? null : (
            <Row label="Повышение уровня">{card.higherLevelsRu}</Row>
          )}
        </dl>

        {card.tacticalAdviceRu === undefined ? null : (
          <details className={`p-2 ${SURFACE_GROUP}`}>
            <summary className="cursor-pointer text-sm font-medium">Тактический совет</summary>
            <p className="mt-2 whitespace-pre-line text-sm">{card.tacticalAdviceRu}</p>
          </details>
        )}

        <details className={`p-2 ${SURFACE_GROUP}`}>
          <summary className="cursor-pointer text-sm font-medium">Полные правила</summary>
          <p className="mt-2 whitespace-pre-line text-sm">{card.fullRulesRu}</p>
        </details>

        <label className="flex flex-col gap-1 text-xs">
          <span className="font-medium">Заметка</span>
          <textarea
            value={row.note ?? ""}
            onChange={(event) => onNoteChange(event.target.value)}
            rows={2}
            placeholder="Домашнее правило или напоминание"
            className={`p-2 text-sm ${SURFACE_CONTROL}`}
          />
        </label>
      </div>

      <footer className={` p-3 ${SURFACE_GROUP}`}>
        <button
          type="button"
          onClick={onCast}
          className={`w-full ${SURFACE_PRIMARY} px-4 py-3 text-base font-semibold`}
        >
          Сотворить
        </button>
      </footer>

      {diagramOpen ? (
        <RitualDiagramView row={row} onClose={() => setDiagramOpen(false)} />
      ) : null}
    </section>
  );
}
