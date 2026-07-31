#!/usr/bin/env python3
"""Проверка целостности спецификации.

Запуск из корня репозитория:

    python3 scripts/check-docs.py

Что проверяется:
  1. Все относительные ссылки между документами ведут на существующие файлы.
  2. Все якоря (#fr-022, #adr-0001, #кс-проверки-концентрации) разрешаются.
  3. Каждое упомянутое требование FR/NFR где-то определено.
  4. Каждое определённое требование перечислено в реестре фич.
  5. Требования из ТЗ не потеряны.
  6. Статусы взяты из словаря CLAUDE.md.

Скрипт не имеет зависимостей. После появления Node-проекта его следует
перенести в CI рядом с проверкой контента заклинаний.
"""

import os
import re
import sys

DOCS = "docs"
FEATURES = os.path.join(DOCS, "features")

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

# У открытых вопросов свой словарь: они не проходят жизненный цикл требования.
QUESTION_STATUSES = {"Открыт", "Закрыт"}
QUESTION_STATUS_PREFIX = "Решено"

REQ_ID = re.compile(r"\b(?:FR|NFR)-\d{3}\b")
REQ_HEADING = re.compile(r"^#{3,4}\s+((?:FR|NFR)-\d{3})\b")
HEADING = re.compile(r"^#{1,6}\s+(.*)$")
HTML_ANCHOR = re.compile(r'<a\s+id="([^"]+)"')
LINK = re.compile(r"\[([^\]]*)\]\(([^)]+)\)")
STATUS_LINE = re.compile(r"\*\*Статус:\*\*\s*([^·\n]+)")


def markdown_files():
    for dirpath, dirnames, filenames in os.walk("."):
        dirnames[:] = [d for d in dirnames if d not in {".git", "node_modules", ".next"}]
        for name in sorted(filenames):
            if name.endswith(".md"):
                yield os.path.normpath(os.path.join(dirpath, name))


def github_slug(text):
    """Слаг заголовка по правилам GitHub: нижний регистр, без пунктуации, пробел → дефис."""
    text = re.sub(r"<[^>]+>", "", text.strip().lower())
    text = re.sub(r"[^\w\s-]", "", text, flags=re.UNICODE)
    return text.replace(" ", "-")


def collect_anchors(path):
    anchors = set()
    for line in read_lines(path):
        heading = HEADING.match(line)
        if heading:
            anchors.add(github_slug(heading.group(1)))
        for anchor_id in HTML_ANCHOR.findall(line):
            anchors.add(anchor_id.lower())
    return anchors


def read_lines(path):
    with open(path, encoding="utf-8") as handle:
        return handle.read().split("\n")


def read_text(path):
    with open(path, encoding="utf-8") as handle:
        return handle.read()


def parse_registry(path):
    """Разворачивает диапазоны требований из реестра фич.

    «FR-070…073, 130…133» → {FR-070, FR-071, FR-072, FR-073, FR-130, …}
    Возвращает отображение «файл фичи → множество требований».
    """
    registry = {}
    for line in read_lines(path):
        if not line.startswith("| [F-"):
            continue
        cells = line.split("|")
        if len(cells) < 5:
            continue
        feature = re.search(r"\((F-[^)]+\.md)\)", cells[1])
        if not feature:
            continue
        prefix = "FR"
        requirements = set()
        for token in cells[3].split(","):
            token = token.strip()
            if not token:
                continue
            named = re.match(r"(FR|NFR)-(.+)", token)
            if named:
                prefix, token = named.group(1), named.group(2)
            numbers = re.findall(r"\d+", token)
            if not numbers:
                continue
            first = int(numbers[0])
            last = int(numbers[-1]) if len(numbers) > 1 else first
            width = len(numbers[0])
            for value in range(first, last + 1):
                requirements.add(f"{prefix}-{value:0{width}d}")
        registry[feature.group(1)] = requirements
    return registry


def main():
    files = list(markdown_files())
    anchors = {path: collect_anchors(path) for path in files}
    errors = []

    # 1–2. Ссылки и якоря.
    for path in files:
        for _, target in LINK.findall(read_text(path)):
            if target.startswith(("http://", "https://", "mailto:")):
                continue
            relative, _, anchor = target.partition("#")
            resolved = (
                os.path.normpath(os.path.join(os.path.dirname(path), relative))
                if relative else path
            )
            if relative and not os.path.exists(resolved):
                errors.append(f"{path}: ссылка на отсутствующий файл — {target}")
                continue
            if anchor and anchor.lower() not in anchors.get(resolved, set()):
                errors.append(f"{path}: неразрешимый якорь — {target}")

    # 3–4. Требования: определены, упомянуты, зарегистрированы.
    defined = {}
    for name in sorted(os.listdir(FEATURES)):
        if not name.startswith("F-"):
            continue
        path = os.path.join(FEATURES, name)
        for line in read_lines(path):
            heading = REQ_HEADING.match(line)
            if heading:
                requirement = heading.group(1)
                if requirement in defined:
                    errors.append(
                        f"{path}: {requirement} определено повторно "
                        f"(уже есть в {defined[requirement]})"
                    )
                defined[requirement] = path

    referenced = set()
    for path in files:
        referenced |= set(REQ_ID.findall(read_text(path)))

    for requirement in sorted(referenced - set(defined)):
        errors.append(f"{requirement} упоминается, но нигде не определено")

    registry = parse_registry(os.path.join(FEATURES, "README.md"))
    for requirement, path in sorted(defined.items()):
        feature = os.path.basename(path)
        if feature not in registry:
            errors.append(f"{feature} отсутствует в реестре фич")
        elif requirement not in registry[feature]:
            errors.append(
                f"{requirement} определено в {feature}, но не входит в её диапазон в реестре"
            )

    for feature, requirements in sorted(registry.items()):
        for requirement in sorted(requirements - set(defined)):
            errors.append(
                f"реестр обещает {requirement} в {feature}, но требование не определено"
            )

    # 5. Требования ТЗ не потеряны.
    for requirement in sorted(SPEC_REQUIREMENTS - set(defined)):
        errors.append(f"{requirement} из ТЗ потеряно: нет определения ни в одной фиче")

    # 6. Статусы из словаря.
    questions = os.path.join(DOCS, "open-questions.md")
    for path in files:
        for status in STATUS_LINE.findall(read_text(path)):
            value = status.strip()
            if not value:
                continue
            if os.path.normpath(path) == os.path.normpath(questions):
                if value in QUESTION_STATUSES or value.startswith(QUESTION_STATUS_PREFIX):
                    continue
            elif value in STATUSES:
                continue
            errors.append(f"{path}: неизвестный статус «{value}»")

    print(f"документов: {len(files)}")
    print(f"требований определено: {len(defined)}")
    print(f"из них добавлено спецификацией: {len(set(defined) - SPEC_REQUIREMENTS)}")

    if errors:
        print(f"\nошибок: {len(errors)}")
        for error in errors:
            print(f"  ✗ {error}")
        return 1

    print("\nспецификация целостна")
    return 0


if __name__ == "__main__":
    sys.exit(main())
