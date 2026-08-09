/**
 * Системные часы: реализация порта времени.
 *
 * Идентификаторы — `crypto.randomUUID`: он есть и в браузере, и в Node, поэтому одна реализация
 * годится обоим местам, где ядро может оказаться собранным.
 */

import type { Clock } from "@/core/application/ports/clock";

export function systemClock(): Clock {
  return {
    now: () => new Date().toISOString(),
    nextId: () => crypto.randomUUID(),
  };
}
