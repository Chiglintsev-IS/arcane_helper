#!/usr/bin/env python3
"""Иконки приложения для установки на домашний экран.

Рисуются кодом, а не растром из редактора: иконка — та же схема ритуала, что
приложение рисует внутри, и повторить
её десятью строками дешевле, чем хранить в репозитории картинку, происхождение
которой через полгода не восстановить.

Запуск из корня репозитория:

    python3 scripts/make-icons.py

Зависимостей нет: PNG собирается вручную из zlib и struct.
"""

import math
import os
import struct
import zlib

# Цвета из cветовой системы приложения: фон — тёмная тема, знак — цвет ритуала.
BACKGROUND = (11, 17, 32)
INK = (96, 191, 138)

SIZES = {
    "public/icon-192.png": 192,
    "public/icon-512.png": 512,
    # Safari берёт apple-touch-icon и не умеет прозрачность: фон здесь обязателен.
    "public/apple-touch-icon.png": 180,
}


def draw(size: int) -> bytes:
    """Схема ритуала: два кольца, шесть лучей и точка в центре."""
    center = (size - 1) / 2
    outer = size * 0.40
    inner = size * 0.26
    line = max(1.0, size * 0.022)
    dot = size * 0.07

    rows = bytearray()
    for y in range(size):
        rows.append(0)  # фильтр строки: None
        for x in range(size):
            dx, dy = x - center, y - center
            distance = math.hypot(dx, dy)

            on_ring = (
                abs(distance - outer) <= line / 2 or abs(distance - inner) <= line / 2
            )
            # Шесть лучей между кольцами — как радиальные знаки на схеме.
            angle = math.degrees(math.atan2(dy, dx)) % 60
            on_spoke = (
                inner <= distance <= outer
                and min(angle, 60 - angle) <= math.degrees(math.atan2(line / 2, max(distance, 1)))
            )
            rows.extend(INK if on_ring or on_spoke or distance <= dot else BACKGROUND)
    return bytes(rows)


def chunk(kind: bytes, payload: bytes) -> bytes:
    return (
        struct.pack(">I", len(payload))
        + kind
        + payload
        + struct.pack(">I", zlib.crc32(kind + payload) & 0xFFFFFFFF)
    )


def png(size: int) -> bytes:
    header = struct.pack(">2I5B", size, size, 8, 2, 0, 0, 0)  # 8 бит, truecolor
    return (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", header)
        + chunk(b"IDAT", zlib.compress(draw(size), 9))
        + chunk(b"IEND", b"")
    )


def main() -> None:
    for path, size in SIZES.items():
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "wb") as file:
            file.write(png(size))
        print(f"{path}: {size}×{size}")


if __name__ == "__main__":
    main()
