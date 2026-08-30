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
