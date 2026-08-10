#!/usr/bin/env python3
"""Проверка живости экспортов ядра.

    python3 scripts/check-dead-code.py
    python3 scripts/check-dead-code.py --list

Экспорт — обещание: «этим пользуются снаружи». Экспорт, которого не импортирует ни один рабочий
файл, обещание не держит: он живёт собственными прогонами, читается как рабочая поверхность и
переживает переносы, потому что удалять его никому не страшно и никому не нужно. Такие символы
годами лежали в ядре, а поле состояния писалось и нигде не читалось.

Что проверяется: у каждого экспорта файла `src/core/**` (кроме прогонов) есть хотя бы один
импортёр среди не-прогонов `src/**` и `e2e/**`. Типы проверяются наравне со значениями: мёртвый
тип так же обещает контракт, которого никто не спрашивает, и так же попадает в переименования и
переносы.

Использование внутри своего файла импортёром не считается: это ошибка не «символ мёртв», а
«лишнее слово `export`» — снять его и есть починка.

Импортом считается и отложенная форма — `const { … } = await import("…")`: символом пользуются так
же, и не считать её значило бы объявить мёртвым ровно то, что приезжает выбором провода.

Совпадение ищется парой (модуль, имя), а не словом: одноимённые символы в разных модулях иначе
прикрывают друг друга, и мёртвый экспорт остаётся незамеченным, пока живо чужое такое же имя.

Прогоном считается файл с `.test.` или `.spec.` в имени, обычный модуль, импортирующий `vitest`, и
модуль поддержки прогонов из списка ниже: набор проверок хранилища и состояния Торна для прогонов
лежат обычными модулями, но принадлежат прогонам, а не рабочему пути.

Реэкспорты здесь не разбираются: посредник, пересдающий чужой символ, запрещён проверкой границ, и
единственный путь к символу — прямой импорт у владельца.

Базлайна у проверки нет. Единственная форма исключения — `ALLOWED_TEST_ONLY` ниже, и каждая запись
в нём несёт обоснование.
"""

import os
import pathlib
import re
import sys

SRC = pathlib.Path("src")
ROOTS = (SRC, pathlib.Path("e2e"))
CORE = SRC / "core"
SUFFIXES = (".ts", ".tsx")

# Модули, которые сами по себе часть прогонов, хотя лежат обычными модулями. Их экспорты живут по
# праву, а их импорты никого живым не делают. Каждая запись — с обоснованием.
TEST_SUPPORT_MODULES = {
    # Общий набор проверок обеих реализаций хранилища: он и есть прогоны, вынесенные модулем, чтобы
    # память и Dexie проверялись одним текстом.
    "src/core/infrastructure/persistence/repositoryContract.ts",
    # Состояния Торна для прогонов: собираются игровыми операциями, а не словарём, и потому живут
    # рядом с самим Торном, а не переписываются в каждом прогоне заново.
    "src/core/infrastructure/catalog/thorne/fixtures.ts",
}

# Экспорт, живущий по праву без импортёров вне прогонов. Каждая запись — с обоснованием.
ALLOWED_TEST_ONLY: set[tuple[str, str]] = {
    # Канонический признак «ход цел»: фикстура десятков прогонов доступности и отбора. Рабочий код
    # собирает признаки хода из состояния, поэтому импортёра вне прогонов у неё нет и не будет.
    ("src/core/application/casting/availability.ts", "ALL_TURN_RESOURCES"),
    # Реестр запретов кампании и вредные виду типы урона: запрет — данные с причиной, а не
    # отсутствие записи. Рабочий код их не читает по построению — запрещённого в контенте просто
    # нет, — и единственный законный читатель реестра это проверка контента.
    ("src/core/infrastructure/catalog/thorne/index.ts", "BANNED_SPELLS"),
    ("src/core/infrastructure/catalog/thorne/index.ts", "HARMFUL_DAMAGE_TYPES"),
    # Разбор карточек списком и его отказ: параметр существует ради проверки защитных ветвей на
    # битых данных. Рабочий путь идёт через `loadThorneSpells`, которому подать битое нечем, и без
    # этой пары ветви отказа никогда не исполнялись бы.
    ("src/core/infrastructure/catalog/thorne/index.ts", "parseSpells"),
    ("src/core/infrastructure/catalog/thorne/index.ts", "ContentError"),
    # Объявленные виды сбоя порта хранилища: битые данные и версия из будущего. Рабочий путь
    # показывает игроку причину словами, а различие видов — контракт, который держат обе
    # реализации, и проверяется он общим набором.
    ("src/core/application/ports/sessionRepository.ts", "StorageCorruptedError"),
    ("src/core/application/ports/sessionRepository.ts", "StorageVersionError"),
    # Форма ячеек заклинаний: рабочий путь всегда несёт её частью состояния персонажа, типизированного
    # схемой, и называет её по имени только тест, строящий фикстуру уровня ячеек напрямую.
    ("src/core/domain/arcana/slots.ts", "SpellSlots"),
}

EXPORT_DECLARATION = re.compile(
    r"^export\s+(?:async\s+)?(?:function|const|let|class|type|interface|enum)\s+(\w+)", re.M
)
EXPORT_LIST = re.compile(
    r"^export\s+(?:type\s+)?\{([^}]*)\}(?:\s*from\s*[\"']([^\"']+)[\"'])?", re.M | re.S
)
IMPORT_LIST = re.compile(r"import\s+(?:type\s+)?\{([^}]*)\}\s*from\s*[\"']([^\"']+)[\"']", re.S)
# Отложенный импорт: `const { … } = await import("…")`. Символ им пользуются так же, и не считать
# его импортом значило бы объявить мёртвым всё, что приезжает выбором провода.
DYNAMIC_IMPORT_LIST = re.compile(
    r"\{([^{}]*)\}\s*=\s*await\s+import\(\s*[\"']([^\"']+)[\"']\s*\)", re.S
)
VITEST = re.compile(r"from\s*[\"']vitest[\"']")

errors: list[str] = []


def sources() -> list[pathlib.Path]:
    return sorted(
        path
        for root in ROOTS
        for path in root.rglob("*")
        if path.suffix in SUFFIXES
    )


def is_run(path: pathlib.Path, text: str) -> bool:
    return (
        ".test." in path.name
        or ".spec." in path.name
        or module_id(path) in TEST_SUPPORT_MODULES
        or VITEST.search(text) is not None
    )


def module_id(path: pathlib.Path) -> str:
    return str(path).replace("\\", "/")


def resolve(specifier: str, importer: pathlib.Path) -> str | None:
    """Модуль, на который указывает импорт. Пакеты и данные не разрешаются — их и не проверяем."""
    if specifier.startswith("@/"):
        base = SRC / specifier[2:]
    elif specifier.startswith("."):
        base = pathlib.Path(os.path.normpath(importer.parent / specifier))
    else:
        return None
    for candidate in (
        *(base.with_name(base.name + suffix) for suffix in SUFFIXES),
        *(base / f"index{suffix}" for suffix in SUFFIXES),
    ):
        if candidate.is_file():
            return module_id(candidate)
    return None


def exported_name(clause: str) -> str | None:
    """Имя, под которым символ виден снаружи: в `A as B` это `B`."""
    clause = clause.strip().removeprefix("type ").strip()
    if not clause:
        return None
    _, _, visible = clause.rpartition(" as ")
    return visible.strip() or None


def imported_name(clause: str) -> str | None:
    """Имя, которое импортёр берёт у модуля: в `A as B` это `A`."""
    clause = clause.strip().removeprefix("type ").strip()
    if not clause:
        return None
    original, _, _ = clause.partition(" as ")
    return original.strip() or None


def collect() -> tuple[dict[tuple[str, str], int], set[tuple[str, str]]]:
    """Экспорты ядра со строками объявления и пары (модуль, имя), которые кто-то импортирует."""
    exports: dict[tuple[str, str], int] = {}
    imports: set[tuple[str, str]] = set()

    for path in sources():
        text = path.read_text(encoding="utf-8")
        run = is_run(path, text)

        if not run:
            for names, specifier in [
                *IMPORT_LIST.findall(text),
                *DYNAMIC_IMPORT_LIST.findall(text),
            ]:
                target = resolve(specifier, path)
                if target is None:
                    continue
                for clause in names.split(","):
                    name = imported_name(clause)
                    if name is not None:
                        imports.add((target, name))

        if run or CORE not in path.parents:
            continue

        module = module_id(path)
        lines = text.splitlines()
        for number, line in enumerate(lines, start=1):
            declaration = EXPORT_DECLARATION.match(line)
            if declaration:
                exports[(module, declaration.group(1))] = number
        for match in EXPORT_LIST.finditer(text):
            number = text[: match.start()].count("\n") + 1
            for clause in match.group(1).split(","):
                name = exported_name(clause)
                if name is not None:
                    exports[(module, name)] = number

    return exports, imports


def main() -> int:
    if not CORE.is_dir():
        print("Запускать из корня репозитория", file=sys.stderr)
        return 2

    exports, imports = collect()
    dead = sorted(
        (module, name, line)
        for (module, name), line in exports.items()
        if (module, name) not in imports and (module, name) not in ALLOWED_TEST_ONLY
    )

    if "--list" in sys.argv[1:]:
        for module, name, line in dead:
            print(f"{module}:{line}\t{name}")
        return 0

    for module, name, line in dead:
        errors.append(f"{module}:{line}: экспорт без импортёров вне прогонов — {name}")

    if errors:
        print(f"Мёртвые экспорты ядра: {len(errors)} замечаний\n")
        for error in errors[:60]:
            print("  •", error)
        if len(errors) > 60:
            print(f"  … и ещё {len(errors) - 60}")
        return 1

    print(
        f"Экспорты ядра живы: {len(exports)} проверено, "
        f"{len(ALLOWED_TEST_ONLY)} названо каноном прогонов"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
