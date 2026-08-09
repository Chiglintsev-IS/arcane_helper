/**
 * Проекция кровавого колдовства: цена очка, границы одной сделки и то, что ей мешает.
 *
 * Проверяется, что помеха приходит от той же проверки, которой откажет подтверждение: строка списка
 * и мастер обмена обязаны называть один запрет одними словами.
 */

import { describe, expect, it } from "vitest";

import { createSession, type Occasion, type Session } from "@/core/application/session";
import { castSpell } from "@/core/application/useCases/casting";
import { setSunlight } from "@/core/application/useCases/health";
import { startCombat } from "@/core/application/useCases/turn";
import { loadThorneSpells } from "@/core/infrastructure/catalog/thorne";
import { createThorne } from "@/core/infrastructure/catalog/thorne/character";
import { withDamage } from "@/core/infrastructure/catalog/thorne/fixtures";

import { toBloodMagicView } from "./bloodMagicView";

const OCCASION: Occasion = {
  now: () => "2026-07-31T18:00:00.000Z",
  nextId: () => "id-1",
  commandId: "command-1",
};

const spells = loadThorneSpells();

function fresh(character = createThorne()): Session {
  return createSession(character);
}

describe("цена и границы обмена", () => {
  it("курс ступени возвышения: у Торна три хита за очко", () => {
    expect(toBloodMagicView(fresh()).hitPointsPerPoint).toBe(3);
  });

  it("потолок сделки — сколько очков покупают нынешние хиты", () => {
    // 60 хитов по три за очко: двадцать очков и ни одним больше.
    expect(toBloodMagicView(fresh()).points.maximum).toBe(20);
  });

  it("начинает с самого дешёвого заклинания, а не с потолка и не с бесполезного очка", () => {
    const { points } = toBloodMagicView(fresh());

    expect(points.minimum).toBe(1);
    expect(points.initial).toBe(2);
  });

  it("почти без хитов потолок ниже начального, и начальным становится он", () => {
    const bleeding = fresh(withDamage(createThorne(), 58));

    expect(toBloodMagicView(bleeding).points).toMatchObject({ maximum: 1, initial: 1 });
  });
});

describe("что мешает обмену", () => {
  it("свободному персонажу ничто не мешает", () => {
    expect(toBloodMagicView(fresh()).warningsRu).toEqual([]);
  });

  it("под прямым солнцем особенность подавлена, и это названо словами", () => {
    const suppressed = setSunlight(fresh(), true, OCCASION);

    expect(toBloodMagicView(suppressed).warningsRu[0]).toContain("солнечн");
  });

  it("потраченное действие мешает обмену так же, как и заклинанию", () => {
    const spell = spells.find((candidate) => candidate.id === "mage-armor")!;
    const spent = castSpell(
      startCombat(fresh(), OCCASION),
      { spell, mode: "normal", payment: { kind: "slot", slotLevel: 1 } },
      OCCASION,
    );

    expect(toBloodMagicView(spent).warningsRu).toContain("Действие уже израсходовано");
  });
});
