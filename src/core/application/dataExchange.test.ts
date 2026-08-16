import { describe, expect, it } from "vitest";
import { withSpentSlots } from "@/core/infrastructure/catalog/thorne/fixtures";

import { loadThorneSpells } from "@/core/infrastructure/catalog/thorne";
import { createThorne } from "@/core/infrastructure/catalog/thorne/character";
import { EXPORT_SCHEMA_VERSION } from "@/core/domain/assembly/state";

import {
  applyImport,
  checkIntegrity,
  exportFileName,
  exportSnapshot,
  parseImport,
} from "@/core/application/dataExchange";

const SPELLS = loadThorneSpells();
const NOW = "2026-07-31T18:00:00.000Z";

function snapshotText(): string {
  return JSON.stringify(exportSnapshot(createThorne(), SPELLS, NOW));
}

describe("exportSnapshot (FR-120)", () => {
  it("выгружает персонажа целиком и все карточки", () => {
    const file = exportSnapshot(createThorne(), SPELLS, NOW);

    expect(file.schemaVersion).toBe(EXPORT_SCHEMA_VERSION);
    expect(file.spells).toHaveLength(29);
    expect(file.character.preparedSpellIds).toHaveLength(11);
  });

  it("включает пользовательские дополнения: заметки и остаток ресурсов", () => {
    // Смысл резервной копии — восстановиться там, где остановились, а не начать заново.
    const character = {
      ...withSpentSlots(createThorne(), 1, 3),
      spellNotes: { shield: "мастер считает, что гасит и стрелу" },
    };

    const file = exportSnapshot(character, SPELLS, NOW);
    expect(file.character.spellNotes.shield).toContain("стрелу");
    expect(file.character.spellSlots[1]?.remaining).toBe(1);
  });

  it("имя файла содержит дату: иначе в папке десять одинаковых", () => {
    expect(exportFileName(NOW)).toBe("arcane-helper-2026-07-31.json");
  });
});

describe("parseImport (FR-121)", () => {
  it("принимает собственную выгрузку", () => {
    const outcome = parseImport(snapshotText());

    expect(outcome.ok).toBe(true);
    if (outcome.ok) expect(outcome.file.spells).toHaveLength(29);
  });

  it("не-JSON отклоняется словами, а не исключением", () => {
    const outcome = parseImport("это не файл");
    expect(outcome).toEqual({ ok: false, reasonRu: expect.stringContaining("не JSON") });
  });

  it("файл более новой версии отклоняется с внятной причиной", () => {
    const raw = {
      ...JSON.parse(snapshotText()),
      schemaVersion: EXPORT_SCHEMA_VERSION + 1,
    };

    const outcome = parseImport(JSON.stringify(raw));
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.reasonRu).toContain("Обновите приложение");
  });

  it("ошибка называет путь до поля, а не «ошибка импорта»", () => {
    const raw = {
      ...JSON.parse(snapshotText()),
      character: { ...JSON.parse(snapshotText()).character, hitPoints: { ...JSON.parse(snapshotText()).character.hitPoints, maximumBase: -5 } },
    };

    const outcome = parseImport(JSON.stringify(raw));
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.reasonRu).toContain("hitPoints.maximumBase");
  });

  it("испорченный файл называет причину по-русски, а не словами библиотеки", () => {
    const raw = { ...JSON.parse(snapshotText()), character: null };

    const outcome = parseImport(JSON.stringify(raw));
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.reasonRu).toContain("ожидалось объект, получено пустое значение");
  });

  it("битая карточка называет свой номер", () => {
    const raw = JSON.parse(snapshotText());
    raw.spells[2].level = 99;

    const outcome = parseImport(JSON.stringify(raw));
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.reasonRu).toContain("Карточка №3");
  });

  it("ссылка в пустоту не проходит: подготовленное без карточки открыть нечем", () => {
    const raw = {
      ...JSON.parse(snapshotText()),
      spells: JSON.parse(snapshotText()).spells.filter((spell: { id: string }) => spell.id !== "shield"),
    };

    const outcome = parseImport(JSON.stringify(raw));
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.reasonRu).toContain("«shield»");
  });

  it("пустой файл без версии отклоняется структурной проверкой", () => {
    expect(parseImport("{}").ok).toBe(false);
    expect(parseImport("null").ok).toBe(false);
  });
});

describe("checkIntegrity (FR-121)", () => {
  it("на согласованных данных молчит", () => {
    expect(checkIntegrity(createThorne(), SPELLS)).toBeNull();
  });

  it("ловит заговор без карточки", () => {
    const character = {
      ...createThorne(),
      cantripIds: [...createThorne().cantripIds, "fireball"],
    };
    expect(checkIntegrity(character, SPELLS)).toContain("fireball");
  });

  it("называет набор по-русски: сообщение читает игрок, а не автор схемы", () => {
    const character = {
      ...createThorne(),
      cantripIds: [...createThorne().cantripIds, "fireball"],
    };
    expect(checkIntegrity(character, SPELLS)).toContain("заговоры");
  });

  it("проверяет и книгу: карточка нужна не только подготовленному", () => {
    const character = {
      ...createThorne(),
      spellbookSpellIds: [...createThorne().spellbookSpellIds, "wish"],
    };
    expect(checkIntegrity(character, SPELLS)).toContain("книга заклинаний");
  });

  it("говорит про каталог, а не про файл: проверка работает и при возврате к встроенному", () => {
    const withoutShield = SPELLS.filter((spell) => spell.id !== "shield");
    expect(checkIntegrity(createThorne(), withoutShield)).toContain("каталоге");
  });
});

describe("applyImport (FR-122)", () => {
  it("полная замена ставит состояние из файла", () => {
    const outcome = parseImport(snapshotText());
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;

    const spent = withSpentSlots(createThorne(), 1, 4);

    const applied = applyImport(spent, outcome.file, "replace");
    expect(applied.character.spellSlots[1]?.remaining).toBe(4);
  });

  it("«только карточки» сохраняет ресурсы: это режим для игры", () => {
    const outcome = parseImport(snapshotText());
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;

    const spent = withSpentSlots(createThorne(), 1, 4);

    const applied = applyImport(spent, outcome.file, "spells_only");
    expect(applied.character.spellSlots[1]?.remaining).toBe(0);
    expect(applied.spells).toHaveLength(29);
  });
});
