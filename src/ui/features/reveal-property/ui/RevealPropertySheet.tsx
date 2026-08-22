"use client";

import { useState } from "react";

import type { CommandOf } from "@/contract/commands";
import type { PreviewOf, Question } from "@/contract/questions";
import type { ChoicesView, IngredientKnowledgeView } from "@/contract/views";

import {
  DIRECTION_LABELS,
  RARITY_LABELS,
  labelled,
  propertyNumberRu,
  researchCostRu,
} from "@/ui/entities/crafting/lib/labels";
import { usePreview } from "@/ui/shared/model/usePreview";
import { BUTTON_LABELS } from "@/ui/shared/ui/buttonLabels";
import { SURFACE_CHOSEN, SURFACE_CONTROL, SURFACE_PANEL, SURFACE_PRIMARY } from "@/ui/shared/ui/surface";

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
 * Цена работы: сложность крупно, а под ней — время, порции и расходники одной строкой.
 *
 * Число стоит там же и так же, как стоит сложность рецепта: одно и то же дело — «против чего
 * бросать» — читается за столом одним взглядом, если выглядит одинаково.
 */
function ResearchCost({ plan }: { plan: NonNullable<PreviewOf<"research_preview">["plan"]> }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-xs text-ink-quiet">Сложность</span>
        <span className="text-2xl font-semibold tabular-nums leading-none">{plan.difficulty}</span>
      </div>
      <p className="text-xs text-ink-quiet">{researchCostRu(plan)}</p>
      {plan.rawSampleRu === null ? null : (
        <p className="text-xs text-ink-quiet">{plan.rawSampleRu}</p>
      )}
    </div>
  );
}

/**
 * Раскрытие свойства у записанного вида: сперва цена работы, под ней — запись находки.
 *
 * В этом порядке, потому что в этом порядке за столом и происходит: сначала решают, браться ли, и
 * лишь потом узнают, что вышло. Номер и редкость спрошены один раз на оба дела — второе поле под то
 * же самое отняло бы место и разошлось бы само с собой. Направление работы спрашивается здесь же:
 * в записанном знании его нет, и вывести приложению не из чего.
 *
 * Название находки приходит из закрытого перечня, а не из свободного поля: совпадение считается
 * тождеством названий, и «лечит», набранное руками, не совпало бы с «Лечением здоровья» никогда.
 * Редкость называет игрок: справочник её не печатает.
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
  const [direction, setDirection] = useState(choices.alchemyDirections[0] ?? "");

  const question: Question = { kind: "research_preview", nameRu, number, rarity, direction };
  const answer = usePreview(question);
  const research: PreviewOf<"research_preview"> | null =
    answer?.kind === "research_preview" ? answer : null;

  return (
    <section
      role="dialog"
      aria-modal="true"
      aria-label={revealPropertyName(nameRu)}
      className={`fixed inset-x-0 bottom-0 z-20 flex flex-col gap-3 p-3 ${SURFACE_PANEL}`}
    >
      <h2 className="text-base font-semibold leading-tight">{nameRu}</h2>

      <div className="grid grid-cols-2 gap-2">
        <label className="flex min-w-0 flex-col gap-1">
          <span className="text-xs text-ink-quiet">Номер</span>
          <select
            value={String(number)}
            onChange={(event) => setNumber(Number(event.target.value))}
            className={`min-h-11 w-full px-2 text-sm ${SURFACE_CONTROL}`}
          >
            {choices.propertyNumbers.map((option) => (
              <option key={option} value={String(option)}>
                {propertyNumberRu(option)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex min-w-0 flex-col gap-1">
          <span className="text-xs text-ink-quiet">Редкость</span>
          <select
            value={rarity}
            onChange={(event) => setRarity(event.target.value)}
            className={`min-h-11 w-full px-2 text-sm ${SURFACE_CONTROL}`}
          >
            {choices.alchemicalRarities.map((option) => (
              <option key={option} value={option}>
                {labelled(RARITY_LABELS, option)}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="flex flex-col gap-1">
        <span className="text-xs text-ink-quiet">Направление работы</span>
        <select
          value={direction}
          onChange={(event) => setDirection(event.target.value)}
          className={`min-h-11 w-full px-2 text-sm ${SURFACE_CONTROL}`}
        >
          {choices.alchemyDirections.map((option) => (
            <option key={option} value={option}>
              {labelled(DIRECTION_LABELS, option)}
            </option>
          ))}
        </select>
      </label>

      {research?.plan == null ? null : <ResearchCost plan={research.plan} />}

      {research?.refusalRu === undefined ? null : (
        <p className="text-xs text-ink-soft">{research.refusalRu}</p>
      )}

      <label className="flex flex-col gap-1">
        <span className="text-xs text-ink-quiet">Свойство</span>
        <select
          value={propertyRu}
          onChange={(event) => setPropertyRu(event.target.value)}
          className={`min-h-11 w-full px-2 text-sm ${SURFACE_CONTROL}`}
        >
          <option value="">Не выбрано</option>
          {choices.alchemyDirections.map((option) => (
            <optgroup key={option} label={labelled(DIRECTION_LABELS, option)}>
              {choices.alchemicalProperties
                .filter((property) => property.direction === option)
                .map((property) => (
                  <option key={property.nameRu} value={property.nameRu}>
                    {property.nameRu}
                  </option>
                ))}
            </optgroup>
          ))}
        </select>
      </label>

      <button
        type="button"
        role="switch"
        aria-checked={ingredient.propertiesExhausted}
        onClick={() => onExhausted(!ingredient.propertiesExhausted)}
        className={`min-h-11 px-3 text-sm ${
          ingredient.propertiesExhausted
          ? `${SURFACE_CHOSEN} font-medium`
          : `text-ink-quiet ${SURFACE_CONTROL}`
        }`}
      >
        Свойств у вида больше нет
      </button>

      {refusalRu === null ? null : (
        <p className="text-xs text-ink-soft">{refusalRu}</p>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onConfirm({ kind: "reveal_property", nameRu, number, propertyRu, rarity })}
          className={`min-h-11 flex-1 ${SURFACE_PRIMARY} px-3 text-sm font-semibold`}
        >
          {BUTTON_LABELS.save}
        </button>
        <button
          type="button"
          onClick={onForget}
          className={`min-h-11 shrink-0 px-3 text-sm ${SURFACE_CONTROL}`}
        >
          Забыть вид
        </button>
        <button
          type="button"
          onClick={onCancel}
          className={`min-h-11 shrink-0 px-3 text-sm ${SURFACE_CONTROL}`}
        >
          {BUTTON_LABELS.dismiss}
        </button>
      </div>
    </section>
  );
}
