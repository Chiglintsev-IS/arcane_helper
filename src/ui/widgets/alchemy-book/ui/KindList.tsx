"use client";

import type { IngredientKnowledgeView } from "@/contract/views";

import { propertySlots } from "@/ui/entities/crafting/lib/slots";
import {
  EmptyStripes,
  PropertyStripes,
  markNameRu,
} from "@/ui/entities/crafting/ui/PropertyMark";
import { RULE_EDGE_ACTIVE, RULE_EDGE_QUIET, RULE_ROW } from "@/ui/shared/ui/rule";
import { SURFACE_GROUP_BARE } from "@/ui/shared/ui/surface";

const PROGRESS_NAME = "Раскрыто свойств";

const SEPARATOR = ", ";

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

/**
 * Изученность строкой: четыре знака по числу слотов, и каждый раскрытый несёт цвета своего
 * направления и своей редкости. Считать их не приходится — видно и сколько раскрыто, и чем.
 */
function Progress({ kind }: { kind: IngredientKnowledgeView }) {
  const slots = propertySlots(kind);
  const revealedRu = slots
    .filter((slot) => slot.nameRu !== null)
    .map((slot) => markNameRu(slot))
    .join(SEPARATOR);

  return (
    <span
      aria-label={`${PROGRESS_NAME}: ${kind.properties.length}${
        revealedRu === "" ? "" : ` — ${revealedRu}`
      }`}
      className="flex shrink-0 items-center gap-1.5"
    >
      {slots.map((slot) =>
        slot.nameRu === null ? (
          <EmptyStripes key={slot.number} height="h-4" />
        ) : (
          <PropertyStripes key={slot.number} slot={slot} height="h-4" />
        ),
      )}
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
