import { serverCore } from "@/core/serverCore";

export async function GET(): Promise<Response> {
  return Response.json(await serverCore().read());
}
