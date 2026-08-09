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
  9. Прогон ядра не знает про отображение: `core/**/*.test.*` не импортирует ни `ui/`, ни `app/`.
 10. Прогон импортирует свой предмет: `Foo.test.ts` — модуль `Foo` из своего каталога.
 11. Псевдонима предмета в прогоне нет: `import { X as Y }` для значения из `src/` — ошибка.
 12. Слайс состоит не из одних прогонов, а имя с суффиксом `Screen` носит только экран.
 13. Реэкспортов нет: наружу модуля ведёт явный путь до владельца символа.
 14. Сценарий не дописывает поля к состоянию: спред состояния с добавкой недопустим.
 15. Отображение не меняет состояние: ни `commit`, ни `with…` на агрегате.
 16. Полная схема состояния состоит только из спредов владельцев: поле без владельца недопустимо.
 17. Агрегат объявляет, чем владеет: класс с состоянием и `toState` вызывает `ownedFields`.
 18. Циклов между модулями одного контекста нет.

Восемнадцатое — то же восьмое, только в мелком. Величина, посчитанная из величины, которая считается
из неё, не имеет значения вовсе, и заметить это тем труднее, чем ближе модули друг к другу: внутри
одного контекста ребро заводится одной строкой импорта и глазами не видно. Разбиение по
ответственности ациклично само — цикл здесь означает, что граница проведена не там, и чинится он
переносом ответственности, а не разрывом ребра.

Правила 14–17 держат единственную дверь мутации. Состояние персонажа меняется только через корень
агрегата: дописанное поле мимо владельца затирается соседом при следующей правке, а посчитанное
отображением расходится с ядром. Дверь одна — сценарий поверх корня, — и проверка следит, что второй
не появилось.

Тринадцатое — про видимость протечек. Реэкспорт пересдаёт чужой символ под своим адресом: импортёр
берёт тип домена у сценария, ярлык интерфейса у провайдера, и по списку импортов больше не видно, на
какой слой он на самом деле сходил. Ошибка при этом не в импортёре — он честно взял то, что ему
предложили, — а в посреднике: пока путь ведёт к владельцу, каждое пересечение границы названо в
самом импорте, и лишнее пересечение видно сразу. Барели по той же причине не заводятся: каталог,
пересдающий содержимое соседей, прячет ровно то, за чем следит эта проверка.

Правила 9–12 описывают прогоны, и до них проверялся только рабочий код. Слои прогон собирает
намеренно — фикстура приходит из инфраструктуры, интеграционный прогон поднимает экран целиком, —
но собирать он вправе не любое: прогон ядра, потянувший интерфейс, делает домен зависимым от экрана
через собственную проверку, а прогон, названный одним предметом и проверяющий другой, приписывает
покрытие не тому. Псевдоним — способ сделать второе незаметным: файл называется одним компонентом,
а рендерит другой под его именем.

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
import posixpath
import re
import sys

SRC = pathlib.Path("src")
EXTRA = [pathlib.Path("e2e")]

IMPORT = re.compile(r'(?:from|import)\s+["\']@/([^"\']+)["\']')
TYPE_IMPORT = re.compile(r'import\s+type\s+[^;]*?["\']@/([^"\']+)["\']', re.S)
ANY_IMPORT = re.compile(r'(?:from|import)\s+["\'](@/[^"\']+|\.[^"\']*)["\']')
ANY_TYPE_IMPORT = re.compile(r'import\s+type\s+[^;]*?["\'](@/[^"\']+|\.[^"\']*)["\']', re.S)
NAMED_IMPORT = re.compile(r'import\s+(type\s+)?\{([^}]*)\}\s*from\s*["\']([^"\']+)["\']', re.S)
SPREAD = re.compile(r"\.\.\.(?=[\w(])")
STATE_SPREADS = ("session.character", "current.character")
STATE_SPREAD_TAIL = ".toState()"
LITERAL_FIELD = re.compile(r"^\s*(\w+):", re.M)
COMMIT_IMPORT = re.compile(r"import\s*\{[^}]*\bcommit\b[^}]*\}\s*from\s*[\"']@/core/application/session[\"']", re.S)
AGGREGATE_MUTATION = re.compile(r"\.with[A-Z]\w*\(")
STATE_CLASS = re.compile(r"private constructor\(private readonly state:")
OWNED_FIELDS = "ownedFields("
FULL_SCHEMA = pathlib.Path("src/core/domain/assembly/state.ts")
FULL_SCHEMA_NAME = "STATE_FIELDS"

REEXPORT_FROM = re.compile(
    r'^export\s+(?:type\s+)?(?:\*|\{[^}]*\})\s*(?:as\s+\w+\s*)?from\s*["\']([^"\']+)["\']', re.M
)
EXPORT_LIST = re.compile(r"^export\s+(?:type\s+)?\{([^}]*)\}\s*;", re.M | re.S)
SCREEN_EXPORT = re.compile(r"export\s+(?:function|const)\s+([A-Z]\w*Screen)\b")
SCREENS_LAYER = "ui/screens/"
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
    ("sheet", "items"),
    ("equipment", "items"),
}

# Общее ядро доменной логики: его читают все контексты.
SHARED_CONTEXT = "shared"

# Сборка корня персонажа: она знает контексты, контексты её — нет. Каталога может ещё не быть,
# правило заложено по имени и ждёт его появления.
ASSEMBLY_CONTEXT = "assembly"

errors: list[str] = []

# Ребро «контекст → контекст» и файлы, которые его создают.
context_edges: dict[tuple[str, str], set[str]] = {}

# Импорты модуля внутри его же контекста: граф, на котором ищется цикл в мелком.
module_imports: dict[str, set[str]] = {}


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


def subject_of(path: pathlib.Path) -> str:
    """Предмет прогона: имя файла до первой точки.

    Суффикс-аспект разрешён: `GameScreen.blood.test.tsx` проверяет тот же `GameScreen`, что и
    `GameScreen.test.tsx`, — большому экрану нужен не один файл, но предмет у них один.
    """
    return path.name.split(".")[0]


def check_test_placement(path: pathlib.Path) -> None:
    """Прогон живёт рядом со своим предметом и импортирует именно его."""
    relative = str(path.relative_to(SRC)).replace("\\", "/")
    text = path.read_text(encoding="utf-8")
    targets = ANY_IMPORT.findall(text)

    if relative.startswith("core/"):
        for target in targets:
            layer, _slice_name = layer_of(target.removeprefix("@/"))
            if layer.startswith("ui") or layer == "app":
                errors.append(f"{path}: прогон ядра тянет отображение — {target}")

    subject = subject_of(path)
    if not any(target.rpartition("/")[2] == subject for target in targets):
        errors.append(f"{path}: прогон не импортирует свой предмет — {subject}")

    for type_only, names, source in NAMED_IMPORT.findall(text):
        if type_only or not source.startswith(("@/", ".")):
            continue
        for name in names.split(","):
            name = name.strip()
            if " as " in name and not name.startswith("type "):
                errors.append(f"{path}: предмет переименован псевдонимом — {name} из {source}")


def check_screen_names(path: pathlib.Path) -> None:
    """Суффикс `Screen` носит экран, а не виджет: имя обещает место, а не предмет."""
    relative = str(path.relative_to(SRC)).replace("\\", "/")
    if relative.startswith(SCREENS_LAYER):
        return
    for name in SCREEN_EXPORT.findall(path.read_text(encoding="utf-8")):
        errors.append(f"{path}: имя экрана вне слоя экранов — {name}")


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


def spread_end(text: str, start: int) -> int:
    """Конец выражения спреда: запятая или закрывающая скобка на нулевой глубине."""
    depth = 0
    for position in range(start, len(text)):
        symbol = text[position]
        if symbol in "([{":
            depth += 1
        elif symbol in ")]}":
            if depth == 0:
                return position
            depth -= 1
        elif symbol == "," and depth == 0:
            return position
    return len(text)


def check_state_spread(path: pathlib.Path) -> None:
    """Сценарий не дописывает поля к состоянию: дописанное затрёт владелец при следующей правке.

    Исключений нет: поле без операции у владельца — незаконченный агрегат, а не событие сценария.
    Выражение спреда читается целиком, потому что цепочка правок переносится по строкам: сравнение
    по одной строке пропускало `...root` с продолжением на следующей.
    """
    relative = str(path.relative_to(SRC)).replace("\\", "/")
    if not relative.startswith("core/application/"):
        return
    text = path.read_text(encoding="utf-8")
    for match in SPREAD.finditer(text):
        end = spread_end(text, match.end())
        expression = re.sub(r"\s+", "", text[match.end() : end])
        if expression not in STATE_SPREADS and not expression.endswith(STATE_SPREAD_TAIL):
            continue
        body = enclosing_literal(text, match.start())
        after = body[body.index("...") + 3 :]
        for field in LITERAL_FIELD.findall(after):
            errors.append(
                f"{path}: поле дописано к состоянию мимо владельца — {field}; "
                f"его ставит агрегат, а не сценарий"
            )


def check_display_mutation(path: pathlib.Path) -> None:
    """Отображение состояние не меняет: дверь одна — сценарий поверх корня агрегата."""
    if not str(path.relative_to(SRC)).replace("\\", "/").startswith("ui/"):
        return
    text = path.read_text(encoding="utf-8")
    if COMMIT_IMPORT.search(text):
        errors.append(f"{path}: отображение коммитит состояние само")
    for number, line in enumerate(text.splitlines(), start=1):
        if AGGREGATE_MUTATION.search(line):
            errors.append(
                f"{path}:{number}: отображение правит агрегат — {line.strip()[:70]}"
            )


def check_full_schema() -> None:
    """Полная схема состояния — только спреды владельцев: инлайн-поле значит поле без владельца."""
    if not FULL_SCHEMA.is_file():
        return
    text = FULL_SCHEMA.read_text(encoding="utf-8")
    start = text.find(f"{FULL_SCHEMA_NAME} = {{")
    if start < 0:
        errors.append(f"{FULL_SCHEMA}: перечня полей состояния нет под своим именем")
        return
    body = enclosing_literal(text, text.index("{", start) + 1)
    for line in body.splitlines():
        line = line.strip()
        if line and not line.startswith("...") and not line.startswith("//"):
            errors.append(
                f"{FULL_SCHEMA}: поле в сборке вместо владельца — {line[:60]}"
            )


def check_owned_fields(path: pathlib.Path) -> None:
    """Агрегат называет свои ключи: забывший про них затирает правки соседнего контекста."""
    relative = str(path.relative_to(SRC)).replace("\\", "/")
    context = domain_context(relative)
    if context is None or context in (ASSEMBLY_CONTEXT, SHARED_CONTEXT):
        return
    text = path.read_text(encoding="utf-8")
    if STATE_CLASS.search(text) and "toState()" in text and OWNED_FIELDS not in text:
        errors.append(f"{path}: агрегат не объявил, чем владеет — нет вызова ownedFields")


def check_reexports(path: pathlib.Path) -> None:
    """Символ выдаёт наружу его владелец: посредник прячет пересечение границы."""
    text = path.read_text(encoding="utf-8")
    for source in REEXPORT_FROM.findall(text):
        errors.append(f"{path}: реэкспорт вместо явного пути — {source}")

    imported = {
        name.strip().removeprefix("type ").strip().partition(" as ")[0].strip()
        for _type_only, names, _source in NAMED_IMPORT.findall(text)
        for name in names.split(",")
        if name.strip()
    }
    for names in EXPORT_LIST.findall(text):
        for name in names.split(","):
            visible = name.strip().removeprefix("type ").strip().partition(" as ")[0].strip()
            if visible and visible in imported:
                errors.append(f"{path}: пересдача импортированного символа — {visible}")


def check_test_only_slices() -> None:
    """Каталог из одних прогонов — слайс-призрак: проверяется то, чего здесь нет."""
    directories = {path.parent for path in (SRC / "ui").rglob("*") if path.is_file()}
    for directory in sorted(directories):
        files = [path for path in directory.iterdir() if path.is_file()]
        if files and all(".test." in path.name for path in files):
            errors.append(f"{directory}: слайс без реализации — в каталоге одни прогоны")


def check_imports(path: pathlib.Path) -> None:
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

        if source_layer == "core/domain" and target_layer not in ("core/domain", "shared"):
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


def module_name(relative: str) -> str:
    """Имя модуля: путь от `src/` без расширения — как его пишут в импорте."""
    for suffix in (".tsx", ".ts"):
        if relative.endswith(suffix):
            return relative[: -len(suffix)]
    return relative


def collect_module_imports(path: pathlib.Path) -> None:
    """Импорты модуля внутри его же контекста: соседи, а не чужие контексты.

    Импорт одного типа в счёт не идёт по той же причине, что и между слайсами интерфейса: до сборки
    он исчезает, и посчитать значение из значения через него нельзя. Цикл, который ловит правило, —
    цикл времени выполнения.
    """
    relative = str(path.relative_to(SRC)).replace("\\", "/")
    context = domain_context(relative)
    if context is None:
        return

    text = path.read_text(encoding="utf-8")
    type_only = set(ANY_TYPE_IMPORT.findall(text))
    for target in ANY_IMPORT.findall(text):
        if target in type_only:
            continue
        resolved = (
            target.removeprefix("@/")
            if target.startswith("@/")
            else posixpath.normpath(posixpath.join(posixpath.dirname(relative), target))
        )
        if domain_context(resolved) != context:
            continue
        module_imports.setdefault(module_name(relative), set()).add(module_name(resolved))


def check_module_cycles() -> None:
    """Цикл внутри контекста: величина, посчитанная из той, что считается из неё."""
    for cycle in elementary_cycles(module_imports):
        errors.append(f"цикл модулей внутри контекста — {cycle_name(cycle)}")


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
        if ".test." in path.name:
            check_test_placement(path)
        else:
            check_imports(path)
            check_screen_names(path)
            check_reexports(path)
            check_state_spread(path)
            check_display_mutation(path)
            check_owned_fields(path)
            collect_module_imports(path)
        check_comments(path)
    check_module_cycles()
    check_test_only_slices()
    check_full_schema()
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
