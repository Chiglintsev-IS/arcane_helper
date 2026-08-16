/**
 * Провод внутри процесса.
 *
 * Сообщение всё равно проходит через сериализацию. Соблазн срезать здесь угол — «в одном процессе
 * сериализовать нечего» — и есть то, что делает границу воображаемой: несериализуемое значение
 * прошло бы локально и упало по сети, то есть в тот день, когда отлаживать дороже всего. С этим
 * проходом каждая игра без сети доказывает сетевой договор, и прогоны тоже.
 *
 * Цена нулевая: состояние и так уходит в хранилище сериализованным на каждом изменении.
 */

import type { Transport } from "@/contract/transport";

import type { Backend } from "./handler";

function wire(value: unknown): unknown {
  return JSON.parse(JSON.stringify(value));
}

export function createLocalTransport(backend: Backend): Transport {
  return {
    async read(): Promise<unknown> {
      return wire(await backend.read());
    },

    async readRaw(): Promise<unknown> {
      return wire(await backend.readRaw());
    },

    async send(command: unknown): Promise<unknown> {
      return wire(await backend.handle(wire(command)));
    },

    async ask(question: unknown): Promise<unknown> {
      return wire(await backend.answer(wire(question)));
    },
  };
}
