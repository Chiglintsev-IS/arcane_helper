/** Чтение мимо разбора: содержимое хранилища копией, когда сессия не открылась. */

import { serverCore } from "@/core/serverCore";

export async function GET(): Promise<Response> {
  return Response.json(await serverCore().readRaw());
}
