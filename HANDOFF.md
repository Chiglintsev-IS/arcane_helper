# План передачи: границы контекстов к нулю долга (2026-08-03, вторая редакция)

Исполняется по одной задаче за сессию. Перед любой задачей прочитай `CLAUDE.md`,
`docs/domains/README.md` и докстринг `scripts/check-layers.py`. Правила для всех задач:

- Мелкие коммиты по одной мысли; код и спека — одним коммитом; сообщения на английском и
  осмысленные. Сообщение «wip» запрещено. Четыре уже влитых «wip» не трогать: история после
  слияния не переписывается.
- Перед завершением полный прогон, всё зелёное:
  `npm run check:docs && npm run check:layers && npm run typecheck && npm run test:coverage && npm run build`
- Счётчик в выводе `check:layers` («известных долгов: N рёбер, M циклов») обязан только убывать.
  Ожидаемое значение названо в каждой задаче — если после правки оно другое, разберись до коммита.
- `--write-baseline` запрещён везде, кроме конца задачи 10: флаг молча легализует что угодно.
- Относительные импорты между контекстами запрещены — страж видит только пути `@/…`, и
  «починка» ребра относительным путём спрячет зависимость, не убрав её. Контроль:
  `grep -rn 'from "\.\./' src/core/domain` пуст.
- Имена в коде — только из `docs/glossary.md`. Механику не выдумывать.
- Если задача не даётся (прогон красный и починить не выходит) — откатить рабочие правки, ничего
  не вливать, записать причину сюда в раздел задачи и остановиться.

## Что уже влито в main

Все задачи прежней редакции плана; их недоделки стали задачами ниже и здесь не перечисляются.

- `cf65605` — ADR-0033: база КД из надетого доспеха, `miscBonuses` у персонажа, итог КД в `sheet`,
  миграция v3→v4, «Сумка» строго вещественная.
- `86a03ad` — ADR-0034: оболочка `src/ui/app/PlayShell.tsx` + шесть экранов
  `src/ui/screens/{game,book,sheet,bag,rest,journal}`; `PlayScreen.tsx` удалён, `SCREEN_PARTS`
  умер; `screenMode` ушёл из доменной схемы (экспорт v5), режим живёт в localStorage оболочки.
- `45e9260` — дефекты правильности: экономика хода только из журнала (экспорт v6), `castSpell`
  ходит через `checkAvailability`, отказ «Берётся после короткого отдыха» в сценарии отдыха,
  тариф очков переехал в `arcana`, `exchangeBlood` принимает очки; базлайн 17/18 → 15/9.
- `fe7fff6` — правила из UI: `ritualAvailable`/`isSpellReady` в core, `Equipment.idFromName`,
  единая таблица `CURRENCY_ABBREVIATIONS` в `core/shared/language.ts`, предпросмотр хитов через
  `Vitality`.
- `6bce488` — задача 1, пункт 1: шторки КД, хитов, ресурсов и концентрации принадлежат «Привалу»;
  урон на привале снова предлагает проверку концентрации; переход к полным правилам стал
  необязательным у листа концентрации, и на «Привале» его нет.
- `5bd255f` — задача 1, пункт 2: режим из localStorage сверяется со `SCREEN_MODES` с откатом в
  «Игру», обращение к хранилищу в `try/catch`, мёртвый `economy` в оболочке убран.
- `a377587` — задача 1, пункт 3: `screenMode` переехал из `core/shared` в `ui/shared/model`,
  докстринг и глоссарий говорят правду; `f037b1d` — прогон на недоступное хранилище.

Прогон целиком зелёный: 1495 тестов, typecheck, `check:docs --strict-link-remnants`,
`check:layers` (долг 15 рёбер / 9 циклов), сборка.

## Целевая картина

`scripts/layer-baseline.json` пустеет: ноль рёбер-долгов, ноль циклов. Фактические рёбра совпадают
с целевой картой `docs/domains/README.md`, она же `ALLOWED_CONTEXT_EDGES` в
`scripts/check-layers.py` — **их не править ни в одной задаче**, карта уже описывает финал:
листья `catalog`, `character`, `equipment`, `vitality`, `journal`; `spellbook/arcana/effects →
catalog`; `encounter → journal`; `sheet → character, equipment, effects, catalog`; сборка
`assembly` знает все контексты, её не импортирует ни один.

Весь долг — два узла: `character/state.ts` (общая схема держит подсхемы всех контекстов, все её
импортируют) и `character/character.ts` (корень знает пять агрегатов). Лечение: подсхема — в
каталог владельца, полная схема и корень — в `src/core/domain/assembly/`.

Механика стража, на которую опирается порядок задач:

- Запись базлайна, которой в коде больше нет, просто игнорируется — долг сокращается без
  перегенерации, прогон остаётся зелёным.
- Allowlist не освобождает от проверки **циклов**: законное ребро, замкнувшее кольцо, — ошибка.
  Поэтому сначала умирает `catalog → arcana` (задача 2), и только потом появляются законные
  `arcana → catalog`.
- `.test.`-файлы, `core/application`, `core/infrastructure` и `src/ui` рёбер не создают — правка
  путей импорта там бесплатна для счётчика.
- Type-only импорт между контекстами — тоже ребро (`import type { CharacterState }` считается).
- Сборка обязана быть **каталогом** `src/core/domain/assembly/`: плоский файл `assembly.ts` страж
  не опознаёт, и правило «контекст не импортирует сборку» на нём не сработает.

Общие подводные камни задач 4–10:

- Полную схему собирать **спредом plain-объектов полей** в один `z.object({...})`, а не
  `.extend()`/`.merge()`: обёртки `.default()`/`.refine()` дают не-`ZodObject`. `MUTABLE_STATE_KEYS`
  читает `characterStateSchema.shape` — сборка обязана остаться `ZodObject`, иначе журнал
  останется без ключей.
- Четыре `superRefine`-инварианта корня внутриконтекстные (три — spellbook, один — effects):
  контекст экспортирует функцию-доводчик, сборка вызывает её в своём `superRefine`. Покрытие
  `src/core/**` — жёсткие 100 %: доводчикам нужны тесты всех веток.
- `exactOptionalPropertyTypes` + `noUncheckedIndexedAccess`: необязательные поля
  (`concentration`, `hitDice`, `shortRestSinceLongRest`, `components`, `price`, `bonuses`,
  `armorBase`) при пересборке типов плывут между `T | undefined` и `?: T`;
  `Character.withEffects` снимает ключ `concentration` явной деструктуризацией — намеренно.
- Канарейка: `createThorne()` (`src/core/infrastructure/catalog/thorne/character.ts`) собирает
  Торна через `characterStateSchema.parse` и не перечисляет поля со значениями по умолчанию —
  потерянный `.default()` всплывёт именно там.
- `EXPORT_SCHEMA_VERSION` при переносе подсхем **не поднимать**: форма данных не меняется.
- На переходный период `character/state.ts` реэкспортирует перенесённое — потребители вне
  `core/domain` не трогаются до задачи 10; реэкспорт не создаёт второго определения.

## Задачи 2–10 — рёбра к нулю (строго по порядку)

### Задача 2 — единый владелец уровней заклинаний · долг после: 13 рёбер / 5 циклов

`CANTRIP_LEVEL` и `MAXIMUM_SPELL_LEVEL` объявлены дважды: `catalog/spell.ts` (строки 15–16) и
`arcana/slots.ts` (строки 11, 13). Владелец — каталог («что вообще бывает по правилам»).

1. `src/core/domain/catalog/scaling.ts` берёт `CANTRIP_LEVEL` из `./spell` вместо
   `@/core/domain/arcana/slots` — одна строка, умирают ребро `catalog → arcana` и три цикла
   (промежуточный прогон: 14/6).
2. `arcana/slots.ts` удаляет свои объявления и импортирует уровни из `@/core/domain/catalog/spell`
   (законное `arcana → catalog`; возможно только после п. 1). `MINIMUM_SPELL_LEVEL = 1` остаётся
   аркане — это про ячейки. `spellbook/spellbook.ts` берёт `CANTRIP_LEVEL` из каталога — умирает
   `spellbook → arcana`.
3. Потребителей, тянущих из `arcana/slots` только уровни заклинаний, перевести на
   `catalog/spell` (грепом по `from "@/core/domain/arcana/slots"`; функции ячеек остаются откуда
   были).

### Задача 3 — общее ядро: уровни персонажа и примитивы схем · долг не меняется: 13 / 5

Подготовка: рёбра в `core/domain/shared` не считаются никогда.

1. Новый `src/core/domain/shared/levels.ts`: `MINIMUM_CHARACTER_LEVEL`,
   `MAXIMUM_CHARACTER_LEVEL`. Сейчас предел объявлён дважды — `character/abilities.ts:14` и
   `catalog/spell.ts:17`; оба переходят на shared, дубль умирает. Туда же переводятся
   `arcana/slots.ts:8`, `vitality/blood.ts:10`, `character/migration.ts`.
2. Новый `src/core/domain/shared/schema.ts`: `nonEmpty`, `isoDateTime` и `itemBonusesSchema` +
   тип `ItemBonuses` из `character/state.ts`. Форма прибавок общая для вещи (`equipment`) и
   `miscBonuses` персонажа (`character`) — оба листья, друг друга не знают, поэтому владелец —
   shared, класть её в equipment нельзя.

### Задача 4 — `vitality/schema.ts` · долг после: 11 / 4

Vitality — самый несцепленный контекст, переносится первым.

1. Новый `src/core/domain/vitality/schema.ts`: подсхемы `hitPoints`, `temporaryHitPoints`,
   `hitDice`, `suppression` из `character/state.ts` (вместе с их `.refine`). `character/state.ts`
   импортирует их отсюда (ребро `character → vitality` уже в базлайне — зелено).
2. `vitality/vitality.ts`: `VitalityState` перестаёт быть `Pick<CharacterState, …>` — собственный
   тип из своей схемы; импорт `character/state` умирает.
3. `vitality/hitDice.ts`: импорт типа `HitDiceCost` из каталога заменить структурным локальным
   типом (та же форма полей) — `vitality` по карте лист, ребра `vitality → catalog` в ней нет.
   Вызывающие вне домена продолжают передавать `spell.hitDiceCost` — TypeScript структурный,
   рантайм не меняется.

### Задача 5 — `spellbook/schema.ts` · долг после: 10 / 3

1. Новый `src/core/domain/spellbook/schema.ts`: поля `cantripIds`, `spellbookSpellIds`,
   `preparedSpellIds`, `spellNotes`, `roleplayPreferences` + `roleplayPreferenceSchema`.
2. Доводчик `refineSpellbook(value, context)` — три инварианта из `superRefine` корня
   (`state.ts:388–423`): без дублей id, заговоры не пересекаются с книгой, подготовленное —
   подмножество книги. `state.ts` вызывает его в своём `superRefine`. Тесты на все ветки.
3. `spellbook/spellbook.ts`: `SpellbookState` — собственный тип, импорт `character/state` умирает.

### Задача 6 — `equipment/schema.ts` · долг после: 9 / 2

1. Новый `src/core/domain/equipment/schema.ts`: `ITEM_KINDS`, `CURRENCIES`,
   `MAXIMUM_ITEM_COUNT`, `MAXIMUM_COIN_AMOUNT`, `coinAmount`, `moneySchema`, `NO_MONEY`,
   `priceSchema`, `inventoryItemSchema`, объект `equipment` (с его `.default`). `ItemBonuses`
   уже в shared (задача 3).
2. Тип данных назвать `EquipmentData` — имя `Equipment` занято классом агрегата (он уже
   импортирует «`Equipment as EquipmentData`», переименование это закрепляет).
3. `equipment/equipment.ts` переходит на свою схему; импорт `character/state` умирает.

### Задача 7 — `arcana/schema.ts` · долг после: 8 / 1

1. Новый `src/core/domain/arcana/schema.ts`: `slotSchema`, `spellSlotsSchema`, `arcaneRecovery`,
   `runes`, `spellPoints` и `shortRestSinceLongRest`. Последний сегодня ничей; владелец —
   arcana: поле существует только как предусловие магического восстановления. Строку в таблицу
   «Кто чем владеет» `docs/domains/README.md` — тем же коммитом.
2. `MAXIMUM_SPELL_LEVEL` — из каталога (законно после задачи 2).
3. `arcana/arcana.ts`: `ArcanaState` — собственный тип; импорт `character/state` умирает.

### Задача 8 — `effects/schema.ts` · долг после: 6 / 0

1. Новый `src/core/domain/effects/schema.ts`: `activeEffectSchema`, подсхема `concentration`.
   Импорт `armorClassEffectSchema`/`MAXIMUM_SPELL_LEVEL` из каталога — законное
   `effects → catalog`, обратного ребра нет, цикла не будет.
2. Доводчик `refineEffects(value, context)` — инварианты «концентрация требует своего активного
   эффекта» и «не более одного концентрационного» из `state.ts:426–447`; сборка вызывает.
3. `effects/effectBoard.ts` и `effects/concentration.ts` — собственные типы, импорт
   `character/state` умирает. `sheet/armorClass.ts` берёт `ActiveEffect` из `effects/schema`
   (законное `sheet → effects`).
4. После этого `character/state.ts` больше не импортирует каталог — вместе с
   `effects → character` умирает и `character → catalog`, циклов ноль.

### Задача 9 — журнал перестаёт знать состояние · долг после: 5 / 0

1. `journal/entry.ts` и `journal/journal.ts`: `JournalEntry<TState = Record<string, unknown>>`
   с `undoPatch: Partial<TState>`; `Journal` получает список изменяемых ключей **аргументом**
   (`Journal.of(entries, mutableKeys)` или эквивалент), а не импортом `MUTABLE_STATE_KEYS`.
2. Параметр по умолчанию сохраняет `encounter/encounter.ts` без правок (законное
   `encounter → journal`). Инстанцирует `core/application/session.ts` — рёбер не создаёт.
3. Хранилище готово: `sessionRepository.ts` уже держит `undoPatch` как
   `z.record(z.string(), z.unknown())`, миграция формата не нужна.

### Задача 10 — сборка `assembly` и узкий `withSheet` · долг после: **0 / 0**

Самая большая; всё остальное к ней уже подготовлено.

1. Каталог `src/core/domain/assembly/` (именно каталог). Переезжают из `character/`:
   полная схема (`characterStateSchema` — спред shape-объектов контекстов + вызовы доводчиков),
   `exportFileSchema`, `EXPORT_SCHEMA_VERSION`, `UNRECORDED_KEYS`/`MUTABLE_STATE_KEYS`, тип
   `CharacterState`, корень `Character` (`character.ts`), `migration.ts` вместе с
   `migration.test.ts`.
2. `character/schema.ts` — только своё: `id`, `name`, `className`, `level`, `species`,
   `subclass`, `age`, `size`, `speed`, `abilities`, `saveProficiencies`, `skills`,
   `proficiencies`, `overrides`, `miscBonuses`, `roleplayProfile`, `exhaustion`, `inspiration`
   (+ `CREATURE_SIZES`, `abilitiesSchema`, `overridesSchema`, `roleplayProfileSchema`).
   Решения по ничьим полям: `exhaustion`/`inspiration` — character («отметки», правятся с
   «Листа»); `overrides` хранит character, считает sheet — ребро `character → sheet` не
   заводить. Обе строки — в таблицу владения README тем же коммитом.
3. `sheet/*` перестаёт знать `CharacterState`: входные типы — поля character + `EquipmentData` +
   `ActiveEffect[]` (структурные, `Sheet.of(fullState)` из сборки продолжает компилироваться).
4. `withSheet` сузить: `Partial<Pick<CharacterState, …>>` по явному списку из шестнадцати
   листовых полей — `name, species, subclass, className, age, size, speed, proficiencies,
   abilities, saveProficiencies, skills, overrides, miscBonuses, exhaustion, inspiration, level`.
   Проверка: `useCases/sheet.ts` компилируется без правок; `withSheet({ spellSlots })` — ошибка
   типов.
5. Реэкспорты из `character/state.ts` умирают; пути в `core/application/**`,
   `core/infrastructure/**`, `src/ui/**` (~45 файлов) переводятся на `assembly` или на схему
   владельца — рёбер это не создаёт. `state.test.ts` распадается по владельцам
   (`assembly/*.test.ts`, `character/schema.test.ts`, …).
6. Финал: `python3 scripts/check-layers.py --write-baseline` — единственный раз; прочитать дифф
   `scripts/layer-baseline.json` глазами (обе секции пустые), закоммитить. Документы тем же
   коммитом: `docs/domains/README.md` (абзац про долг в базлайне больше не нужен, «Циклов нет»
   становится правдой), `docs/glossary.md` (сборка, имена новых модулей).

## Задача 11 — правила сотворения и тарифы: добить (после задачи 10 — общие файлы)

Хвосты задачи 3 прежней редакции; по коммиту на пункт. Правит `core/application/useCases`,
`core/application/casting`, `core/domain/{arcana,vitality}`, виджеты крови и мастера.

- Формула «очки × тариф» живёт в четырёх местах (`useCases/health.ts`,
  `casting/announcement.ts` дважды, `BloodMagicWizard.tsx`), владеющей функции нет — использовать
  `hitPointCost` из arcana везде; туда же потолок обмена и `affordableLevels` из
  `BloodMagicWizard.tsx`.
- `CampActions.tsx` дублирует предикат и дословный текст «Берётся после короткого отдыха» из
  `useCases/rest.ts`: правило — в агрегат arcana (сценарий сейчас читает сырое поле мимо
  агрегата), core отдаёт причину отказа, UI только рисует.
- `overridable` у предикатов не исполняется: `useCases/casting.ts` держит ручной белый список
  кодов, и `allowAnyway` снимает даже `overridable: false` (`concentration_busy`). Исполнять
  запрет по объявлению предиката; в `CastWizard.tsx` один флаг совмещает два разных согласия
  (замена концентрации и перерасход ячейки) — развести.
- Дубль правила уровня ячейки: `applyPayment` в `useCases/casting.ts` против предиката
  `slot_too_low` в `availability.ts` — тексты уже разошлись; оставить предикат.
- Мёртвый код vitality: `exchangeHitPoints`, `Exchange.remainderIgnored`,
  `applyExchangeToHitPoints`, `regenerationApplies`, `sunSaveDc` — убрать или вернуть в живой
  путь (они покрыты только собственными тестами).
- Миграция v5→v6: тест «сохранение с `turnTracking`/`reactionAvailable` читается, поля
  отброшены»; мёртвые поля из фикстур `state.test.ts`/`migration.test.ts` убрать;
  `docs/data-exchange.md` — приведения версий описаны только для v1/v2, дописать 3→6.

## Задача 12 — типизированный протокол и тесты за экранами (добить ADR-0034; независима от 2–11)

Правит только `src/ui/screens/**` и `src/ui/widgets/**` — можно параллельно с задачами 2–9 в
worktree.

- Строковый протокол жив: `SheetScreen.tsx` (`useState<string | null>`, `ability:${…}` и семь
  строк-литералов), `BagScreen.tsx` (`item:${id}`), источник строк —
  `widgets/character-sheet/model/rows.ts` (`editId: string`) и `CharacterSheetScreen.tsx`
  (`onEdit: (blockId: string)`). Заменить типизированным union внутри экрана; в `GameScreen.tsx`
  девять булевых флагов шторок — union по желанию (они локальны, через слои не текут).
- `src/ui/screens/play/` — слайс-призрак: `PlayScreen.test.tsx` (1670 строк) и
  `Concentration.test.tsx` тестируют `PlayShell` под псевдонимом
  (`import { PlayShell as PlayScreen }`). Разнести проверки по своим экранам и `ui/app`,
  каталог удалить. Строки «Проверка» FR, называющие эти тесты, — тем же коммитом.
- `widgets/{bag,journal,camp,character-sheet}/ui/*Screen.tsx` называются экранами, будучи
  виджетами: переименовать по глоссарию либо втянуть в свой экран, если обёртка тривиальна.

## Задача 13 — протечки правил из UI, вторая волна (после задачи 11)

Правило: UI ничего не вычисляет по правилам игры. Найденные вычисления, по коммиту на связку
(файл → что считает → куда переносить):

- `BloodMagicWizard.tsx` — `exchangeWarnings` (доступность обмена) → рядом с `checkAvailability`.
- `SpellCardDetails.tsx` — сам выбирает `CastMode` и оплату мимо `bestCastPlan`/`castOptions`
  (в бою покажет ритуал, которого core не предложит) → звать core.
- `CastWizard.tsx` — диапазон результата костей (дважды) → `vitality/hitDice.ts`;
  `runeUnavailable` → `arcana/runes.ts`.
- `castDraftStore.ts` + `MaterialsList.tsx` — предикат «дорогой/расходуемый компонент», две копии
  при третьей в `availability.ts` → `catalog/spell.ts`.
- `SpellCardCompact.tsx`, `entities/spell/lib/format.ts` — подготовленность через
  `preparedSpellIds.includes` → `isSpellReady`; там же `slotCostLabel` («есть ли смысл повышать»)
  → `catalog/scaling.ts`.
- `BookScreen.tsx` — «лимит подготовки достигнут» → `Spellbook` (он уже владеет запретом).
- `MarksSheet.tsx` — лестница истощения 0…6; `AbilitySheet.tsx` — границы характеристики 1…30 →
  константы владельцев в core.
- `checkGuidance.ts` — вердикты по границам d20 → `effects/concentration.ts`.
- `ArcaneRecoverySheet.tsx` — отбор ячеек, которые восстановление вправе вернуть →
  `arcana/slots.ts`.
- `ResourceHeader.tsx` — `bloodReduction + masterReduction` → геттер `Vitality`.
- `spellList.ts` — `belongsToPlayList` (неподготовленный ритуал уходит из боевого списка) и
  `castableWithinTurn` (дубль `turnResourceFor` из `availability.ts`); `actionTraits.ts` —
  `priceOf` (цена ритуала вне боя = 0) → core.
- `LevelSheet.tsx` — среднее за кость хитов зашито числом и текстом «d6», `changeLines`
  пересказывает переход по уровню → доменная функция предпросмотра рядом с `changeLevel`.
- `availability.ts` — литерал «зм» дважды мимо `CURRENCY_ABBREVIATIONS`.

## Задача 14 — хвосты документации (параллельна задачам 2–9: код не пересекается)

- Битые строки «Проверка» — тестов с такими именами нет: `screens.md:161,219` и
  `effects.md:127` (`combat-screen renders…` → `play-screen renders all resource blocks`);
  `screens.md:255` — оборванное «, E2E» → `undo returns the slot through the journal screen`;
  `screens.md:409,578` — имена unit-тестов списка; `character.md:115` — единственное число;
  `encounter.md:80` — мёртвый `spendAction`; `encounter.md:98` — FR-143 «Проверено» ссылается на
  тест, умерший с кэш-флагами; `vitality.md:122` — имя теста крови.
- Семь e2e-прогонов не названы ни одним FR (`key mechanics fit iPhone SE…`, `camp mode reaches
  rest and recovery`, `blood exchange goes through the wizard…` и другие) — вписать в «Проверки»
  своих требований.
- `data-exchange.md` (FR-233): описаны приведения только v1/v2 — дописать v3→v6 (включая «режим
  экрана игнорируется при чтении», «кэш-флаги хода игнорируются»); исправить «прибавки …
  переезжают в снаряжение» — после ADR-0033 прочие прибавки у персонажа.
- `glossary.md`: `reactionAvailable` — теперь производное проекции, не хранимое; добавить
  `shortRestSinceLongRest`, `CURRENCY_ABBREVIATIONS`, `Equipment.idFromName`.
- `domains/README.md:51` «Циклов нет» — неправда до конца задачи 10: переформулировать «в целевой
  карте циклов нет; фактические записаны долгом в базлайне и разбираются планом передачи».
- `ux.md:68` «приложение живёт одним экраном» → одна страница без маршрутов, оболочка и шесть
  экранов. `use-cases.md:48` — кнопка «Реакции» не в шапке, а в ряду кнопок «Игры»;
  `use-cases.md:109` — шаг «открывает режим „Привал“». `scenarios.md:176` (FR-060) — убрать
  «главный экран» и «в шапке». `screens.md:43,159` — «Главный экран» переименовать в оболочку и
  «Игру». `architecture.md:64` — режим не «сохраняемое значение»; `:69` — назвать оболочку в
  описании `ui/app`.
- `roadmap.md`: дата и подзаголовок устарели; «Следующий шаг» усечь до «хвосты → разбор общей
  схемы → игровая сессия» и сослаться на `HANDOFF.md`; строки «Интерфейс» и «Прогоны» не знают
  про оболочку, шесть экранов, привал и обмен кровью.
- Решить и записать: ослабление `armorClassEffectSchema.value` (потерян запрет нуля и
  отрицательных у контента — вернуть строгость или записать требованием); поле
  `activeEffect.type` не участвует ни в одном правиле и не имеет требования; отложенное «расход
  вещи из „Игры“» — записать в `open-questions.md` или FR со статусом «Отложено»; подпись кнопки
  часа при единственной регенерации без уточнения; завести `docs/domains/sheet.md` по шаблону
  README — контекст есть в карте и коде, документа нет.
- `scenarios.md:133` FR-041 «В работе» — статус честный, **не трогать**.

## Задача 15 — уборка (последняя)

Все ветки `worktree-agent-*` влиты в main (`git branch --merged main`). В worktree-каталогах
`.claude/worktrees/` живут пять untracked-отчётов агентов (`temporary-ac-report.md`,
`partial-recovery-report.md`, `manual-effect-report.md`, `inventory-report.md`,
`hour-rules-report.md`) — их живые находки уже разнесены по задачам 11 и 14, файлы удаляются
вместе с worktree. В `agent-a0702bc…` — незакоммиченные правки, дублирующие влитую задачу:
сверить diff с main перед удалением; в `agent-a983ffc…` — только `package-lock.json`.
`git worktree remove` каждому, затем `git branch -d`.

## Порядок

2 → 3 → … → 10 → 11 → 13 → 15. Задача 12 независима (только UI-слой) — параллельно задачам
2–9 в worktree; задача 14 независима (только docs) — параллельно им же. Задачи 11 и 13 — строго
после 10: задача 10 переписывает пути импортов в тех же файлах use cases и UI. Внутри 2–10
порядок обязателен: задача 2 снимает цикл, блокирующий законные рёбра к каталогу, задача 3 даёт
shared-модули задачам 4–8, задача 10 собирает всё.
