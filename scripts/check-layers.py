#!/usr/bin/env python3
"""Проверка границ слоёв и чистоты комментариев.

    python3 scripts/check-layers.py

Архитектура держится не договорённостью, а проверкой: договорённость забывают через месяц.

Что проверяется:
  1. Логика не знает про отображение: `core/` не импортирует ни `ui/`, ни `app/`.
  2. Домен не знает ни о ком: `core/domain/` импортирует только себя.
  3. Прикладной слой не знает про инфраструктуру: реализации приходят через порты.
  4. Порядок слоёв FSD: app → screens → widgets → features → entities → shared, только вниз.
  5. Слайсы одного слоя не импортируют друг друга напрямую.
  6. Код не ссылается на документацию: ни путями `docs/…`, ни номерами требований и решений.

Шестое правило — про хрупкость. Номер требования в комментарии превращает перенумерацию спеки в
правку сотни файлов, а путь до документа ломается молча при первом же переносе. Связь спеки с кодом
держат имена прогонов: они и так названы в разделе «Проверка» требования.
"""

import pathlib
import re
import sys

SRC = pathlib.Path("src")
EXTRA = [pathlib.Path("e2e")]

IMPORT = re.compile(r'(?:from|import)\s+["\']@/([^"\']+)["\']')
TYPE_IMPORT = re.compile(r'import\s+type\s+[^;]*?["\']@/([^"\']+)["\']', re.S)
DOCS_PATH = re.compile(r"docs/[\w./-]+\.md")
SPEC_ID = re.compile(r"\b(?:FR-\d{3}|NFR-\d{3}|ADR-\d{4}|OQ-\d{2}|AC-\d{2}|M-\d{2})\b")

# Комментарии: блочные и строчные. Строки кода в расчёт не берутся.
COMMENT = re.compile(r"/\*.*?\*/|//[^\n]*", re.S)

FSD_ORDER = ["app", "screens", "widgets", "features", "entities", "shared"]

errors: list[str] = []


def layer_of(path: str) -> tuple[str, str]:
    """Слой и слайс модуля по его пути от `src/`."""
    parts = path.split("/")
    if parts[0] == "core":
        return f"core/{parts[1]}" if len(parts) > 1 else "core", ""
    if parts[0] == "ui":
        layer = parts[1] if len(parts) > 1 else ""
        slice_name = parts[2] if len(parts) > 2 else ""
        return f"ui/{layer}", slice_name
    return parts[0], ""


def check_imports(path: pathlib.Path) -> None:
    # Тесты собирают слои намеренно: фикстура приходит из инфраструктуры, интеграционный прогон
    # поднимает экран целиком. Правило описывает рабочий код, а не то, чем его проверяют.
    if ".test." in path.name:
        return
    relative = str(path.relative_to(SRC)).replace("\\", "/")
    source_layer, source_slice = layer_of(relative)

    text = path.read_text(encoding="utf-8")
    # Импорт одного типа не создаёт зависимости времени выполнения: до сборки он исчезает. Внутри
    # интерфейса это допустимая форма контракта; через границу логики и отображения — нет.
    type_only = set(TYPE_IMPORT.findall(text))

    for target in IMPORT.findall(text):
        target_layer, target_slice = layer_of(target)

        if source_layer.startswith("core") and (
            target_layer.startswith("ui") or target_layer == "app"
        ):
            errors.append(f"{path}: логика тянет отображение — @/{target}")
            continue

        if source_layer == "core/domain" and target_layer not in ("core/domain", "core/shared"):
            errors.append(f"{path}: домен зависит от внешнего слоя — @/{target}")
            continue

        if source_layer == "core/application" and target_layer == "core/infrastructure":
            errors.append(f"{path}: сценарий тянет реализацию мимо порта — @/{target}")
            continue

        if source_layer.startswith("ui/") and target_layer.startswith("ui/"):
            if target in type_only:
                continue
            source_index = FSD_ORDER.index(source_layer.split("/")[1])
            target_index = FSD_ORDER.index(target_layer.split("/")[1])
            if target_index < source_index:
                errors.append(f"{path}: импорт вверх по слоям — @/{target}")
            elif (
                target_index == source_index
                and target_slice != source_slice
                # У слоя приложения слайсов нет: это единственная точка сборки.
                and source_layer != "ui/app"
            ):
                errors.append(f"{path}: слайсы одного слоя не знают друг о друге — @/{target}")


def check_comments(path: pathlib.Path) -> None:
    text = path.read_text(encoding="utf-8")
    # Тестовый код узнаётся по vitest, а не по имени файла: общий набор проверок хранилища лежит
    # обычным модулем, но состоит из прогонов, и номер требования в их именах — единственная
    # разрешённая связь спеки с кодом.
    is_test = ".test." in path.name or "spec.ts" in path.name or 'from "vitest"' in text
    for comment in COMMENT.findall(text):
        for match in DOCS_PATH.findall(comment):
            errors.append(f"{path}: комментарий ссылается на документ — {match}")
        for match in SPEC_ID.findall(comment):
            errors.append(f"{path}: комментарий называет номер спеки — {match}")
    if not is_test:
        # Вне комментариев номера допустимы только в именах прогонов, а их в рабочем коде нет.
        code = COMMENT.sub("", text)
        for match in SPEC_ID.findall(code):
            errors.append(f"{path}: номер спеки в коде — {match}")


def main() -> int:
    if not SRC.is_dir():
        print("Запускать из корня репозитория", file=sys.stderr)
        return 2

    sources = sorted([*SRC.rglob("*.ts"), *SRC.rglob("*.tsx")])
    for path in sources:
        check_imports(path)
        check_comments(path)
    for root in EXTRA:
        for path in sorted([*root.rglob("*.ts")]):
            check_comments(path)

    if errors:
        print(f"Границы нарушены: {len(errors)} замечаний\n")
        for error in errors[:60]:
            print("  •", error)
        if len(errors) > 60:
            print(f"  … и ещё {len(errors) - 60}")
        return 1

    print(f"Границы соблюдены: {len(sources)} модулей")
    return 0


if __name__ == "__main__":
    sys.exit(main())
