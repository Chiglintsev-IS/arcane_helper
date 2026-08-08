/**
 * Образец, который обязан не собираться: вклад к Классу Доспеха, читающий Класс Доспеха.
 *
 * Ошибка компиляции здесь и есть тот запрет цикла, на который опирается лист. Величина строится из
 * объектов своих зависимостей, а не из их имён, и назвать зависимостью себя значит использовать
 * объявление до объявления. Собери этот файл — и запрета больше нет.
 */

import { defineStat, ownCandidate } from "@/core/domain/sheet/resolve";

export const armorClass = defineStat({
  id: "armorClass",
  from: [armorClass],
  methods: (read) => [ownCandidate(read(armorClass) + 1)],
});
