#!/usr/bin/env python3
"""Список файлов сборки для service worker (F-12, NFR-001).

Запускается после `next build` и вписывает в `out/sw.js` конкретные имена
файлов сборки. Без этого в кэш при установке попадает только оболочка, а
скрипты и стили оседают там лишь со второй загрузки: при первой странице
service worker ещё не управляет, и его обработчик `fetch` её запросы не видит.

Разница не теоретическая. Игрок открывает приложение один раз дома и уходит с
телефоном за стол: если после одного открытия в кэше нет скриптов, в
авиарежиме он получит пустой экран.

Имена файлов сборки содержат хеш и заранее неизвестны, поэтому список
собирается здесь, а не пишется руками в `public/sw.js`.

Запуск из корня репозитория:

    python3 scripts/precache.py
"""

import os
import re
import sys

OUT = "out"
WORKER = os.path.join(OUT, "sw.js")
PLACEHOLDER = re.compile(r"const BUILD = \[[^\]]*\];", re.S)

# Что имеет смысл класть в кэш при установке: оболочка тянет за собой всё
# остальное, а картинки и карты исходников не нужны для запуска.
EXTENSIONS = (".js", ".css")


def build_files():
    """Пути файлов сборки относительно корня приложения, в порядке обхода."""
    root = os.path.join(OUT, "_next")
    found = []
    for dirpath, _, filenames in os.walk(root):
        for name in sorted(filenames):
            if name.endswith(EXTENSIONS):
                path = os.path.join(dirpath, name)
                found.append("./" + os.path.relpath(path, OUT))
    return sorted(found)


def main() -> int:
    if not os.path.exists(WORKER):
        print(f"{WORKER} не найден: сначала соберите приложение", file=sys.stderr)
        return 1

    files = build_files()
    if not files:
        print("файлов сборки не найдено — список остался пустым", file=sys.stderr)
        return 1

    listed = ",\n  ".join(f'"{path}"' for path in files)
    source = open(WORKER, encoding="utf-8").read()
    patched, count = PLACEHOLDER.subn(f"const BUILD = [\n  {listed},\n];", source, count=1)
    if count == 0:
        print("в sw.js нет строки `const BUILD = [...]` — вписывать некуда", file=sys.stderr)
        return 1

    with open(WORKER, "w", encoding="utf-8") as file:
        file.write(patched)
    print(f"{WORKER}: в кэш установки добавлено файлов — {len(files)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
