/** Запись: доставить команду. Разбирает её ядро — маршрут возит тело и не заглядывает внутрь. */

import { serverCore } from "@/core/serverCore";

export async function POST(request: Request): Promise<Response> {
  return Response.json(await serverCore().handle(await request.json()));
}
