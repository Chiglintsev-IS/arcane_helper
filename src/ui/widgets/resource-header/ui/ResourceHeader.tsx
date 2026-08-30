/**
 * Шапка ресурсов: чем платить и сколько осталось.
 *
 * Стоит там, где тратят и восстанавливают, — в «Игре» и в «Привале». Закреплена и остаётся на месте
 * при прокрутке: на неё смотрят в каждый ход. Имени, класса и подкласса в шапке нет: за столом их не
 * спрашивают, а место они занимают постоянно — их дом «Лист».
 *
 * Рядов три, и каждый отвечает на свой вопрос. Первый — числа тела и его зарядов: защита, здоровье,
 * руны, Кости хитов. Общего имени у ряда нет, и голосу он его не называет: «чем платить» солгало бы
 * про защиту, а «сколько осталось» — про неё же. Каждая плитка называет себя целиком сама.
 * Второй — ячейки во всю ширину: их считают чаще всего, и новый уровень встаёт в него пятой
 * плиткой, не ужимая соседей. Третий — тихая строка того, что за бой не меняется вовсе: скорость,
 * размер и пассивная внимательность. Её называют мастеру, но её не тратят, и потому она стоит
 * мельче и без ступени.
 *
 * Компонент презентационный: состояние приходит параметрами, действия — из экрана.
 */

import type { ResourcesView, SheetView, TurnView } from "@/contract/views";

import { ARMOR_CLASS_ADJUSTMENT } from "@/ui/features/edit-armor-class/ui/ArmorClassSheet";
import {
  DERIVED_LABELS,
  SHEET_FIELD_LABELS,
  sizeLabel,
  skillLabel,
} from "@/ui/entities/character/lib/labels";
import { HIT_POINTS_EVENTS } from "@/ui/features/edit-hit-points/ui/HitPointsSheet";
import { MARKS_LABEL } from "@/ui/features/edit-character-sheet/ui/MarksSheet";
import { RESOURCES_EDIT_LABEL } from "@/ui/features/edit-resources/ui/ResourcesSheet";
import { Badge } from "@/ui/shared/ui/Badge";
import { feet } from "@/ui/shared/lib/spellLabels";
import { hitDicePool } from "@/ui/widgets/resource-header/lib/hitDicePool";
import { signed } from "@/shared/language";
import { SURFACE_CONTROL, SURFACE_GROUP } from "@/ui/shared/ui/surface";

/**
 * Ресурсы хода: чем ходят, в том порядке, в каком их называют правила.
 *
 * Подпись на экране короткая, доступное имя — полное: на iPhone SE места нет, но «Бонусное» без
 * пояснения незрячему пользователю ничего не говорит. Имя называет и род: действие израсходовано,
 * реакция израсходована, и одна строка на оба случая читалась бы как ошибка приложения.
 */
const TURN_RESOURCES: readonly {
  labelRu: string;
  spentRu: string;
  spentIn: (turn: TurnView) => boolean;
}[] = [
  {
    labelRu: "Действие",
    spentRu: "Действие израсходовано",
    spentIn: (turn) => !turn.actionAvailable,
  },
  {
    labelRu: "Бонусное",
    spentRu: "Бонусное действие израсходовано",
    spentIn: (turn) => !turn.bonusActionAvailable,
  },
  {
    labelRu: "Реакция",
    spentRu: "Реакция израсходована",
    spentIn: (turn) => !turn.reactionAvailable,
  },
];

/**
 * Шкура плитки: ступень отвечает, метит ли в плитку палец, приглушённость — кончился ли пул.
 *
 * Ячейка уровня и пул носят её одну: за ними стоит одна и та же дверь, и разные шкуры на ней
 * обещали бы разные дела.
 */
function payingSkin({
  pressable,
  available,
}: {
  pressable: boolean;
  available: boolean;
}): string {
  if (!available) return `text-ink-quiet ${SURFACE_GROUP}`;
  return pressable ? SURFACE_CONTROL : SURFACE_GROUP;
}

/** Подпись плитки: мелкая строка над числом. */
function TileCaption({ children }: { children: React.ReactNode }) {
  return (
    <span className="block whitespace-nowrap text-[0.625rem] leading-tight text-ink-quiet">
      {children}
    </span>
  );
}

/**
 * Плитка первого ряда: подпись, число и, если за плиткой есть дверь, нажатие.
 *
 * Одна на все четыре, потому что вопрос у них один — «сколько сейчас и где это менять». Пока плиток
 * было четыре вида, КД и хиты расходились с рунами шириной подписи и высотой числа, хотя стоят в
 * одном ряду и читаются одним взглядом.
 *
 * Смыслового цвета плитка не берёт. Восемь оттенков заняты видом действия, ролью, концентрацией и
 * ритуалом, и зелёная плитка рун читалась бы как ритуал, которым руна не является. На вопрос «есть
 * ли ещё» отвечают само число и знак отказа: полный пул назван остатком, кончившийся — знаком.
 *
 * Знак стоит при числе, а не при подписи: подпись называет ресурс и от остатка не зависит, поэтому
 * ширина плитки не меняется от того, кончился пул или нет, — ряд не перестраивается на исходе.
 */
function Tile({
  captionRu,
  value,
  accessibleName,
  available = true,
  onOpen,
}: {
  captionRu: string;
  value: string;
  /** Полное имя величины: подпись короче его ровно настолько, насколько требует ширина ряда. */
  accessibleName: string;
  /** Есть ли чем платить: кончившийся пул опускается ступенью и метится знаком при числе. */
  available?: boolean;
  /** Дверь правки, если она есть; без неё плитка — факт, а не кнопка. */
  onOpen?: () => void;
}) {
  const shown = (
    <>
      <TileCaption>{captionRu}</TileCaption>
      <span className="block text-base font-semibold leading-tight tabular-nums">
        {available ? null : <span aria-hidden="true">✗ </span>}
        {value}
      </span>
    </>
  );
  const skin = `flex-auto ${payingSkin({ pressable: onOpen !== undefined, available })}`;

  // Обёртка `div` обязательна: `button` не может быть прямым потомком `dl` (axe: only-dlitems).
  return (
    <div className={skin}>
      <dt className="sr-only">{accessibleName}</dt>
      <dd>
        {onOpen === undefined ? (
          <div className="px-2 py-1">{shown}</div>
        ) : (
          <button
            type="button"
            onClick={onOpen}
            aria-label={accessibleName}
            className="w-full px-2 py-1 text-left"
          >
            {shown}
          </button>
        )}
      </dd>
    </div>
  );
}

/** Ячейка уровня словами: тем же именем её зовёт и шапка, и доступное имя ряда. */
function slotName(slot: ResourcesView["slots"][number]): string {
  return `Ячейки ${slot.level} уровня: ${slot.remaining} из ${slot.maximum}`;
}

/**
 * Ячейки всех уровней: остаток и максимум на каждом. Минус — долг, разрешённый «Применить всё равно».
 *
 * Уровней четыре, а правка у них одна: любой из них открывает ту же шторку — место, где число
 * видно, и место, где его меняют, одно и то же. Нажимаемое место поэтому тоже одно: уже наименьшего
 * размера нажатия оно не бывает, и заведённое на каждый уровень заняло бы почти весь ряд.
 *
 * Ряд занят одними ячейками и потому идёт во всю ширину: пятый уровень встанет в него пятой плиткой,
 * не ужимая четырёх соседей до нечитаемого. Уровни стоят теснее плиток первого ряда — зазор внутри
 * ресурса меньше зазора между ресурсами, и взгляд читает их как один ресурс, а не как четыре.
 *
 * Синего у ячеек нет по той же причине, по какой у рун нет зелёного: синий занят видом действия, а
 * ячейка — не действие. Истраченная опускается на ступень: пустая рука не нажимается так же охотно,
 * как полная.
 */
function SlotRow({ slots, onEdit }: { slots: ResourcesView["slots"]; onEdit: () => void }) {
  return (
    <button
      type="button"
      onClick={onEdit}
      aria-label={`${slots.map((slot) => slotName(slot)).join(", ")}. ${RESOURCES_EDIT_LABEL}`}
      className="flex w-full gap-0.5"
    >
      {slots.map((slot) => (
        <span
          key={slot.level}
          className={`flex-1 px-1 py-1 text-center ${payingSkin({
            pressable: true,
            available: slot.remaining > 0,
          })}`}
        >
          <TileCaption>{slot.level} ур.</TileCaption>
          <span className="block text-sm font-semibold leading-tight tabular-nums">
            {slot.remaining}/{slot.maximum}
          </span>
        </span>
      ))}
    </button>
  );
}

/**
 * Тихая строка: числа, которые называют мастеру, но не тратят.
 *
 * Ступени у неё нет и плиток тоже: плитка обещает, что за ней что-то делают, а здесь делать нечего —
 * скорость и размер правятся на «Листе», пассивная внимательность не правится вовсе. Подпись стоит
 * рядом со значением, а не над ним: строке отведено одно междустрочье.
 *
 * Единственная строка шапки, которой перенос разрешён. На 320 пикселях три величины в неё не встают,
 * и выбор здесь между второй строкой и спрятанной величиной — а спрятанное за столом не
 * существует. Верхние два ряда переноса не знают: там плитки, и переехавшая плитка ломала бы место,
 * где её ищет взгляд.
 */
function QuietStat({
  captionRu,
  value,
  accessibleName,
}: {
  captionRu: string;
  value: string;
  /** Полное имя величины, если подпись его сократила. Нет вовсе — подпись и есть имя. */
  accessibleName?: string;
}) {
  return (
    <div className="flex items-baseline gap-0.5 whitespace-nowrap">
      <dt>
        {accessibleName === undefined ? (
          captionRu
        ) : (
          <>
            <span className="sr-only">{accessibleName}</span>
            <span aria-hidden="true">{captionRu}</span>
          </>
        )}
      </dt>
      <dd className="font-semibold text-ink-soft tabular-nums">{value}</dd>
    </div>
  );
}

/**
 * Закреплённая часть: числа, которые называют вслух, и всё, чем платят за сотворение.
 *
 * Экономии хода она не знает намеренно — то, что остаётся на месте при прокрутке, не должно
 * перестраиваться от начала боя.
 */
export function ResourceHeader({
  sheet,
  resources,
  onOpenArmorClass,
  onOpenHitPoints,
  onEditResources,
}: {
  /** Хиты и защита приезжают листом: то же число, что на «Листе», а не второй его счёт. */
  sheet: SheetView;
  resources: ResourcesView;
  onOpenArmorClass: () => void;
  onOpenHitPoints: () => void;
  /** Ручная правка ячеек и рун. */
  onEditResources: () => void;
}) {
  const { hitPoints } = sheet;
  const dice = hitDicePool(hitPoints.hitDice);
  const { runes } = resources;

  return (
    <section aria-label="Ресурсы" className="flex flex-col gap-1">
      <dl className="flex gap-1">
        <Tile
          captionRu={`КД${
            resources.armorClassAdjustment === 0
              ? ""
              : ` ${signed(resources.armorClassAdjustment)}`
          }`}
          value={`${sheet.armorClass}`}
          accessibleName={`КД ${sheet.armorClass}. ${ARMOR_CLASS_ADJUSTMENT}`}
          onOpen={onOpenArmorClass}
        />
        <Tile
          captionRu={`Хиты${hitPoints.temporary > 0 ? ` +${hitPoints.temporary}` : ""}`}
          value={`${hitPoints.current}/${hitPoints.maximum}`}
          accessibleName={`Хиты ${hitPoints.current}/${hitPoints.maximum}. ${HIT_POINTS_EVENTS}`}
          onOpen={onOpenHitPoints}
        />
        {/*
         * Руны правятся той же шторкой, что и ячейки: место, где число видно, и место, где его
         * меняют, — одно и то же. Кости правки не имеют — их двигают отдых и обмен кровью.
         */}
        <Tile
          captionRu="Руны"
          value={`${runes.remaining}/${runes.maximum}`}
          accessibleName={`Руны: ${runes.remaining} из ${runes.maximum}. ${RESOURCES_EDIT_LABEL}`}
          available={runes.remaining > 0}
          onOpen={onEditResources}
        />
        <Tile
          captionRu={dice.nameRu}
          value={dice.remaining}
          accessibleName={`${dice.nameRu}: ${dice.remaining}`}
          available={dice.available}
        />
      </dl>

      <SlotRow slots={resources.slots} onEdit={onEditResources} />

      {/*
       * Подпись короче доступного имени: на 320 пикселях полное имя забирает целую строку. Оба
       * слова приходят от владельца подписей: пассивная внимательность выведена из навыка и зовётся
       * его именем.
       */}
      <dl className="flex min-h-5 flex-wrap items-baseline gap-x-1.5 text-[0.625rem] text-ink-quiet">
        <QuietStat captionRu={SHEET_FIELD_LABELS.speed} value={feet(sheet.speed)} />
        <QuietStat captionRu={SHEET_FIELD_LABELS.size} value={sizeLabel(sheet.size)} />
        <QuietStat
          captionRu={skillLabel("perception")}
          value={`${resources.passivePerception}`}
          accessibleName={DERIVED_LABELS.passivePerception}
        />
      </dl>
    </section>
  );
}

/**
 * Значки: что случилось и что мешает. Уезжают вместе со списком — их число растёт от ситуации, и
 * закрепить их значило бы отдать прокрутке первую карточку.
 *
 * Постоянного здесь нет: остаток, который за бой не меняется, стоит плиткой в закреплённой части.
 * Значком остаётся то, чего на экране либо нет вовсе, либо оно только что изменилось.
 *
 * Списка заклинаний ряд не знает: ресурс хода принадлежит ходу, а не книге, и привязанный к тому,
 * что стоит в списке, он пропадал бы при смене режима — молча и в ту минуту, когда его считают.
 */
export function ResourceBadges({
  sheet,
  resources,
  turn,
  onOpenMarks,
}: {
  sheet: SheetView;
  resources: ResourcesView;
  turn: TurnView;
  /**
   * Дверь в отметки мастера: истощение и вдохновение правятся оттуда, где их видно, и не уводят с
   * экрана, на котором мастер их и назвал.
   */
  onOpenMarks: () => void;
}) {
  const { hitPoints } = sheet;
  const { inFight } = turn;

  return (
    <ul aria-label="Прочие ресурсы" className="flex flex-wrap items-center gap-2 text-xs">
        {hitPoints.maximumReduction > 0 ? (
          <li>
            <Badge tone="reaction" icon="✖">
              Максимум снижен на {hitPoints.maximumReduction}
            </Badge>
          </li>
        ) : null}
        {/*
         * Ступень названа числом и словом, а не одним цветом. Отсутствующего в ряду нет вовсе:
         * «Истощение 0» занимало бы место сообщением о том, чего не происходит.
         */}
        {sheet.exhaustion > 0 ? (
          <li>
            <MarkButton
              accessibleName={`Истощение: ступень ${sheet.exhaustion}. ${MARKS_LABEL}`}
              onOpen={onOpenMarks}
            >
              <Badge tone="reaction" icon="✖">
                Истощение {sheet.exhaustion}
              </Badge>
            </MarkButton>
          </li>
        ) : null}
        {sheet.inspiration ? (
          <li>
            <MarkButton
              accessibleName={`Вдохновение. ${MARKS_LABEL}`}
              onOpen={onOpenMarks}
            >
              <Badge tone="action" icon="✦">
                Вдохновение
              </Badge>
            </MarkButton>
          </li>
        ) : null}
        {resources.suppression.firedUpon ? (
          <li>
            <Badge tone="reaction" icon="✖">
              Особенности подавлены: урон огнём
            </Badge>
          </li>
        ) : null}
        {resources.suppression.underDirectSunlight ? (
          <li>
            <Badge tone="reaction" icon="✖">
              Особенности подавлены: солнечный свет
            </Badge>
          </li>
        ) : null}
        {/*
         * Экономия хода показывается только в бою и только у потраченного: вне боя ходов нет, а в
         * начале своего хода доступно всё. Вечно зелёная галочка отвечает то же, что и начало хода,
         * а места в ряду занимает столько же, сколько новость, — и на трёх ресурсах ряд от неё
         * переносится, унося первую карточку списка за край экрана.
         */}
        {!inFight
          ? null
          : TURN_RESOURCES.filter((resource) => resource.spentIn(turn)).map((resource) => (
              <li key={resource.labelRu} aria-label={resource.spentRu}>
                <Badge tone="muted" icon="✗">
                  {resource.labelRu}
                </Badge>
              </li>
            ))}
    </ul>
  );
}

/**
 * Значок, за которым стоит дверь: рамка остаётся размером со значок, а нажимается зона в 44 точки.
 *
 * Раздуть саму метку нельзя — она стоит в ряду с метками, за которыми двери нет, и разъехавшийся
 * ряд читался бы как два разных ряда. Поэтому поля прозрачные: видно значок, нажимается площадь
 * вокруг него, и зазор в ряду разводит соседние зоны, чтобы палец не попадал в чужую.
 */
function MarkButton({
  accessibleName,
  onOpen,
  children,
}: {
  accessibleName: string;
  onOpen: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={accessibleName}
      className="flex min-h-11 items-center"
    >
      {children}
    </button>
  );
}
