import { describe, expect, it } from "vitest";

import type { Spell } from "@/core/domain/catalog/spell";
import { createSession, undoLast, type Occasion, type Session } from "@/core/application/session";
import { castSpell } from "@/core/application/useCases/casting";
import { loadThorneSpells } from "@/core/infrastructure/catalog/thorne";
import { createWizard } from "@/core/infrastructure/catalog/thorne/fixtures";
import { renameEffect, setArmorClassAdjustment, startManualEffect } from "./effects";

function testOccasion(commandId: string): Occasion {
  let tick = 0;
  return {
    now: () => new Date(Date.UTC(2026, 8, 26, 18, 0, tick)).toISOString(),
    nextId: () => `${commandId}-${++tick}`,
    commandId,
  };
}

function spell(id: string): Spell {
  const found = loadThorneSpells().find((candidate) => candidate.id === id);
  if (found === undefined) throw new Error(`нет карточки ${id}`);
  return found;
}

function withStatus(nameRu: string): Session {
  return startManualEffect(createSession(createWizard()), { nameRu }, testOccasion("status"));
}

function onlyEffectId(session: Session): string {
  const [effect] = session.character.activeEffects;
  if (effect === undefined) throw new Error("на доске ничего нет");
  return effect.id;
}

describe("переименование статуса", () => {
  it("набранный статус несёт признак статуса", () => {
    expect(withStatus("Отравлн").character.activeEffects[0]?.manualKind).toBe("status");
  });

  it("новое название записывается в лог, и отмена возвращает прежнее", () => {
    const typo = withStatus("Отравлн");

    const renamed = renameEffect(typo, onlyEffectId(typo), "Отравлен", testOccasion("rename"));

    expect(renamed.character.activeEffects[0]?.nameRu).toBe("Отравлен");
    expect(renamed.log).toHaveLength(2);
    expect(renamed.log.at(-1)?.summaryRu).toBe("Эффект переименован: Отравлн → Отравлен");
    expect(undoLast(renamed).character.activeEffects[0]?.nameRu).toBe("Отравлн");
  });

  it("название без изменений ничего не меняет и в лог не пишется", () => {
    const status = withStatus("Отравлен");

    const same = renameEffect(status, onlyEffectId(status), " Отравлен ", testOccasion("rename"));

    expect(same).toBe(status);
  });

  it("эффект заклинания переименованию не подлежит", () => {
    const cast = castSpell(
      createSession(createWizard()),
      { spell: spell("detect-magic"), mode: "normal", payment: { kind: "slot", slotLevel: 1 } },
      testOccasion("cast"),
    );

    expect(() =>
      renameEffect(cast, onlyEffectId(cast), "Чутьё", testOccasion("rename")),
    ).toThrow(
      "«Обнаружение магии» не статус: переименовать можно только статус, набранный вручную",
    );
  });

  it("поправка к КД переименованию не подлежит", () => {
    const adjusted = setArmorClassAdjustment(
      createSession(createWizard()),
      2,
      testOccasion("adjust"),
    );

    expect(() =>
      renameEffect(adjusted, onlyEffectId(adjusted), "Прикрытие", testOccasion("rename")),
    ).toThrow("«Поправка к КД» не статус: переименовать можно только статус, набранный вручную");
  });

  it("пустое название отвергается той же причиной, что и при заведении статуса", () => {
    const status = withStatus("Отравлен");

    expect(() =>
      renameEffect(status, onlyEffectId(status), "   ", testOccasion("rename")),
    ).toThrow("Название эффекта не может быть пустым");
    expect(() =>
      startManualEffect(createSession(createWizard()), { nameRu: "   " }, testOccasion("empty")),
    ).toThrow("Название эффекта не может быть пустым");
  });
});
