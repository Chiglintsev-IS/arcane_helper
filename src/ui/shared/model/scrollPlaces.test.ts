import { describe, expect, it } from "vitest";

import { scrollPlaces } from "./scrollPlaces";

describe("места страниц", () => {
  it("невиданная страница начинается сверху, а покинутая ждёт там, где её оставили", () => {
    const places = scrollPlaces();

    expect(places.at("kinds")).toBe(0);

    places.leftAt("kinds", 240);
    expect(places.at("kinds")).toBe(240);
    expect(places.at("recipes")).toBe(0);

    places.leftAt("kinds", 0);
    expect(places.at("kinds")).toBe(0);
  });
});
