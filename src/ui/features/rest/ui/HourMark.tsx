"use client";

import type { RecoveryView } from "@/contract/views";
import { RestActionButton } from "./RestActionButton";

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
  if (maximumReturned <= 0 && healed <= 0) return null;

  return (
    <RestActionButton
      onClick={onRecoverMaximum}
      name={hourLabel(maximumReturned, healed)}
      {...(unavailabilityRu === undefined ? {} : { disabledReason: unavailabilityRu })}
    />
  );
}
