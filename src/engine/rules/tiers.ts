import type { CountryTier } from "../models/enums";

export type TierRules = {
  empireThreshold: number;
  hegemonThreshold: number;
  empireOverrides: string[];
};

export const defaultTierRules: TierRules = {
  empireThreshold: 50,
  hegemonThreshold: 9999,
  empireOverrides: ["USA", "CHN"],
};

export function resolveTier(
  strategicPower: number,
  countryId: string,
  rules: TierRules = defaultTierRules
): CountryTier {
  if (rules.empireOverrides.includes(countryId)) return "Empire";
  if (strategicPower >= rules.empireThreshold) return "Empire";
  return "Kingdom";
}
