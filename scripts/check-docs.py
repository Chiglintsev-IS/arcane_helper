#!/usr/bin/env python3
"""Проверка целостности спецификации.

    python3 scripts/check-docs.py

Что проверяется:
  1. Относительные ссылки между документами ведут на существующие файлы.
  2. Якоря (#fr-022, #adr-0001, #кровавое-колдовство) разрешаются.
  3. Каждое упомянутое требование где-то определено.
  4. Каждое требование определено ровно один раз и только в документе, который им владеет.
  5. Требования из ТЗ не потеряны.
  6. Статусы взяты из словаря CLAUDE.md.

Требования живут в доменных документах и в документах сквозных сценариев, экранов и обмена данными.
Реестра фич больше нет: владельца требования задаёт файл, в котором оно определено, а не отдельная
таблица, которая с этим файлом расходится.
"""

import os
import pathlib
import re
import sys

DOCS = "docs"

# Документы, которым разрешено ОПРЕДЕЛЯТЬ требования. В остальных они только упоминаются.
OWNERS = ("docs/domains/", "docs/scenarios.md", "docs/screens.md", "docs/data-exchange.md")

# Требования из ТЗ (§9, §15, §17). Потеря любого — ошибка.
SPEC_REQUIREMENTS = {f"FR-{n:03d}" for n in (
    1, 2, 3,
    10, 11, 12,
    20, 21, 22, 23,
    30, 31,
    40, 41, 42,
    50, 51, 52, 53, 54,
    60, 61, 62, 63,
    70, 71, 72, 73,
    80, 81, 82, 83,
    90, 91, 92,
    100, 101, 102, 103,
    110, 111, 112,
    120, 121, 122,
)} | {"NFR-001", "NFR-002", "NFR-003"}

STATUSES = {"План", "В работе", "Готово", "Проверено", "Отложено", "Отменено", "Принято"}
QUESTION_STATUSES = {"Открыт", "Закрыт", "Частично закрыт"}
QUESTION_STATUS_PREFIX = "Решено"
DECISION_STATUS_PREFIX = "Заменено ADR-"

FENCE = re.compile(r"^```.*?^```", re.M | re.S)
REQUIREMENT = re.compile(r"\b((?:N?FR)-\d{3})\b")
DEFINITION = re.compile(r"^#{2,4} ((?:N?FR)-\d{3}) — (.+)$", re.M)
HEADING = re.compile(r"^#{1,6}\s+(.*)$", re.M)
HTML_ANCHOR = re.compile(r'<a\s+id="([^"]+)"')
LINK = re.compile(r"\[[^\]]*\]\(([^)]+)\)")
STATUS_LINE = re.compile(r"\*\*Статус:\*\*\s*([^·\n]+)")

errors: list[str] = []


def markdown_files() -> list[pathlib.Path]:
    return sorted(pathlib.Path(DOCS).rglob("*.md"))


def github_slug(text: str) -> str:
    """Слаг заголовка по правилам GitHub: нижний регистр, без пунктуации, пробел → дефис."""
    text = re.sub(r"<[^>]+>", "", text.strip().lower())
    text = re.sub(r"[^\w\s-]", "", text, flags=re.UNICODE)
    return text.replace(" ", "-")


def anchors_of(path: pathlib.Path) -> set[str]:
    text = path.read_text(encoding="utf-8")
    return {github_slug(h) for h in HEADING.findall(text)} | set(HTML_ANCHOR.findall(text))


def check_links(files: list[pathlib.Path]) -> None:
    anchors = {path: anchors_of(path) for path in files}
    for path in files:
        for target in LINK.findall(path.read_text(encoding="utf-8")):
            if target.startswith(("http://", "https://", "mailto:")):
                continue
            file_part, _, anchor = target.partition("#")
            destination = path if file_part == "" else pathlib.Path(
                os.path.normpath(path.parent / file_part)
            )
            if file_part != "" and not destination.exists():
                errors.append(f"{path}: ссылка в никуда — {target}")
                continue
            known = anchors.get(destination)
            if anchor and known is not None and anchor not in known:
                errors.append(f"{path}: якорь не найден — {target}")


def check_requirements(files: list[pathlib.Path]) -> None:
    defined: dict[str, list[str]] = {}
    mentioned: set[str] = set()

    for path in files:
        # Блоки кода вырезаются: образец оформления требования — не его определение.
        text = FENCE.sub("", path.read_text(encoding="utf-8"))
        owned = str(path).startswith(OWNERS)
        for requirement, _name in DEFINITION.findall(text):
            defined.setdefault(requirement, []).append(str(path))
            if not owned:
                errors.append(f"{path}: требование {requirement} определено вне доменного документа")
        mentioned |= set(REQUIREMENT.findall(text))

    for requirement, places in sorted(defined.items()):
        if len(places) > 1:
            errors.append(f"{requirement} определено дважды: {', '.join(places)}")

    for requirement in sorted(mentioned - set(defined)):
        errors.append(f"требование {requirement} упоминается, но нигде не определено")

    for requirement in sorted(SPEC_REQUIREMENTS - set(defined)):
        errors.append(f"требование ТЗ {requirement} потеряно")


def check_statuses(files: list[pathlib.Path]) -> None:
    for path in files:
        for status in STATUS_LINE.findall(path.read_text(encoding="utf-8")):
            status = status.strip().rstrip(".")
            if path.name == "open-questions.md":
                if status in QUESTION_STATUSES or status.startswith(QUESTION_STATUS_PREFIX):
                    continue
            elif path.name == "decisions.md":
                if status in STATUSES or status.startswith(DECISION_STATUS_PREFIX):
                    continue
            elif status in STATUSES:
                continue
            errors.append(f"{path}: статус вне словаря — «{status}»")


def main() -> int:
    if not os.path.isdir(DOCS):
        print("Запускать из корня репозитория", file=sys.stderr)
        return 2

    files = markdown_files()
    check_links(files)
    check_requirements(files)
    check_statuses(files)

    if errors:
        print(f"Проверка спецификации не прошла: {len(errors)} замечаний\n")
        for error in errors:
            print("  •", error)
        return 1

    print(f"Спецификация цела: {len(files)} документов, {len(SPEC_REQUIREMENTS)} требований ТЗ на месте")
    return 0


if __name__ == "__main__":
    sys.exit(main())
