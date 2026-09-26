"use client";

import { useState } from "react";

import type { ActiveEffectView } from "@/contract/views";

import type { ConcentrationSummary } from "@/ui/entities/concentration/lib/summary";
import { MARKS_LABEL } from "@/ui/features/edit-character-sheet/ui/MarksSheet";
import { editName } from "@/ui/shared/ui/buttonLabels";
import { FieldForm, WRITTEN, type WriteAnswer } from "@/ui/shared/ui/FieldForm";
import { GrowingField } from "@/ui/shared/ui/GrowingField";
import { NameEditor } from "@/ui/shared/ui/NameEditor";
import { TONE_TEXT } from "@/ui/shared/ui/tone";
import { SURFACE_CONTROL, SURFACE_PAGE, SURFACE_GROUP } from "@/ui/shared/ui/surface";

export const ACTIVE_SHEET_LABEL = "Действует";

const NEW_STATUS = "Новый статус";

const STATUS_RU = "Статус";

const STATUS_HINT = "Как назвал мастер: «Опутан», «Благословение до конца боя»";

export function armorClassNote(effect: ActiveEffectView, armorClass: number): string {
  return effect.changesArmorClass ? ` · КД ${armorClass}` : "";
}

/** Статус пишут словами мастера: форма набора закрывает экран, а набранное переживает «Отмену». */
function NewStatus({ onAdd }: { onAdd: (nameRu: string) => WriteAnswer }) {
  const [adding, setAdding] = useState(false);
  const [value, setValue] = useState("");

  const add = (): WriteAnswer => {
    const nameRu = value.trim();
    if (nameRu === "") return WRITTEN;
    return onAdd(nameRu).then((refused) => {
      if (refused === null) setValue("");
      return refused;
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setAdding(true)}
        className={`min-h-11 px-3 text-sm font-medium ${TONE_TEXT.action} ${SURFACE_CONTROL}`}
      >
        {NEW_STATUS}
      </button>
      {!adding ? null : (
        <FieldForm titleRu={NEW_STATUS} subtitleRu={ACTIVE_SHEET_LABEL} onWrite={add} onClose={() => setAdding(false)}>
          <GrowingField
            labelRu={NEW_STATUS}
            placeholderRu={STATUS_HINT}
            value={value}
            autoFocus
            onChange={setValue}
          />
        </FieldForm>
      )}
    </>
  );
}

function EffectSummary({ effect, armorClass }: { effect: ActiveEffectView; armorClass: number }) {
  return (
    <>
      <span aria-hidden="true">◈</span> {effect.nameRu}
      {armorClassNote(effect, armorClass)} · {effect.endConditionRu}
      {effect.noteRu === undefined ? null : (
        <span className="block text-xs text-ink-quiet">{effect.noteRu}</span>
      )}
      {effect.repeatableAction === undefined ? null : (
        <span className="block text-xs text-action">
          ↻ {effect.repeatableAction.label}: {effect.repeatableAction.description}
        </span>
      )}
    </>
  );
}

function ConcentrationSection({
  summary,
  onOpenSpell,
  onTakeDamage,
  onDrop,
}: {
  summary: ConcentrationSummary;
  onOpenSpell?: (() => void) | undefined;
  onTakeDamage: () => void;
  onDrop: () => void;
}) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-lg font-semibold leading-tight text-concentration">
        <span aria-hidden="true">✦</span> {summary.nameRu}
      </h3>
      <p className="text-xs text-ink-quiet">
        {summary.slotLabel} · начата в {summary.startLabel} · {summary.durationLabel}
      </p>
      <p className="text-xs text-ink-quiet">Отсчёта нет — за длительностью следит игрок</p>

      <p>{summary.shortRulesRu}</p>
      <p className="text-xs text-ink-quiet">{summary.mechanicsLabel}</p>
      {summary.rulesAvailable && onOpenSpell !== undefined ? (
        <button
          type="button"
          onClick={onOpenSpell}
          className={`min-h-11 self-start px-3 text-sm ${SURFACE_CONTROL}`}
        >
          Полные правила <span aria-hidden="true">›</span>
        </button>
      ) : null}

      <h4 className="text-xs font-semibold uppercase text-ink-quiet">Прерывается</h4>
      <ul aria-label="Чем прерывается" className="flex flex-col gap-1">
        {summary.breakers.map((breaker) => (
          <li key={breaker.textRu} className="flex gap-2">
            <span aria-hidden="true">•</span>
            <span>
              {breaker.atDiscretion ? (
                <span className="text-ink-quiet">На усмотрение мастера: </span>
              ) : null}
              {breaker.textRu}
            </span>
          </li>
        ))}
      </ul>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={onTakeDamage}
          className={`min-h-11 flex-1 px-3 text-sm font-semibold text-reaction ${SURFACE_CONTROL}`}
        >
          Получил урон
        </button>
        <button
          type="button"
          onClick={onDrop}
          className={`min-h-11 flex-1 px-3 text-sm ${SURFACE_CONTROL}`}
        >
          Снять концентрацию
        </button>
      </div>
    </section>
  );
}

export function ActiveEffectsSheet({
  effects,
  armorClass,
  concentration,
  onOpenSpell,
  onTakeDamage,
  onDropConcentration,
  onEndEffect,
  onAddStatus,
  onRenameStatus,
  onOpenMarks,
  onClose,
}: {
  effects: readonly ActiveEffectView[];
  armorClass: number;
  concentration: ConcentrationSummary | null;
  onOpenSpell?: (() => void) | undefined;
  onTakeDamage: () => void;
  onDropConcentration: () => void;
  onEndEffect: (effectId: string) => void;
  onAddStatus: (nameRu: string) => WriteAnswer;
  onRenameStatus: (effectId: string, nameRu: string) => WriteAnswer;
  onOpenMarks: () => void;
  onClose: () => void;
}) {
  const otherEffects = effects.filter((effect) => !effect.isConcentration);
  const [renaming, setRenaming] = useState<string | null>(null);

  return (
    <section
      role="dialog"
      aria-modal="true"
      aria-label={ACTIVE_SHEET_LABEL}
      className={`fixed inset-0 z-10 flex flex-col ${SURFACE_PAGE}`}
    >
      <header className={`flex items-start justify-between gap-2 p-3 ${SURFACE_GROUP}`}>
        <h2 className="text-lg font-semibold leading-tight">{ACTIVE_SHEET_LABEL}</h2>
        <button
          type="button"
          onClick={onClose}
          className="min-h-11 px-2 text-sm text-ink-quiet underline"
        >
          Закрыть
        </button>
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-3 text-sm">
        {concentration === null ? null : (
          <ConcentrationSection
            summary={concentration}
            onOpenSpell={onOpenSpell}
            onTakeDamage={onTakeDamage}
            onDrop={onDropConcentration}
          />
        )}

        {otherEffects.length > 0 ? (
          <ul aria-label="Активные эффекты" className="flex flex-col gap-2">
            {otherEffects.map((effect) => (
              <li key={effect.id} className="flex flex-col gap-1.5">
                <div className="flex items-start justify-between gap-2">
                  {effect.renamable ? (
                    <button
                      type="button"
                      aria-label={editName(effect.nameRu)}
                      aria-expanded={renaming === effect.id}
                      onClick={() => setRenaming(effect.id)}
                      className="min-h-11 min-w-0 flex-1 text-left"
                    >
                      <EffectSummary effect={effect} armorClass={armorClass} />
                    </button>
                  ) : (
                    <span className="min-w-0 flex-1">
                      <EffectSummary effect={effect} armorClass={armorClass} />
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => onEndEffect(effect.id)}
                    aria-label={`Завершить: ${effect.nameRu}`}
                    className={`min-h-11 shrink-0 px-3 text-xs ${SURFACE_CONTROL}`}
                  >
                    Завершить
                  </button>
                </div>
                {renaming !== effect.id ? null : (
                  <NameEditor
                    nameRu={effect.nameRu}
                    subtitleRu={STATUS_RU}
                    onWrite={(nameRu) => onRenameStatus(effect.id, nameRu)}
                    onClose={() => setRenaming(null)}
                  />
                )}
              </li>
            ))}
          </ul>
        ) : null}

        {concentration === null && otherEffects.length === 0 ? (
          <p className="text-ink-quiet">Сейчас ничего не действует.</p>
        ) : null}

        <div className="grid grid-cols-2 gap-2">
          <NewStatus onAdd={onAddStatus} />
          <button
            type="button"
            onClick={onOpenMarks}
            className={`min-h-11 px-3 text-sm ${SURFACE_CONTROL}`}
          >
            {MARKS_LABEL}
          </button>
        </div>
      </div>
    </section>
  );
}
