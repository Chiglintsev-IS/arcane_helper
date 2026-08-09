/**
 * Клиент договора. Один на оба режима: отличается только провод, под которым он собран.
 *
 * Второй реализации порта не бывает намеренно. Пара независимых реализаций — то же самое, что
 * отсутствие порта: они расходятся молча, и локальная перестаёт доказывать сетевую.
 *
 * Разбор схемой идёт в обе стороны и всегда, включая игру без сети. Стоит он микросекунды, а
 * взамен нарушить договор нечем: команда, которую не принял бы сервер, не уезжает и в локальном
 * режиме.
 */

import { envelopeSchema, type Envelope } from "./commands";
import { resultSchema, type Result } from "./result";
import { snapshotSchema, type Snapshot } from "./snapshot";
import type { ArcaneApi } from "./port";
import type { Transport } from "./transport";

export function createClient(transport: Transport): ArcaneApi {
  return {
    async open(): Promise<Snapshot> {
      return snapshotSchema.parse(await transport.read());
    },

    async execute(envelope: Envelope): Promise<Result> {
      return resultSchema.parse(await transport.send(envelopeSchema.parse(envelope)));
    },
  };
}
