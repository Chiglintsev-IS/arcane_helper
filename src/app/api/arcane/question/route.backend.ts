/** Вопрос: посчитать предпросмотр по ненабранному. Состояния не меняет, поэтому повтор безвреден. */

import { serverCore } from "@/core/serverCore";

export async function POST(request: Request): Promise<Response> {
  return Response.json(await serverCore().answer(await request.json()));
}
