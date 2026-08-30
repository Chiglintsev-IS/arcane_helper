import type { Envelope } from "./commands";
import type { Preview, Question } from "./questions";
import type { RawSave } from "./rawSave";
import type { Result } from "./result";
import type { Snapshot } from "./snapshot";

export type ArcaneApi = {
  open(): Promise<Snapshot>;
  readRaw(): Promise<RawSave>;
  execute(envelope: Envelope): Promise<Result>;
  ask(question: Question): Promise<Preview>;
};
