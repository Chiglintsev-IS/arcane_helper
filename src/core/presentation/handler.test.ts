/**
 * Ведущий адаптер: разбор сообщения и разница между отказом и дефектом.
 *
 * Отказ по правилам — обычный ответ, по нему игроку есть что делать. Дефект — не ответ вовсе: он
 * летит наверх, потому что выдать его за причину отказа значит соврать игроку словами правил.
 */

import { describe, expect, it } from "vitest";

import { createThorne } from "@/core/infrastructure/catalog/thorne/character";
import { loadThorneSpells } from "@/core/infrastructure/catalog/thorne";
import { DomainError } from "@/core/domain/shared/errors";
import { createSession, type LiveSession } from "@/core/application/session";

import { createHandler } from "./handler";

function live(): LiveSession {
  return {
    session: createSession(createThorne()),
    spellCatalog: loadThorneSpells(),
    spellCatalogSource: "built_in",
  };
}

const OPENED = { live: live(), version: 0 };

/** Часы двери: снимку они не нужны, а выгрузке — да. */
const NOW = "2026-07-31T18:00:00.000Z";

/** Что лежит в хранилище: дверь отдаёт это копией, ни во что не разбирая. */
const STORED = { schemaVersion: 1, savedAt: "", character: {} };

function handlerThat(
  execute: () => Promise<{ live: LiveSession; version: number }>,
  readStored: () => Promise<unknown> = async () => STORED,
) {
  return createHandler({ now: () => NOW, open: async () => OPENED, readStored, execute });
}

describe("чтение", () => {
  it("отдаёт снимок с версией, проекциями и логом", async () => {
    const handler = handlerThat(async () => OPENED);

    const snapshot = await handler.read();

    expect(snapshot).toMatchObject({ version: 0, log: [] });
    // Состав проекции проверяет её собственный прогон; здесь важно, что она доехала.
    expect(snapshot).toHaveProperty("sheet.name", "Торн");
  });

  it("сырое содержимое едет текстом и со своим именем файла", async () => {
    const handler = handlerThat(async () => OPENED);

    const copy = await handler.readRaw();

    expect(copy).toHaveProperty("fileName", "arcane-helper-raw-2026-07-31.json");
    expect(copy).toHaveProperty("text", JSON.stringify(STORED, null, 2));
  });

  it("пустое хранилище копией не притворяется", async () => {
    const handler = handlerThat(async () => OPENED, async () => null);

    expect(await handler.readRaw()).toBeNull();
  });
});

describe("разбор сообщения", () => {
  it("сообщение не по договору отвергается, а не ломает ядро", async () => {
    const handler = handlerThat(async () => OPENED);

    const answer = await handler.handle({ commandId: "", command: { kind: "нет-такой" } });

    expect(answer).toMatchObject({ ok: false });
    expect(answer).toHaveProperty("reasonRu", expect.stringMatching(/Команда не разобрана/));
  });

  it("не-объект отвергается: замечанию без поля причина всё равно называется", async () => {
    const handler = handlerThat(async () => OPENED);

    const answer = await handler.handle(null);

    expect(answer).toHaveProperty("reasonRu", expect.stringMatching(/Команда не разобрана/));
  });

  it("причина, по которой команда не разобрана, названа по-русски", async () => {
    const handler = handlerThat(async () => OPENED);

    const answer = await handler.handle(null);

    expect(answer).toHaveProperty(
      "reasonRu",
      expect.stringContaining("ожидалось объект, получено пустое значение"),
    );
  });

  it("до сценария неразобранное не доходит", async () => {
    let reached = false;
    const handler = handlerThat(async () => {
      reached = true;
      return OPENED;
    });

    await handler.handle({ ерунда: true });

    expect(reached).toBe(false);
  });
});

describe("отказ и дефект", () => {
  it("отказ по правилам становится ответом со словами владельца", async () => {
    const handler = handlerThat(async () => {
      throw new DomainError("Заклинание с ячейкой требует способа оплаты");
    });

    const answer = await handler.handle({ commandId: "command-1", command: { kind: "long_rest" } });

    expect(answer).toEqual({ ok: false, reasonRu: "Заклинание с ячейкой требует способа оплаты" });
  });

  it("дефект остаётся исключением: игроку по нему делать нечего", async () => {
    const handler = handlerThat(async () => {
      throw new TypeError("undefined is not a function");
    });

    await expect(
      handler.handle({ commandId: "command-1", command: { kind: "long_rest" } }),
    ).rejects.toThrow(TypeError);
  });
});
