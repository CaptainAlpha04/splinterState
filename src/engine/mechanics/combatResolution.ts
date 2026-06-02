import type { Country } from "../models/country";
import { controlledDevelopmentScore } from "../content/countryContent";
import { calculateWeights } from "./initiativeWheel";
import { bfsConquest } from "./bfsConquest";
import { nextInt, type RngState } from "../rng/seededRng";

export type CombatOutcome = {
  attackerId: string;
  defenderId: string;
  winnerId: string | null;
  rounds: Array<{
    activeCountryId: string;
    roll: number;
    capturedProvinces: string[];
  }>;
};

export type CombatTurnOutcome = {
  attackerId: string;
  defenderId: string;
  activeCountryId: string;
  targetCountryId: string;
  roll: number;
  capturedProvinces: string[];
  incineratedProvinceIds: string[];
  winnerId: string | null;
  action: "advance" | "counter" | "camp" | "nuke" | "interceptor" | "support";
  falloutRoll?: number;
};

function rollMultiplier(country: Country) {
  const development = controlledDevelopmentScore(country);
  if (development >= 520) return 3;
  if (
    country.name.endsWith("Empire") ||
    country.unlockedFormations.length > 0 ||
    development >= 290 ||
    country.baseId === "USA" ||
    country.baseId === "CHN"
  ) {
    return 2;
  }
  return 1;
}

export function resolveCombatTurn(
  attacker: Country,
  defender: Country,
  adjacencyMap: Record<string, string[]>,
  rngState: RngState
): CombatTurnOutcome {
  const attackerProvinces = new Set(attacker.provinces);
  const defenderProvinces = new Set(defender.provinces);

  const weights = calculateWeights(
    attacker,
    defender,
    attackerProvinces.size,
    defenderProvinces.size,
    attackerProvinces.has(defender.capitalProvinceId),
    defenderProvinces.has(attacker.capitalProvinceId)
  );

  const totalWeight = Math.max(1, weights.attackerWeight + weights.defenderWeight);
  const wheelRoll = nextInt(rngState, 1, totalWeight);
  const isActiveAttacker = wheelRoll <= weights.attackerWeight;
  const activeCountry = isActiveAttacker ? attacker : defender;
  const targetCountry = isActiveAttacker ? defender : attacker;
  const activeSet = isActiveAttacker ? attackerProvinces : defenderProvinces;
  const targetSet = isActiveAttacker ? defenderProvinces : attackerProvinces;
  const roll = nextInt(rngState, -8, 8);
  const multiplier = rollMultiplier(activeCountry);
  let capturedProvinces: string[] = [];
  let incineratedProvinceIds: string[] = [];
  let action: CombatTurnOutcome["action"] = "advance";
  let falloutRoll: number | undefined;

  if (roll > 0) {
    const result = bfsConquest(Array.from(activeSet), targetSet, roll * multiplier, adjacencyMap, targetCountry.capitalProvinceId);
    capturedProvinces = result.capturedProvinceIds;
    capturedProvinces.forEach(provinceId => {
      targetSet.delete(provinceId);
      activeSet.add(provinceId);
    });
  } else if (roll < 0) {
    action = "counter";
    const result = bfsConquest(Array.from(targetSet), activeSet, Math.abs(roll) * multiplier, adjacencyMap, activeCountry.capitalProvinceId);
    capturedProvinces = result.capturedProvinceIds;
    capturedProvinces.forEach(provinceId => {
      activeSet.delete(provinceId);
      targetSet.add(provinceId);
    });
  } else {
    const specialRoll = nextInt(rngState, 1, 4);
    if (specialRoll === 1) {
      action = "nuke";
      falloutRoll = nextInt(rngState, 1, 10);
      const result = bfsConquest(Array.from(activeSet), targetSet, falloutRoll, adjacencyMap, targetCountry.capitalProvinceId);
      capturedProvinces = result.capturedProvinceIds;
      incineratedProvinceIds = capturedProvinces;
      capturedProvinces.forEach(provinceId => {
        targetSet.delete(provinceId);
        activeSet.add(provinceId);
      });
    } else if (specialRoll === 2) {
      action = "interceptor";
      activeCountry.armyCampsCount += 1;
    } else if (specialRoll === 3) {
      action = "camp";
      activeCountry.armyCampsCount += 1;
    } else {
      action = "support";
      activeCountry.eventModifier += 4;
    }
  }

  attacker.provinces = Array.from(attackerProvinces);
  defender.provinces = Array.from(defenderProvinces);

  const winnerId =
    attackerProvinces.size === 0 ? defender.id :
    defenderProvinces.size === 0 ? attacker.id :
    null;

  return {
    attackerId: attacker.id,
    defenderId: defender.id,
    activeCountryId: activeCountry.id,
    targetCountryId: targetCountry.id,
    roll,
    capturedProvinces,
    incineratedProvinceIds,
    winnerId,
    action,
    falloutRoll,
  };
}

export function resolveCombat(
  attacker: Country,
  defender: Country,
  adjacencyMap: Record<string, string[]>,
  rngState: RngState
): CombatOutcome {
  const outcome: CombatOutcome = {
    attackerId: attacker.id,
    defenderId: defender.id,
    winnerId: null,
    rounds: []
  };

  const attackerProvinces = new Set(attacker.provinces);
  const defenderProvinces = new Set(defender.provinces);

  // Simplified infinite loop guard
  let maxRounds = 1000;

  while (attackerProvinces.size > 0 && defenderProvinces.size > 0 && maxRounds > 0) {
    maxRounds--;

    const turn = resolveCombatTurn(attacker, defender, adjacencyMap, rngState);
    attackerProvinces.clear();
    defenderProvinces.clear();
    attacker.provinces.forEach(provinceId => attackerProvinces.add(provinceId));
    defender.provinces.forEach(provinceId => defenderProvinces.add(provinceId));

    outcome.rounds.push({
      activeCountryId: turn.activeCountryId,
      roll: turn.roll,
      capturedProvinces: turn.capturedProvinces
    });
  }

  if (attackerProvinces.size === 0) {
    outcome.winnerId = defender.id;
  } else if (defenderProvinces.size === 0) {
    outcome.winnerId = attacker.id;
  }

  // Sync state back
  attacker.provinces = Array.from(attackerProvinces);
  defender.provinces = Array.from(defenderProvinces);

  return outcome;
}
