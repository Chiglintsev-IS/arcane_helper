/** `crypto.randomUUID` есть и в браузере, и в Node: одна реализация годится обеим сборкам. */

import type { Clock } from "@/core/application/ports/clock";

export function systemClock(): Clock {
  return {
    now: () => new Date().toISOString(),
    nextId: () => crypto.randomUUID(),
  };
}
