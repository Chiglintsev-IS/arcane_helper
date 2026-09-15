import type { AlchemyHandbookView } from "@/contract/views";

import { CURRENCY_ABBREVIATIONS, MISHAP_DIE_RU, signed, withPlural } from "@/shared/language";
import { TIER_LABELS, minutesRu, portionsRu, rarityTone } from "@/ui/entities/crafting/lib/labels";
import { labelled, propertyNumberRu } from "@/ui/shared/lib/alchemyLabels";
import { RULE_BETWEEN, RULE_BLOCK, RULE_ROW, RULE_SECTION } from "@/ui/shared/ui/rule";
import { TONE_TEXT } from "@/ui/shared/ui/tone";

const STATIONARY_RU = "стационарный";

const NOW_RU = "сейчас";

const KIND_FORMS: [string, string, string] = ["вид", "вида", "видов"];

/** Главы справочника: их три, и оглавление книги считает их этим же перечнем. */
export const HANDBOOK_CHAPTERS = [
  {
    id: "research",
    titleRu: "Раскрытие свойств",
    leadRu: "по порядку, от первого к четвёртому: глубже — дольше и дороже",
  },
  {
    id: "brewing",
    titleRu: "Варка зелья",
    leadRu: "во что обходится замысел и что выходит из партии",
  },
  {
    id: "apparatus",
    titleRu: "Оснащение",
    leadRu: "какую сложность набор держит и сколько порций берёт за раз",
  },
] as const;

function bandRu(from: number, to: number | null): string {
  if (to === null) return `${from} и выше`;
  return from === to ? `${from}` : `${from}–${to}`;
}

function Chapter({
  titleRu,
  leadRu,
  children,
}: {
  titleRu: string;
  leadRu: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-5">
      {/* Заголовок и подзаголовок держатся вместе, а от таблиц их отделяет целый шаг. */}
      <div className="flex flex-col gap-2">
        <h2 className={`pb-2 text-[1.0625rem] font-semibold text-accent ${RULE_SECTION}`}>
          {titleRu}
        </h2>
        <p className="text-xs leading-snug text-ink-quiet">{leadRu}</p>
      </div>
      {children}
    </section>
  );
}

function Block({ labelRu, children }: { labelRu: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2.5">
      <span className="text-[0.625rem] tracking-[0.14em] text-ink-soft">{labelRu}</span>
      {children}
    </div>
  );
}

type Row = { key: string; cells: readonly React.ReactNode[]; marked?: boolean };

function Table({
  nameRu,
  headRu,
  rows,
}: {
  nameRu: string;
  headRu: readonly string[];
  rows: readonly Row[];
}) {
  return (
    <table className="w-full">
      <caption className="sr-only">{nameRu}</caption>
      <thead>
        <tr>
          {headRu.map((title, column) => (
            <th
              key={title}
              scope="col"
              className={`pb-2 text-[0.6875rem] font-normal leading-tight text-ink-quiet ${
                RULE_ROW
              } ${column === 0 ? "pr-3 text-left" : "pl-3 text-right"}`}
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
                className={`py-2.5 align-baseline ${
                  column === 0
                    ? "pr-3 text-left text-[0.84375rem]"
                    : "pl-3 text-right text-[0.9375rem] font-medium tabular-nums"
                }`}
              >
                {cell}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return (
    <p className={`mt-1 py-1 pl-2.5 text-xs leading-relaxed text-ink-soft ${RULE_BLOCK}`}>
      {children}
    </p>
  );
}

/** Редкость читается цветом и в справочнике: тот же цвет, что у слота свойства и кнопки выбора. */
function Rarity({ nameRu }: { nameRu: string }) {
  return (
    <span className="flex items-center gap-2">
      <span
        aria-hidden="true"
        className={`h-3.5 w-1 shrink-0 ${TONE_TEXT[rarityTone(nameRu)]} bg-current`}
      />
      <span className="min-w-0">{nameRu}</span>
    </span>
  );
}

function Name({ nameRu, noteRu }: { nameRu: string; noteRu: string | null }) {
  return (
    <span className="flex flex-col gap-0.5">
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

/**
 * Правила стола тремя главами: те же таблицы, по которым считает верстак. Второго перечня чисел у
 * приложения нет, и прочитанное здесь не может разойтись с тем, что оно назовёт при работе.
 */
export function AlchemyHandbook({
  handbook,
  apparatusRu,
}: {
  handbook: AlchemyHandbookView;
  apparatusRu: string | null;
}) {
  const { tariffs } = handbook;

  return (
    <div className="flex flex-col gap-8 p-3">
      <Chapter titleRu={HANDBOOK_CHAPTERS[0].titleRu} leadRu={HANDBOOK_CHAPTERS[0].leadRu}>
        <Block labelRu="ГЛУБИНА ИССЛЕДОВАНИЯ">
          <Table
            nameRu={HANDBOOK_CHAPTERS[0].titleRu}
            headRu={["Свойство", "Время", "Сл", "Порций"]}
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
          <Note>Порций тратится при успехе / при провале.</Note>
        </Block>

        <Block labelRu="НАДБАВКА ЗА РЕДКОСТЬ">
          <Table
            nameRu="Надбавка к сложности исследования"
            headRu={["Редкость свойства", "К Сл"]}
            rows={handbook.rarities.map((rarity) => ({
              key: rarity.nameRu,
              cells: [<Rarity key={rarity.nameRu} nameRu={rarity.nameRu} />, signed(rarity.research)],
            }))}
          />
          <Note>
            Редкость называет мастер, и заранее она неизвестна: базовая сложность номера — только
            начало счёта.
          </Note>
        </Block>

        <Note>
          Непрофильными инструментами точное свойство не раскрывается: после половины времени
          удачная проверка называет лишь направление чужой реакции, и работа начинается заново.
        </Note>
      </Chapter>

      <Chapter titleRu={HANDBOOK_CHAPTERS[1].titleRu} leadRu={HANDBOOK_CHAPTERS[1].leadRu}>
        <Block labelRu="ЦЕНА ЭФФЕКТА">
          <Table
            nameRu="Цена эффекта по редкости"
            headRu={["Редкость", "Основной", "Ещё один", "Подавить"]}
            rows={handbook.rarities.map((rarity) => ({
              key: rarity.nameRu,
              cells: [
                <Rarity key={rarity.nameRu} nameRu={rarity.nameRu} />,
                signed(rarity.main),
                signed(rarity.additional),
                signed(rarity.suppression),
              ],
            }))}
          />
          <Note>
            Редкость попутного эффекта стол не называет: в счёт идёт первая строка, а за очистку
            смеси платят {signed(tariffs.purification)} вместо подавления.
          </Note>
        </Block>

        <Block labelRu="СТУПЕНЬ СОВПАДЕНИЯ">
          <Table
            nameRu="Ступень совпадения"
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
        </Block>

        <Block labelRu="СЧЁТ СЛОЖНОСТИ">
          <dl className={`flex flex-col ${RULE_BETWEEN}`}>
            {[
              { labelRu: "Начальная сложность", value: String(tariffs.base) },
              { labelRu: "Ниже не опускается", value: String(tariffs.lowest) },
              { labelRu: "Повтор в полную силу", value: signed(tariffs.perRepeat) },
              { labelRu: "За повторы не больше", value: signed(tariffs.mostRepeats) },
              { labelRu: "Очистить смесь", value: signed(tariffs.purification) },
              {
                labelRu: "Ограничения снимают не больше",
                value: signed(tariffs.mostLimitationRelief),
              },
              {
                labelRu: "Лишняя единица состава",
                value: `за каждые ${portionsRu(tariffs.portionsPerBonusUnit)}`,
              },
              {
                labelRu: "Комплект расходников",
                value: `на ${portionsRu(tariffs.portionsPerConsumableKit)}`,
              },
            ].map((row) => (
              <div key={row.labelRu} className="flex items-baseline justify-between gap-3 py-2.5">
                <dt className="min-w-0 text-[0.84375rem] leading-snug text-ink-quiet">
                  {row.labelRu}
                </dt>
                <dd className="shrink-0 text-[0.9375rem] font-medium tabular-nums">{row.value}</dd>
              </div>
            ))}
          </dl>
        </Block>

        <Block labelRu="ВРЕМЯ ПАРТИИ">
          <Table
            nameRu="Время партии"
            headRu={["Сложность", "Время"]}
            rows={handbook.batchTimes.map((band) => ({
              key: String(band.fromDifficulty),
              cells: [bandRu(band.fromDifficulty, band.toDifficulty), minutesRu(band.minutes)],
            }))}
          />
        </Block>

        <Block labelRu="ЧЕМ ПЛАТИМ">
          <Table
            nameRu="Расходники"
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
        </Block>

        <Block labelRu={`АВАРИЯ: ${MISHAP_DIE_RU}`}>
          <Table
            nameRu="Авария"
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
        </Block>

        <Note>
          Записанный рецепт повторяется без броска. Формулу ломает смена вида, параметров,
          длительности, применения или очистки — и оснащение, которое итоговой сложности не держит.
        </Note>
      </Chapter>

      <Chapter titleRu={HANDBOOK_CHAPTERS[2].titleRu} leadRu={HANDBOOK_CHAPTERS[2].leadRu}>
        <Table
          nameRu={HANDBOOK_CHAPTERS[2].titleRu}
          headRu={["Набор", "Предел Сл", "Порций за раз"]}
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
        <Note>
          Набор бонуса к броску не даёт. Ремонт повреждённого стоит 5% его цены, и до ремонта предел
          сложности ниже на 5.
        </Note>
      </Chapter>
    </div>
  );
}
