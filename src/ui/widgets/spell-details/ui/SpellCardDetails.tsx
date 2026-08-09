/**
 * Подробная карточка заклинания.
 *
 * Два уровня чтения: механические данные сверху — для решения и для разговора с мастером; полные
 * правила и отыгрыш спрятаны за раскрытием. Полный текст правил закрыт по умолчанию
 *, а художественный текст живёт в отдельном блоке с другим оформлением: смешивать
 * его с механикой запрещено.
 *
 * Пустые поля не показываются: заклинание без урона не должно иметь строки «Урон: —».
 */

"use client";

import { useState } from "react";

import type { CastingView, SpellRowView } from "@/contract/views";

import { RitualDiagramView } from "@/ui/features/ritual-diagram/ui/RitualDiagramView";
import {
  castingTimeBadge,
  castingTimeLabel,
  castingTimePhrase,
  durationLabel,
  levelLabel,
  slotCostLabel,
  targetingLabel,
} from "@/ui/entities/spell/lib/format";
import { areaLabel, rangeLabel, resolutionBadge } from "@/ui/shared/lib/spellLabels";
import { RoleplaySection } from "@/ui/features/roleplay/ui/RoleplaySection";
import { Badge } from "@/ui/shared/ui/Badge";
import type { Spell } from "@/core/domain/catalog/spell";

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-2 border-b border-slate-100 py-1 last:border-0 dark:border-slate-800/60">
      <dt className="shrink-0 text-slate-600 dark:text-slate-400">{label}</dt>
      <dd className="text-right">{children}</dd>
    </div>
  );
}

export function SpellCardDetails({
  spell,
  row,
  casting,
  note,
  onCast,
  onNoteChange,
  onClose,
}: {
  spell: Spell;
  /**
   * Уже посчитанное про это заклинание: цена, урон, доступность, что сделать и как объявить.
   *
   * Рядом с карточкой, а не вместо неё, потому что художественный текст, полные правила и схема
   * ритуала — содержимое контента, а не производные правил. Карточка уйдёт отсюда вместе с
   * временной дверью.
   */
  row: SpellRowView;
  /** Числа заклинателя: ими называется бросок. */
  casting: CastingView;
  note: string | undefined;
  onCast: () => void;
  onNoteChange: (note: string) => void;
  onClose: () => void;
}) {
  const [diagramOpen, setDiagramOpen] = useState(false);
  const castingTime = castingTimeBadge(spell.castingTime.type);
  const slotCost = slotCostLabel(row);
  // Отсутствие цели — решение, а не пробел: мастер её не спрашивает.
  const shownGaps = row.announcement.gaps.filter((gap) => gap.placeholder !== "target");
  const damage = row.damage?.formula ?? null;

  return (
    <section
      role="dialog"
      aria-modal="true"
      aria-label={`Заклинание «${spell.nameRu}»`}
      className="fixed inset-0 z-10 flex flex-col bg-slate-50 dark:bg-slate-950"
    >
      <header className="flex items-start justify-between gap-2 border-b border-slate-200 p-3 dark:border-slate-800">
        <div>
          <h2 className="text-lg font-semibold leading-tight">{spell.nameRu}</h2>
          <p className="text-xs text-slate-500">
            {spell.nameEn} · {spell.school} · {levelLabel(spell.level)}
          </p>
        </div>
        <button type="button" onClick={onClose} className="px-2 text-sm text-slate-500 underline">
          Закрыть
        </button>
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3 text-sm">
        <div className="flex flex-wrap gap-1">
          <Badge tone={castingTime.tone} icon={castingTime.icon}>
            {castingTimePhrase(spell.castingTime)}
          </Badge>
          {spell.concentration ? (
            <Badge tone="concentration" icon="✦">
              Концентрация
            </Badge>
          ) : null}
          {spell.ritual ? (
            <Badge tone="ritual" icon="❖">
              Ритуал
            </Badge>
          ) : null}
        </div>

        {/* Рядом со значками, а не в подвале: за десять минут ритуала схему открывают первой. */}
        {spell.ritualDiagram === undefined ? null : (
          <button
            type="button"
            onClick={() => setDiagramOpen(true)}
            className="min-h-11 rounded-lg border border-ritual/60 px-3 text-sm font-medium text-ritual"
          >
            Схема ритуала
          </button>
        )}

        <p className="text-slate-700 dark:text-slate-300">{spell.shortRulesRu}</p>

        <section aria-label="Что сделать" className="flex flex-col gap-1">
          <h3 className="text-xs font-medium uppercase tracking-wide text-slate-500">Что сделать</h3>
          <ul className="flex flex-col gap-1 text-sm">
            {row.instructions.map((step) => (
              <li key={step} className="rounded-md border border-slate-200 px-2 py-1 dark:border-slate-800">
                {step}
              </li>
            ))}
          </ul>
        </section>

        <dl aria-label="Механика" className="text-xs">
          {slotCost === null ? null : <Row label="Стоимость">{slotCost}</Row>}
          <Row label="Дальность">{rangeLabel(spell.range)}</Row>
          {/* Пара строк подряд: подписанные, они сравниваются глазом и не путаются. */}
          <Row label="Накладывание">{castingTimeLabel(spell.castingTime)}</Row>
          <Row label="Длительность">{durationLabel(spell.duration)}</Row>
          <Row label="Цель">{targetingLabel(spell.targeting)}</Row>
          {spell.area === undefined ? null : <Row label="Область">{areaLabel(spell.area)}</Row>}
          <Row label="Разрешение">
            {resolutionBadge(spell.resolution, casting).label}
          </Row>
          {damage === null ? null : (
            <Row label="Урон">
              {damage} {spell.damage?.type}
            </Row>
          )}
          {spell.resolution.successEffect === undefined ? null : (
            <Row label="При успехе">{spell.resolution.successEffect}</Row>
          )}
          {spell.resolution.failureEffect === undefined ? null : (
            <Row label="При провале">{spell.resolution.failureEffect}</Row>
          )}
          {spell.higherLevelsRu === undefined ? null : (
            <Row label="Повышение уровня">{spell.higherLevelsRu}</Row>
          )}
          {spell.castingTime.reactionTrigger === undefined ? null : (
            <Row label="Триггер реакции">{spell.castingTime.reactionTrigger}</Row>
          )}
        </dl>

        <details className="rounded-lg border border-slate-200 p-2 dark:border-slate-800">
          <summary className="cursor-pointer text-sm font-medium">Как объявить</summary>
          <p className="mt-2 text-sm">{row.announcement.text}</p>
          {shownGaps.length === 0 ? null : (
            <ul className="mt-2 flex flex-col gap-1 text-xs text-slate-500">
              {shownGaps.map((gap) => (
                <li key={gap.placeholder ?? gap.reasonRu}>{gap.reasonRu}</li>
              ))}
            </ul>
          )}
        </details>

        {spell.tacticalAdviceRu === undefined ? null : (
          <details className="rounded-lg border border-slate-200 p-2 dark:border-slate-800">
            <summary className="cursor-pointer text-sm font-medium">Тактический совет</summary>
            <p className="mt-2 text-sm">{spell.tacticalAdviceRu}</p>
          </details>
        )}

        <details className="rounded-lg border border-slate-200 p-2 dark:border-slate-800">
          <summary className="cursor-pointer text-sm font-medium">Полные правила</summary>
          <p className="mt-2 text-sm">{spell.fullRulesRu}</p>
        </details>

        <RoleplaySection spell={spell} collapsible />

        <label className="flex flex-col gap-1 text-xs">
          <span className="font-medium">Заметка</span>
          <textarea
            value={note ?? ""}
            onChange={(event) => onNoteChange(event.target.value)}
            rows={2}
            placeholder="Домашнее правило или напоминание"
            className="rounded-lg border border-slate-200 p-2 text-sm dark:border-slate-800 dark:bg-slate-900"
          />
        </label>
      </div>

      <footer className="border-t border-slate-200 p-3 dark:border-slate-800">
        <button
          type="button"
          onClick={onCast}
          className="w-full rounded-xl bg-action-strong px-4 py-3 text-base font-semibold text-white"
        >
          Сотворить
        </button>
      </footer>

      {diagramOpen ? (
        <RitualDiagramView spell={spell} onClose={() => setDiagramOpen(false)} />
      ) : null}
    </section>
  );
}
