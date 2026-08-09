/**
 * Ведущий адаптер: сообщение снаружи — в вызов собранного ядра и обратно.
 *
 * Про протокол не знает ничего: принимает `unknown`, отдаёт `unknown`. Всё знание о HTTP живёт в
 * трёх строках маршрута, поэтому один и тот же хендлер обслуживает и провод внутри процесса, и
 * сеть, и что угодно ещё.
 *
 * Отказ по правилам становится ответом, дефект остаётся исключением. Разница не косметическая: по
 * отказу игроку есть что сделать, по дефекту — нечего, и выдавать второе за первое значит врать
 * ему словами правил.
 */

import { envelopeSchema, type Envelope } from "@/contract/commands";

import { DomainError } from "@/core/domain/shared/errors";
import type { LiveSession } from "@/core/application/session";

import { toSnapshot } from "./presenter";

/** Чем хендлер располагает: собранное ядро, знающее своё состояние и его версию. */
type Application = {
  open(): Promise<{ live: LiveSession; version: number }>;
  execute(envelope: Envelope): Promise<{ live: LiveSession; version: number }>;
};

/** Дверь ядра до провода: то же, что порт договора, но в сыром виде. */
export type Backend = {
  read(): Promise<unknown>;
  handle(raw: unknown): Promise<unknown>;
};

export function createHandler(application: Application): Backend {
  return {
    async read(): Promise<unknown> {
      const { live, version } = await application.open();
      return toSnapshot(live, version);
    },

    async handle(raw: unknown): Promise<unknown> {
      const parsed = envelopeSchema.safeParse(raw);
      if (!parsed.success) {
        const reasons = parsed.error.issues
          .slice(0, 3)
          .map((issue) => `${issue.path.join(".") || "—"}: ${issue.message}`)
          .join("; ");
        return { ok: false, reasonRu: `Команда не разобрана — ${reasons}` };
      }

      try {
        const { live, version } = await application.execute(parsed.data);
        return { ok: true, snapshot: toSnapshot(live, version) };
      } catch (error: unknown) {
        if (error instanceof DomainError) return { ok: false, reasonRu: error.message };
        throw error;
      }
    },
  };
}
