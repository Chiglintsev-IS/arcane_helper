"use client";

import { useState } from "react";

import type { CommandOf } from "@/contract/commands";
import type { ChoicesView, IngredientKnowledgeView } from "@/contract/views";

import {
  DIRECTION_LABELS,
  RARITY_LABELS,
  labelled,
  propertyNumberRu,
} from "@/ui/entities/crafting/lib/labels";
import { BUTTON_LABELS } from "@/ui/shared/ui/buttonLabels";
import { SURFACE_CONTROL, SURFACE_PANEL } from "@/ui/shared/ui/surface";

/**
 * Имя двери раскрытия и имя её шторки: слово дела и вид, которого оно касается.
 *
 * Слово принадлежит шторке, а вид приходит одним значением: дверь пишет экран, шторку — этот файл,
 * а читает их за столом один человек, и два имени одного дела он читает как два разных дела.
 */
export function revealPropertyName(nameRu: string): string {
  return `Раскрыть свойство: ${nameRu}`;
}

/**
 * Раскрытие свойства у записанного вида.
 *
 * Название приходит из закрытого перечня, а не из свободного поля: совпадение считается тождеством
 * названий, и «лечит», набранное руками, не совпало бы с «Лечением здоровья» никогда. Редкость
 * называет игрок: справочник её не печатает, и вывести приложению не из чего.
 *
 * Заголовок называет вид, а произносимое имя добавляет к нему слово дела: заголовку тут стоять
 * предметом — за дверью набирают про этот самый корень, и повторять слово дела глазами незачем.
 *
 * Здесь же стол говорит, что свойств у вида больше нет: сказать это можно только про тот вид, чьё
 * знание перед глазами, а строке списка эта отметка стоила бы места у каждого вида разом.
 */
export function RevealPropertySheet({
  ingredient,
  choices,
  refusalRu,
  onConfirm,
  onExhausted,
  onForget,
  onCancel,
}: {
  ingredient: IngredientKnowledgeView;
  choices: ChoicesView;
  /** Почему записать не вышло; нет вовсе — отказа не было. */
  refusalRu: string | null;
  onConfirm: (command: CommandOf<"reveal_property">) => void;
  /** Установил ли стол, что свойств больше нет: отметка ставится и снимается одинаково. */
  onExhausted: (exhausted: boolean) => void;
  onForget: () => void;
  onCancel: () => void;
}) {
  const nameRu = ingredient.nameRu;
  const [propertyRu, setPropertyRu] = useState("");
  const [number, setNumber] = useState(choices.propertyNumbers[0] ?? 1);
  const [rarity, setRarity] = useState(choices.alchemicalRarities[0] ?? "");

  return (
    <section
      role="dialog"
      aria-modal="true"
      aria-label={revealPropertyName(nameRu)}
      className={`fixed inset-x-0 bottom-0 z-20 flex flex-col gap-3 rounded-t-2xl p-3 ${SURFACE_PANEL}`}
    >
      <h2 className="text-base font-semibold leading-tight">{nameRu}</h2>

      <label className="flex flex-col gap-1">
        <span className="text-xs text-slate-600 dark:text-slate-400">Свойство</span>
        <select
          value={propertyRu}
          onChange={(event) => setPropertyRu(event.target.value)}
          className={`min-h-11 w-full rounded-lg px-2 text-sm ${SURFACE_CONTROL}`}
        >
          <option value="">Не выбрано</option>
          {choices.alchemyDirections.map((direction) => (
            <optgroup key={direction} label={labelled(DIRECTION_LABELS, direction)}>
              {choices.alchemicalProperties
                .filter((property) => property.direction === direction)
                .map((property) => (
                  <option key={property.nameRu} value={property.nameRu}>
                    {property.nameRu}
                  </option>
                ))}
            </optgroup>
          ))}
        </select>
      </label>

      <div className="grid grid-cols-2 gap-2">
        <label className="flex min-w-0 flex-col gap-1">
          <span className="text-xs text-slate-600 dark:text-slate-400">Номер</span>
          <select
            value={String(number)}
            onChange={(event) => setNumber(Number(event.target.value))}
            className={`min-h-11 w-full rounded-lg px-2 text-sm ${SURFACE_CONTROL}`}
          >
            {choices.propertyNumbers.map((option) => (
              <option key={option} value={String(option)}>
                {propertyNumberRu(option)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex min-w-0 flex-col gap-1">
          <span className="text-xs text-slate-600 dark:text-slate-400">Редкость</span>
          <select
            value={rarity}
            onChange={(event) => setRarity(event.target.value)}
            className={`min-h-11 w-full rounded-lg px-2 text-sm ${SURFACE_CONTROL}`}
          >
            {choices.alchemicalRarities.map((option) => (
              <option key={option} value={option}>
                {labelled(RARITY_LABELS, option)}
              </option>
            ))}
          </select>
        </label>
      </div>

      <button
        type="button"
        role="switch"
        aria-checked={ingredient.propertiesExhausted}
        onClick={() => onExhausted(!ingredient.propertiesExhausted)}
        className={`min-h-11 rounded-lg px-3 text-sm ${
          ingredient.propertiesExhausted
            ? "bg-action/20 font-medium text-action-strong dark:text-action-bright"
            : `text-slate-600 dark:text-slate-400 ${SURFACE_CONTROL}`
        }`}
      >
        Свойств у вида больше нет
      </button>

      {refusalRu === null ? null : (
        <p className="text-xs text-slate-700 dark:text-slate-300">{refusalRu}</p>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onConfirm({ kind: "reveal_property", nameRu, number, propertyRu, rarity })}
          className="min-h-11 flex-1 rounded-xl bg-action-strong px-3 text-sm font-semibold text-white"
        >
          {BUTTON_LABELS.save}
        </button>
        <button
          type="button"
          onClick={onForget}
          className={`min-h-11 shrink-0 rounded-xl px-3 text-sm ${SURFACE_CONTROL}`}
        >
          Забыть вид
        </button>
        <button
          type="button"
          onClick={onCancel}
          className={`min-h-11 shrink-0 rounded-xl px-3 text-sm ${SURFACE_CONTROL}`}
        >
          {BUTTON_LABELS.dismiss}
        </button>
      </div>
    </section>
  );
}
