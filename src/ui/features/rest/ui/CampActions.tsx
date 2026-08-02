/**
 * Операции режима «Вне боя».
 *
 * Все четыре написаны и покрыты тестами давно, но входа к ним не было ни одного: отдохнуть в
 * приложении было нечем. Режим «Привал» их и открывает.
 *
 * Показывается только то, что сейчас сделать можно: магическое восстановление исчезает, когда оно
 * израсходовано, «Прошёл час» — когда максимум хитов не снижен. Кнопка, которая гарантированно
 * ответит отказом, занимает ряд и обещает возможность.
 */

"use client";

import type { CharacterState } from "@/core/domain/character/state";
import { maximumRecoveryPerHour } from "@/core/domain/vitality/blood";

export function CampActions({
  character,
  inFight,
  onShortRest,
  onLongRest,
  onArcaneRecovery,
  onRecoverMaximum,
  onFightOver,
  onData,
}: {
  character: CharacterState;
  /** Бой отмечен начатым и ещё не закрыт: тогда его есть чем закончить. */
  inFight: boolean;
  onShortRest: () => void;
  onLongRest: () => void;
  onArcaneRecovery: () => void;
  onRecoverMaximum: () => void;
  onFightOver: () => void;
  /** Выгрузка и загрузка (F-11): резервную копию делают между сессиями, а не в бою и не за чтением. */
  onData: () => void;
}) {
  const hourReturns = Math.min(
    maximumRecoveryPerHour(character.level),
    character.hitPoints.maximumReduction,
  );

  return (
    <section aria-label="Вне боя" className="flex flex-wrap gap-1">
      {/*
 Конец боя отмечается явно и здесь: раньше приложение спрашивало об этом на каждом
 уходе из «Боя», в том числе когда игрок просто заглядывал в книгу за справкой. Кнопка стоит
 первой, потому что это первое, что делают, выйдя из боя.
 */}
      {inFight ? <Action onClick={onFightOver} name="Бой закончен" tone="strong" /> : null}
      <Action onClick={onShortRest} name="Короткий отдых · час" />
      <Action onClick={onLongRest} name="Долгий отдых" />
      {/*
 Кнопка не исчезает израсходованной: пропавшая кнопка не отвечает на вопрос «почему нельзя», а
 за столом этот вопрос возникает раньше, чем игрок вспомнит правило. Недоступность
 называется причиной, как у заклинания в списке.
 */}
      <Action
        onClick={onArcaneRecovery}
        name="Магическое восстановление"
        {...(character.arcaneRecoveryAvailable
          ? {}
          : { disabledReason: "Уже использовано до следующего долгого отдыха" })}
      />
      {character.hitPoints.maximumReduction > 0 ? (
        <Action onClick={onRecoverMaximum} name={`Прошёл час · максимум +${hourReturns}`} />
      ) : null}
      <Action onClick={onData} name="Данные" />
    </section>
  );
}

/**
 * Кнопка операции — одна строка и только название.
 *
 * Подпись с ценой («1 час», «8 часов») делала шапку привала выше экрана: три ряда кнопок по два ряда
 * текста в каждом. Час против восьми часов игрок и так знает — это базовые правила, — а число в
 * подписи остаётся только там, где его действительно не угадать: сколько вернёт прошедший час.
 */
function Action({
  onClick,
  name,
  tone,
  disabledReason,
}: {
  onClick: () => void;
  name: string;
  tone?: "strong";
  /** Причина недоступности словами. Кнопка гаснет, но остаётся видимой и объясняет себя. */
  disabledReason?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabledReason !== undefined}
      {...(disabledReason === undefined ? {} : { title: disabledReason })}
      aria-label={disabledReason === undefined ? undefined : `${name} — ${disabledReason}`}
      className={`min-h-11 grow whitespace-nowrap rounded-xl border px-3 text-sm font-medium disabled:opacity-50 ${
        tone === "strong"
          ? "border-action bg-action/10 text-action-strong dark:text-action"
          : "border-slate-200 dark:border-slate-800"
      }`}
    >
      {name}
    </button>
  );
}
