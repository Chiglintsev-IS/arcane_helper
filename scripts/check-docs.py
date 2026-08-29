#!/usr/bin/env python3
"""Проверка документации: описывает текущее состояние, изолирована и абстрактна.

    python3 scripts/check-docs.py

Что проверяется:
  1. `docs/` плоский: один документ — один файл, каталогов внутри нет.
  2. Документы друг на друга не ссылаются: ни ссылкой на файл, ни упоминанием чужого имени файла.
     Единственное исключение — карта `docs/README.md`: она ведёт к документам, и её ссылки должны
     существовать.
  3. Идентификаторов требований, решений и вопросов (FR-, NFR-, ADR-, OQ-, UC-, AC-, M-) нет:
     документ описывает поведение, а не реестр.
  4. Строк статуса, проверки и дорожной карты нет: документ описывает состояние, а не путь к нему.
  5. Документ абстрактен: путей `src/…`, `e2e/…`, имён файлов кода и прогонов в нём нет. Исключение —
     `docs/architecture.md`: он называет корневые каталоги, но не файлы.

Документ обязан пережить переименование функции и удаление соседнего документа, поэтому правила 2
и 5 — единственная связь документации с кодом и друг с другом, и она проверяется тем, что связи нет.
"""

import pathlib
import re
import sys

DOCS = pathlib.Path("docs")
INDEX = DOCS / "README.md"
ARCHITECTURE = DOCS / "architecture.md"

FENCE = re.compile(r"^```.*?^```", re.M | re.S)
INLINE_CODE = re.compile(r"`[^`\n]+`")
LINK = re.compile(r"\[[^\]]*\]\(([^)]+)\)")
DOC_MENTION = re.compile(r"\b[\w-]+\.md\b")
IDENTIFIER = re.compile(r"\b(?:N?FR|ADR|OQ|UC|AC)-\d+\b|\bM-\d{2}\b")
PROCESS_MARKER = re.compile(
    r"\*\*(?:Статус|Проверка):\*\*|^#{1,6}\s+(?:N?FR|ADR|OQ|UC)-\d+", re.M
)
CODE_PATH = re.compile(r"\b(?:src|e2e|scripts)/[\w./-]*")
CODE_FILE = re.compile(r"\b[\w-]+\.(?:tsx?|py|json|css|mjs)\b")

errors: list[str] = []


def documents() -> list[pathlib.Path]:
    return sorted(DOCS.glob("*.md"))


def prose(text: str) -> str:
    """Текст без блоков кода и без встроенного кода: там образцы, а не утверждения документа."""
    return INLINE_CODE.sub("…", FENCE.sub("", text))


def check_flat() -> None:
    for entry in DOCS.iterdir():
        if entry.is_dir():
            errors.append(f"{entry}: каталог внутри docs — документы лежат плоско")
        elif entry.suffix != ".md":
            errors.append(f"{entry}: в docs лежат только документы .md")


def check_isolation(path: pathlib.Path, text: str) -> None:
    for target in LINK.findall(text):
        if target.startswith(("http://", "https://", "mailto:", "#")):
            continue
        if path == INDEX:
            if not (path.parent / target.partition("#")[0]).exists():
                errors.append(f"{path}: карта ведёт в никуда — {target}")
            continue
        errors.append(f"{path}: ссылка на другой документ — {target}")
    if path != INDEX:
        for mention in DOC_MENTION.findall(prose(text)):
            errors.append(f"{path}: упомянут другой документ — {mention}")


def check_no_registry(path: pathlib.Path, text: str) -> None:
    for identifier in IDENTIFIER.findall(text):
        errors.append(f"{path}: идентификатор реестра — {identifier}")
    for marker in PROCESS_MARKER.findall(text):
        errors.append(f"{path}: строка процесса, а не состояния — «{marker.strip()}»")


def check_abstract(path: pathlib.Path, text: str) -> None:
    body = prose(text) if path == ARCHITECTURE else FENCE.sub("", text)
    for found in CODE_FILE.findall(body):
        errors.append(f"{path}: имя файла кода — {found}")
    if path == ARCHITECTURE:
        return
    for found in CODE_PATH.findall(body):
        errors.append(f"{path}: путь к коду — {found}")


def main() -> int:
    if not DOCS.is_dir():
        print("Запускать из корня репозитория", file=sys.stderr)
        return 2

    check_flat()
    files = documents()
    for path in files:
        text = path.read_text(encoding="utf-8")
        check_isolation(path, text)
        check_no_registry(path, text)
        check_abstract(path, text)

    if errors:
        print(f"Проверка документации не прошла: {len(errors)} замечаний\n")
        for error in errors:
            print("  •", error)
        return 1

    print(f"Документация цела: {len(files)} документов, изолированы и абстрактны")
    return 0


if __name__ == "__main__":
    sys.exit(main())
