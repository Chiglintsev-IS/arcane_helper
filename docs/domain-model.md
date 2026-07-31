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

  castingTime: {
    type: "action" | "bonus_action" | "reaction" | "minute" | "hour";
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

  shortRulesRu: string;          // собственный пересказ, 1–2 строки
  fullRulesRu: string;
  higherLevelsRu?: string;
  tacticalAdviceRu?: string;

  roleplay: {
    incantations: string[];
    gestures: string[];
    visualEffects: string[];
    completeVariants: {
      short: string[];
      atmospheric: string[];
      sarcastic: string[];
    };
  };

  announcementTemplate: string;
};
```

**Инварианты.**

- `level === 0` → `ritual === false`, `concentration` допустим, ячейка не расходуется.
- `castingTime.type === "reaction"` → `reactionTrigger` задан.
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
    | "manual_adjustment";

  summaryRu: string;                   // «Паутина, ячейка 2 уровня»

  // Снимок затронутых полей ДО изменения — основа отмены
  undoPatch: Partial<CharacterState>;

  spellId?: string;
  slotLevel?: number;
  targetLabel?: string;
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
