/** Чтение: открыть сессию и отдать снимок. Всё, что знает маршрут о ядре, — это его дверь. */

import { serverCore } from "@/core/serverCore";

export async function GET(): Promise<Response> {
  return Response.json(await serverCore().read());
}
