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
  4. Состояние персонажа не собирается числами руками: поле, которым владеет правило, меняет
     операция контекста, а не словарь в литерале. Правило действует и в прогонах — фикстура,
     набранная руками, повторяет правило и расходится с ним ровно так же, как рабочий код.
  5. Отображение не проверяет доменных инвариантов: ни `Number.isInteger`, ни сравнения с пределом
     правил. Экран передаёт набранное владельцу и показывает его ответ — сущность приходит либо
     готовой, либо с причиной отказа. Показать предел он вправе: подпись и подсказка поля — это
     чтение, а не решение.
  6. Отображение не обрезает дробный ввод сам: ни `Number.parseInt`/`Number.parseFloat`, ни голые
     `parseInt`/`parseFloat` не встречаются в `src/ui/**`. Дробное доходит до владельца как есть —
     обрезать его до целого молча вправе только тот, кто отвечает за инвариант целости.

Первые три правила прогонов не касаются: фикстура повторяет фразу нарочно — прогон обязан называть
то, что проверяет, словом, а не ссылкой на константу. Четвёртое касается: `{ maximum: 4, remaining: 1 }`
в фикстуре говорит «так выглядят поля», а не «истрачены три ячейки», и переживает правку тарифа
молча. Операции состояния для прогонов живут рядом с самим персонажем.

Пятое — про рассыпанный инвариант. Проверка, повторённая на клиенте, становится вторым правилом о том
же: предел правят у владельца, а копия в экране остаётся прежней и молча пропускает то, что владелец
уже не принимает. Владелец при этом отвечает не «нет», а «нет, потому что» — и это ровно то, что
экрану надо показать.

Шестое — про дробное с той же стороны, что и пятое, но раньше: `parseInt("12.5")` не отказывает и не
спрашивает владельца — он режет строку до точки и возвращает целое, будто дробного не было. Экран,
который зовёт `parseInt` до передачи значения дальше, решает за владельца целости то, что вправе
решать только он: доходит не набранное, а его обрезок.

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

# Поля состояния, чьи числа следуют правилам своих контекстов: их меняет операция, а не литерал.
RULED_STATE_FIELDS = (
    "spellSlots",
    "hitPoints",
    "temporaryHitPoints",
    "hitDice",
    "runes",
    "spellPoints",
    "arcaneRecovery",
)

# Файлы, которым форма состояния и есть предмет проверки. Каждая запись — с обоснованием.
STATE_SHAPE_OWNERS = {
    # Начальные числа Торна: это его содержимое, и объявляет их он сам.
    "src/core/infrastructure/catalog/thorne/character.ts",
    # Операции над состоянием Торна для прогонов: они и есть законный способ его собрать.
    "src/core/infrastructure/catalog/thorne/fixtures.ts",
    # Полная схема состояния: прогон проверяет, что она принимает и что отвергает, — форма и есть
    # его предмет.
    "src/core/domain/assembly/state.test.ts",
    # Приведение сохранений: прежние версии существуют только как данные прежней формы.
    "src/core/domain/assembly/migration.test.ts",
    # Разбор прочитанного из хранилища: снимок приходит данными, а не операцией.
    "src/core/infrastructure/persistence/repositoryContract.ts",
}

CYRILLIC = re.compile(r"[А-Яа-яЁё]")
# Спред состояния персонажа: по нему видно, что литерал собирает состояние целиком, а не данные
# одного контекста. Слова «персонаж» и «Торн» в выражении спреда — единственный надёжный признак:
# внутри своего контекста те же поля пишет их владелец, и там числа на месте.
STATE_SPREAD = re.compile(r"\.\.\.[\w.()]*(?:[Cc]haracter|[Tt]horne)[\w.()]*\s*,")
LITERAL = re.compile(rf'"([^"\\\n]{{{MINIMUM_SHARED_LENGTH},}})"' + rf"|`([^`$\\\n]{{{MINIMUM_SHARED_LENGTH},}})`")
ANY_LITERAL = re.compile(r'"([^"\\\n]*)"' + r"|`([^`$\\\n]*)`")
MEASURE = re.compile(r"(?<![А-Яа-яЁё])(зм|см|мм)(?![А-Яа-яЁё])")
DIE_SIZE = re.compile(r"(?<![\w])d\d+(?![\w])")

# Проверка доменного инварианта: целость числа и сравнение с пределом правил. Показ предела —
# подпись, подсказка поля — не проверка: он читает чужое число, а не решает по нему.
DOMAIN_CHECK = re.compile(r"\bNumber\.isInteger\b")
LIMIT = r"(?:MINIMUM|MAXIMUM)_\w+"
LIMIT_COMPARISON = (
    re.compile(rf"{LIMIT}\s*(?:[<>]=?|===|!==)"),
    re.compile(rf"(?:[<>]=?|===|!==)\s*{LIMIT}"),
)

# Обрезка дробного до целого мимо владельца: `Number.parseInt(...)` и голый `parseInt(...)` разбирают
# ввод сам экран, вместо того чтобы отдать набранное владельцу целости.
PARSE_TO_INTEGER = (
    re.compile(r"\bNumber\.parse(?:Int|Float)\b"),
    re.compile(r"(?<!\.)\bparse(?:Int|Float)\b"),
)

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


def all_paths() -> list[pathlib.Path]:
    """Все модули, включая прогоны: фикстура подчиняется владению так же, как рабочий код."""
    return sorted(path for path in SRC.rglob("*") if path.suffix in SUFFIXES)


def enclosing_literal(text: str, position: int) -> str:
    """Тело объектного литерала, внутри которого стоит позиция: от его `{` до парной `}`."""
    depth = 0
    start = position
    while start > 0:
        start -= 1
        if text[start] == "}":
            depth += 1
        elif text[start] == "{":
            if depth == 0:
                break
            depth -= 1
    depth = 0
    for end in range(start + 1, len(text)):
        if text[end] == "{":
            depth += 1
        elif text[end] == "}":
            if depth == 0:
                return text[start + 1 : end]
            depth -= 1
    return text[start + 1 :]


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


def check_state_by_operations(paths: list[pathlib.Path]) -> None:
    """Поле, которым владеет правило, меняет операция контекста, а не словарь в литерале.

    Признак сборки состояния — спред персонажа рядом: `{ ...createThorne(), spellSlots: {…} }`
    говорит «состояние такое», хотя за столом оно таким становится расходом. Литерал без спреда
    состояния не трогаем: это данные своего контекста, и там числа на месте.
    """
    found: set[tuple[str, int, str]] = set()
    for path in paths:
        if str(path) in STATE_SHAPE_OWNERS:
            continue
        text = path.read_text(encoding="utf-8")
        offset = 0
        for number, line in enumerate(text.splitlines(), start=1):
            start = offset
            offset += len(line) + 1
            spread = STATE_SPREAD.search(line)
            if spread is None:
                continue
            body = enclosing_literal(text, start + spread.start())
            for field in RULED_STATE_FIELDS:
                if re.search(rf"^\s*{field}: \{{", body, re.M):
                    found.add((str(path), number, field))
    report_state_findings(found)


def report_state_findings(found: set[tuple[str, int, str]]) -> None:
    for path, number, field in sorted(found):
        errors.append(
            f"{path}:{number}: состояние собрано числами — {field}; его меняет операция контекста"
        )


def check_invariants_not_in_ui(paths: list[pathlib.Path]) -> None:
    """Отображение не проверяет инвариантов: оно передаёт набранное владельцу и показывает ответ."""
    for path in paths:
        if not str(path).startswith("src/ui/"):
            continue
        text = path.read_text(encoding="utf-8")
        for number, line in enumerate(text.splitlines(), start=1):
            if DOMAIN_CHECK.search(line):
                errors.append(
                    f"{path}:{number}: отображение проверяет число само — {line.strip()[:70]}"
                )
            if any(pattern.search(line) for pattern in LIMIT_COMPARISON):
                errors.append(
                    f"{path}:{number}: отображение сравнивает с пределом правил — "
                    f"{line.strip()[:70]}"
                )


def check_no_parse_to_integer_in_ui(paths: list[pathlib.Path]) -> None:
    """Отображение не обрезает дробный ввод сам: набранное уходит владельцу как есть."""
    for path in paths:
        if not str(path).startswith("src/ui/"):
            continue
        for number, line in enumerate(path.read_text(encoding="utf-8").splitlines(), start=1):
            if any(pattern.search(line) for pattern in PARSE_TO_INTEGER):
                errors.append(
                    f"{path}:{number}: дробное обрезано в отображении — {line.strip()[:70]}"
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
    check_invariants_not_in_ui(paths)
    check_no_parse_to_integer_in_ui(paths)
    check_state_by_operations(all_paths())

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
