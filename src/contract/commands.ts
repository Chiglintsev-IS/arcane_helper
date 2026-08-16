/**
 * Команды: всё, о чём отображение вправе попросить ядро.
 *
 * Схема проверяет форму, а не правила. «Здесь стоит число» — форма; «целое, и не больше остатка
 * ячеек» — правило, и оно остаётся у владельца инварианта, который ответит отказом с причиной.
 * Второй экземпляр предела здесь разошёлся бы с настоящим при первой же правке правил, и молча, —
 * а до тех пор отвечал бы игроку своими словами вместо тех, которыми правило написано.
 *
 * Игровые слова — имена характеристик, величин, категорий, монет, рун — приходят строками, а не
 * перечислениями: перечень был бы вторым списком тех же слов и разъехался бы с первым. Сузить
 * строку до слова правил берётся тот, кому список принадлежит.
 *
 * Команда несёт идентификаторы, а не объекты: карточку заклинания ядро возьмёт из каталога сессии
 * само. Приехавшая с клиента карточка была бы клиентом, диктующим правила. Исключение —
 * то, что игрок знает лучше приложения: выпавшее на кубике едет числом, потому что кубик кидает он.
 */

import { z } from "zod";

/** Игровое слово: договор ручается за непустую строку, за смысл ручается владелец правила. */
const word = z.string().min(1);

/**
 * Число. Именно число, а не «целое от и до»: целость, предел и применимость — правила, и держит их
 * владелец. Схема, повторившая предел, перехватила бы отказ у него и ответила бы игроку своими
 * словами вместо его — а разошлись бы они на первой же правке правил.
 */
const numeric = z.number();

function command<K extends string, S extends z.ZodRawShape>(kind: K, shape: S) {
  return z.object({ kind: z.literal(kind), ...shape });
}

/**
 * Чем платят за заклинание. Род оплаты придуман договором, поэтому перечислением.
 *
 * Тот же самый и в проекции способов, и в вопросе про набранное: способ, показанный игроку, — это
 * ровно то, чем он потом и заплатит, и второй формой сказать об этом значило бы переводить одно в
 * другое на полпути.
 */
export const paymentSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("slot"), slotLevel: numeric }),
  z.object({ kind: z.literal("spell_points") }),
  z.object({ kind: z.literal("none") }),
]);

export const commandSchema = z.discriminatedUnion("kind", [
  // Применение
  command("cast_spell", {
    spellId: word,
    mode: word,
    payment: paymentSchema,
    /** Кого назвали целью: слова игрока, попадающие в объявление мастеру. */
    targetLabel: word.optional(),
    rune: word.optional(),
    runeTarget: word.optional(),
    allowAnyway: z.boolean().optional(),
    replaceConcentration: z.boolean().optional(),
    /** Кубик кидает игрок: сколько костей потрачено и что на них выпало. */
    hitDice: z.object({ count: numeric, rolled: numeric }).optional(),
  }),

  // Ход и схватка
  command("start_combat", {}),
  command("begin_turn", {}),
  command("end_combat", {}),

  // Эффекты и концентрация
  command("end_concentration", { reason: word }),
  command("spend_rune_on_warding_sigil", {}),
  command("start_manual_effect", { nameRu: word, armorClassBonus: numeric.optional() }),
  command("set_armor_class_adjustment", { value: numeric }),
  command("end_effect", { effectId: word }),

  // Ресурсы
  command("adjust_runes", { delta: numeric }),
  command("adjust_last_hint", { delta: numeric }),
  command("spend_spell_slot", { slotLevel: numeric }),
  command("refund_spell_slot", { slotLevel: numeric }),

  // Жизнеспособность
  command("take_damage", { damage: numeric, fire: z.boolean().optional() }),
  command("heal", { amount: numeric }),
  command("grant_temporary_hit_points", { amount: numeric }),
  command("exchange_blood", { spellPoints: numeric, allowAnyway: z.boolean().optional() }),
  command("recover_hit_point_maximum", {}),
  command("set_sunlight", { underSunlight: z.boolean() }),

  // Отдых
  command("long_rest", {}),
  command("short_rest", {}),
  command("use_arcane_recovery", { plan: z.record(word, numeric) }),

  // Книга
  command("toggle_preparation", { spellId: word }),
  command("toggle_material", { spellId: word }),
  command("set_spell_note", { spellId: word, note: z.string() }),

  // Заметки про мир
  command("add_world_note", { text: word }),
  command("edit_world_note", { noteId: word, text: word }),
  command("remove_world_note", { noteId: word }),

  // Отыгрыш
  command("toggle_roleplay_favorite", { spellId: word, variantId: word }),
  command("toggle_roleplay_disabled", { spellId: word, variantId: word }),
  command("add_roleplay_variant", { spellId: word, category: word, text: word }),
  command("use_roleplay_variant", { spellId: word, variantId: word }),

  // Снаряжение
  command("add_item", { nameRu: word, itemKind: word }),
  command("edit_item", { item: z.looseObject({ id: word, nameRu: word }) }),
  command("remove_item", { itemId: word }),
  command("adjust_bag_count", { itemId: word, delta: numeric }),
  command("adjust_worn_count", { itemId: word, delta: numeric }),
  command("edit_money", { money: z.record(word, numeric) }),

  // Ремесло
  /**
   * Замысел состава едет целиком объектом: перечни справочника — правило, и сужает пришедшее слово
   * их владелец. Договор ручается лишь за то, что это объект и что порций названо число.
   */
  command("craft_batch", {
    formula: z.looseObject({}),
    portions: numeric,
    /** Кубик кидает игрок: что выпало на проверке разработки и что выпало на аварии. */
    rolled: numeric.optional(),
    mishapRolled: numeric.optional(),
    /** Отдельный риск рецепта: его называет мастер, и тогда проверки требует каждая партия. */
    risky: z.boolean().optional(),
  }),

  command("note_ingredient", { nameRu: word }),
  command("forget_ingredient", { nameRu: word }),
  /** Название и редкость раскрытого называет стол: справочник редкости не печатает. */
  command("reveal_property", {
    nameRu: word,
    number: numeric,
    propertyRu: word,
    rarity: word,
  }),

  /** Мастерская: чем алхимик оснащён по каждому направлению и каким из них обучен. */
  command("set_alchemy_workshop", {
    apparatus: z.record(word, word),
    studiedDirections: z.array(word),
  }),

  // Лист персонажа
  command("edit_identity", { patch: z.looseObject({}) }),
  command("edit_ability", {
    ability: word,
    score: numeric,
    saveProficient: z.boolean(),
    skills: z.record(word, word),
  }),
  command("edit_marks", { exhaustion: numeric, inspiration: z.boolean() }),
  command("edit_health", { maximumBase: numeric, masterReduction: numeric }),
  command("change_level", { level: numeric, hitPointMaximumBase: numeric }),

  // Сессия
  command("undo_last", {}),
  /** Присланное — текстом как есть: разбирает его ядро, оно же и откажет с причиной. */
  command("import_snapshot", { raw: z.string() }),
  command("restore_built_in_catalog", {}),
  command("reset", {}),
]);

export type Command = z.infer<typeof commandSchema>;

/** Одна команда по её виду: собирающему её незачем возвращать всё объединение. */
export type CommandOf<TKind extends Command["kind"]> = Extract<Command, { kind: TKind }>;

/**
 * Команда с идентификатором попытки.
 *
 * Идентификатор стоит рядом с командой, а не внутри неё, потому что описывает не намерение, а
 * попытку его доставить: одно и то же намерение, посланное дважды, несёт один идентификатор — по
 * нему ядро и узнаёт, что применять второй раз нечего. Выдаёт его отправитель при постановке
 * команды, а не при отправке: иначе каждая пересылка выглядела бы новым намерением.
 */
export const envelopeSchema = z.object({
  commandId: word,
  command: commandSchema,
});

export type Envelope = z.infer<typeof envelopeSchema>;
