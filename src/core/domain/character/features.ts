import { z } from "zod";

import { nonEmpty } from "@/core/domain/shared/schema";

const characterFeatureSchema = z.object({
  nameRu: nonEmpty,
  summaryRu: nonEmpty,
});

export const characterFeaturesSchema = z.array(characterFeatureSchema).default([]);
