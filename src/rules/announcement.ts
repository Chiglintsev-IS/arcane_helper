/**
 * Объявление мастеру (FR-040, FR-041).
 *
 * Шаблон хранится в карточке заклинания, подстановки берутся из состояния персонажа и выбора в
 * мастере применения. Художественного текста здесь нет и быть не может: словарь подстановок закрыт
 * (FR-042, ADR-0005), а сама функция ничего не сочиняет.
 *
 * Чего приложение не заполняет, оно не выдумывает: неизвестная подстановка превращается в «?» и
 * попадает в `gaps` с причиной. Показать неверное число хуже, чем не показать никакого (OQ-11).
 */

import type { CharacterState } from "@/data/schemas/character";
import type { Spell } from "@/data/schemas/spell";
import { ANNOUNCEMENT_PLACEHOLDERS } from "@/data/schemas/spell";
import { armorClassWithSpell } from "./armorClass";
import { componentRequirements, type PaymentChoice } from "./availability";
import { withPlural } from "./language";
import { hitPointCost, spellPointCost } from "./bloodMagic";
import { MINIMUM_CONCENTRATION_DC } from "./concentration";
import { effectiveDamage } from "./scaling";
import type { CastMode } from "./slots";

export type AnnouncementPlaceholder = (typeof ANNOUNCEMENT_PLACEHOLDERS)[number];

/** Незаполненная подстановка либо замечание о режиме применения. Причина — словами. */
export type AnnouncementGap = {
  placeholder?: AnnouncementPlaceholder;
  reasonRu: string;
};

export type Announcement = {
  /** Готовая к произнесению вслух формулировка. */
  text: string;
  gaps: AnnouncementGap[];
};

export type AnnouncementContext = {
  character: CharacterState;
  mode: CastMode;
  payment: PaymentChoice;
  /** Цель свободным текстом: модели противников в MVP нет (OQ-10). */
  targetLabel?: string;
};

/** Знак обязателен: игрок называет «плюс восемь», а не «восемь». */
function signed(value: number): string {
  return value < 0 ? `${value}` : `+${value}`;
}

/** Уровень, на котором сотворяется заклинание: выбранная ячейка или собственный уровень. */
function castLevel(spell: Spell, payment: PaymentChoice): number {
  return payment.kind === "slot" ? payment.slotLevel : spell.level;
}

type Resolved = { value: string; gap?: AnnouncementGap };

const UNKNOWN = "?";

function resolve(
  placeholder: AnnouncementPlaceholder,
  spell: Spell,
  context: AnnouncementContext,
): Resolved {
  const { character } = context;

  switch (placeholder) {
    case "slotLevel":
      return { value: `${castLevel(spell, context.payment)}` };

    case "spellSaveDc":
      return { value: `${character.spellSaveDc}` };

    case "spellAttackModifier":
      return { value: signed(character.spellAttackModifier) };

    case "damage":
      if (spell.damage === undefined) {
        return {
          value: UNKNOWN,
          gap: { placeholder, reasonRu: "У заклинания нет формулы урона" },
        };
      }
      return {
        value: effectiveDamage(spell.damage, {
          spellLevel: spell.level,
          slotLevel: castLevel(spell, context.payment),
          characterLevel: character.level,
        }),
      };

    case "target":
      // Пустая подстановка намеренно: «по цели в пределах 60 футов» звучит правильно и без цели.
      if (context.targetLabel === undefined) {
        return { value: "", gap: { placeholder, reasonRu: "Цель не указана" } };
      }
      return { value: context.targetLabel };

    case "range":
      if (spell.range.distanceFeet === undefined) {
        return {
          value: UNKNOWN,
          gap: { placeholder, reasonRu: "У заклинания нет дальности в футах" },
        };
      }
      return { value: `${spell.range.distanceFeet}` };

    case "armorClass":
      // Считается вклад выбранного заклинания вместе с уже активными эффектами (FR-093).
      // Состояние при этом не меняется: до подтверждения его менять нельзя (FR-022).
      return { value: `${armorClassWithSpell(character, spell)}` };
  }
}

/**
 * Замечание о режиме: у заклинания один шаблон, а режимов два. Ритуальные карточки написаны под
 * ритуал, поэтому обычное сотворение такого заклинания приложение проговаривает отдельно, а не
 * подменяет текст догадкой.
 */
function modeGap(spell: Spell, mode: CastMode): AnnouncementGap[] {
  if (!spell.ritual || mode === "ritual") return [];
  return [
    {
      reasonRu:
        "Шаблон написан для ритуального применения: при обычном сотворении назовите" +
        " израсходованную ячейку и время накладывания без 10 минут ритуала",
    },
  ];
}

/** Оплата кровью в шаблонах не предусмотрена: она добавляется фразой, а не подстановкой (F-15). */
function paymentSentence(spell: Spell, payment: PaymentChoice): string {
  if (payment.kind !== "spell_points") return "";
  return ` Ячейка не расходуется: сотворяю за очки заклинаний (${spellPointCost(spell.level)}).`;
}

/**
 * Готовое объявление. Порядок замечаний: сначала подстановки в порядке словаря, затем режим —
 * так список читается как «чего не хватает в тексте» сверху вниз.
 */
export function renderAnnouncement(spell: Spell, context: AnnouncementContext): Announcement {
  let text = spell.announcementTemplate;
  const gaps: AnnouncementGap[] = [];

  for (const placeholder of ANNOUNCEMENT_PLACEHOLDERS) {
    const token = `{${placeholder}}`;
    if (!text.includes(token)) continue;

    const { value, gap } = resolve(placeholder, spell, context);
    text = text.replaceAll(token, value);
    if (gap !== undefined) gaps.push(gap);
  }

  // Пустая подстановка цели оставляет двойной пробел — он виден на экране и слышен в паузе.
  text = `${text.replace(/ {2,}/g, " ").trim()}${paymentSentence(spell, context.payment)}`;

  return { text, gaps: [...gaps, ...modeGap(spell, context.mode)] };
}

type SavingThrowAbility = NonNullable<Spell["resolution"]["savingThrow"]>;

const SAVING_THROW_NAMES: Record<SavingThrowAbility, string> = {
  STR: "Силы",
  DEX: "Ловкости",
  CON: "Телосложения",
  INT: "Интеллекта",
  WIS: "Мудрости",
  CHA: "Харизмы",
};

/**
 * Урон, с которого КС проверки концентрации перестаёт быть минимальной: половина урона превышает
 * порог начиная с 22 — при 21 половина равна 10 и порога не поднимает
 * (rules-engine.md#кс-проверки-концентрации).
 */
const DAMAGE_ABOVE_MINIMUM_CONCENTRATION_DC = (MINIMUM_CONCENTRATION_DC + 1) * 2;

/**
 * Что игрок должен сделать — числами этого персонажа (FR-032).
 *
 * Инструкция говорит порогами, а не терминами правил (ADR-0012): «16 и выше — спаслась» вместо
 * «против вашей КС 16». Сокращения остаются в объявлении мастеру, где их ждут вслух, и в подробной
 * карточке. Все числа берутся из состояния персонажа и движка правил, поэтому инструкция остаётся
 * верной и после смены предмета, и после повышения уровня.
 */
export function castInstructions(spell: Spell, context: AnnouncementContext): string[] {
  const { character } = context;
  const level = castLevel(spell, context.payment);
  const steps: string[] = [...componentRequirements(spell.components)];

  if (context.payment.kind === "slot") {
    steps.push(`Спишется ячейка ${level} уровня`);
  } else if (context.payment.kind === "spell_points") {
    // Снижение максимума хитов названо отдельным следствием: «столько же максимума» игрок читает как
    // повтор цены, а это вторая, невосстановимая её половина (F-15).
    steps.push(
      `Спишется ${withPlural(spellPointCost(spell.level), ["очко", "очка", "очков"])}` +
        ` заклинаний — заплатите ${withPlural(hitPointCost(spell.level, character.level), ["хит", "хита", "хитов"])},` +
        " максимум хитов упадёт на столько же",
    );
  } else if (context.mode === "ritual") {
    steps.push("Ячейка не расходуется, но накладывание займёт на 10 минут дольше");
  }

  switch (spell.resolution.type) {
    case "spell_attack":
      // «КД цели» — единственное сокращение, которое инструкция не может заменить порогом: числа
      // противника приложение не знает (ADR-0012). Поэтому рядом сказано, что с ним делать.
      steps.push(
        `Бросьте d20 ${signed(character.spellAttackModifier)} — попадание, если результат не ниже КД цели`,
      );
      break;
    case "saving_throw": {
      // Схема требует характеристику при спасброске; если её нет — состояние испорчено, и лучше
      // назвать хотя бы порог, чем показать пустое место в инструкции.
      const ability = spell.resolution.savingThrow;
      const name = ability === undefined ? null : SAVING_THROW_NAMES[ability];
      const throwName = name === null ? "спасбросок" : `спасбросок ${name}`;
      // Порог вместо «против вашей КС 16»: КС спасброска от заклинаний — это ровно то число, которое
      // цель должна выбросить, и назвать его напрямую короче, чем расшифровывать сокращение.
      steps.push(
        `Цель бросает ${throwName}: ${character.spellSaveDc} и выше — спаслась, ниже — нет`,
      );
      break;
    }
    default:
      steps.push("Броска нет: эффект применяется сразу");
  }

  if (spell.damage !== undefined) {
    const formula = effectiveDamage(spell.damage, {
      spellLevel: spell.level,
      slotLevel: level,
      characterLevel: character.level,
    });
    // Модификатор к урону не добавляется — самая тихая ошибка заклинателя
    // (rules-engine.md#модификатор-атаки-не-добавляется-к-урону). «Только кубики» говорит, что
    // сделать; сама оговорка объясняет, чего не делать.
    steps.push(
      `Урон: ${formula} (${spell.damage.type}) — только кубики,` +
        " модификатор характеристики к урону не прибавляется",
    );
  }

  // «При успехе цели» читается двусмысленно: успех чей и в чём. Спасбросок бросает цель — значит и
  // условие называется её броском.
  if (spell.resolution.successEffect !== undefined) {
    steps.push(`Если цель спаслась: ${spell.resolution.successEffect}`);
  }
  if (spell.resolution.failureEffect !== undefined) {
    steps.push(`Если цель провалила спасбросок: ${spell.resolution.failureEffect}`);
  }

  if (spell.concentration) {
    // Формула «10 или половина урона, что больше» требует счёта в уме на каждое попадание. Порог
    // постоянен, пока половина урона его не превысит, — эта граница и названа числом (ADR-0012).
    steps.push(
      `Держите концентрацию: получите урон — бросьте d20 ${signed(character.constitutionSaveModifier)}.` +
        ` Нужно ${MINIMUM_CONCENTRATION_DC} и больше` +
        ` (при уроне от ${DAMAGE_ABOVE_MINIMUM_CONCENTRATION_DC} — половину урона и больше),` +
        " иначе заклинание спадает",
    );
  }

  return steps;
}
