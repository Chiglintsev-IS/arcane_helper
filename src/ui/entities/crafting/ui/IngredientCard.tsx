import type { IngredientKnowledgeView } from "@/contract/views";

import { stockRu } from "@/ui/entities/crafting/lib/labels";
import { propertyNumberRu } from "@/ui/shared/lib/alchemyLabels";
import { RULE_ACTIVE } from "@/ui/shared/ui/rule";
import {
  SURFACE_CHOSEN,
  SURFACE_CONTROL,
  SURFACE_GROUP,
  SURFACE_GROUP_BARE,
} from "@/ui/shared/ui/surface";

const TAKEN_MARK = "✓";
const ADD_MARK = "+";

export function mixtureChoiceName(chosen: boolean, nameRu: string): string {
  return `${chosen ? "Убрать из состава" : "В состав"}: ${nameRu}`;
}

/**
 * Вид в списке: запись о нём открывается нажатием на карточку, а в состав он попадает отдельной
 * кнопкой — так же, как заклинание книги готовится, не закрывая своей карточки.
 */
export function IngredientCard({
  ingredient,
  chosen,
  onChoose,
  onOpen,
}: {
  ingredient: IngredientKnowledgeView;
  chosen: boolean;
  onChoose: () => void;
  onOpen: () => void;
}) {
  const { nameRu, properties, notes, shortageRu } = ingredient;

  return (
    <li className="flex items-stretch gap-1">
      <button
        type="button"
        onClick={onOpen}
        className={`flex min-w-0 flex-1 flex-col items-start gap-1 p-2 text-left ${
          chosen ? `${SURFACE_GROUP_BARE} ${RULE_ACTIVE}` : SURFACE_GROUP
        }`}
      >
        <span className="flex w-full flex-col gap-0.5">
          <span className="text-base font-semibold leading-tight">{nameRu}</span>
          <span className="text-xs tabular-nums text-ink-quiet">{stockRu(ingredient)}</span>
        </span>

        {properties.length === 0 ? null : (
          <span className="flex w-full flex-col gap-1">
            {properties.map((property) => (
              <span key={property.number} className="flex items-start gap-2">
                <span className="shrink-0 text-xs font-semibold tabular-nums text-ink-quiet">
                  {propertyNumberRu(property.number)}
                </span>
                <span className="min-w-0 flex-1 text-sm leading-tight">{property.nameRu}</span>
              </span>
            ))}
          </span>
        )}

        {notes.length === 0 ? null : (
          <span className="flex w-full flex-col gap-0.5">
            {notes.map((note) => (
              <span key={note.id} className="text-xs leading-snug text-ink-soft">
                {note.textRu}
              </span>
            ))}
          </span>
        )}

        {shortageRu === null ? null : (
          <span className="text-xs leading-snug text-reaction">{shortageRu}</span>
        )}
      </button>

      {!chosen && shortageRu !== null ? null : (
        <button
          type="button"
          aria-pressed={chosen}
          aria-label={mixtureChoiceName(chosen, nameRu)}
          onClick={onChoose}
          className={`w-11 shrink-0 text-lg ${
            chosen ? SURFACE_CHOSEN : `text-ink-quiet ${SURFACE_CONTROL}`
          }`}
        >
          <span aria-hidden="true">{chosen ? TAKEN_MARK : ADD_MARK}</span>
        </button>
      )}
    </li>
  );
}
