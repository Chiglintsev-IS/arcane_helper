import { describe } from "vitest";

import { createMemoryRepository } from "./memoryRepository";
import { describeParsingContract, describeRepositoryContract } from "./repositoryContract";

describe("хранилище в памяти", () => {
  describeRepositoryContract(() => createMemoryRepository());
});

describe("разбор сохранённого", () => {
  describeParsingContract();
});
