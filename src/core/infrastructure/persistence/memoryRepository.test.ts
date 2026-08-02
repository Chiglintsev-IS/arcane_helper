import { describe } from "vitest";

import { createMemoryRepository } from "@/core/infrastructure/persistence/memoryRepository";
import { describeParsingContract, describeRepositoryContract } from "@/core/infrastructure/persistence/repositoryContract";

describe("хранилище в памяти", () => {
  describeRepositoryContract(() => createMemoryRepository());
});

describe("разбор сохранённого", () => {
  describeParsingContract();
});
