/**
 * Шапка ресурсов: чем платить и сколько осталось.
 *
 * Стоит там, где тратят и восстанавливают, — в «Игре». Закреплена и остаётся на месте при
 * прокрутке: на неё смотрят в каждый ход. Имени, класса и уровня в шапке нет: за столом их не
 * спрашивают, а место они занимают постоянно — их дом «Лист».
 *
 * Плиткой стоит то, что за бой не меняется, значком — то, что случается: у плитки своё место, и
 * глаз находит её там же, где нашёл в прошлый ход. Поэтому пулы, которыми платят, стоят плитками
 * рядом с ячейками — одним рядом, одним вопросом, — а не отдельной строкой значков под шапкой.
 *
 * Компонент презентационный: состояние приходит параметрами, действия — из экрана.
 */

import type { ResourcesView, SheetView, TurnView } from "@/contract/views";

import { ARMOR_CLASS_ADJUSTMENT } from "@/ui/features/edit-armor-class/ui/ArmorClassSheet";
import { DERIVED_LABELS, skillLabel } from "@/ui/entities/character/lib/labels";
import { HIT_POINTS_EVENTS } from "@/ui/features/edit-hit-points/ui/HitPointsSheet";
import { RESOURCES_EDIT_LABEL } from "@/ui/features/edit-resources/ui/ResourcesSheet";
import { Badge } from "@/ui/shared/ui/Badge";
import { type Tone } from "@/ui/shared/ui/tone";
import { hitDicePool } from "@/ui/widgets/resource-header/lib/hitDicePool";
import { signed } from "@/shared/language";
import { SURFACE_CONTROL, SURFACE_GROUP } from "@/ui/shared/ui/surface";

/**
 * Ярлык того, чем платят: ресурса хода и пула с остатком.
 *
 * Подпись одна и та же в обоих состояниях: израсходованность несут знак и пониженная контрастность,
 * а словами её называет доступное имя, которое ставит вызывающий. Цвет отвечает на вопрос «есть ли
 * ещё»: постоянный отвечал бы «да» и при нуле, и пустой пул был бы неотличим от полного.
 */
function SpendableResource({
  available,
  tone,
  icon,
  children,
}: {
  available: boolean;
  tone: Tone;
  /** Знак ресурса, пока им есть чем платить: кончившийся носит знак отказа. */
  icon: string;
  children: React.ReactNode;
}) {
  return (
    <Badge tone={available ? tone : "muted"} icon={available ? icon : "✗"}>
      {children}
    </Badge>
  );
}

/**
 * Шкура плитки ряда оплаты: ступень отвечает, метит ли в плитку палец, приглушённость — кончился ли
 * пул. Ячейка уровня и пул носят её одну: за ними стоит одна и та же дверь, и разные шкуры на ней
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
 * Плитка КД — кнопка, как и плитка хитов: поправку мастера кладут там же, где видно само число.
 * Правкой дверь не зовётся — за ней подтверждают случившееся за столом, а не сохраняют запись.
 */
function ArmorClassStat({
  value,
  adjustment,
  onOpen,
}: {
  value: string;
  adjustment: number;
  onOpen: () => void;
}) {
  // Обёртка `div` обязательна: `button` не может быть прямым потомком `dl` (axe: only-dlitems).
  return (
    <div className={`flex-auto ${SURFACE_CONTROL}`}>
      <dt className="sr-only">КД</dt>
      <dd>
        <button
          type="button"
          onClick={onOpen}
          aria-label={`КД ${value}. ${ARMOR_CLASS_ADJUSTMENT}`}
          className="w-full px-2 py-1 text-left"
        >
          <TileCaption>КД{adjustment !== 0 ? ` ${signed(adjustment)}` : ""}</TileCaption>
          <span className="block text-base font-semibold leading-tight tabular-nums">{value}</span>
        </button>
      </dd>
    </div>
  );
}

/**
 * Плитка хитов — кнопка: случившееся за столом подтверждают отсюда. Число, которое чаще всего
 * меняется, и место, где его меняют, — одно и то же, и зовутся они одним словом.
 */
function HitPointsStat({
  value,
  temporary,
  onOpen,
}: {
  value: string;
  temporary: number;
  onOpen: () => void;
}) {
  // Обёртка `div` обязательна: `button` не может быть прямым потомком `dl` (axe: only-dlitems).
  return (
    <div className={`flex-auto ${SURFACE_CONTROL}`}>
      <dt className="sr-only">Хиты</dt>
      <dd>
        <button
          type="button"
          onClick={onOpen}
          aria-label={`Хиты ${value}. ${HIT_POINTS_EVENTS}`}
          className="w-full px-2 py-1 text-left"
        >
          <TileCaption>Хиты{temporary > 0 ? ` +${temporary}` : ""}</TileCaption>
          <span className="block text-base font-semibold leading-tight tabular-nums">{value}</span>
        </button>
      </dd>
    </div>
  );
}

/**
 * Плитка числа, которое за бой не меняется: за ней нет правки, и лежит она ступенью ниже — верхнюю
 * ступень в этом ряду занимает то, что нажимается.
 */
function ConstantStat({
  captionRu,
  value,
  accessibleName,
}: {
  captionRu: string;
  value: string;
  /** Полное имя величины: подпись короче его ровно настолько, насколько требует ширина ряда. */
  accessibleName: string;
}) {
  return (
    <div className={`flex-auto px-2 py-1 ${SURFACE_GROUP}`}>
      <dt className="sr-only">{accessibleName}</dt>
      <dd>
        <TileCaption>{captionRu}</TileCaption>
        <span className="block text-base font-semibold leading-tight tabular-nums">{value}</span>
      </dd>
    </div>
  );
}

/**
 * Плитка пула: чем платят и сколько осталось.
 *
 * Смыслового цвета плитка не берёт. Восемь оттенков заняты видом действия, ролью, концентрацией и
 * ритуалом, и зелёная плитка рун читалась бы как ритуал, которым руна не является. На вопрос «есть
 * ли ещё» отвечают само число и знак отказа: полный пул назван остатком, кончившийся — знаком.
 *
 * Знак стоит при числе, а не при подписи: подпись называет ресурс и от остатка не зависит, поэтому
 * ширина плитки не меняется от того, кончился пул или нет, — ряд не перестраивается на исходе.
 *
 * Ступень отвечает на другой вопрос — нажимается ли плитка: правка у пула бывает, а бывает и нет, и
 * одна ступень на оба случая обещала бы дверь там, где её не открыть.
 */
function PoolCounter({
  captionRu,
  value,
  available,
  action,
}: {
  captionRu: string;
  value: string;
  available: boolean;
  /** Правка пула, если она есть; без неё плитка — факт, а не кнопка. */
  action?: { accessibleName: string; onOpen: () => void };
}) {
  const shown = (
    <>
      <TileCaption>{captionRu}</TileCaption>
      <span className="block text-sm font-semibold leading-tight tabular-nums">
        {available ? null : <span aria-hidden="true">✗ </span>}
        {value}
      </span>
    </>
  );
  const skin = `flex-1 text-center ${payingSkin({
    pressable: action !== undefined,
    available,
  })}`;

  if (action === undefined) {
    return <li className={`${skin} px-1 py-1`}>{shown}</li>;
  }
  return (
    <li className={skin}>
      <button
        type="button"
        onClick={action.onOpen}
        aria-label={action.accessibleName}
        className="w-full px-1 py-1"
      >
        {shown}
      </button>
    </li>
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
 * размера нажатия оно не бывает, и заведённое на каждый уровень заняло бы почти весь ряд, уводя
 * последние плитки за край узкого экрана.
 *
 * Уровни стоят теснее, чем соседи по ряду: зазор внутри группы меньше зазора между ресурсами, и
 * взгляд читает четыре уровня как один ресурс, а не как четыре соседних.
 *
 * Синего у ячеек нет по той же причине, по какой у рун нет зелёного: синий занят видом действия, а
 * ячейка — не действие. Истраченная опускается на ступень: пустая рука не нажимается так же охотно,
 * как полная.
 */
function SlotCounters({ slots, onEdit }: { slots: ResourcesView["slots"]; onEdit: () => void }) {
  return (
    <li className="flex-[4]">
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
    </li>
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

  return (
    <section aria-label="Ресурсы" className="flex flex-col gap-1">
      <dl className="flex gap-1">
        <ArmorClassStat
          value={`${sheet.armorClass}`}
          adjustment={resources.armorClassAdjustment}
          onOpen={onOpenArmorClass}
        />
        <HitPointsStat
          value={`${hitPoints.current}/${hitPoints.maximum}`}
          temporary={hitPoints.temporary}
          onOpen={onOpenHitPoints}
        />
        {/*
         * Подпись короче доступного имени: на 320 пикселях полное имя забирает целый ряд, а ряд
         * здесь стоит четверти карточки списка. Оба слова приходят от владельца подписей: величина
         * выведена из навыка и зовётся его именем.
         */}
        <ConstantStat
          captionRu={skillLabel("perception")}
          value={`${resources.passivePerception}`}
          accessibleName={DERIVED_LABELS.passivePerception}
        />
      </dl>

      <ul aria-label="Чем платить" className="flex gap-1">
        <SlotCounters slots={resources.slots} onEdit={onEditResources} />
        {/*
         * Руны правятся той же шторкой, что и ячейки: место, где число видно, и место, где его
         * меняют, — одно и то же. Кости и очки правки не имеют — их двигают отдых и обмен кровью.
         */}
        <PoolCounter
          captionRu="Руны"
          value={`${resources.runes.remaining}/${resources.runes.maximum}`}
          available={resources.runes.remaining > 0}
          action={{
            accessibleName: `Руны: ${resources.runes.remaining} из ${resources.runes.maximum}. ${RESOURCES_EDIT_LABEL}`,
            onOpen: onEditResources,
          }}
        />
        <PoolCounter captionRu={dice.nameRu} value={dice.remaining} available={dice.available} />
        <PoolCounter
          captionRu="Очки"
          value={`${resources.spellPoints}`}
          available={resources.spellPoints > 0}
        />
      </ul>
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
}: {
  sheet: SheetView;
  resources: ResourcesView;
  turn: TurnView;
}) {
  const { hitPoints } = sheet;
  const { inFight } = turn;

  return (
    <ul aria-label="Прочие ресурсы" className="flex flex-wrap items-center gap-1 text-xs">
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
          <li aria-label={`Истощение: ступень ${sheet.exhaustion}`}>
            <Badge tone="reaction" icon="✖">
              Истощение {sheet.exhaustion}
            </Badge>
          </li>
        ) : null}
        {sheet.inspiration ? (
          <li aria-label="Вдохновение">
            <Badge tone="action" icon="✦">
              Вдохновение
            </Badge>
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
         * Экономия хода показывается только в бою: вне боя ходов нет, и правила отвечают «всё
         * доступно» независимо от журнала. Три вечно зелёные галочки не сообщали бы ничего.
         *
         * Подпись на экране короткая, а доступное имя — полное: на iPhone SE места нет, но
         * «Действие» без пояснения незрячему пользователю ничего не говорит.
         */}
        {inFight ? (
          <>
            <li aria-label={turn.actionAvailable ? "Действие доступно" : "Действие израсходовано"}>
              <SpendableResource available={turn.actionAvailable} tone="action" icon="✓">
                Действие
              </SpendableResource>
            </li>
            <li
              aria-label={
                turn.bonusActionAvailable
                  ? "Бонусное действие доступно"
                  : "Бонусное действие израсходовано"
              }
            >
              <SpendableResource available={turn.bonusActionAvailable} tone="bonus" icon="✓">
                Бонусное
              </SpendableResource>
            </li>
          </>
        ) : null}
    </ul>
  );
}
