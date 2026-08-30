/** IndexedDB подменяется fake-indexeddb: браузера у прогона нет. */

import "fake-indexeddb/auto";

import { describe } from "vitest";

import { createDexieRepository } from "@/core/infrastructure/persistence/dexieRepository";
import { describeRepositoryContract } from "@/core/infrastructure/persistence/repositoryContract";

let databaseNumber = 0;

describe("хранилище на IndexedDB", () => {
  describeRepositoryContract(() => createDexieRepository(`arcane-helper-test-${++databaseNumber}`));
});
