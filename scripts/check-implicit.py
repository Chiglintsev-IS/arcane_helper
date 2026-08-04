#!/usr/bin/env python3
"""Проверка того, что типы не подделываются.

    python3 scripts/check-implicit.py

Компилятор — единственная проверка, которая читает весь код целиком и на каждой правке. Приведение
типа её отключает: `as` ничего не проверяет, он обещает. Обещание живёт до первой правки формы —
поле переименовали, объединение расширили, — и молча становится ложью: там, где стоит `as`, тип
сходится по определению, а данные больше нет. `any` делает то же самое шире, а `@ts-ignore` — прямо.

Что проверяется:
  1. `as` вне `as const` — ошибка. `satisfies` не приведение, а проверка: он разрешён.
  2. Тип `any` в любой форме (`: any`, `<any>`, `any[]`, `as any`) — ошибка.
  3. `@ts-ignore`, `@ts-expect-error`, `@ts-nocheck` — ошибка.

Область — рабочий код и прогоны целиком: фикстура, собранная приведением, проверяет не то, что
принимает владелец, а то, что ей приказали считать принятым. Псевдоним импорта (`import { A as B }`)
и переименование в экспорте приведением не являются: имена в них сверяет тот же компилятор.

Строки и комментарии из разбора исключены — слово внутри текста ничего не приводит; директива
компилятору живёт как раз в комментарии и потому ищется до их исключения.

Честный способ обойтись без приведения почти всегда есть, и он же лучше: объявить тип накопителя, а
не результата; спросить ключи у того, кто их объявил; вернуть из приведения формы объявленный тип, а
не `unknown`. Там, где способа нет, дыра языка закрывается в одном месте и называется по имени —
словарь исключений ниже, и каждая запись несёт обоснование. Запись без находки — тоже ошибка:
исключение, которому нечего разрешать, обещает опасность там, где её уже нет.
"""

import pathlib
import re
import sys

SRC = pathlib.Path("src")
EXTRA = [pathlib.Path("e2e")]
SUFFIXES = (".ts", ".tsx")

# Приведения, без которых язык не обходится. Ключ — файл и фрагмент строки, значение — обоснование.
ALLOWED: dict[tuple[str, str], str] = {
    (
        "src/core/domain/shared/records.ts",
        "as Record<TKey, TValue>",
    ): "Накопитель записи по замкнутому списку ключей: полнота следует из самой операции — она "
    "проходит весь список, — но `Object.fromEntries` теряет тип ключа, и выразить это языком "
    "нечем. Записи собираются этой операцией, поэтому дыра здесь одна на всех.",
    (
        "src/core/domain/shared/ownedFields.ts",
        "as Pick<TState, TKey>",
    ): "Тот же накопитель для полей агрегата: ключи приходят списком, и результат заполняется по "
    "нему целиком. Отдельно от `recordOf`, потому что ключ с `undefined` в результат не попадает — "
    "«поля нет» и «поле пустое» это разные состояния.",
}

# Директивы компилятору: они живут в комментариях, поэтому ищутся до их исключения.
DIRECTIVES = re.compile(r"@ts-(?:ignore|expect-error|nocheck)")

# Импорт и переименование в экспорте: приведения внутри них не бывает, а `as` бывает.
IMPORT = re.compile(r"^[ \t]*import\b[^;]*;", re.M)
EXPORT_CLAUSE = re.compile(r"^[ \t]*export\s+(?:type\s+)?\{[^;]*;", re.M)

ASSERTION = re.compile(r"\bas\b(?!\s+const\b)")
ANY_TYPE = re.compile(r"\bany\b")

errors: list[str] = []
used: set[tuple[str, str]] = set()


def modules() -> list[pathlib.Path]:
    roots = [SRC, *(root for root in EXTRA if root.is_dir())]
    return sorted(
        path for root in roots for path in root.rglob("*") if path.suffix in SUFFIXES
    )


def code_of(text: str) -> str:
    """Только код: строковые литералы и комментарии заменены пробелами.

    Подстановка шаблонной строки остаётся кодом — приведение внутри `${…}` ничем не отличается от
    любого другого. Номера строк и смещения при замене не двигаются.
    """
    result = list(text)

    def hide(start: int, end: int) -> None:
        for position in range(start, min(end, len(text))):
            if result[position] != "\n":
                result[position] = " "

    def quoted(index: int) -> int:
        quote = text[index]
        end = index + 1
        while end < len(text) and text[end] != quote:
            end += 2 if text[end] == "\\" else 1
        hide(index, end + 1)
        return min(end + 1, len(text))

    def template(index: int) -> int:
        start = index
        index += 1
        while index < len(text):
            if text[index] == "\\":
                index += 2
            elif text[index] == "`":
                hide(start, index + 1)
                return index + 1
            elif text[index : index + 2] == "${":
                hide(start, index)
                start = code(index + 2, inside_substitution=True)
                index = start + 1
            else:
                index += 1
        hide(start, index)
        return index

    def code(index: int, inside_substitution: bool) -> int:
        depth = 0
        while index < len(text):
            pair = text[index : index + 2]
            if pair == "//":
                end = text.find("\n", index)
                end = len(text) if end == -1 else end
                hide(index, end)
                index = end
            elif pair == "/*":
                end = text.find("*/", index + 2)
                end = len(text) if end == -1 else end + 2
                hide(index, end)
                index = end
            elif text[index] in "\"'":
                index = quoted(index)
            elif text[index] == "`":
                index = template(index)
            elif inside_substitution and text[index] == "{":
                depth += 1
                index += 1
            elif inside_substitution and text[index] == "}":
                if depth == 0:
                    return index
                depth -= 1
                index += 1
            else:
                index += 1
        return index

    code(0, inside_substitution=False)
    return "".join(result)


def without_clauses(text: str) -> str:
    for pattern in (IMPORT, EXPORT_CLAUSE):
        for match in pattern.finditer(text):
            span = "".join(
                " " if character != "\n" else "\n" for character in match.group(0)
            )
            text = text[: match.start()] + span + text[match.end() :]
    return text


def allowed(path: str, line: str) -> bool:
    for key in ALLOWED:
        if key[0] == path and key[1] in line:
            used.add(key)
            return True
    return False


def report(path: pathlib.Path, lines: list[str], code: str, position: int, reason: str) -> None:
    number = code[:position].count("\n") + 1
    line = lines[number - 1]
    if allowed(str(path), line):
        return
    errors.append(f"{path}:{number}: {reason} — {line.strip()[:70]}")


def check(path: pathlib.Path) -> None:
    text = path.read_text(encoding="utf-8")
    lines = text.splitlines()
    for match in DIRECTIVES.finditer(text):
        report(path, lines, text, match.start(), "компилятор заглушён директивой")

    code = without_clauses(code_of(text))
    for match in ASSERTION.finditer(code):
        report(path, lines, code, match.start(), "приведение типа вместо проверки")
    for match in ANY_TYPE.finditer(code):
        report(path, lines, code, match.start(), "тип `any` отключает проверку")


def main() -> int:
    if not SRC.is_dir():
        print("Запускать из корня репозитория", file=sys.stderr)
        return 2

    found = modules()
    for path in found:
        check(path)

    for key in sorted(ALLOWED.keys() - used):
        errors.append(f"{key[0]}: исключению «{key[1]}» нечего разрешать — запись устарела")

    if errors:
        print(f"Типы подделаны: {len(errors)} замечаний\n")
        for error in errors[:80]:
            print("  •", error)
        if len(errors) > 80:
            print(f"  … и ещё {len(errors) - 80}")
        return 1

    print(
        f"Неявного кода нет: {len(found)} модулей, "
        f"{len(ALLOWED)} приведений названо законными"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
