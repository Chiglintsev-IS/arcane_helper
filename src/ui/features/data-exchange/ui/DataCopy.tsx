"use client";
/**
 * Работа с файлами в Safari на iOS ограничена, поэтому рядом со скачиванием стоит обмен через
 * буфер: он работает всегда.
 */

import { SURFACE_CONTROL, SURFACE_PRIMARY } from "@/ui/shared/ui/surface";

export function DataCopy({ text, fileName }: { text: string; fileName: string }) {
  const download = (): void => {
    const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        onClick={download}
        className={`min-h-11 grow ${SURFACE_PRIMARY} px-3 text-sm font-semibold`}
      >
        Скачать файл
      </button>
      <button
        type="button"
        onClick={() => void navigator.clipboard?.writeText(text)}
        className={`min-h-11 grow px-3 text-sm ${SURFACE_CONTROL}`}
      >
        Скопировать
      </button>
    </div>
  );
}
