import { withPlural } from "@/shared/language";

const SHORT_REST_MINUTES = 10;

export const SHORT_REST_DURATION_RU = withPlural(SHORT_REST_MINUTES, [
  "минута",
  "минуты",
  "минут",
]);
