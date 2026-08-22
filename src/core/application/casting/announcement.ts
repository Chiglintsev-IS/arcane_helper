/**
 * Объявление мастеру.
 *
 * Шаблон хранится в карточке заклинания, подстановки берутся из состояния персонажа и выбора в
 * мастере применения. Художественного текста здесь нет и быть не может: словарь подстановок закрыт
 *, а сама функция ничего не сочиняет.
 *
 * Чего приложение не заполняет, оно не выдумывает: неизвестная подстановка превращается в «?» и
 * попадает в `gaps` с причиной. Показать неверное число хуже, чем не показать никакого.
 */

import type { CharacterState } from "@/core/domain/assembly/state";
import { Character } from "@/core/domain/assembly/character";
import { saveStatId } from "@/core/domain/shared/stats";
import type { Spell } from "@/core/domain/catalog/spell";
import { ANNOUNCEMENT_PLACEHOLDERS } from "@/core/domain/catalog/spell";
import {
  bloodPrice,
  castLevelOf,
  componentRequirements,
  type PaymentChoice,
} from "@/core/application/casting/availability";
import { materialCoveredByFocus } from "@/core/application/casting/material";
import { NO_ROLL_RU, SAVING_THROW_NAMES, signed, withPlural } from "@/shared/language";
import { RITUAL_EXTRA_MINUTES } from "@/core/domain/arcana/slots";
import { MINIMUM_CONCENTRATION_DC } from "@/core/domain/effects/concentration";
import { RUNE_LABEL, runeEffect, type Rune } from "@/core/domain/arcana/runes";
import { effectiveDamage } from "@/core/domain/catalog/scaling";
import type { CastMode } from "@/core/domain/arcana/slots";

type AnnouncementPlaceholder = (typeof ANNOUNCEMENT_PLACEHOLDERS)[number];

/** Незаполненная подстановка либо замечание о режиме применения. Причина — словами. */
type AnnouncementGap = {
  placeholder?: AnnouncementPlaceholder;
  reasonRu: string;
};

type Announcement = {
  /** Готовая к произнесению вслух формулировка. */
  text: string;
  gaps: AnnouncementGap[];
};

type AnnouncementContext = {
  character: CharacterState;
  mode: CastMode;
  payment: PaymentChoice;
  /** Цель свободным текстом: модели противников в MVP нет. */
  targetLabel?: string;
  /** Приложенная руна. Заговору и ритуалу её приложить не к чему. */
  rune?: Rune;
};

/** Уровень сотворения, а без него — собственный уровень заклинания: заговор и ритуал не растут. */
function castLevel(spell: Spell, payment: PaymentChoice): number {
  return castLevelOf(payment) ?? spell.level;
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
      return { value: `${Character.of(character).sheet.value("spellSaveDc")}` };

    case "spellAttackModifier":
      return { value: signed(Character.of(character).sheet.value("spellAttackModifier")) };

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
      // Считается вклад выбранного заклинания вместе с уже активными эффектами.
      // Состояние при этом не меняется: до подтверждения его менять нельзя.
      return { value: `${Character.of(character).sheetWith(spell).value("armorClass")}` };
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

/**
 * Откуда взялась ячейка, в шаблонах не предусмотрено: это добавляется фразой, а не подстановкой.
 *
 * Шаблон уже назвал уровень — назвать его вторично значило бы повторить число; сказано поэтому
 * только то, чего в шаблоне нет: ячейка не из пула, и за неё заплачено кровью.
 */
function paymentSentence(payment: PaymentChoice, character: CharacterState): string {
  if (payment.kind !== "blood") return "";
  const { hitPoints } = bloodPrice(payment.castLevel, character);
  return ` Ячейку создаю кровью: ${withPlural(hitPoints, ["хит", "хита", "хитов"])}.`;
}

/**
 * Руна в шаблонах карточек не предусмотрена: она добавляется фразой, как и оплата кровью.
 *
 * Молчит там, где уровня сотворения нет: у заговора и ритуала эффект руны считать не от чего, и
 * названная вслух она обещала бы мастеру то, чего не будет.
 */
function runeSentence(context: AnnouncementContext): string {
  const level = castLevelOf(context.payment);
  if (context.rune === undefined || level === undefined) return "";
  const name = RUNE_LABEL[context.rune].replace("Руна ", "руну ");
  return ` Применяю ${name}: ${runeEffect(context.rune, level)}.`;
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
  text =
    `${text.replace(/ {2,}/g, " ").trim()}` +
    `${paymentSentence(context.payment, context.character)}${runeSentence(context)}`;

  return { text, gaps: [...gaps, ...modeGap(spell, context.mode)] };
}

/**
 * Урон, с которого КС проверки концентрации перестаёт быть минимальной: половина урона превышает
 * порог начиная с 22 — при 21 половина равна 10 и порога не поднимает
 */
const DAMAGE_ABOVE_MINIMUM_CONCENTRATION_DC = (MINIMUM_CONCENTRATION_DC + 1) * 2;

/**
 * Что игрок должен сделать — числами этого персонажа.
 *
 * Инструкция говорит порогами, а не терминами правил: «16 и выше — спаслась» вместо
 * «против вашей КС 16». Сокращения остаются в объявлении мастеру, где их ждут вслух, и в подробной
 * карточке. Все числа берутся из состояния персонажа и движка правил, поэтому инструкция остаётся
 * верной и после смены предмета, и после повышения уровня.
 */
export function castInstructions(spell: Spell, context: AnnouncementContext): string[] {
  const { character } = context;
  const totals = Character.of(character).sheet;
  const level = castLevel(spell, context.payment);
  const steps: string[] = [
    ...componentRequirements(spell.components, materialCoveredByFocus(spell.components, character)),
  ];

  if (context.payment.kind === "slot") {
    steps.push(`Спишется ячейка ${level} уровня`);
  } else if (context.payment.kind === "blood") {
    // Снижение максимума хитов названо отдельным следствием: «столько же максимума» игрок читает как
    // повтор цены, а это вторая, невосстановимая её половина.
    const { hitPoints } = bloodPrice(context.payment.castLevel, character);
    steps.push(
      `Кровь создаст ячейку ${level} уровня —` +
        ` заплатите ${withPlural(hitPoints, ["хит", "хита", "хитов"])},` +
        " максимум хитов упадёт на столько же",
    );
  } else if (context.mode === "ritual") {
    steps.push(
      `Ячейка не расходуется, но накладывание займёт на ${RITUAL_EXTRA_MINUTES} минут дольше`,
    );
  }

  // Руна списывается той же транзакцией, что и оплата, поэтому названа рядом с ценой.
  const runeLevel = castLevelOf(context.payment);
  if (context.rune !== undefined && runeLevel !== undefined) {
    steps.push(
      `Спишется ${RUNE_LABEL[context.rune].replace("Руна ", "руна ")}:` +
        ` ${runeEffect(context.rune, runeLevel)}`,
    );
  }

  switch (spell.resolution.type) {
    case "spell_attack":
      // «КД цели» — единственное сокращение, которое инструкция не может заменить порогом: числа
      // противника приложение не знает. Поэтому рядом сказано, что с ним делать.
      steps.push(
        `Бросьте d20${signed(totals.value("spellAttackModifier"))} — попадание, если результат не ниже КД цели`,
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
        `Цель бросает ${throwName}: ${totals.value("spellSaveDc")} и выше — спаслась, ниже — нет`,
      );
      break;
    }
    default:
      steps.push(`${NO_ROLL_RU}: эффект применяется сразу`);
  }

  if (spell.damage !== undefined) {
    const formula = effectiveDamage(spell.damage, {
      spellLevel: spell.level,
      slotLevel: level,
      characterLevel: character.level,
    });
    // Модификатор к урону не добавляется — самая тихая ошибка заклинателя
    //. «Только кубики» говорит, что
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
    // постоянен, пока половина урона его не превысит, — эта граница и названа числом.
    steps.push(
      `Держите концентрацию: получите урон — бросьте d20${signed(totals.value(saveStatId("constitution")))}.` +
        ` Нужно ${MINIMUM_CONCENTRATION_DC} и больше` +
        ` (при уроне от ${DAMAGE_ABOVE_MINIMUM_CONCENTRATION_DC} — половину урона и больше),` +
        " иначе заклинание спадает",
    );
  }

  return steps;
}
