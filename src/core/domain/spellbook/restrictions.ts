type BanCategory = "harmful_to_species" | "dungeon_master";

export type BannedSpell = {
  nameRu: string;
  nameEn: string;
  reason: BanCategory;
  explanationRu: string;
};
