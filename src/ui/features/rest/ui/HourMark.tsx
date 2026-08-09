/**
 * «Прошёл час»: единственная кнопка на два режима — «Игра» и «Привал».
 *
 * Один компонент, а не две реализации: та же кнопка, показанная в двух местах, обязана исчезать,
 * называть итог и гаснуть в бою одинаково — иначе один из режимов рано или поздно забудет про
 * правку, внесённую в другом.
 *
 * Час не только даёт, но и берёт: сгорят очки заклинаний, созданные до него. Подпись обязана
 * назвать это число заранее — нажатие тратит ресурс молча, а строка списка так не делает ни для
 * одного заклинания.
 */

"use client";

import type { RecoveryView } from "@/contract/views";
import { withPlural } from "@/core/shared/language";
import { RestActionButton } from "./RestActionButton";

/**
 * Подпись «Прошёл час»: называет всё, что случится именно сейчас, и только это. Максимум без
 * остатка не упомянут, очков без остатка тоже нет — иначе кнопка обещала бы то, чего не сделает.
 *
 * Три факта те же, что в записи журнала, но время другое: кнопка обещает, журнал сообщает. Одна
 * строка на оба случая читалась бы за столом как «уже произошло».
 */
function hourLabel(maximumReturn: number, healed: number, spellPoints: number): string {
  const facts = [
    ...(maximumReturn > 0 ? [`максимум +${maximumReturn}`] : []),
    ...(healed > 0 ? [`регенерация +${healed}`] : []),
    ...(spellPoints > 0 ? [`сгорит ${withPlural(spellPoints, ["очко", "очка", "очков"])}`] : []),
  ];
  return facts.length === 0 ? "Прошёл час" : `Прошёл час · ${facts.join(", ")}`;
}

export function HourMark({
  nextHour,
  onRecoverMaximum,
}: {
  nextHour: RecoveryView["nextHour"];
  onRecoverMaximum: () => void;
}) {
  const { maximumReturned, healed, spellPointsLost, unavailabilityRu } = nextHour;
  // Кнопка, которая гарантированно ответит отказом, занимает ряд и обещает возможность, которой
  // нет: часу нечего менять — кнопки тоже нет.
  if (maximumReturned <= 0 && healed <= 0 && spellPointsLost <= 0) return null;

  return (
    <RestActionButton
      onClick={onRecoverMaximum}
      name={hourLabel(maximumReturned, healed, spellPointsLost)}
      {...(unavailabilityRu === undefined ? {} : { disabledReason: unavailabilityRu })}
    />
  );
}
