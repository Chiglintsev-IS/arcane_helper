"use client";

import type { IngredientKnowledgeView } from "@/contract/views";

import { RULE_EDGE_ACTIVE, RULE_EDGE_QUIET, RULE_ROW } from "@/ui/shared/ui/rule";
import { SURFACE_GROUP_BARE } from "@/ui/shared/ui/surface";

/* Знаки изученности — квадраты, а не бруски: у брусков нет пустой пары в системном шрифте. */
const REVEALED_MARK = "■";
const HIDDEN_MARK = "□";

const PROGRESS_NAME = "Раскрыто свойств";

/** Кавычки и пробелы в начале имени порядка не задают: «Неожиданность Зинаиды» стоит на «Н». */
function sortable(nameRu: string): string {
  return nameRu.replaceAll(/[«»"'\s]/gu, "").toLocaleLowerCase("ru");
}

function letterOf(nameRu: string): string {
  return sortable(nameRu).slice(0, 1).toLocaleUpperCase("ru");
}

export type KindGroup = {
  readonly letterRu: string;
  readonly kinds: readonly IngredientKnowledgeView[];
};

/** Виды книги по буквам и в том же порядке, в каком их листают на странице вида. */
export function kindGroups(kinds: readonly IngredientKnowledgeView[]): readonly KindGroup[] {
  const ordered = [...kinds].sort((one, other) =>
    sortable(one.nameRu).localeCompare(sortable(other.nameRu), "ru"),
  );

  return ordered.reduce<readonly KindGroup[]>((groups, kind) => {
    const letterRu = letterOf(kind.nameRu);
    const last = groups.at(-1);
    return last !== undefined && last.letterRu === letterRu
      ? [...groups.slice(0, -1), { letterRu, kinds: [...last.kinds, kind] }]
      : [...groups, { letterRu, kinds: [kind] }];
  }, []);
}

function Progress({ kind }: { kind: IngredientKnowledgeView }) {
  return (
    <span
      aria-label={`${PROGRESS_NAME}: ${kind.properties.length}`}
      className="shrink-0 tracking-[1.5px]"
    >
      <span aria-hidden="true" className="text-accent">
        {REVEALED_MARK.repeat(kind.properties.length)}
      </span>
      <span aria-hidden="true" className="text-off">
        {HIDDEN_MARK.repeat(kind.researchNumbers.length)}
      </span>
    </span>
  );
}

/**
 * Список видов: буквенные разделители вместо поиска и указателя. Строка называет имя и то, сколько
 * о виде известно, — запас, место и тип живут не здесь.
 */
export function KindList({
  kinds,
  openedId,
  onOpen,
}: {
  kinds: readonly IngredientKnowledgeView[];
  openedId: string | null;
  onOpen: (itemId: string) => void;
}) {
  return (
    <div className="flex flex-col">
      {kindGroups(kinds).map((group) => (
        <section key={group.letterRu}>
          <h3
            className={`px-3 py-1.5 text-[0.6875rem] font-semibold tracking-[0.1em] text-accent ${SURFACE_GROUP_BARE}`}
          >
            {group.letterRu}
          </h3>
          {group.kinds.map((kind) => (
            <button
              key={kind.itemId}
              type="button"
              onClick={() => onOpen(kind.itemId)}
              className={`flex min-h-[3.25rem] w-full items-center justify-between gap-2 px-3 py-2 text-left ${RULE_ROW} ${
                kind.itemId === openedId ? RULE_EDGE_ACTIVE : RULE_EDGE_QUIET
              }`}
            >
              <span className="min-w-0 text-sm leading-tight">{kind.nameRu}</span>
              <Progress kind={kind} />
            </button>
          ))}
        </section>
      ))}
    </div>
  );
}
