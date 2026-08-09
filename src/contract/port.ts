/**
 * Дверь в ядро. Один тип на оба режима: играет ли приложение само с собой или ходит к серверу,
 * отображение видит одно и то же.
 *
 * Асинхронная по объявлению, а не по нужде сегодняшнего дня. Синхронная дверь, которую однажды
 * придётся сделать асинхронной, — это правка каждого места вызова, и делать её дважды незачем.
 */

import type { Envelope } from "./commands";
import type { Preview, Question } from "./questions";
import type { Result } from "./result";
import type { Snapshot } from "./snapshot";

export type ArcaneApi = {
  /** Открыть сессию: прочитать сохранённое либо начать заново. Повтор безвреден. */
  open(): Promise<Snapshot>;
  execute(envelope: Envelope): Promise<Result>;
  /** Спросить про ненабранное. Состояния не меняет, поэтому повтор безвреден и здесь. */
  ask(question: Question): Promise<Preview>;
};
