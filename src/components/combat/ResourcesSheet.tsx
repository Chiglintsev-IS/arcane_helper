/**
 * Ручная правка ресурсов (FR-071, FR-142, FR-155).
 *
 * Приложение знает правила Торна, но не знает правил стола: мастер вправе вернуть реакцию посреди
 * раунда, предмет — потратить руну без заклинания, а ячейка бывает списана по ошибке. Отказ в правке
 * означал бы, что игрок ведёт второй, настоящий учёт на бумаге, — и тогда приложение не нужно.
 *
 * Всё здесь пишется в журнал и отменяется как любое другое изменение
 * ([FR-111](../../../docs/features/F-10-journal-undo.md#fr-111)).
 */

"use client";

import type { CharacterState } from "@/data/schemas/character";

function Stepper({
  label,
  value,
  onMinus,
  onPlus,
  minusDisabled,
  plusDisabled,
}: {
  label: string;
  value: string;
  onMinus: () => void;
  onPlus: () => void;
  minusDisabled: boolean;
  plusDisabled: boolean;
}) {
  return (
    <li className="flex items-center justify-between gap-2 text-sm">
      <span>{label}</span>
      <span className="flex items-center gap-1">
        <button
          type="button"
          disabled={minusDisabled}
          onClick={onMinus}
          aria-label={`Потратить: ${label}`}
          className="min-h-11 min-w-11 rounded-lg border border-slate-200 disabled:opacity-40 dark:border-slate-800"
        >
          <span aria-hidden="true">−</span>
        </button>
        <span className="w-12 text-center font-semibold tabular-nums">{value}</span>
        <button
          type="button"
          disabled={plusDisabled}
          onClick={onPlus}
          aria-label={`Вернуть: ${label}`}
          className="min-h-11 min-w-11 rounded-lg border border-slate-200 disabled:opacity-40 dark:border-slate-800"
        >
          <span aria-hidden="true">+</span>
        </button>
      </span>
    </li>
  );
}

export function ResourcesSheet({
  character,
  onSpendSlot,
  onRefundSlot,
  onAdjustRunes,
  onSunlight,
  onClose,
}: {
  character: CharacterState;
  onSpendSlot: (level: number) => void;
  onRefundSlot: (level: number) => void;
  onAdjustRunes: (delta: number) => void;
  /** Признак «под прямым солнечным светом» (FR-181): приложение его не знает, говорит игрок. */
  onSunlight: (under: boolean) => void;
  onClose: () => void;
}) {
  const slots = Object.entries(character.spellSlots)
    .map(([level, slot]) => ({ level: Number(level), ...slot }))
    .sort((left, right) => left.level - right.level);

  return (
    <section
      role="dialog"
      aria-modal="true"
      aria-label="Правка ресурсов"
      className="fixed inset-x-0 bottom-0 z-20 flex max-h-[85dvh] flex-col gap-3 overflow-y-auto rounded-t-2xl border-t border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950"
    >
      <p className="text-xs text-slate-600 dark:text-slate-400">
        Для случаев вне модели приложения: эффект предмета, решение мастера, ошибка в списании.
        Каждая правка попадает в журнал и отменяется кнопкой «Отменить».
      </p>

      <ul aria-label="Ячейки" className="flex flex-col gap-1">
        {slots.map((slot) => (
          <Stepper
            key={slot.level}
            label={`Ячейка ${slot.level} ур.`}
            value={`${slot.remaining}/${slot.maximum}`}
            onMinus={() => onSpendSlot(slot.level)}
            onPlus={() => onRefundSlot(slot.level)}
            minusDisabled={slot.remaining <= 0}
            plusDisabled={slot.remaining >= slot.maximum}
          />
        ))}
      </ul>

      <ul aria-label="Руны" className="flex flex-col gap-1">
        <Stepper
          label="Руны"
          value={`${character.runes.remaining}/${character.runes.maximum}`}
          onMinus={() => onAdjustRunes(-1)}
          onPlus={() => onAdjustRunes(1)}
          minusDisabled={character.runes.remaining <= 0}
          plusDisabled={character.runes.remaining >= character.runes.maximum}
        />
      </ul>

      {/*
        Солнце стоит здесь по той же причине, что и ручные правки: приложение не может узнать, где
        персонаж, — это говорит игрок. Значок ряда ресурсов только показывает признак; места под
        кнопку в 44 пикселя там нет, а ряд значков и так занимает пятую часть карточки (FR-183).
      */}
      <section aria-label="Состояния" className="flex flex-col gap-1">
        <h3 className="text-xs font-medium uppercase tracking-wide text-slate-500">Состояния</h3>
        <button
          type="button"
          aria-pressed={character.suppression.underDirectSunlight}
          onClick={() => onSunlight(!character.suppression.underDirectSunlight)}
          className={`min-h-11 rounded-xl border px-3 text-sm ${
            character.suppression.underDirectSunlight
              ? "border-reaction bg-reaction/10 font-medium text-reaction-strong dark:text-reaction"
              : "border-slate-200 dark:border-slate-800"
          }`}
        >
          Под прямым солнечным светом
        </button>
        <p className="text-xs text-slate-600 dark:text-slate-400">
          Под солнцем не работают ни регенерация, ни магия крови, ни возврат максимума.
        </p>
      </section>

      <button
        type="button"
        onClick={onClose}
        className="min-h-11 rounded-xl border border-slate-200 px-3 text-sm dark:border-slate-800"
      >
        Закрыть
      </button>
    </section>
  );
}
