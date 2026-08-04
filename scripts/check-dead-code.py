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

Совпадение ищется парой (модуль, имя), а не словом: одноимённые символы в разных модулях иначе
прикрывают друг друга, и мёртвый экспорт остаётся незамеченным, пока живо чужое такое же имя.

Прогоном считается файл с `.test.` или `.spec.` в имени, а также обычный модуль, импортирующий
`vitest`: общий набор проверок хранилища лежит обычным модулем, но состоит из прогонов.

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

# Экспорт, живущий по праву без импортёров вне прогонов. Каждая запись — с обоснованием.
ALLOWED_TEST_ONLY: set[tuple[str, str]] = {
    # Канонический признак «ход цел»: фикстура десятков прогонов доступности и отбора. Рабочий код
    # собирает признаки хода из состояния, поэтому импортёра вне прогонов у неё нет и не будет.
    ("src/core/application/casting/availability.ts", "ALL_TURN_RESOURCES"),
    # Общий набор проверок обеих реализаций хранилища: сам по себе — прогоны, лежащие обычным
    # модулем, чтобы память и Dexie проверялись одним текстом.
    ("src/core/infrastructure/persistence/repositoryContract.ts", "describeParsingContract"),
}

EXPORT_DECLARATION = re.compile(
    r"^export\s+(?:async\s+)?(?:function|const|let|class|type|interface|enum)\s+(\w+)", re.M
)
EXPORT_LIST = re.compile(
    r"^export\s+(?:type\s+)?\{([^}]*)\}(?:\s*from\s*[\"']([^\"']+)[\"'])?", re.M | re.S
)
IMPORT_LIST = re.compile(r"import\s+(?:type\s+)?\{([^}]*)\}\s*from\s*[\"']([^\"']+)[\"']", re.S)
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
    return ".test." in path.name or ".spec." in path.name or VITEST.search(text) is not None


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
            for names, specifier in IMPORT_LIST.findall(text):
                target = resolve(specifier, path)
                if target is None:
                    continue
                for clause in names.split(","):
                    name = imported_name(clause)
                    if name is not None:
                        imports.add((target, name))

        # Реэкспорт — тоже импорт: символ уходит наружу через посредника и жив.
        for names, specifier in EXPORT_LIST.findall(text):
            if not specifier:
                continue
            target = resolve(specifier, path)
            if target is None:
                continue
            for clause in names.split(","):
                name = imported_name(clause)
                if name is not None and not run:
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
