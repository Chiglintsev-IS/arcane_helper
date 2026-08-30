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

/**
 * Гроссбух бросков: всё, чем отвечают на просьбу мастера бросить, на одном экране без прокрутки.
 *
 * Столбцы фиксированы, а не подогнаны под содержимое: модификаторы стоят один под другим, и нужное
 * число находится взглядом сверху вниз, а не чтением шести строк подряд. По той же причине знак
 * стоит при числе, а не при подписи — от владения ширина столбца не меняется.
 *
 * Компонент презентационный: числа приходят проекцией, дверь правки выбирает экран.
 */
export function AbilityLedger({
  sheet,
  onEdit,
}: {
  sheet: SheetView;
  onEdit: (edit: SheetEdit) => void;
}) {
  return (
    <div className="flex flex-col gap-[5px]">
      {/*
       * Слагаемое, общее всем числам ниже, названо один раз и над ними: повторённое у каждого
       * владения, оно заняло бы восемнадцать строк ради одной и той же тройки.
       */}
      <div
        className={`flex h-[26px] items-center justify-between px-2.5 ${SURFACE_GROUP}`}
      >
        <span className="whitespace-nowrap text-xs text-ink-soft">
          {DERIVED_LABELS.proficiencyBonus}{" "}
          <b className="text-[0.9375rem] font-bold text-ink">{signed(sheet.proficiencyBonus)}</b>
        </span>
        <span className="whitespace-nowrap text-[0.6875rem] text-ink-quiet">
          <span aria-hidden="true" className="text-accent">
            {PROFICIENT_MARK.glyph}
          </span>{" "}
          {PROFICIENT_MARK.labelRu}
        </span>
      </div>

      {abilityLedger(sheet).map((ability) => (
        <AbilityGroup key={ability.id} ability={ability} onEdit={onEdit} />
      ))}
    </div>
  );
}

/**
 * Отметка владения при числе: знак для глаза, слово для голоса.
 *
 * Знак помечен `aria-hidden`, потому что рядом стоит слово: цвет и точка сами по себе значения не
 * несут, и без слова владение осталось бы видимым только зрячему.
 */
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

/**
 * Одна характеристика: шапка со своими числами и её навыки под ней.
 *
 * Шапка целиком — дверь правки: за ней правят и значение, и владение спасброском, и степени владения
 * навыками, то есть ровно то, что в группе и показано. Знака правки при ней нет: нажимается вся
 * строка, и значок обещал бы, что правка живёт в нём одном, — а на 320 пикселях он забирал бы у
 * чисел восьмую часть ширины ради этого обещания.
 */
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

      {/*
       * Навыки в две колонки: в одну восемнадцать строк заняли бы полтора экрана, и «Броски»
       * перестали бы отвечать на свой вопрос одним взглядом. Перенос подписи запрещён — колонка
       * подогнана под самую длинную из них, и переносящаяся строка ломала бы шаг в 22 пикселя.
       */}
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
