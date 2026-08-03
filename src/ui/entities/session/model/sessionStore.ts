/**
 * Стор сессии: единственная точка изменения состояния в приложении.
 *
 * У стора одна операция изменения — `apply`, принимающая чистую функцию из `session.ts`. Благодаря
 * этому новая операция над состоянием не требует ни строчки правок здесь: стор не знает, что именно
 * делает переданная функция, он отвечает за загрузку, сохранение и показ ошибок.
 *
 * Каталог заклинаний живёт здесь же, рядом с персонажем: у него отдельные
 * операции, потому что `apply` меняет только состояние персонажа, а каталог с персонажем обязан
 * меняться вместе — одной записью, без половины импорта.
 *
 * Зависимости приходят снаружи (хранилище, часы, начальное состояние, встроенный каталог): стор не
 * выбирает реализацию и не импортирует контент, поэтому проверяется без браузера.
 */

import { createStore, type StoreApi } from "zustand/vanilla";

import type { CharacterState } from "@/core/domain/assembly/state";
import type { Spell } from "@/core/domain/catalog/spell";
import { applyImport, checkIntegrity, type ExportFile } from "@/core/application/dataExchange";
import { fromPersisted, toPersisted, type SessionRepository } from "@/core/application/ports/sessionRepository";
import { createSession, replaceCharacter, type Clock, type Session } from "@/core/application/session";

export type SessionStatus = "loading" | "ready" | "error";

/** Чем играют прямо сейчас: карточками из сборки или загруженными игроком. */
export type SpellCatalogSource = "built_in" | "imported";

export type SessionStoreState = {
  session: Session | null;
  /** Карточки, по которым идёт игра. До загрузки — встроенные. */
  spellCatalog: readonly Spell[];
  spellCatalogSource: SpellCatalogSource;
  status: SessionStatus;
  /** Сообщение последней ошибки: показывается пользователю, состояние при этом не испорчено. */
  error: string | null;

  /** Прочитать сохранённое или начать с чистого состояния персонажа. */
  hydrate: () => Promise<void>;
  /**
   * Применить операцию над состоянием. Возвращает текст ошибки или `null` при успехе —
   * так вызывающий узнаёт о причине, не разбирая исключений.
   */
  apply: (operation: (session: Session) => Session) => string | null;
  /**
   * Заменить персонажа и каталог разобранным файлом. Журнал начинается заново:
   * «Отменить» после импорта вернуло бы ячейку тому, кого уже нет.
   */
  importSnapshot: (file: ExportFile) => string | null;
  /**
   * Вернуться к карточкам из сборки. Персонаж остаётся: чужой файл не должен стоить
   * игроку состояния, если встроенных карточек ему хватает.
   */
  restoreBuiltInCatalog: () => string | null;
  /** Забыть сохранённое и начать заново. */
  reset: () => Promise<void>;
  /** Снять сообщение об ошибке. */
  dismissError: () => void;
};

export type SessionStoreDependencies = {
  repository: SessionRepository;
  clock: Clock;
  /** Как выглядит персонаж, если сохранений ещё нет. */
  createInitialCharacter: () => CharacterState;
  /** Карточки из сборки. Стор не знает, чей это контент, и не тянет его импортом. */
  loadBuiltInCatalog: () => Spell[];
};

/** Всё, что сохраняется вместе. Держится одним объектом, чтобы записать половину было нечем. */
type Loaded = {
  session: Session;
  spellCatalog: readonly Spell[];
  spellCatalogSource: SpellCatalogSource;
};

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function createSessionStore(
  dependencies: SessionStoreDependencies,
): StoreApi<SessionStoreState> {
  const { repository, clock, createInitialCharacter, loadBuiltInCatalog } = dependencies;
  const builtInCatalog: readonly Spell[] = loadBuiltInCatalog();

  return createStore<SessionStoreState>((set, get) => {
    /**
     * Немедленная запись после каждого изменения: дебаунс сложнее и теряет последнее действие,
     * если приложение закрыли. Ошибка записи показывается — молчать о ней значит обещать
     * сохранность, которой нет.
     *
     * Встроенный каталог в запись не идёт: его копия заморозила бы книгу на дате установки, и
     * заклинание из следующей сборки не появилось бы никогда.
     */
    const persist = (loaded: Loaded): void => {
      const stored = loaded.spellCatalogSource === "imported" ? loaded.spellCatalog : null;
      void repository.save(toPersisted(loaded.session, clock.now(), stored)).catch(
        (error: unknown) => {
          set({ error: `Не удалось сохранить состояние: ${describe(error)}` });
        },
      );
    };

    const fail = (message: string): string => {
      set({ error: message });
      return message;
    };

    /**
     * Единственное место, где меняется каталог. Целостность проверяется здесь, а не у вызывающего:
     * после подмены каталога ссылка в пустоту — это разрушенное состояние, а не спорный файл
     */
    const commit = (loaded: Loaded): string | null => {
      const broken = checkIntegrity(loaded.session.character, loaded.spellCatalog);
      if (broken !== null) return fail(broken);

      set({ ...loaded, error: null });
      persist(loaded);
      return null;
    };

    const fresh = (): Loaded => ({
      session: createSession(createInitialCharacter()),
      spellCatalog: builtInCatalog,
      spellCatalogSource: "built_in",
    });

    return {
      session: null,
      spellCatalog: builtInCatalog,
      spellCatalogSource: "built_in",
      status: "loading",
      error: null,

      async hydrate() {
        set({ status: "loading", error: null });
        try {
          const stored = await repository.load();
          if (stored === null) {
            const loaded = fresh();
            set({ ...loaded, status: "ready" });
            persist(loaded);
            return;
          }
          // Каталога в записи нет — значит его и не подменяли: играем тем, что в сборке.
          const catalog = stored.spellCatalog;
          set({
            session: fromPersisted(stored),
            spellCatalog: catalog ?? builtInCatalog,
            spellCatalogSource: catalog === undefined ? "built_in" : "imported",
            status: "ready",
          });
        } catch (error: unknown) {
          // Данные остаются в хранилище: их можно выгрузить руками, а начать с чистого листа
          // молча — потерять игру.
          set({ session: null, status: "error", error: describe(error) });
        }
      },

      apply(operation) {
        const { session, spellCatalog, spellCatalogSource } = get();
        if (session === null) return fail("Состояние ещё не загружено");
        try {
          const loaded = { session: operation(session), spellCatalog, spellCatalogSource };
          set({ ...loaded, error: null });
          persist(loaded);
          return null;
        } catch (error: unknown) {
          return fail(describe(error));
        }
      },

      importSnapshot(file) {
        const { session } = get();
        // Импорт в непрочитанный стор записал бы поверх того, чего никто не видел, — а
        // повреждённое хранилище приложение обязано сохранять для ручной выгрузки.
        if (session === null) return fail("Состояние ещё не загружено");

        const { character, spells } = applyImport(session.character, file, "replace");
        return commit({
          session: replaceCharacter(character),
          spellCatalog: spells,
          spellCatalogSource: "imported",
        });
      },

      restoreBuiltInCatalog() {
        const { session } = get();
        if (session === null) return fail("Состояние ещё не загружено");

        return commit({
          session,
          spellCatalog: builtInCatalog,
          spellCatalogSource: "built_in",
        });
      },

      async reset() {
        await repository.clear();
        const loaded = fresh();
        set({ ...loaded, status: "ready", error: null });
        persist(loaded);
      },

      dismissError() {
        set({ error: null });
      },
    };
  });
}
