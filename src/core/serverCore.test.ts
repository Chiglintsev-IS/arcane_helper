import { describe, expect, it } from "vitest";

import { serverCore } from "./serverCore";

describe("ядро серверного процесса", () => {
  it("отвечает снимком открытой сессии", async () => {
    expect(await serverCore().read()).toMatchObject({ version: 0 });
  });

  it("одно на процесс: три маршрута говорят с одной игрой", async () => {
    await serverCore().handle({ commandId: "попытка", command: { kind: "start_combat" } });

    expect(await serverCore().read()).toMatchObject({ turn: { inFight: true } });
  });
});
