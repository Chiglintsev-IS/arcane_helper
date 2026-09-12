import type { AlchemyHandbookView } from "@/contract/views";

import { CURRENCY_ABBREVIATIONS, MISHAP_DIE_RU, signed, withPlural } from "@/shared/language";
import { TIER_LABELS, minutesRu } from "@/ui/entities/crafting/lib/labels";
import { labelled, propertyNumberRu } from "@/ui/shared/lib/alchemyLabels";
import { RULE_BETWEEN, RULE_BLOCK } from "@/ui/shared/ui/rule";
import { SURFACE_GROUP } from "@/ui/shared/ui/surface";

const STATIONARY_RU = "стационарный";

const NOW_RU = "сейчас";

const KIND_FORMS: [string, string, string] = ["вид", "вида", "видов"];

const PORTION_FORMS: [string, string, string] = ["порцию", "порции", "порций"];

function bandRu(from: number, to: number | null): string {
  if (to === null) return `${from} и выше`;
  return from === to ? `${from}` : `${from}–${to}`;
}

function Card({ titleRu, children }: { titleRu: string; children: React.ReactNode }) {
  return (
    <section className={`flex flex-col gap-2 p-3 ${SURFACE_GROUP}`}>
      <h2 className="text-sm font-semibold leading-tight">{titleRu}</h2>
      {children}
    </section>
  );
}

type Row = { key: string; cells: readonly React.ReactNode[]; marked?: boolean };

/** Таблица в карточке: заголовок карточки её и называет, чтобы у прочитанного вслух было имя. */
function TableCard({
  titleRu,
  headRu,
  rows,
  noteRu,
}: {
  titleRu: string;
  headRu: readonly string[];
  rows: readonly Row[];
  noteRu?: string;
}) {
  return (
    <Card titleRu={titleRu}>
      <table className="w-full text-xs">
        <caption className="sr-only">{titleRu}</caption>
        <thead>
          <tr>
            {headRu.map((title, column) => (
              <th
                key={title}
                scope="col"
                className={`pb-1 font-normal text-ink-quiet ${
                  column === 0 ? "pr-2 text-left" : "pl-2 text-right"
                }`}
              >
                {title}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className={RULE_BETWEEN}>
          {rows.map((row) => (
            <tr key={row.key} className={row.marked === true ? "text-accent" : ""}>
              {row.cells.map((cell, column) => (
                <td
                  key={headRu[column]}
                  className={`py-1.5 align-baseline ${
                    column === 0 ? "pr-2 text-left" : "pl-2 text-right tabular-nums"
                  }`}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {noteRu === undefined ? null : (
        <p className="text-[0.6875rem] leading-snug text-ink-quiet">{noteRu}</p>
      )}
    </Card>
  );
}

function Name({ nameRu, noteRu }: { nameRu: string; noteRu: string | null }) {
  return (
    <span className="flex flex-col">
      <span className="leading-tight">{nameRu}</span>
      {noteRu === null ? null : (
        <span className="text-[0.6875rem] leading-tight text-ink-quiet">{noteRu}</span>
      )}
    </span>
  );
}

function apparatusNoteRu(
  entry: AlchemyHandbookView["apparatus"][number],
  own: boolean,
): string | null {
  const notes = [
    ...(own ? [NOW_RU] : []),
    ...(entry.stationary ? [STATIONARY_RU] : []),
    ...(entry.surcharge === 0 ? [] : [`${signed(entry.surcharge)} к сложности`]),
  ];
  return notes.length === 0 ? null : notes.join(" · ");
}

function researchNoteRu(step: AlchemyHandbookView["research"][number]): string | null {
  const notes = [
    ...(step.laboratory ? [STATIONARY_RU] : []),
    ...(step.consumables ? ["расходники"] : []),
    ...(step.rawSample ? ["или сырая проба"] : []),
  ];
  return notes.length === 0 ? null : notes.join(" · ");
}

function Steps({ tariffs }: { tariffs: AlchemyHandbookView["tariffs"] }) {
  const steps = [
    `Возьмите от ${tariffs.fewestKinds} до ${tariffs.mostKinds} разных видов: на каждую порцию состава уходит по порции каждого.`,
    `Свойство входит в состав, если раскрыто не меньше чем у ${tariffs.fewestKinds} видов.`,
    "Назовите основной эффект и настройте форму: длительность, начало, цели, применение, сопротивление.",
    `Сложность начинается с ${tariffs.base}, ниже ${tariffs.lowest} не опускается и не может превысить предел оснащения.`,
    "Заложите партию: время зависит только от сложности, а расходники — от её класса.",
    "Новый замысел требует проверки разработки; удавшийся рецепт повторяется без броска.",
  ];

  return (
    <ol className="flex flex-col gap-1.5">
      {steps.map((text, index) => (
        <li key={text} className="flex items-start gap-2">
          <span className="w-4 shrink-0 text-right text-xs font-semibold tabular-nums text-ink-quiet">
            {index + 1}
          </span>
          <span className="min-w-0 flex-1 text-[0.8125rem] leading-snug">{text}</span>
        </li>
      ))}
    </ol>
  );
}

export function AlchemyHandbook({
  handbook,
  apparatusRu,
}: {
  handbook: AlchemyHandbookView;
  apparatusRu: string | null;
}) {
  const { tariffs } = handbook;

  return (
    <div className="flex flex-col gap-2">
      <Card titleRu="Как идёт работа">
        <Steps tariffs={tariffs} />
        <p className={`py-0.5 pl-2 text-[0.8125rem] leading-snug ${RULE_BLOCK}`}>
          Пока состав не очищен, цель подвергается каждому совпавшему свойству, а не только тем,
          ради которых он задуман.
        </p>
      </Card>

      <TableCard
        titleRu="Оснащение"
        headRu={["Набор", "Предел Сл", "Партия"]}
        rows={handbook.apparatus.map((entry) => ({
          key: entry.nameRu,
          marked: entry.nameRu === apparatusRu,
          cells: [
            <Name
              key={entry.nameRu}
              nameRu={entry.nameRu}
              noteRu={apparatusNoteRu(entry, entry.nameRu === apparatusRu)}
            />,
            entry.hardest,
            entry.batch,
          ],
        }))}
      />

      <TableCard
        titleRu="Глубина исследования"
        headRu={["Свойство", "Время", "Сл", "Порций"]}
        noteRu="Порций тратится при успехе / при провале."
        rows={handbook.research.map((step) => ({
          key: propertyNumberRu(step.number),
          cells: [
            <Name
              key={step.number}
              nameRu={propertyNumberRu(step.number)}
              noteRu={researchNoteRu(step)}
            />,
            minutesRu(step.minutes),
            step.difficulty,
            `${step.portionsOnSuccess} / ${step.portionsOnFailure}`,
          ],
        }))}
      />

      <TableCard
        titleRu="Время партии"
        headRu={["Сложность", "Время"]}
        rows={handbook.batchTimes.map((band) => ({
          key: String(band.fromDifficulty),
          cells: [bandRu(band.fromDifficulty, band.toDifficulty), minutesRu(band.minutes)],
        }))}
      />

      <TableCard
        titleRu="Расходники"
        headRu={["Сложность", "Класс", "За час"]}
        rows={handbook.consumables.map((band) => ({
          key: band.nameRu,
          cells: [
            bandRu(band.fromDifficulty, band.toDifficulty),
            band.nameRu,
            `${band.goldPerStartedHour} ${CURRENCY_ABBREVIATIONS.gold}`,
          ],
        }))}
      />

      <TableCard
        titleRu="Совпадение свойств"
        headRu={["Источников", "Ступень", "Сл"]}
        rows={handbook.tiers.map((step) => ({
          key: step.tier,
          cells: [
            withPlural(step.sources, KIND_FORMS),
            labelled(TIER_LABELS, step.tier),
            signed(step.modifier),
          ],
        }))}
      />

      <Card titleRu="Цена замысла">
        <dl className="flex flex-col gap-1 text-xs">
          {[
            { labelRu: "Начальная сложность", value: String(tariffs.base) },
            { labelRu: "Ниже не опускается", value: String(tariffs.lowest) },
            { labelRu: "Каждый лишний эффект", value: signed(tariffs.additionalEffect) },
            { labelRu: "Подавить свойство", value: signed(tariffs.suppression) },
            { labelRu: "Ограничения снимают не больше", value: signed(tariffs.mostLimitationRelief) },
            {
              labelRu: "Лишняя единица состава",
              value: `за каждые ${withPlural(tariffs.portionsPerBonusUnit, PORTION_FORMS)}`,
            },
            {
              labelRu: "Комплект расходников",
              value: `на ${withPlural(tariffs.portionsPerConsumableKit, PORTION_FORMS)}`,
            },
          ].map((row) => (
            <div key={row.labelRu} className="flex items-baseline justify-between gap-2">
              <dt className="min-w-0 text-ink-quiet">{row.labelRu}</dt>
              <dd className="shrink-0 tabular-nums">{row.value}</dd>
            </div>
          ))}
        </dl>
      </Card>

      <TableCard
        titleRu={`Авария: ${MISHAP_DIE_RU}`}
        headRu={["Выпало", "Что случилось"]}
        rows={handbook.mishaps.map((band) => ({
          key: String(band.fromRolled),
          cells: [
            bandRu(band.fromRolled, band.toRolled),
            <span key={band.textRu} className="block text-left leading-snug">
              {band.textRu}
            </span>,
          ],
        }))}
      />
    </div>
  );
}
