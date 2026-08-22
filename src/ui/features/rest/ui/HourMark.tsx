/**
 * «Прошёл час»: единственная кнопка на два режима — «Игра» и «Привал».
 *
 * Один компонент, а не две реализации: та же кнопка, показанная в двух местах, обязана исчезать,
 * называть итог и гаснуть в бою одинаково — иначе один из режимов рано или поздно забудет про
 * правку, внесённую в другом.
 *
 * Подпись называет числа заранее: нажатие, меняющее их молча, за столом не прощают.
 */

"use client";

import type { RecoveryView } from "@/contract/views";
import { RestActionButton } from "./RestActionButton";

/**
 * Подпись «Прошёл час»: называет всё, что случится именно сейчас, и только это. Что без остатка,
 * не упомянуто — иначе кнопка обещала бы то, чего не сделает.
 *
 * Факты те же, что в записи журнала, но время другое: кнопка обещает, журнал сообщает. Одна
 * строка на оба случая читалась бы за столом как «уже произошло».
 */
function hourLabel(maximumReturn: number, healed: number): string {
  const facts = [
    ...(maximumReturn > 0 ? [`максимум +${maximumReturn}`] : []),
    ...(healed > 0 ? [`регенерация +${healed}`] : []),
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
  const { maximumReturned, healed, unavailabilityRu } = nextHour;
  // Кнопка, которая гарантированно ответит отказом, занимает ряд и обещает возможность, которой
  // нет: часу нечего менять — кнопки тоже нет.
  if (maximumReturned <= 0 && healed <= 0) return null;

  return (
    <RestActionButton
      onClick={onRecoverMaximum}
      name={hourLabel(maximumReturned, healed)}
      {...(unavailabilityRu === undefined ? {} : { disabledReason: unavailabilityRu })}
    />
  );
}
