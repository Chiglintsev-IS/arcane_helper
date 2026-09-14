"use client";

import { useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";

import { RULE_EDGE_BOTTOM, RULE_EDGE_TOP } from "@/ui/shared/ui/rule";
import { SURFACE_GROUP_BARE, SURFACE_PAGE, SURFACE_PANEL } from "@/ui/shared/ui/surface";

/**
 * Доля экрана, выше которой шторка открывается страницей: за высокой шторкой остаётся полоса
 * прежнего экрана, нажатие по которой доходит до того, что под ней, — и правит не то, чем сейчас
 * занят игрок.
 */
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
 * Отступы несут части, а не рама: их высота и есть рост шторки, по которому выбран вид.
 */
export function Sheet({
  titleRu,
  nameRu,
  aside = null,
  subtitleRu = null,
  footer = null,
  overSheet = false,
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
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  });

  const layer = overSheet ? "z-30" : "z-20";

  return (
    <section
      role="dialog"
      aria-modal="true"
      {...(nameRu === undefined ? { "aria-labelledby": titleId } : { "aria-label": nameRu })}
      className={
        asPage
          ? `fixed inset-0 ${layer} flex flex-col ${SURFACE_PAGE}`
          : `fixed inset-x-0 bottom-0 ${layer} flex flex-col ${SURFACE_PANEL}`
      }
    >
      <header
        ref={headerRef}
        className={
          asPage
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

      <div className={asPage ? "min-h-0 flex-1 overflow-y-auto" : ""}>
        <div ref={contentRef} className="flex flex-col gap-3 p-3">
          {children}
        </div>
      </div>

      {footer === null ? null : (
        <footer
          ref={footerRef}
          className={
            asPage
              ? `flex shrink-0 flex-col gap-3 p-3 ${SAFE_BOTTOM} ${SURFACE_GROUP_BARE} ${RULE_EDGE_TOP}`
              : `flex flex-col gap-3 px-3 ${SAFE_BOTTOM}`
          }
        >
          {footer}
        </footer>
      )}
    </section>
  );
}
