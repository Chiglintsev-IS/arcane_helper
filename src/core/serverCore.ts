/**
 * Ядро в серверном процессе: та же сборка, другие исходящие адаптеры.
 *
 * Одно на процесс: три маршрута обслуживают одну игру, и второе ядро рядом означало бы вторую
 * сессию, которая ничего не знает о первой.
 *
 * Сессия одна и подразумеваемая — та же, что и в браузере. Названная понадобится тому, у кого игр
 * несколько; здесь игрок один, персонаж один, и имя сессии было бы полем, которое никто не
 * заполняет.
 *
 * Хранилище оперативное: поставка с бэкендом доказывает шов, а не заводит второе место, где живёт
 * игра. Перезапуск процесса начинает партию заново, и это её единственное отличие от офлайновой,
 * которая остаётся основной.
 *
 * Провода здесь нет: на этой стороне провод — сам маршрут.
 */

import { createCore, type Core } from "@/core/composition";
import { loadThorneSpells } from "@/core/infrastructure/catalog/thorne";
import { createThorne } from "@/core/infrastructure/catalog/thorne/character";
import { systemClock } from "@/core/infrastructure/clock";
import { createMemoryRepository } from "@/core/infrastructure/persistence/memoryRepository";

let core: Core | null = null;

export function serverCore(): Core {
  core ??= createCore({
    repository: createMemoryRepository(),
    clock: systemClock(),
    createInitialCharacter: createThorne,
    loadBuiltInCatalog: loadThorneSpells,
  });
  return core;
}
