import type { Country } from "../models/country";
import { controlledDevelopmentScore, religionModifier } from "../content/countryContent";
import { governmentModifier } from "../rules/modifiers";

export type WheelWeights = {
  attackerWeight: number;
  defenderWeight: number;
};

export type WheelBreakdown = {
  provincePower: number;
  government: number;
  special: number;
  religion: number;
  event: number;
  armyCamps: number;
  capital: number;
  total: number;
};

export function provincePower(provinceCount: number): number {
  return Math.max(1, Math.min(180, Math.round(Math.pow(Math.max(1, provinceCount), 0.86) * 3.2)));
}

export function countryWheelBreakdown(
  country: Country,
  provinceCount: number,
  hasEnemyCapital: boolean
): WheelBreakdown {
  const special = country.specialModifiers.reduce((total, modifier) => total + modifier.value, 0);
  const armyCamps = country.armyCampsCount * 25;
  const capital = hasEnemyCapital ? 20 : 0;
  const government = governmentModifier(country.government);
  const religion = religionModifier(country.religion);
  const originalFootprint = Math.max(1, country.initialProvinceCount);
  const conqueredFootprint = Math.max(0, provinceCount - originalFootprint);
  const retainedBase = country.strategicPower * Math.min(1, provinceCount / originalFootprint);
  const conquestPower = Math.sqrt(conqueredFootprint) * 5.5;
  const retainedStrategicPower = Math.round(Math.max(4, retainedBase + conquestPower));
  const developmentPower = Math.round(controlledDevelopmentScore(country) * 0.45);
  const land = Math.max(1, retainedStrategicPower + developmentPower + provincePower(provinceCount));
  const total = Math.max(1, land + government + religion + special + country.eventModifier + armyCamps + capital);

  return {
    provincePower: land,
    government,
    religion,
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
