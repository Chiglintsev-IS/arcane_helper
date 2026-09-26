"use client";

import { useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";

import { RULE_EDGE_BOTTOM, RULE_EDGE_TOP } from "@/ui/shared/ui/rule";
import { SURFACE_GROUP_BARE, SURFACE_PAGE, SURFACE_PANEL, SURFACE_SCRIM } from "@/ui/shared/ui/surface";
import { useVisibleArea } from "@/ui/shared/ui/visibleArea";

/** Доля экрана, выше которой шторка открывается страницей: полоса над высокой шторкой ни на что не отвечает. */
const PAGE_SHARE = 0.4;

/**
 * Системные отступы iPhone лежат внутри `dvh`: без них заголовок уходит под чёлку, а кнопка — под
 * домашнюю полосу.
 */
const SAFE_TOP = "pt-[calc(env(safe-area-inset-top)_+_0.75rem)]";
const SAFE_BOTTOM = "pb-[calc(env(safe-area-inset-bottom)_+_0.75rem)]";

/**
 * Шторка: заголовок, содержимое и действия внизу. Невысокая выезжает снизу; переросшая долю экрана
 * занимает его целиком — там прокручивается только содержимое, а заголовок с действиями стоят на
 * месте.
 *
 * Экран под невысокой шторкой притушен и не нажимается: нажатие мимо шторки не доходит до него и
 * набранного не выбрасывает — оно лишь убирает клавиатуру. Уходят из шторки её же ответом.
 *
 * Отступы несут части, а не рама: их высота и есть рост шторки, по которому выбран вид.
 */
export function Sheet({
  titleRu,
  nameRu,
  aside = null,
  subtitleRu = null,
  footer = null,
  overSheet = false,
  presentation = "auto",
  children,
}: {
  titleRu: string;
  /** Произносимое имя шторки, когда её дело зовётся не теми же словами, что заголовок записи. */
  nameRu?: string;
  /** Число или вопрос в строке заголовка: они про дело шторки, а не про её содержимое. */
  aside?: ReactNode;
  subtitleRu?: ReactNode;
  footer?: ReactNode;
  /** Шторка, открытая поверх другой: она лежит выше. */
  overSheet?: boolean;
  presentation?: "auto" | "page";
  children: ReactNode;
}) {
  const titleId = useId();
  const headerRef = useRef<HTMLElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const footerRef = useRef<HTMLElement>(null);
  const [asPage, setAsPage] = useState(false);

  useLayoutEffect(() => {
    const measure = (): void => {
      const parts = [headerRef.current, contentRef.current, footerRef.current];
      const grown = parts.reduce((sum, part) => sum + (part === null ? 0 : part.offsetHeight), 0);
      setAsPage(grown > window.innerHeight * PAGE_SHARE);
    };

    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    [headerRef.current, contentRef.current, footerRef.current].forEach((part) => {
      if (part !== null) observer.observe(part);
    });
    return () => observer.disconnect();
  }, []);

  const layer = overSheet ? "z-30" : "z-20";
  const page = presentation === "page" || asPage;

  /* Клавиатура телефона ложится поверх низа экрана: шторка стоит над ней, и ответы видны, пока набирают. */
  const area = useVisibleArea();
  const keyboardOpen = area !== null && area.hiddenBelow > 0;
  const placed =
    area === null
      ? undefined
      : page
        ? { top: area.top, height: area.height, bottom: "auto" }
        : { bottom: area.hiddenBelow };
  const footerEdge = keyboardOpen ? "pb-3" : SAFE_BOTTOM;

  const hideKeyboard = (): void => {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  };

  return (
    <>
      {page ? null : (
        <div
          aria-hidden="true"
          onClick={hideKeyboard}
          className={`fixed inset-0 ${layer} ${SURFACE_SCRIM}`}
        />
      )}
      <section
        role="dialog"
        aria-modal="true"
        {...(nameRu === undefined ? { "aria-labelledby": titleId } : { "aria-label": nameRu })}
        style={placed}
        className={
          page
            ? `fixed inset-0 ${layer} flex flex-col ${SURFACE_PAGE}`
            : `fixed inset-x-0 bottom-0 ${layer} flex flex-col ${SURFACE_PANEL}`
        }
      >
        <header
          ref={headerRef}
          className={
            page
              ? `flex shrink-0 flex-col gap-0.5 p-3 ${SAFE_TOP} ${SURFACE_GROUP_BARE} ${RULE_EDGE_BOTTOM}`
              : "flex flex-col gap-0.5 px-3 pt-3"
          }
        >
          <div className="flex items-baseline justify-between gap-3">
            <h2 id={titleId} className="text-base font-semibold leading-tight">
              {titleRu}
            </h2>
            {aside}
          </div>
          {subtitleRu === null ? null : (
            <p className="text-xs text-ink-quiet">{subtitleRu}</p>
          )}
        </header>

        <div className={page ? "min-h-0 flex-1 overflow-y-auto" : ""}>
          <div ref={contentRef} className="flex flex-col gap-3 p-3">
            {children}
          </div>
        </div>

        {footer === null ? null : (
          <footer
            ref={footerRef}
            className={
              page
                ? `flex shrink-0 flex-col gap-3 p-3 ${footerEdge} ${SURFACE_GROUP_BARE} ${RULE_EDGE_TOP}`
                : `flex flex-col gap-3 px-3 ${footerEdge}`
            }
          >
            {footer}
          </footer>
        )}
      </section>
    </>
  );
}
