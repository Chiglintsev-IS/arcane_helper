/**
 * Блок отыгрыша с маркером обязательного и управлением вариантами.
 *
 * Оформление у блока заведомо другое — пунктир, курсив, свой цвет: художественный текст нельзя
 * перепутать с механикой. Единственная механическая строка здесь — что из отыгрыша
 * обязательно по правилам: вербальный компонент
 * значит, что заклинание нужно произнести вслух, и забывают об этом чаще всего.
 *
 * Строку заклинания компонент берёт сам, а не принимает пропсами: он рендерится и из карточки, и из
 * мастера применения, и прокидывание через обоих завело бы два источника одной правды. Пометки на
 * вариантах и порядок показа приезжают в ней посчитанными.
 */

"use client";

import { useState } from "react";

import type { RoleplayVariantView, SpellCardView, SpellRowView } from "@/contract/views";

import { useSession, useStores } from "@/ui/shared/model/storeContext";

const CATEGORY_LABELS: Record<string, string> = {
  short: "Коротко",
  atmospheric: "Атмосферно",
  sarcastic: "Саркастично",
};

/** Что из отыгрыша требуют правила, а что остаётся украшением. */
function requirementNote(components: SpellCardView["components"]): string {
  if (components.verbal && components.somatic) {
    return "Обязательно: произнести вслух и сделать жест свободной рукой";
  }
  if (components.verbal) return "Обязательно: произнести вслух";
  if (components.somatic) return "Обязательно: жест свободной рукой";
  return "Ни голоса, ни жеста правила не требуют — отыгрыш по желанию";
}

/**
 * Кнопка действия над вариантом. Ряд из них переносится, а не делится на равные доли: на 320
 * пикселях «Скопировать» в трети ширины не помещается, а перенос ничего не ломает.
 */
const ACTION_CLASS =
  "min-h-11 grow rounded-lg border border-slate-200 px-2 text-xs text-slate-600 dark:border-slate-800 dark:text-slate-300";

function Variants({
  row,
  category,
  onCategory,
}: {
  row: SpellRowView;
  category: string;
  onCategory: (category: string) => void;
}) {
  const { session: sessionStore } = useStores();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [ownText, setOwnText] = useState<string | null>(null);

  const execute = sessionStore.getState().execute;
  const categories = row.roleplayCategories;
  // Отключённая категория пропадает из ряда, и показывать её нечем: берём первую оставшуюся.
  // Скрыть все три нельзя, поэтому запасной вариант здесь всегда есть.
  const shown = categories.find((candidate) => candidate.id === category) ?? categories[0];

  const variants = shown?.variants ?? [];
  const visible = variants.filter((variant) => !variant.disabled);
  const hidden = variants.filter((variant) => variant.disabled);
  const rotated = visible.find((variant) => variant.suggested);
  const selected = visible.find((variant) => variant.id === selectedId) ?? rotated ?? visible[0];

  /** Выбор варианта — это и есть его использование: счётчик ведёт ротацию. */
  const choose = (variant: RoleplayVariantView): void => {
    setSelectedId(variant.id);
    void execute({ kind: "use_roleplay_variant", spellId: row.id, variantId: variant.id });
  };

  const copy = (variant: RoleplayVariantView): void => {
    // Safari на iOS отдаёт буфер только внутри пользовательского жеста: любое ожидание до вызова —
    // и разрешение потеряно. Сохранение состояния асинхронно, поэтому идёт после.
    void navigator.clipboard?.writeText(variant.text);
    void execute({ kind: "use_roleplay_variant", spellId: row.id, variantId: variant.id });
  };

  const addOwn = (text: string): void => {
    // Пустой текст сюда не доходит: операция его отклонит, но поле не должно и предлагать отправку.
    if (text.trim() === "" || shown === undefined) return;
    void execute({ kind: "add_roleplay_variant", spellId: row.id, category: shown.id, text });
    setOwnText(null);
  };

  return (
    <div className="flex flex-col gap-2">
      {/* Механическая строка внутри художественного блока — единственная и помечена как требование. */}
      <p className="rounded-md border border-concentration/40 bg-concentration/10 px-2 py-1 text-xs font-medium not-italic text-concentration-strong dark:text-concentration">
        {requirementNote(row.card.components)}
      </p>

      <div className="flex flex-wrap gap-1">
        {categories.map((value) => (
          <button
            key={value.id}
            type="button"
            aria-pressed={shown?.id === value.id}
            onClick={() => onCategory(value.id)}
            className={`min-h-11 rounded-lg border px-2 text-xs ${
              shown?.id === value.id
                ? "border-concentration text-concentration-strong dark:text-concentration"
                : "border-slate-200 text-slate-500 dark:border-slate-800"
            }`}
          >
            {CATEGORY_LABELS[value.id] ?? value.id}
          </button>
        ))}
      </div>

      <ul aria-label="Варианты отыгрыша" className="flex flex-col gap-1">
        {visible.map((variant) => (
          <li key={variant.id}>
            <button
              type="button"
              aria-pressed={selected?.id === variant.id}
              onClick={() => choose(variant)}
              className={`min-h-11 w-full rounded-lg border px-2 py-1 text-left text-sm italic ${
                selected?.id === variant.id
                  ? "border-concentration bg-concentration/10"
                  : "border-transparent"
              }`}
            >
              {variant.text}
            </button>
          </li>
        ))}
      </ul>

      {selected === undefined ? null : (
        <div className="flex flex-wrap gap-1">
          <button type="button" onClick={() => copy(selected)} className={ACTION_CLASS}>
            Скопировать
          </button>
          <button
            type="button"
            onClick={() =>
              void execute({
                kind: "toggle_roleplay_favorite",
                spellId: row.id,
                variantId: selected.id,
              })
            }
            className={ACTION_CLASS}
          >
            {selected.favorite ? "Из любимых" : "В любимые"}
          </button>
          <button
            type="button"
            onClick={() =>
              void execute({
                kind: "toggle_roleplay_disabled",
                spellId: row.id,
                variantId: selected.id,
              })
            }
            className={ACTION_CLASS}
          >
            Отключить
          </button>
        </div>
      )}

      {ownText === null ? (
        <button
          type="button"
          onClick={() => setOwnText("")}
          className={`${ACTION_CLASS} not-italic`}
        >
          Написать свой
        </button>
      ) : (
        <div className="flex flex-col gap-1">
          <textarea
            aria-label="Свой вариант отыгрыша"
            value={ownText}
            rows={2}
            onChange={(event) => setOwnText(event.target.value)}
            className="rounded-lg border border-slate-200 px-2 py-1 text-sm dark:border-slate-800 dark:bg-slate-900"
          />
          <div className="flex flex-wrap gap-1">
            <button type="button" onClick={() => addOwn(ownText)} className={ACTION_CLASS}>
              Добавить
            </button>
            <button type="button" onClick={() => setOwnText(null)} className={ACTION_CLASS}>
              Отмена
            </button>
          </div>
        </div>
      )}

      {/* Отключённое не исчезает: предпочтения журналом не отменяются, и вернуть их больше нечем. */}
      {hidden.length === 0 ? null : (
        <details className="text-xs not-italic text-slate-500">
          <summary className="min-h-11 cursor-pointer py-3">Отключено: {hidden.length}</summary>
          <ul className="flex flex-col gap-1">
            {hidden.map((variant) => (
              <li key={variant.id} className="flex items-center gap-1">
                <span className="flex-1 italic">{variant.text}</span>
                <button
                  type="button"
                  aria-label={`Включить: ${variant.text}`}
                  onClick={() =>
                    void execute({
                      kind: "toggle_roleplay_disabled",
                      spellId: row.id,
                      variantId: variant.id,
                    })
                  }
                  className={ACTION_CLASS}
                >
                  Включить
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}

      <dl className="flex flex-col gap-1 text-xs italic text-slate-600 dark:text-slate-400">
        <div>
          <dt className="not-italic">Реплика</dt>
          {/* Кавычки-ёлочки отличают прямую речь от описания жеста рядом. */}
          <dd>«{row.card.roleplay.incantation}»</dd>
        </div>
        <div>
          <dt className="not-italic">Жест</dt>
          <dd>{row.card.roleplay.gesture}</dd>
        </div>
      </dl>
    </div>
  );
}

/**
 * Блок отыгрыша. В карточке он свёрнут (`collapsible`), в мастере применения — раскрыт: там выбор
 * категории часть применения, а не справка.
 */
export function RoleplaySection({
  spellId,
  collapsible = false,
  category: controlled,
  onCategory,
}: {
  spellId: string;
  collapsible?: boolean;
  /** Выбранная снаружи категория; `null` — выбора не было, и показывается первая доступная. */
  category?: string | null;
  onCategory?: (category: string) => void;
}) {
  const row = useSession((state) =>
    state.snapshot?.spells.find((candidate) => candidate.id === spellId),
  );
  const [local, setLocal] = useState<string | null>(null);
  const category = controlled ?? local;
  const change = (value: string): void => {
    setLocal(value);
    onCategory?.(value);
  };

  if (row === undefined) return null;
  // Пока игрок не выбирал, показывается первая доступная категория: пустого ряда не бывает.
  const shown = category ?? row.roleplayCategories[0]?.id ?? "";

  if (collapsible) {
    return (
      <details className="rounded-lg border border-dashed border-concentration/50 bg-concentration/5 p-2">
        <summary className="cursor-pointer text-sm font-medium text-concentration-strong dark:text-concentration">Отыгрыш</summary>
        <div className="mt-2">
          <Variants row={row} category={shown} onCategory={change} />
        </div>
      </details>
    );
  }

  return (
    <section
      aria-label="Отыгрыш"
      className="flex flex-col gap-2 rounded-lg border border-dashed border-concentration/50 bg-concentration/5 p-2"
    >
      <h3 className="text-xs font-medium uppercase tracking-wide text-concentration-strong dark:text-concentration">Отыгрыш</h3>
      <Variants row={row} category={shown} onCategory={change} />
    </section>
  );
}
