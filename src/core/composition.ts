/**
 * Сборка ядра: единственное место, видящее все четыре слоя сразу.
 *
 * Здесь ядро обзаводится состоянием, хранилищем и часами — и становится тем, к чему обращаются
 * сообщением. Сегодня эту функцию зовёт браузер, завтра позовёт серверный процесс: больше в
 * переезде ничего нет.
 *
 * Состояние живёт тут, а не у отображения. Это и есть разница между «логика лежит в отдельном
 * каталоге» и «логика отдельна»: пока состоянием владел стор экрана, ядро было библиотекой, к
 * которой он ходил, а не стороной, у которой спрашивают.
 */

import type { Envelope } from "@/contract/commands";

import type { CharacterState } from "@/core/domain/assembly/state";
import type { Spell } from "@/core/domain/catalog/spell";
import { DomainError } from "@/core/domain/shared/errors";
import { checkIntegrity } from "@/core/application/dataExchange";
import type { Clock } from "@/core/application/ports/clock";
import { createSession, type LiveSession, type Occasion } from "@/core/application/session";
import {
  fromPersisted,
  toPersisted,
  type SessionRepository,
} from "@/core/application/ports/sessionRepository";
import { applyCommand } from "@/core/presentation/controller";
import { createHandler, type Backend } from "@/core/presentation/handler";

type CoreParts = {
  repository: SessionRepository;
  clock: Clock;
  /** Как выглядит персонаж, если сохранений ещё нет. */
  createInitialCharacter: () => CharacterState;
  /** Карточки из сборки. Ядро не знает, чей это контент, и не тянет его импортом. */
  loadBuiltInCatalog: () => Spell[];
};

/**
 * Собранное ядро.
 *
 * Кроме двери договора отдаёт нынешнюю живую сессию — временно, на срок переезда: отображение ещё
 * выводит числа из состояния само. Дверь уходит вместе с последним таким местом, и по сети её нет
 * вовсе, потому что состояние по проводу не ездит.
 */
export type Core = Backend & {
  live(): LiveSession | null;
};

export function createCore(parts: CoreParts): Core {
  const { repository, clock, createInitialCharacter, loadBuiltInCatalog } = parts;
  const builtInCatalog: readonly Spell[] = loadBuiltInCatalog();

  let live: LiveSession | null = null;
  let version = 0;

  const fresh = (): LiveSession => ({
    session: createSession(createInitialCharacter()),
    spellCatalog: builtInCatalog,
    spellCatalogSource: "built_in",
  });

  /**
   * Запись идёт до ответа, а не после: ответ «применено» при незаписанном состоянии — обещание
   * сохранности, которой нет.
   *
   * Встроенный каталог в запись не уходит: его копия заморозила бы книгу на дате установки, и
   * заклинание из следующей сборки не появилось бы никогда.
   */
  const persist = async (next: LiveSession): Promise<void> => {
    const stored = next.spellCatalogSource === "imported" ? next.spellCatalog : null;
    try {
      await repository.save(toPersisted(next.session, clock.now(), stored));
    } catch (error: unknown) {
      const reason = error instanceof Error ? error.message : String(error);
      throw new Error(`Не удалось сохранить состояние: ${reason}`);
    }
  };

  const opened = async (): Promise<LiveSession> => {
    if (live !== null) return live;

    const stored = await repository.load();
    if (stored === null) {
      const started = fresh();
      await persist(started);
      live = started;
      return started;
    }

    // Каталога в записи нет — значит его и не подменяли: играем тем, что в сборке.
    const catalog = stored.spellCatalog;
    const restored: LiveSession = {
      session: fromPersisted(stored),
      spellCatalog: catalog ?? builtInCatalog,
      spellCatalogSource: catalog === undefined ? "built_in" : "imported",
    };
    live = restored;
    return restored;
  };

  const handler = createHandler({
    async open() {
      return { live: await opened(), version };
    },

    async execute(envelope: Envelope) {
      const current = await opened();
      const occasion: Occasion = { ...clock, commandId: envelope.commandId };
      const next = applyCommand(current, envelope.command, occasion, {
        builtInCatalog,
        createInitialCharacter,
      });

      // Повтор попытки состояние не двигает: контроллер вернул то же самое.
      if (next === current) return { live: current, version };

      /*
       * Целостность проверяется здесь, а не у просящего: после подмены каталога ссылка в пустоту —
       * разрушенное состояние, а не спорный файл. Отказ приходит до записи, поэтому отвергнутая
       * подмена не оставляет следа.
       */
      const broken = checkIntegrity(next.session.character, next.spellCatalog);
      if (broken !== null) throw new DomainError(broken);

      await persist(next);
      live = next;
      version += 1;
      return { live: next, version };
    },
  });

  return {
    read: handler.read,
    handle: handler.handle,
    answer: handler.answer,
    live: () => live,
  };
}
