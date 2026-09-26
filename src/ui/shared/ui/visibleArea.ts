"use client";

import { useEffect, useState } from "react";

/** Видимая часть экрана: клавиатура телефона закрывает низ, а страница под ней не сжимается сама. */
export type VisibleArea = { top: number; height: number; hiddenBelow: number };

export function useVisibleArea(): VisibleArea | null {
  const [area, setArea] = useState<VisibleArea | null>(null);

  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;

    const measure = (): void =>
      setArea({
        top: viewport.offsetTop,
        height: viewport.height,
        hiddenBelow: Math.max(0, window.innerHeight - viewport.offsetTop - viewport.height),
      });

    measure();
    viewport.addEventListener("resize", measure);
    viewport.addEventListener("scroll", measure);
    return () => {
      viewport.removeEventListener("resize", measure);
      viewport.removeEventListener("scroll", measure);
    };
  }, []);

  return area;
}
