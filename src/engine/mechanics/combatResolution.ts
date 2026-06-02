import type { Country } from "../models/country";
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
  winnerId: string | null;
  action: "advance" | "counter" | "camp";
};

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
  let capturedProvinces: string[] = [];
  let action: CombatTurnOutcome["action"] = "advance";

  if (roll > 0) {
    const result = bfsConquest(Array.from(activeSet), targetSet, roll, adjacencyMap);
    capturedProvinces = result.capturedProvinceIds;
    capturedProvinces.forEach(provinceId => {
      targetSet.delete(provinceId);
      activeSet.add(provinceId);
    });
  } else if (roll < 0) {
    action = "counter";
    const result = bfsConquest(Array.from(targetSet), activeSet, Math.abs(roll), adjacencyMap);
    capturedProvinces = result.capturedProvinceIds;
    capturedProvinces.forEach(provinceId => {
      activeSet.delete(provinceId);
      targetSet.add(provinceId);
    });
  } else {
    action = "camp";
    activeCountry.armyCampsCount += 1;
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
    winnerId,
    action,
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
