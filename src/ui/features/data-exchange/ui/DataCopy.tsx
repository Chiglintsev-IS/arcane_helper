/**
 * Копия данных: файлом и через буфер.
 *
 * Работа с файлами в Safari на iOS ограничена, поэтому рядом со скачиванием стоит обмен через
 * буфер: скопировать текст и вставить его — то, что работает всегда.
 *
 * Способ отдать копию живёт здесь один. Выгрузка сессии и копия непрочитанного сохранения
 * различаются тем, что копируют, а не тем, как: второй экземпляр этих кнопок разошёлся бы с первым
 * молча.
 */

"use client";

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
        className="min-h-11 grow rounded-xl bg-action-strong px-3 text-sm font-semibold text-white"
      >
        Скачать файл
      </button>
      <button
        type="button"
        onClick={() => void navigator.clipboard?.writeText(text)}
        className="min-h-11 grow rounded-xl border border-slate-200 px-3 text-sm dark:border-slate-800"
      >
        Скопировать
      </button>
    </div>
  );
}
