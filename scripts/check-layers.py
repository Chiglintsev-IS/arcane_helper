#!/usr/bin/env python3
"""Проверка границ слоёв и чистоты комментариев.

    python3 scripts/check-layers.py
    python3 scripts/check-layers.py --write-baseline

Архитектура держится не договорённостью, а проверкой: договорённость забывают через месяц.

Что проверяется:
  1. Логика не знает про отображение: `core/` не импортирует ни `ui/`, ни `app/`.
  2. Домен не знает ни о ком: `core/domain/` импортирует только себя.
  3. Прикладной слой не знает про инфраструктуру: реализации приходят через порты.
  4. Порядок слоёв FSD: app → screens → widgets → features → entities → shared, только вниз.
  5. Слайсы одного слоя не импортируют друг друга напрямую.
  6. Код не ссылается на документацию: ни путями `docs/…`, ни номерами требований и решений.
  7. Рёбра между ограниченными контекстами внутри `core/domain/` — только из карты разрешённых.
  8. Циклов между контекстами нет.

Шестое правило — про хрупкость. Номер требования в комментарии превращает перенумерацию спеки в
правку сотни файлов, а путь до документа ломается молча при первом же переносе. Связь спеки с кодом
держат имена прогонов: они и так названы в разделе «Проверка» требования.

Седьмое и восьмое терпят известный долг, записанный в `scripts/layer-baseline.json`: ребро или цикл
оттуда считается долгом и называется счётчиком, новое ребро или новый цикл — ошибка. Сейчас список
пуст: карта разрешённых рёбер и код совпадают. Пополнять его нечем — базлайн перегенерируется
флагом `--write-baseline` после законной структурной работы, и только тогда.
"""

import json
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

BASELINE = pathlib.Path("scripts/layer-baseline.json")

# Целевая карта рёбер между ограниченными контекстами. Ребро «A импортирует B» законно, только если
# названо здесь; остальное — либо долг из базлайна, либо ошибка.
ALLOWED_CONTEXT_EDGES = {
    ("spellbook", "catalog"),
    ("arcana", "catalog"),
    ("effects", "catalog"),
    ("encounter", "journal"),
    ("sheet", "character"),
    ("sheet", "equipment"),
    ("sheet", "effects"),
    ("sheet", "catalog"),
}

# Общее ядро доменной логики: его читают все контексты.
SHARED_CONTEXT = "shared"

# Сборка корня персонажа: она знает контексты, контексты её — нет. Каталога может ещё не быть,
# правило заложено по имени и ждёт его появления.
ASSEMBLY_CONTEXT = "assembly"

errors: list[str] = []

# Ребро «контекст → контекст» и файлы, которые его создают.
context_edges: dict[tuple[str, str], set[str]] = {}


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


def domain_context(path: str) -> str | None:
    """Ограниченный контекст модуля: каталог сразу под `core/domain/`."""
    parts = path.split("/")
    if len(parts) >= 3 and parts[0] == "core" and parts[1] == "domain" and "." not in parts[2]:
        return parts[2]
    return None


def check_imports(path: pathlib.Path) -> None:
    # Тесты собирают слои намеренно: фикстура приходит из инфраструктуры, интеграционный прогон
    # поднимает экран целиком. Правило описывает рабочий код, а не то, чем его проверяют.
    if ".test." in path.name:
        return
    relative = str(path.relative_to(SRC)).replace("\\", "/")
    source_layer, source_slice = layer_of(relative)
    source_context = domain_context(relative)

    text = path.read_text(encoding="utf-8")
    # Импорт одного типа не создаёт зависимости времени выполнения: до сборки он исчезает. Внутри
    # интерфейса это допустимая форма контракта; через границу логики и отображения — нет.
    type_only = set(TYPE_IMPORT.findall(text))

    for target in IMPORT.findall(text):
        target_layer, target_slice = layer_of(target)
        target_context = domain_context(target)

        if source_context and target_context and source_context != target_context:
            context_edges.setdefault((source_context, target_context), set()).add(str(path))

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


def edge_name(source: str, target: str) -> str:
    return f"{source} -> {target}"


def cycle_name(cycle: tuple[str, ...]) -> str:
    return " -> ".join([*cycle, cycle[0]])


def elementary_cycles(graph: dict[str, set[str]]) -> list[tuple[str, ...]]:
    """Все простые циклы графа контекстов; каждый назван начиная с наименьшей вершины."""
    nodes = sorted(set(graph) | {t for targets in graph.values() for t in targets})
    found: set[tuple[str, ...]] = set()

    def walk(start: str, node: str, path: tuple[str, ...], seen: frozenset[str]) -> None:
        for step in sorted(graph.get(node, ())):
            if step == start:
                found.add(path)
            elif step not in seen and step > start:
                walk(start, step, path + (step,), seen | {step})

    for start in nodes:
        walk(start, start, (start,), frozenset({start}))
    return sorted(found)


def unmapped_edges() -> dict[tuple[str, str], set[str]]:
    """Рёбра, которых нет в карте разрешённых: кандидаты в долг или в ошибку."""
    return {
        (source, target): files
        for (source, target), files in context_edges.items()
        if target != SHARED_CONTEXT
        and source != ASSEMBLY_CONTEXT
        and target != ASSEMBLY_CONTEXT
        and (source, target) not in ALLOWED_CONTEXT_EDGES
    }


def load_baseline() -> tuple[set[str], set[str]]:
    if not BASELINE.exists():
        return set(), set()
    payload = json.loads(BASELINE.read_text(encoding="utf-8"))
    return set(payload.get("edges", [])), set(payload.get("cycles", []))


def write_baseline() -> None:
    payload = {
        "edges": sorted(edge_name(a, b) for a, b in unmapped_edges()),
        "cycles": sorted(cycle_name(c) for c in elementary_cycles(context_graph())),
    }
    BASELINE.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(
        f"Базлайн переписан: {len(payload['edges'])} рёбер, "
        f"{len(payload['cycles'])} циклов — {BASELINE}"
    )


def context_graph() -> dict[str, set[str]]:
    graph: dict[str, set[str]] = {}
    for source, target in context_edges:
        graph.setdefault(source, set()).add(target)
    return graph


def check_contexts() -> tuple[int, int]:
    """Рёбра и циклы контекстов против карты разрешённых и базлайна долгов.

    Возвращает счётчики долга: сколько рёбер и циклов терпится по базлайну.
    """
    baseline_edges, baseline_cycles = load_baseline()

    for (source, target), files in sorted(context_edges.items()):
        if target == ASSEMBLY_CONTEXT and source != ASSEMBLY_CONTEXT:
            for file in sorted(files):
                errors.append(
                    f"{file}: контекст импортирует сборку корня персонажа — "
                    f"{source} → {target}, а знает контексты только сборка"
                )

    debt_edges = 0
    for (source, target), files in sorted(unmapped_edges().items()):
        if edge_name(source, target) in baseline_edges:
            debt_edges += 1
            continue
        for file in sorted(files):
            errors.append(
                f"{file}: новое ребро контекстов — {source} → {target}; "
                f"его нет ни в карте разрешённых рёбер, ни в базлайне долгов"
            )

    debt_cycles = 0
    for cycle in elementary_cycles(context_graph()):
        if cycle_name(cycle) in baseline_cycles:
            debt_cycles += 1
            continue
        edges = list(zip(cycle, [*cycle[1:], cycle[0]]))
        fresh = [
            f"{a} → {b}" for a, b in edges if edge_name(a, b) not in baseline_edges
        ]
        shown = " → ".join([*cycle, cycle[0]])
        detail = f" (рёбра вне базлайна: {', '.join(fresh)})" if fresh else ""
        errors.append(f"новый цикл контекстов — {shown}{detail}")

    return debt_edges, debt_cycles


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

    if "--write-baseline" in sys.argv[1:]:
        write_baseline()

    debt_edges, debt_cycles = check_contexts()

    if errors:
        print(f"Границы нарушены: {len(errors)} замечаний\n")
        for error in errors[:60]:
            print("  •", error)
        if len(errors) > 60:
            print(f"  … и ещё {len(errors) - 60}")
        return 1

    summary = f"Границы соблюдены: {len(sources)} модулей"
    if debt_edges or debt_cycles:
        summary += f" · известных долгов: {debt_edges} рёбер, {debt_cycles} циклов"
    print(summary)
    return 0


if __name__ == "__main__":
    sys.exit(main())
