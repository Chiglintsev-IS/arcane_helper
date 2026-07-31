/**
 * Браузерное хранилище проверяется тем же набором, что и оперативное.
 * IndexedDB подменяется fake-indexeddb: непроверенный слой хранения — то место, где теряются данные.
 */

import "fake-indexeddb/auto";

import { describe } from "vitest";

import { createDexieRepository } from "./dexieRepository";
import { describeRepositoryContract } from "./repositoryContract";

let databaseNumber = 0;

describe("хранилище на IndexedDB", () => {
  // Своя база на каждый тест: иначе тесты видят данные друг друга.
  describeRepositoryContract(() => createDexieRepository(`arcane-helper-test-${++databaseNumber}`));
});
