import type { Country } from "../models/country";
import type { ActiveWar } from "../models/war";
import type { GovernmentType } from "../models/enums";
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
  interceptedByCountryId?: string;
  interceptedRoll?: number;
  blitzRoll?: number;
  directiveWeights?: Record<"camp" | "interceptor" | "support" | "nuke", number>;
};

function rollMultiplier(country: Country) {
  const development = controlledDevelopmentScore(country);
  const absorbedScale = country.absorbedCountryIds.length;
  const conqueredScale = Math.max(0, country.provinces.length - country.initialProvinceCount);
  if (development >= 820 && country.provinces.length >= 220 && absorbedScale >= 8) return 3;
  if (
    (country.unlockedFormations.length > 0 && development >= 360 && country.provinces.length >= 55) ||
    (development >= 520 && country.provinces.length >= 95 && absorbedScale >= 3) ||
    (conqueredScale >= 90 && development >= 470 && absorbedScale >= 2) ||
    country.baseId === "USA" ||
    country.baseId === "CHN"
  ) {
    return 2;
  }
  return 1;
}

function effectiveInitiativeWeights(
  attacker: Country,
  defender: Country,
  attackerProvinces: Set<string>,
  defenderProvinces: Set<string>,
  initiativePenalties: Record<string, number>
) {
  const weights = calculateWeights(
    attacker,
    defender,
    attackerProvinces.size,
    defenderProvinces.size,
    attackerProvinces.has(defender.capitalProvinceId),
    defenderProvinces.has(attacker.capitalProvinceId)
  );
  return {
    attackerWeight: Math.max(1, weights.attackerWeight + (initiativePenalties[attacker.id] ?? 0)),
    defenderWeight: Math.max(1, weights.defenderWeight + (initiativePenalties[defender.id] ?? 0)),
  };
}

function spinInitiative(attackerWeight: number, defenderWeight: number, rngState: RngState) {
  const totalWeight = Math.max(1, attackerWeight + defenderWeight);
  const wheelRoll = nextInt(rngState, 1, totalWeight);
  return wheelRoll <= attackerWeight;
}

function directiveWeightsFor(
  activeCountry: Country,
  activeWeight: number,
  targetWeight: number,
  usedNukesByCountryId: Record<string, boolean>
): Record<"camp" | "interceptor" | "support" | "nuke", number> {
  const base = baseDirectiveWeights(activeCountry.government);
  const share = activeWeight / Math.max(1, activeWeight + targetWeight);
  const nukeAvailable = activeCountry.government !== "Democracy" && !usedNukesByCountryId[activeCountry.id];
  if (!nukeAvailable) return { ...base, nuke: 0 };
  if (share < 0.2) {
    return {
      camp: 10,
      interceptor: 10,
      support: 10,
      nuke: 70,
    };
  }
  return base;
}

function baseDirectiveWeights(government: GovernmentType): Record<"camp" | "interceptor" | "support" | "nuke", number> {
  if (government === "Democracy") return { camp: 30, interceptor: 40, support: 30, nuke: 0 };
  if (government === "Aristocracy") return { camp: 40, interceptor: 30, support: 20, nuke: 10 };
  if (government === "Communism" || government === "Caliphate") return { camp: 35, interceptor: 15, support: 30, nuke: 20 };
  if (government === "Revolutionary") return { camp: 15, interceptor: 15, support: 30, nuke: 40 };
  return { camp: 30, interceptor: 30, support: 30, nuke: 10 };
}

function pickDirective(
  weights: Record<"camp" | "interceptor" | "support" | "nuke", number>,
  rngState: RngState
): CombatTurnOutcome["action"] {
  const total = Math.max(1, weights.camp + weights.interceptor + weights.support + weights.nuke);
  const roll = nextInt(rngState, 1, total);
  if (roll <= weights.camp) return "camp";
  if (roll <= weights.camp + weights.interceptor) return "interceptor";
  if (roll <= weights.camp + weights.interceptor + weights.support) return "support";
  return "nuke";
}

export function resolveCombatTurn(
  attacker: Country,
  defender: Country,
  adjacencyMap: Record<string, string[]>,
  rngState: RngState,
  provinceInitialCountryIds: Record<string, string> = {},
  war?: ActiveWar
): CombatTurnOutcome {
  const attackerProvinces = new Set(attacker.provinces);
  const defenderProvinces = new Set(defender.provinces);
  const usedNukesByCountryId = war?.usedNukesByCountryId ?? {};
  const initiativePenalties = war?.initiativePenalties ?? {};
  const initiativeWeights = effectiveInitiativeWeights(attacker, defender, attackerProvinces, defenderProvinces, initiativePenalties);
  let isActiveAttacker = spinInitiative(initiativeWeights.attackerWeight, initiativeWeights.defenderWeight, rngState);
  let interceptedByCountryId: string | undefined;
  let interceptedRoll: number | undefined;
  let blitzBonusCountryId: string | undefined;

  const firstActiveCountry = isActiveAttacker ? attacker : defender;
  if (firstActiveCountry.blitzActions > 0) {
    firstActiveCountry.blitzActions -= 1;
    blitzBonusCountryId = firstActiveCountry.id;
  } else {
    const firstTargetCountry = isActiveAttacker ? defender : attacker;
    const firstRoll = nextInt(rngState, -8, 8);
    if (firstRoll > 0 && firstTargetCountry.interceptorCharges > 0) {
      firstTargetCountry.interceptorCharges = Math.max(0, firstTargetCountry.interceptorCharges - 1);
      interceptedByCountryId = firstTargetCountry.id;
      interceptedRoll = firstRoll;
      const retryWeights = effectiveInitiativeWeights(attacker, defender, attackerProvinces, defenderProvinces, initiativePenalties);
      isActiveAttacker = spinInitiative(retryWeights.attackerWeight, retryWeights.defenderWeight, rngState);
    } else {
      return resolveActionRoll({
        attacker,
        defender,
        attackerProvinces,
        defenderProvinces,
        isActiveAttacker,
        roll: firstRoll,
        adjacencyMap,
        rngState,
        provinceInitialCountryIds,
        war,
        usedNukesByCountryId,
        initiativePenalties,
      });
    }
  }

  const activeCountry = isActiveAttacker ? attacker : defender;
  const targetCountry = isActiveAttacker ? defender : attacker;
  const activeSet = isActiveAttacker ? attackerProvinces : defenderProvinces;
  const targetSet = isActiveAttacker ? defenderProvinces : attackerProvinces;
  const roll = nextInt(rngState, -8, 8);
  const blitzRoll = blitzBonusCountryId === activeCountry.id ? nextInt(rngState, -8, 8) : undefined;
  const multiplier = rollMultiplier(activeCountry);
  let capturedProvinces: string[] = [];
  let incineratedProvinceIds: string[] = [];
  let action: CombatTurnOutcome["action"] = "advance";
  let falloutRoll: number | undefined;
  let directiveWeights: CombatTurnOutcome["directiveWeights"];

  if (roll > 0) {
    capturedProvinces = captureCleanProvinceBlock(
      Array.from(activeSet),
      targetSet,
      roll * multiplier,
      adjacencyMap,
      provinceInitialCountryIds,
      activeCountry.id,
      targetCountry.capitalProvinceId
    );
    capturedProvinces.forEach(provinceId => {
      targetSet.delete(provinceId);
      activeSet.add(provinceId);
    });
  } else if (roll < 0) {
    action = "counter";
    capturedProvinces = captureCleanProvinceBlock(
      Array.from(targetSet),
      activeSet,
      Math.abs(roll) * multiplier,
      adjacencyMap,
      provinceInitialCountryIds,
      targetCountry.id,
      activeCountry.capitalProvinceId
    );
    capturedProvinces.forEach(provinceId => {
      activeSet.delete(provinceId);
      targetSet.add(provinceId);
    });
  } else {
    directiveWeights = directiveWeightsFor(
      activeCountry,
      isActiveAttacker ? initiativeWeights.attackerWeight : initiativeWeights.defenderWeight,
      isActiveAttacker ? initiativeWeights.defenderWeight : initiativeWeights.attackerWeight,
      usedNukesByCountryId
    );
    action = pickDirective(directiveWeights, rngState);
    if (action === "nuke") {
      action = "nuke";
      falloutRoll = nextInt(rngState, 1, 10);
      capturedProvinces = bfsConquest(
        [targetCountry.capitalProvinceId],
        targetSet,
        falloutRoll,
        adjacencyMap,
        targetCountry.capitalProvinceId
      ).capturedProvinceIds;
      incineratedProvinceIds = capturedProvinces;
      capturedProvinces.forEach(provinceId => {
        targetSet.delete(provinceId);
      });
      usedNukesByCountryId[activeCountry.id] = true;
      initiativePenalties[targetCountry.id] = (initiativePenalties[targetCountry.id] ?? 0) - 100;
    } else if (action === "interceptor") {
      action = "interceptor";
      activeCountry.interceptorCharges = Math.min(3, activeCountry.interceptorCharges + 1);
    } else if (action === "camp") {
      action = "camp";
      activeCountry.armyCampsCount += 1;
    } else {
      action = "support";
      activeCountry.blitzActions += 1;
    }
  }

  if (typeof blitzRoll === "number") {
    const blitzCaptured = applyBlitzRoll(
      activeCountry,
      targetCountry,
      activeSet,
      targetSet,
      blitzRoll,
      multiplier,
      adjacencyMap,
      provinceInitialCountryIds
    );
    capturedProvinces = Array.from(new Set([...capturedProvinces, ...blitzCaptured]));
  }

  if (war) {
    war.usedNukesByCountryId = usedNukesByCountryId;
    war.initiativePenalties = initiativePenalties;
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
    interceptedByCountryId,
    interceptedRoll,
    blitzRoll,
    directiveWeights,
  };
}

function applyBlitzRoll(
  activeCountry: Country,
  targetCountry: Country,
  activeSet: Set<string>,
  targetSet: Set<string>,
  roll: number,
  multiplier: number,
  adjacencyMap: Record<string, string[]>,
  provinceInitialCountryIds: Record<string, string>
) {
  if (roll === 0) return [];
  if (roll > 0) {
    const captured = captureCleanProvinceBlock(
      Array.from(activeSet),
      targetSet,
      roll * multiplier,
      adjacencyMap,
      provinceInitialCountryIds,
      activeCountry.id,
      targetCountry.capitalProvinceId
    );
    captured.forEach(provinceId => {
      targetSet.delete(provinceId);
      activeSet.add(provinceId);
    });
    return captured;
  }

  const captured = captureCleanProvinceBlock(
    Array.from(targetSet),
    activeSet,
    Math.abs(roll) * multiplier,
    adjacencyMap,
    provinceInitialCountryIds,
    targetCountry.id,
    activeCountry.capitalProvinceId
  );
  captured.forEach(provinceId => {
    activeSet.delete(provinceId);
    targetSet.add(provinceId);
  });
  return captured;
}

function resolveActionRoll(args: {
  attacker: Country;
  defender: Country;
  attackerProvinces: Set<string>;
  defenderProvinces: Set<string>;
  isActiveAttacker: boolean;
  roll: number;
  adjacencyMap: Record<string, string[]>;
  rngState: RngState;
  provinceInitialCountryIds: Record<string, string>;
  war?: ActiveWar;
  usedNukesByCountryId: Record<string, boolean>;
  initiativePenalties: Record<string, number>;
}): CombatTurnOutcome {
  const {
    attacker,
    defender,
    attackerProvinces,
    defenderProvinces,
    isActiveAttacker,
    roll,
    adjacencyMap,
    rngState,
    provinceInitialCountryIds,
    war,
    usedNukesByCountryId,
    initiativePenalties,
  } = args;
  const activeCountry = isActiveAttacker ? attacker : defender;
  const targetCountry = isActiveAttacker ? defender : attacker;
  const activeSet = isActiveAttacker ? attackerProvinces : defenderProvinces;
  const targetSet = isActiveAttacker ? defenderProvinces : attackerProvinces;
  const weights = effectiveInitiativeWeights(attacker, defender, attackerProvinces, defenderProvinces, initiativePenalties);
  const multiplier = rollMultiplier(activeCountry);
  let capturedProvinces: string[] = [];
  let incineratedProvinceIds: string[] = [];
  let action: CombatTurnOutcome["action"] = "advance";
  let falloutRoll: number | undefined;
  let directiveWeights: CombatTurnOutcome["directiveWeights"];

  if (roll > 0) {
    capturedProvinces = captureCleanProvinceBlock(Array.from(activeSet), targetSet, roll * multiplier, adjacencyMap, provinceInitialCountryIds, activeCountry.id, targetCountry.capitalProvinceId);
    capturedProvinces.forEach(provinceId => {
      targetSet.delete(provinceId);
      activeSet.add(provinceId);
    });
  } else if (roll < 0) {
    action = "counter";
    capturedProvinces = captureCleanProvinceBlock(Array.from(targetSet), activeSet, Math.abs(roll) * multiplier, adjacencyMap, provinceInitialCountryIds, targetCountry.id, activeCountry.capitalProvinceId);
    capturedProvinces.forEach(provinceId => {
      activeSet.delete(provinceId);
      targetSet.add(provinceId);
    });
  } else {
    directiveWeights = directiveWeightsFor(
      activeCountry,
      isActiveAttacker ? weights.attackerWeight : weights.defenderWeight,
      isActiveAttacker ? weights.defenderWeight : weights.attackerWeight,
      usedNukesByCountryId
    );
    action = pickDirective(directiveWeights, rngState);
    if (action === "nuke") {
      falloutRoll = nextInt(rngState, 1, 10);
      capturedProvinces = bfsConquest([targetCountry.capitalProvinceId], targetSet, falloutRoll, adjacencyMap, targetCountry.capitalProvinceId).capturedProvinceIds;
      incineratedProvinceIds = capturedProvinces;
      capturedProvinces.forEach(provinceId => targetSet.delete(provinceId));
      usedNukesByCountryId[activeCountry.id] = true;
      initiativePenalties[targetCountry.id] = (initiativePenalties[targetCountry.id] ?? 0) - 100;
    } else if (action === "interceptor") {
      activeCountry.interceptorCharges = Math.min(3, activeCountry.interceptorCharges + 1);
    } else if (action === "camp") {
      activeCountry.armyCampsCount += 1;
    } else {
      activeCountry.blitzActions += 1;
    }
  }

  if (war) {
    war.usedNukesByCountryId = usedNukesByCountryId;
    war.initiativePenalties = initiativePenalties;
  }
  attacker.provinces = Array.from(attackerProvinces);
  defender.provinces = Array.from(defenderProvinces);

  return {
    attackerId: attacker.id,
    defenderId: defender.id,
    activeCountryId: activeCountry.id,
    targetCountryId: targetCountry.id,
    roll,
    capturedProvinces,
    incineratedProvinceIds,
    winnerId: attackerProvinces.size === 0 ? defender.id : defenderProvinces.size === 0 ? attacker.id : null,
    action,
    falloutRoll,
    directiveWeights,
  };
}

function captureCleanProvinceBlock(
  startProvinceIds: string[],
  targetProvinceIds: Set<string>,
  amount: number,
  adjacencyMap: Record<string, string[]>,
  provinceInitialCountryIds: Record<string, string>,
  capturingCountryId: string,
  fallbackAnchorProvinceId?: string
) {
  if (amount <= 0) return [];

  const ownOccupiedTargets = new Set(
    Array.from(targetProvinceIds).filter(provinceId => provinceInitialCountryIds[provinceId] === capturingCountryId)
  );
  const captured: string[] = [];
  const firstPass = bfsConquest(startProvinceIds, ownOccupiedTargets, amount, adjacencyMap, fallbackAnchorProvinceId).capturedProvinceIds;
  firstPass.forEach(provinceId => {
    captured.push(provinceId);
    targetProvinceIds.delete(provinceId);
  });

  const remaining = amount - captured.length;
  if (remaining <= 0) return captured;

  const expandedStart = Array.from(new Set([...startProvinceIds, ...captured]));
  const secondPass = bfsConquest(expandedStart, targetProvinceIds, remaining, adjacencyMap, fallbackAnchorProvinceId).capturedProvinceIds;
  return [...captured, ...secondPass];
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
