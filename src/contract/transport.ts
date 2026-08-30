export type Transport = {
  read(): Promise<unknown>;
  readRaw(): Promise<unknown>;
  send(command: unknown): Promise<unknown>;
  ask(question: unknown): Promise<unknown>;
};
