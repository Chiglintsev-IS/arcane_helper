# Модель данных

> Обновлено: 2026-07-31 · Статус: согласовано · Источник: ТЗ §10–12, расширено спецификацией

Структуры данных приложения и их инварианты. Типы здесь — контракт: Zod-схемы в коде выводятся из этих
описаний и служат единственным источником и типов TypeScript, и валидации импорта
([ADR-0004](decisions.md#adr-0004)).

## Заклинание

Неизменяемые данные. Заговоры описываются той же структурой с `level: 0`.

```ts
type Spell = {
  id: string;

  nameRu: string;
  nameEn: string;

  level: number;                 // 0 для заговора, иначе 1..9
  school: string;
  source?: string;

  // Зачем заклинание нужно в бою — F-18, FR-213. Из остальных полей не выводится:
  // «Поглощение стихий» несёт урон и при этом чисто защитное.
  // Необязательное в схеме, обязательное для собственного контента: импорт из сборки без
  // этого поля обязан читаться (FR-120, NFR-003). Отсутствие означает «роль неизвестна»
  // и трактуется как "other" — предполагать «боевое» приложение не вправе.
  combatRole?: "offense" | "defense" | "other";

  castingTime: {
    type: "action" | "bonus_action" | "reaction" | "minute" | "hour";
    value?: number;              // обязателен при type "minute" и "hour": 1 минута ≠ 10 минут
    reactionTrigger?: string;    // обязателен при type === "reaction"
  };

  range: {
    type: "self" | "touch" | "distance" | "special";
    distanceFeet?: number;       // обязателен при type === "distance"
  };

  area?: {
    shape: "cone" | "cube" | "line" | "sphere" | "cylinder";
    sizeFeet: number;
  };

  components: {
    verbal: boolean;
    somatic: boolean;
    material: boolean;
    materialText?: string;       // обязателен при material === true
    costGp?: number;             // стоимость: фокусировка не заменяет компонент
    consumed?: boolean;          // расходуется при применении
  };

  duration: {
    type: "instant" | "rounds" | "minutes" | "hours" | "special";
    value?: number;
  };

  concentration: boolean;
  ritual: boolean;

  targeting: {
    // "object" добавлен при внесении первой партии контента: «Починка» и «Опознание»
    // целятся в предмет, а не в существо или точку.
    type: "self" | "creature" | "creatures" | "object" | "point" | "area";
    maximumTargets?: number;
  };

  resolution: {
    type: "spell_attack" | "saving_throw" | "automatic";
    savingThrow?: "STR" | "DEX" | "CON" | "INT" | "WIS" | "CHA";
    successEffect?: string;
    failureEffect?: string;
  };

  damage?: {
    dice: string;                        // "3d4+3"
    type: string;                        // "сила", "холод", "электричество"
    scaling?: Record<number, string>;    // уровень ячейки → формула
  };

  // Вклад в Класс Доспеха — см. F-08, ADR-0013. Отсутствует у заклинаний, не влияющих на КД.
  armorClassEffect?: {
    kind: "base_override" | "bonus";     // замена базы или прибавка к итогу
    value: number;                       // 13 у «Доспехов мага», 5 у «Щита»
  };

  shortRulesRu: string;          // собственный пересказ, 1–2 строки
  fullRulesRu: string;
  higherLevelsRu?: string;
  tacticalAdviceRu?: string;

  roleplay: {
    incantation: string;
    gesture: string;
    visualEffect: string;
    completeVariants: {
      short: string[];
      atmospheric: string[];
      sarcastic: string[];
    };
  };

  /** Схема ритуала: только у ritual: true (FR-190). */
  ritualDiagram?: RitualDiagram;

  announcementTemplate: string;
};
```

**Инварианты.**

- `level === 0` → `ritual === false`, `concentration` допустим, ячейка не расходуется.
- `castingTime.type === "reaction"` → `reactionTrigger` задан.
- `castingTime.type ∈ {"minute", "hour"}` → `value` задан; для действия, бонусного действия и реакции
  `value` отсутствует — число там не имеет смысла.
- `resolution.type === "saving_throw"` → `savingThrow` задан.
- `components.material === true` → `materialText` задан.
- `roleplay` заполнен по минимуму [FR-050](features/F-04-roleplay.md#fr-050): ≥1 реплика, ≥1 жест,
  ≥1 визуальный эффект, ≥3 варианта суммарно по категориям.
- `announcementTemplate` не содержит текста из `roleplay` ([FR-042](features/F-03-cast-wizard.md#fr-042)).
- Ключи `damage.scaling` — уровни не ниже `level`.

## Состояние персонажа

Изменяемые данные. Всё, что меняется в бою.

```ts
type CharacterState = {
  id: string;
  name: string;
  className: string;
  level: number;

  intelligence: number;
  spellSaveDc: number;                 // производное, см. rules-engine
  spellAttackModifier: number;         // производное
  constitutionSaveModifier: number;    // задаётся вручную, см. OQ-05

  cantripIds: string[];
  spellbookSpellIds: string[];
  preparedSpellIds: string[];

  spellSlots: Record<number, {
    maximum: number;
    remaining: number;
  }>;

  reactionAvailable: boolean;

  concentration?: {
    spellId: string;
    startedAt: string;                 // ISO 8601
  };

  activeEffects: ActiveEffect[];

  roleplayProfile: RoleplayProfile;

  // Добавлено спецификацией — см. F-06
  turnTracking: {
    enabled: boolean;
    actionAvailable: boolean;
    bonusActionAvailable: boolean;
  };

  arcaneRecoveryAvailable: boolean;

  // Хиты — см. F-15. Нужны потому, что кровавое колдовство покупает магию здоровьем.
  hitPoints: {
    current: number;
    maximum: number;          // уже с учётом снижения
    maximumReduction: number; // сколько срезано кровавым колдовством
  };

  // Класс Доспеха — см. OQ-02. Слагаемые хранятся раздельно, потому что «Доспехи мага»
  // заменяют базу, а не прибавляют к итогу.
  armorClass: {
    base: number;              // 10 без доспехов
    dexterityModifier: number;
    itemBonus: number;
  };

  // Руны подкласса — см. F-13.
  runes: {
    maximum: number;
    remaining: number;
  };

  // Очки заклинаний от кровавого колдовства — см. F-15.
  // Держатся до долгого отдыха; время создания показывается как справка, отсчёта нет.
  spellPoints: {
    remaining: number;
    createdAt: string | null;  // ISO 8601
  };

  // Подавление расовых особенностей — см. F-16.
  suppression: {
    firedUpon: boolean;
    underDirectSunlight: boolean;
  };

  // Пользовательские дополнения — см. F-02, F-04
  spellNotes: Record<string, string>;                  // spellId → заметка
  roleplayPreferences: Record<string, {                // spellId → предпочтения
    favoriteVariantIds: string[];
    disabledVariantIds: string[];
    customVariants: Array<{
      id: string;
      category: "short" | "atmospheric" | "sarcastic";
      text: string;
    }>;
    usageCount: Record<string, number>;                // для детерминированной ротации
  }>;
};
```

**Инварианты.**

- `0 ≤ remaining ≤ maximum` для каждого уровня, кроме явного превышения через «Применить всё равно»,
  которое отображается как долг и требует видимой пометки.
- `concentration` — не более одной записи ([FR-080](features/F-07-concentration.md#fr-080)). Структура
  делает второе одновременное значение невыразимым.
- `concentration` задана → в `activeEffects` есть эффект с `isConcentration: true` и тем же `spellId`.
- `preparedSpellIds.length ≤ preparedLimit`, где лимит вычисляется движком.
- `preparedSpellIds ⊆ spellbookSpellIds`; `cantripIds` не пересекается с `spellbookSpellIds`.
- Заговоры не входят в `preparedSpellIds`.
- `0 ≤ runes.remaining ≤ runes.maximum`.
- `hitPoints.current ≤ hitPoints.maximum`; `maximumReduction ≥ 0`.
- `spellPoints.remaining > 0 → createdAt` задан: время создания показывается игроку как справка.
- `armorClass` хранит слагаемые, а не итог: итог вычисляется движком с учётом активных эффектов
  ([FR-093](features/F-08-active-effects.md#fr-093)), иначе одно и то же число пришлось бы поддерживать
  в двух местах.

## Активный эффект

```ts
type ActiveEffect = {
  id: string;
  spellId: string;
  nameRu: string;

  type: "buff" | "control" | "utility" | "summon";
  startedAt: string;                   // ISO 8601

  duration: {
    type: "rounds" | "minutes" | "hours" | "special";
    value?: number;
  };

  isConcentration: boolean;
  slotLevelUsed: number;               // 0 для заговора

  repeatableAction?: {
    label: string;                     // «Спасбросок Ловкости для входящих в область»
    description: string;
  };

  // Копия armorClassEffect заклинания — см. ADR-0013. Нужна затем, чтобы итоговый КД считался
  // из одного состояния персонажа, без обращения к каталогу заклинаний.
  armorClass?: {
    kind: "base_override" | "bonus";
    value: number;
  };

  endConditionRu: string;              // текстом, формализация вне MVP
  note?: string;
};
```

Длительность в MVP не отсчитывается автоматически: `startedAt` и `duration` показываются
пользователю, но таймера нет — см. [F-08](features/F-08-active-effects.md).

## Профиль отыгрыша

```ts
type RoleplayProfile = {
  tone: Array<"serious" | "mysterious" | "sarcastic" | "wild">;

  magicThemes: string[];
  speechStyle: string;
  gestureStyle: string;

  preferredElements: string[];
  prohibitedThemes: string[];

  maximumPhraseLength: number;         // в словах
};
```

Конфигурация Торна:

```json
{
  "tone": ["sarcastic", "mysterious"],
  "magicThemes": ["руны", "молнии", "холод", "алхимические символы"],
  "speechStyle": "Короткие формулы и язвительные замечания",
  "gestureStyle": "Рисует знаки пальцами, посохом или мелом",
  "preferredElements": ["электричество", "холод", "сила"],
  "prohibitedThemes": ["огонь"],
  "maximumPhraseLength": 15
}
```

Профиль используется скриптом проверки контента ([FR-052](features/F-04-roleplay.md#fr-052)):
`prohibitedThemes` — стоп-слова, `maximumPhraseLength` — ограничение длины реплик.

## Запись журнала

Добавлено спецификацией — см. [F-10](features/F-10-journal-undo.md) и
[ADR-0006](decisions.md#adr-0006).

```ts
type JournalEntry = {
  id: string;
  at: string;                          // ISO 8601

  kind:
    | "spell_cast"
    | "reaction_cast"
    | "slot_spent"
    | "slot_refunded"
    | "concentration_started"
    | "concentration_ended"
    | "effect_created"
    | "effect_ended"
    | "long_rest"
    | "short_rest"
    | "arcane_recovery"
    | "turn_started"
    | "manual_adjustment"
    // Добавлено вместе с F-13 и F-15: у этих ресурсов свои события,
    // иначе отмена не отличит трату руны от трат ячейки.
    | "blood_exchange"
    | "rune_spent"
    | "hit_points_changed"
    | "suppression_changed";

  summaryRu: string;                   // «Паутина, ячейка 2 уровня»

  // Снимок затронутых полей ДО изменения — основа отмены
  undoPatch: Partial<CharacterState>;

  spellId?: string;
  slotLevel?: number;
  targetLabel?: string;

  // Что именно потрачено внутри хода. Без этого поля доступность действия и реакции
  // невозможно вывести из журнала (ADR-0008).
  actionUsed?: "action" | "bonus_action" | "reaction";
};
```

**Инварианты.**

- Одно пользовательское действие — одна запись, даже если изменилось несколько полей.
- `undoPatch` содержит достаточно данных для точного восстановления: применение `undoPatch` к текущему
  состоянию даёт состояние до события.
- Журнал ограничен по длине ([FR-112](features/F-10-journal-undo.md#fr-112),
  [OQ-08](open-questions.md#oq-08)).

## Черновик применения

Добавлено спецификацией. Живёт отдельно от `CharacterState`, чем и обеспечивается инвариант
[FR-022](features/F-03-cast-wizard.md#fr-022): пока применение не подтверждено, состояние персонажа
физически не затронуто.

```ts
type CastDraft = {
  spellId: string;
  mode: "normal" | "ritual" | "upcast";
  slotLevel: number;
  targetLabel?: string;
  selectedVariantId?: string;
  acknowledgedWarnings: string[];      // какие предупреждения пользователь принял
  step: number;
};
```

## Файл экспорта

```ts
type ExportFile = {
  schemaVersion: number;               // отклонять неизвестные версии
  exportedAt: string;
  character: CharacterState;
  spells: Spell[];
  journal?: JournalEntry[];
};
```

Проверка при импорте — [FR-121](features/F-11-data-io.md#fr-121).

## Сохранённая сессия

То, что лежит в браузере между запусками. Читается и пишется целиком одной записью
([ADR-0009](decisions.md#adr-0009), [ADR-0019](decisions.md#adr-0019)).

```ts
type PersistedSession = {
  schemaVersion: number;               // отклонять записи новее приложения
  savedAt: string;                     // ISO 8601
  character: CharacterState;
  journal: JournalEntry[];

  // Каталог заклинаний, загруженный игроком — FR-123. Отсутствует, пока играют встроенным:
  // копия встроенных карточек заморозила бы книгу на дате установки, и заклинание из
  // следующей сборки не появилось бы никогда.
  spellCatalog?: Spell[];
};
```

**Инварианты.**

- `spellCatalog` задан → каждый идентификатор из `cantripIds`, `spellbookSpellIds` и
  `preparedSpellIds` встречается в нём ([FR-123](features/F-11-data-io.md#fr-123)). Пока каталог был
  константой сборки, рассогласование могло прийти только из файла импорта; теперь оно может лежать в
  хранилище, и чтение обязано его обнаружить.
- `spellCatalog` отсутствует → действует встроенный каталог. Это состояние по умолчанию, а не
  признак незаполненности.
- Персонаж и каталог заменяются вместе: половины импорта не существует
  ([FR-122](features/F-11-data-io.md#fr-122)).
