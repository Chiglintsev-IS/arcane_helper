/**
 * Ответ на команду: применено либо отказано с причиной.
 *
 * Отказ по правилам — обычный ответ, а не исключение: он доезжает по проводу и показывается там,
 * где набирали. Исключением остаётся дефект — то, чего случиться не должно было; он не превращается
 * в текст для игрока, потому что игроку по нему делать нечего.
 */

import { z } from "zod";

import { snapshotSchema } from "./snapshot";

export const resultSchema = z.discriminatedUnion("ok", [
  z.object({ ok: z.literal(true), snapshot: snapshotSchema }),
  z.object({ ok: z.literal(false), reasonRu: z.string().min(1) }),
]);

export type Result = z.infer<typeof resultSchema>;
