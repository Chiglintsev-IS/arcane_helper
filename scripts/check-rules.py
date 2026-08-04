#!/usr/bin/env python3
"""Проверка владения правилами и словами.

    python3 scripts/check-rules.py

Один факт живёт в одном месте, и два самых частых способа это нарушить — скопировать фразу и
посчитать правило игры второй раз в компоненте. Оба нарушения выглядят безобидно в момент правки и
расходятся молча: одна копия фразы меняется, вторая остаётся, а формула в экране начинает врать
после первой же правки тарифа.

Что проверяется:
  1. Русский литерал длиннее 15 знаков не встречается в двух рабочих файлах. У фразы один владелец,
     и остальные её читают.
  2. Файл `src/ui/**` не считает по состоянию: рядом с обращением к состоянию нет `+ - * / %`.
     Экран спрашивает готовое число у сценария или агрегата — формулы живут в ядре.
  3. Сокращения монет и мер, а также размер кости строкой, стоят только у своего владельца: словарь
     языка знает «зм», «см», «мм», а размер кости приходит из состояния, а не из текста.

Прогоны не проверяются: фикстура повторяет фразу нарочно — прогон и обязан называть то, что
проверяет, словом, а не ссылкой на константу.

Базлайна у проверки нет. Единственная форма исключения — словари ниже, и каждая запись в них несёт
обоснование.
"""

import pathlib
import re
import sys

SRC = pathlib.Path("src")
SUFFIXES = (".ts", ".tsx")
MINIMUM_SHARED_LENGTH = 16

# Фразы, живущие в двух файлах по праву. Каждая запись — с обоснованием.
ALLOWED_REPEATS: set[str] = set()

# Владелец сокращений монет и мер: единственная таблица, с которой их сверяют.
LANGUAGE_OWNER = "src/core/shared/language.ts"

CYRILLIC = re.compile(r"[А-Яа-яЁё]")
LITERAL = re.compile(rf'"([^"\\\n]{{{MINIMUM_SHARED_LENGTH},}})"' + rf"|`([^`$\\\n]{{{MINIMUM_SHARED_LENGTH},}})`")
ANY_LITERAL = re.compile(r'"([^"\\\n]*)"' + r"|`([^`$\\\n]*)`")
MEASURE = re.compile(r"(?<![А-Яа-яЁё])(зм|см|мм)(?![А-Яа-яЁё])")
DIE_SIZE = re.compile(r"(?<![\w])d\d+(?![\w])")

# Обращение к состоянию рядом с арифметикой: считать по нему — дело ядра.
STATE_FIELD = r"(?:character\.[\w.]+|\w+\.(?:remaining|maximum|current|level|spent))"
STATE_ARITHMETIC = (
    re.compile(rf"{STATE_FIELD}\s*[-+*/%](?![-+=>])"),
    re.compile(rf"[-+*/%]\s*{STATE_FIELD}\b"),
)

errors: list[str] = []


def sources() -> list[pathlib.Path]:
    return sorted(
        path
        for path in SRC.rglob("*")
        if path.suffix in SUFFIXES and ".test." not in path.name
    )


def literals_of(text: str, pattern: re.Pattern[str]) -> list[tuple[int, str]]:
    """Строковые литералы с номерами строк. Подстановки не разбираются: их части не сравнить."""
    found: list[tuple[int, str]] = []
    for match in pattern.finditer(text):
        value = match.group(1) if match.group(1) is not None else match.group(2)
        if value:
            found.append((text[: match.start()].count("\n") + 1, value))
    return found


def check_shared_phrases(paths: list[pathlib.Path]) -> int:
    """Одна фраза — один владелец: копия расходится с оригиналом на первой же правке."""
    places: dict[str, set[str]] = {}
    for path in paths:
        for _number, value in literals_of(path.read_text(encoding="utf-8"), LITERAL):
            if CYRILLIC.search(value):
                places.setdefault(value, set()).add(str(path))

    repeated = 0
    for value, where in sorted(places.items()):
        if len(where) > 1 and value not in ALLOWED_REPEATS:
            repeated += 1
            errors.append(
                f"фраза живёт в {len(where)} файлах — «{value[:60]}»: "
                f"{', '.join(sorted(where))}"
            )
    return len(places) - repeated


def check_rules_in_ui(paths: list[pathlib.Path]) -> None:
    """`ui/` не вычисляет по правилам игры: он спрашивает готовое число."""
    for path in paths:
        if not str(path).startswith("src/ui/"):
            continue
        for number, line in enumerate(path.read_text(encoding="utf-8").splitlines(), start=1):
            if any(pattern.search(line) for pattern in STATE_ARITHMETIC):
                errors.append(
                    f"{path}:{number}: счёт по состоянию в отображении — {line.strip()[:70]}"
                )


def check_owned_literals(paths: list[pathlib.Path]) -> None:
    """Сокращение монеты и размер кости приходят от владельца, а не набираются буквами."""
    for path in paths:
        text = path.read_text(encoding="utf-8")
        for number, value in literals_of(text, ANY_LITERAL):
            if str(path) != LANGUAGE_OWNER and MEASURE.search(value):
                errors.append(f"{path}:{number}: сокращение мимо словаря языка — «{value[:40]}»")
            if str(path).startswith("src/ui/") and DIE_SIZE.search(value):
                errors.append(f"{path}:{number}: размер кости строкой — «{value[:40]}»")


def main() -> int:
    if not SRC.is_dir():
        print("Запускать из корня репозитория", file=sys.stderr)
        return 2

    paths = sources()
    phrases = check_shared_phrases(paths)
    check_rules_in_ui(paths)
    check_owned_literals(paths)

    if errors:
        print(f"Владение нарушено: {len(errors)} замечаний\n")
        for error in errors[:60]:
            print("  •", error)
        if len(errors) > 60:
            print(f"  … и ещё {len(errors) - 60}")
        return 1

    print(
        f"Владение соблюдено: {len(paths)} модулей, {phrases} фраз у своих владельцев, "
        f"{len(ALLOWED_REPEATS)} повторов названо законными"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
