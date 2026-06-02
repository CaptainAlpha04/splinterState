import type { Country } from "../models/country";
import { governmentModifier } from "../rules/modifiers";

export type WheelWeights = {
  attackerWeight: number;
  defenderWeight: number;
};

export type WheelBreakdown = {
  provincePower: number;
  government: number;
  special: number;
  event: number;
  armyCamps: number;
  capital: number;
  total: number;
};

export function provincePower(provinceCount: number): number {
  return Math.max(1, Math.min(36, Math.round(Math.sqrt(Math.max(1, provinceCount)) * 3)));
}

export function countryWheelBreakdown(
  country: Country,
  provinceCount: number,
  hasEnemyCapital: boolean
): WheelBreakdown {
  const special = country.specialModifiers.reduce((total, modifier) => total + modifier.value, 0);
  const armyCamps = country.armyCampsCount * 10;
  const capital = hasEnemyCapital ? 20 : 0;
  const government = governmentModifier(country.government);
  const land = Math.max(1, country.strategicPower + provincePower(provinceCount));
  const total = Math.max(1, land + government + special + country.eventModifier + armyCamps + capital);

  return {
    provincePower: land,
    government,
    special,
    event: country.eventModifier,
    armyCamps,
    capital,
    total,
  };
}

export function calculateWeights(
  attacker: Country,
  defender: Country,
  attackerProvinceCount: number,
  defenderProvinceCount: number,
  attackerHasCapital: boolean,
  defenderHasCapital: boolean
): WheelWeights {
  const attackerWeight = countryWheelBreakdown(attacker, attackerProvinceCount, attackerHasCapital).total;
  const defenderWeight = countryWheelBreakdown(defender, defenderProvinceCount, defenderHasCapital).total;

  return { attackerWeight, defenderWeight };
}
