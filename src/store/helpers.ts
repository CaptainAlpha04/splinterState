import type { Country, ReligiousDenomination } from "../engine/models/country";
import type { Province } from "../engine/models/province";
import type { ActiveWar } from "../engine/models/war";
import type { GovernmentType } from "../engine/models/enums";
import type { PlayerState } from "../engine/models/player";
import type { CapitalRecord } from "../lib/data/loadMapAssets";
import { resolveCombatTurn } from "../engine/mechanics/combatResolution";
import type { CombatOutcome, CombatTurnOutcome } from "../engine/mechanics/combatResolution";
import type { RngState } from "../engine/rng/seededRng";
import type { CampaignScale, CampaignScope, WarBet, WarResult, CampaignStage, TurnResolution, GameState } from "./types";
import { nextInt } from "../engine/rng/seededRng";
import {
  COUNTRY_NAMES,
  FLAGS,
  MAP_COLORS,
  CONTINENT_OVERRIDES,
  REGION_OVERRIDES,
  TICKET_WALLET_KEY,
  BASE_TICKETS,
} from "./constants";
import {
  countryTicketCost,
  modernStrategicPower,
  rebelName,
  controlledDevelopmentScore,
  MODERN_EMPIRES,
  religionModifier,
  religionModifierLabel,
  applyCountryFormation,
  type CountryMetadataIndex,
} from "../engine/content/countryContent";

// Constant from gameStore.ts
export const LONG_WAR_ANNEXATION_THRESHOLD = 0.68;

export function newCampaignRng(createRng: any, createEntropySeed: any) {
  return createRng(createEntropySeed());
}

export function normalizeTicketWallet(tickets: number) {
  return Math.max(500, Math.round(tickets));
}

export function loadTicketWallet() {
  if (typeof window === "undefined") return BASE_TICKETS;
  const stored = window.localStorage.getItem(TICKET_WALLET_KEY);
  const parsed = stored ? Number(stored) : BASE_TICKETS;
  return Number.isFinite(parsed) ? normalizeTicketWallet(parsed) : BASE_TICKETS;
}

export function saveTicketWallet(tickets: number) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(TICKET_WALLET_KEY, String(normalizeTicketWallet(tickets)));
}


export function countryCost(country: Country): number {
  return countryTicketCost(country);
}

export function displayName(countryId: string): string {
  return COUNTRY_NAMES[countryId] ?? countryId;
}

export function flagFor(countryId: string): string {
  return FLAGS[countryId] ?? "⚑";
}

export function initialMapColor(countryId: string) {
  let hash = 0;
  for (let i = 0; i < countryId.length; i += 1) {
    hash = countryId.charCodeAt(i) + ((hash << 5) - hash);
  }
  return MAP_COLORS[Math.abs(hash) % MAP_COLORS.length];
}

export function normalizeRegion(countryId: string, region: string, subregion = "") {
  if (CONTINENT_OVERRIDES[countryId]) return CONTINENT_OVERRIDES[countryId];
  if (region === "Americas") {
    return subregion === "South America" ? "South America" : "North America";
  }
  return region || "Unassigned";
}

export function normalizeSubregion(countryId: string, subregion: string) {
  return REGION_OVERRIDES[countryId] ?? (subregion || "Unassigned");
}

export function strategicPowerFor(countryId: string, metadata: CountryMetadataIndex, provinceCount: number): number {
  return modernStrategicPower(countryId, metadata, provinceCount);
}

export function rebelPowerFor(parent: Country, rebelProvinceCount: number) {
  const share = rebelProvinceCount / Math.max(1, parent.provinces.length);
  return Math.max(10, Math.round(parent.strategicPower * Math.max(0.2, share * 0.7)));
}

export function rebelGovernmentFor(parent: Country): GovernmentType {
  const absorbed = parent.absorbedGovernments.filter(government => government !== parent.government);
  if (absorbed.length > 0) return absorbed[0];
  if (parent.government === "Communism") return "Revolutionary";
  if (parent.government === "Revolutionary") return "Democracy";
  if (parent.government === "Caliphate") return "Revolutionary";
  if (parent.subregion === "Middle East" || parent.subregion === "Northern Africa") return "Caliphate";
  return "Revolutionary";
}

export function rebelReligionFor(parent: Country, government: GovernmentType): ReligiousDenomination {
  if (government === "Communism" || government === "Revolutionary") return "State Atheism";
  if (government === "Caliphate") return parent.religion === "Shia Islam" ? "Shia Islam" : "Sunni Islam";
  return parent.religion;
}

export function rebellionChance(country: Country) {
  if (country.provinces.length < 10) return 0;
  const tier = getCountryTier(country);
  if (tier === "Empire") return Math.min(18, 9 + country.absorbedGovernments.length * 2);
  return 0;
}

export function rebelProvinceCount(country: Country, rngState: RngState) {
  const base = 0.12 + nextInt(rngState, 0, 8) / 100;
  const maxByAbsorbed = Math.max(5, country.largestAbsorbedProvinceCount || 5);
  const desired = Math.round(country.provinces.length * base);
  return Math.max(5, Math.min(country.provinces.length - 1, maxByAbsorbed, desired));
}

export function takeRebelProvinces(country: Country, provinces: Record<string, Province>, rngState: RngState) {
  const desiredCount = rebelProvinceCount(country, rngState);
  const ownedProvinceIds = new Set(country.provinces);
  let bestBlock: string[] = [];

  const shuffledSeeds = [...country.provinces];
  for (let i = shuffledSeeds.length - 1; i > 0; i -= 1) {
    const j = nextInt(rngState, 0, i);
    [shuffledSeeds[i], shuffledSeeds[j]] = [shuffledSeeds[j], shuffledSeeds[i]];
  }

  shuffledSeeds.forEach(seedId => {
    if (seedId === country.capitalProvinceId && country.provinces.length > desiredCount + 4) return;
    const block: string[] = [];
    const visited = new Set<string>([seedId]);
    const queue = [seedId];

    while (queue.length > 0 && block.length < desiredCount) {
      const currentId = queue.shift()!;
      if (ownedProvinceIds.has(currentId)) {
        block.push(currentId);
      }

      const neighbors = provinces[currentId]?.adjacentProvinceIds ?? [];
      neighbors.forEach(neighborId => {
        if (!visited.has(neighborId) && ownedProvinceIds.has(neighborId)) {
          visited.add(neighborId);
          queue.push(neighborId);
        }
      });
    }

    if (block.length > bestBlock.length) {
      bestBlock = block;
    }
  });

  return bestBlock.length >= Math.min(5, desiredCount) ? bestBlock.slice(0, desiredCount) : [];
}

export function connectedOwnedBlocks(provinceIds: string[], provinces: Record<string, Province>) {
  const owned = new Set(provinceIds);
  const visited = new Set<string>();
  const blocks: string[][] = [];

  provinceIds.forEach(seedId => {
    if (visited.has(seedId)) return;
    const block: string[] = [];
    const queue = [seedId];
    visited.add(seedId);

    while (queue.length > 0) {
      const currentId = queue.shift()!;
      block.push(currentId);
      (provinces[currentId]?.adjacentProvinceIds ?? []).forEach(neighborId => {
        if (owned.has(neighborId) && !visited.has(neighborId)) {
          visited.add(neighborId);
          queue.push(neighborId);
        }
      });
    }

    blocks.push(block);
  });

  return blocks.sort((a, b) => b.length - a.length);
}

export function occupiedHomelandBlocks(country: Country, countries: Record<string, Country>, provinces: Record<string, Province>) {
  const provinceIdsByOriginal = new Map<string, string[]>();
  country.provinces.forEach(provinceId => {
    const originalId = provinces[provinceId]?.initialCountryId;
    if (!originalId || originalId === country.baseId || originalId === country.id || originalId === "ATA") return;
    const originalCountry = countries[originalId];
    if (!originalCountry || originalCountry.isAlive) return;
    const list = provinceIdsByOriginal.get(originalId) ?? [];
    list.push(provinceId);
    provinceIdsByOriginal.set(originalId, list);
  });

  return Array.from(provinceIdsByOriginal.entries())
    .map(([originalCountryId, provinceIds]) => {
      const blocks = connectedOwnedBlocks(provinceIds, provinces);
      return {
        originalCountryId,
        provinceIds: blocks[0] ?? [],
        share: provinceIds.length / Math.max(1, countries[originalCountryId]?.initialProvinceCount ?? provinceIds.length),
      };
    })
    .filter(candidate => candidate.provinceIds.length >= 5 && candidate.share >= 0.25)
    .sort((a, b) => b.provinceIds.length - a.provinceIds.length);
}

export function disconnectedEnclaveBlock(country: Country, provinces: Record<string, Province>) {
  const blocks = connectedOwnedBlocks(country.provinces, provinces);
  if (blocks.length <= 1) return null;
  return blocks
    .slice(1)
    .filter(block => block.length >= 5)
    .sort((a, b) => b.length - a.length)[0] ?? null;
}

export function dominantInitialCountryId(provinceIds: string[], provinces: Record<string, Province>) {
  const counts = new Map<string, number>();
  provinceIds.forEach(provinceId => {
    const initialCountryId = provinces[provinceId]?.initialCountryId;
    if (!initialCountryId || initialCountryId === "ATA") return;
    counts.set(initialCountryId, (counts.get(initialCountryId) ?? 0) + 1);
  });
  return Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}

export function buildBreakawayCountry(args: {
  id: string;
  sourceCountry: Country;
  baseCountry: Country | null;
  provinceIds: string[];
  phase: number;
  name: string;
  flag: string;
  government: GovernmentType;
  religion: ReligiousDenomination;
}) {
  const share = args.provinceIds.length / Math.max(1, args.sourceCountry.provinces.length);
  return {
    id: args.id,
    baseId: args.baseCountry?.baseId ?? args.id,
    name: args.name,
    flag: args.flag,
    mapColor: args.baseCountry?.mapColor ?? initialMapColor(args.id),
    provinces: args.provinceIds,
    initialProvinceCount: args.baseCountry?.initialProvinceCount ?? args.provinceIds.length,
    strategicPower: Math.max(10, Math.round((args.baseCountry?.strategicPower ?? args.sourceCountry.strategicPower) * Math.max(0.25, share))),
    population: Math.round((args.baseCountry?.population ?? args.sourceCountry.population) * Math.max(0.1, share)),
    area: Math.round((args.baseCountry?.area ?? args.sourceCountry.area) * Math.max(0.1, share)),
    region: args.baseCountry?.region ?? args.sourceCountry.region,
    subregion: args.baseCountry?.subregion ?? args.sourceCountry.subregion,
    absorbedGovernments: [args.government],
    absorbedCountryIds: [args.baseCountry?.baseId ?? args.id],
    unlockedFormations: [],
    largestAbsorbedProvinceCount: 0,
    campaignPhaseBorn: args.phase,
    capitalProvinceId: args.provinceIds[0],
    government: args.government,
    religion: args.religion,
    specialModifiers: [
      {
        label: "Liberation Front",
        value: 9,
        description: "A country-based independence movement fights on familiar terrain.",
      },
    ],
    armyCampsCount: 0,
    interceptorCharges: 0,
    blitzActions: 0,
    disconnectedPhaseCount: 0,
    eventModifier: 4,
    isAlive: true,
  } satisfies Country;
}

export function eventLabel(modifier: number) {
  if (modifier >= 8) return "Golden mobilization";
  if (modifier >= 4) return "Officer corps rally";
  if (modifier > 0) return "Local initiative";
  if (modifier <= -8) return "State paralysis";
  if (modifier <= -4) return "Supply scandal";
  if (modifier < 0) return "Border unrest";
  return "Quiet front";
}

export function plausibleGovernment(countryId: string): GovernmentType {
  if (["CHN", "CUB", "VNM", "LAO", "PRK"].includes(countryId)) return "Communism";
  if (["SAU", "IRN", "IRQ", "AFG", "PAK", "YEM", "OMN", "ARE", "QAT", "KWT", "SYR", "JOR"].includes(countryId)) return "Caliphate";
  if (["RUS", "KAZ", "BLR", "AZE", "THA", "MMR"].includes(countryId)) return "Aristocracy";
  if (["VEN", "BOL", "NIC", "LBY", "SDN"].includes(countryId)) return "Revolutionary";
  return "Democracy";
}

export function countrySpecialModifiers(countryId: string, strategicPower: number, population: number, area: number) {
  const modifiers = [];
  const developmentBand = strategicPower * 2 + Math.max(0, Math.log10(Math.max(1, population)) - 6) * 20 + Math.max(0, Math.log10(Math.max(1, area)) - 4) * 12;
  if (countryId === "USA") {
    modifiers.push({ label: "Expeditionary Reach", value: 14, description: "Global logistics increase initiative in every theater." });
  } else if (countryId === "RUS") {
    modifiers.push({ label: "Strategic Depth", value: 12, description: "Vast landmass absorbs pressure and sustains campaigns." });
  } else if (countryId === "CHN") {
    modifiers.push({ label: "Industrial Mobilization", value: 13, description: "Dense production base accelerates war tempo." });
  } else if (countryId === "IND") {
    modifiers.push({ label: "Demographic Reserve", value: 10, description: "Population scale reinforces extended conflicts." });
  } else if (countryId === "GBR" || countryId === "JPN") {
    modifiers.push({ label: "Maritime Doctrine", value: 7, description: "Naval posture improves initiative around coasts." });
  } else if (countryId === "BRA" || countryId === "CAN" || countryId === "AUS") {
    modifiers.push({ label: "Resource Hinterland", value: 7, description: "Strategic resources stabilize long wars." });
  } else if (developmentBand >= 185) {
    modifiers.push({ label: "Continental Command", value: 12, description: "Major population, land, and logistics create a continental war machine." });
  } else if (developmentBand >= 150) {
    modifiers.push({ label: "Major Regional Command", value: 10, description: "A serious regional power can mobilize across multiple fronts." });
  } else if (developmentBand >= 115) {
    modifiers.push({ label: "Regional Command", value: 7, description: "Medium-scale administration improves mobilization." });
  } else {
    modifiers.push({ label: "Compact Defense", value: 3, description: "Small territory coordinates defensive response quickly." });
  }
  return modifiers;
}

export function activeCapitalFor(countryId: string, capitals: CapitalRecord[]): CapitalRecord | null {
  return capitals.find(capital => capital.countryId === countryId) ?? null;
}

export function continentForCountry(countryId: string, country: Country | undefined, capital: CapitalRecord | null): string {
  return CONTINENT_OVERRIDES[countryId] ?? country?.region ?? continentFromCapital(capital);
}

export function regionForCountry(countryId: string, country: Country | undefined, capital: CapitalRecord | null): string {
  return REGION_OVERRIDES[countryId] ?? country?.subregion ?? regionFromCapital(capital);
}

export function continentFromCapital(capital: CapitalRecord | null): string {
  if (!capital) return "Unassigned";
  const { latitude, longitude } = capital;
  if (latitude < -55) return "Antarctica";
  if (longitude >= -170 && longitude <= -25 && latitude >= -60) return latitude >= 12 ? "North America" : "South America";
  if (longitude >= -25 && longitude <= 35 && latitude >= 35) return "Europe";
  if (longitude >= 35 && longitude <= 180 && latitude >= -10) return "Asia";
  if (longitude >= -25 && longitude <= 60 && latitude >= -35) return "Africa";
  if (longitude >= 105 && longitude <= 180 && latitude < -10) return "Oceania";
  return "Unassigned";
}

export function regionFromCapital(capital: CapitalRecord | null): string {
  if (!capital) return "Unassigned";
  const continent = continentFromCapital(capital);
  if (continent === "North America") return capital.longitude < -100 ? "Western North America" : "Eastern North America";
  if (continent === "South America") return capital.latitude < -20 ? "Southern South America" : "Northern South America";
  if (continent === "Europe") return capital.longitude < 15 ? "Western Europe" : "Eastern Europe";
  if (continent === "Africa") return capital.latitude >= 0 ? "North Africa" : "Sub-Saharan Africa";
  if (continent === "Asia") return capital.longitude < 65 ? "Middle East" : capital.longitude < 90 ? "Central Asia" : capital.longitude < 115 ? "South Asia" : "East Asia";
  if (continent === "Oceania") return "Oceania";
  return continent;
}

export function scopeBounds(countryIds: string[], capitals: CapitalRecord[]) {
  const scopedCapitals = capitals.filter(capital => countryIds.includes(capital.countryId));
  if (scopedCapitals.length === 0) {
    return { minX: -180, maxX: 180, minY: -55, maxY: 85 };
  }

  const longitudes = scopedCapitals.map(capital => capital.longitude);
  const latitudes = scopedCapitals.map(capital => capital.latitude);
  return {
    minX: Math.max(-180, Math.min(...longitudes) - 18),
    maxX: Math.min(180, Math.max(...longitudes) + 18),
    minY: Math.max(-55, Math.min(...latitudes) - 14),
    maxY: Math.min(85, Math.max(...latitudes) + 14),
  };
}

export function buildScope(scale: CampaignScale, selectedCountryId: string | null, countries: Record<string, Country>, capitals: CapitalRecord[]): CampaignScope {
  const aliveCountryIds = Object.values(countries)
    .filter(country => country.isAlive && country.id !== "ATA")
    .map(country => country.id);

  if (scale === "World War" || !selectedCountryId) {
    return {
      scale,
      label: scale === "World War" ? "World" : "Pick an anchor country",
      eligibleCountryIds: aliveCountryIds,
      bounds: { minX: -180, maxX: 180, minY: -55, maxY: 85 },
    };
  }

  const selectedCapital = activeCapitalFor(selectedCountryId, capitals);
  const classifier = scale === "Continent War" ? continentForCountry : regionForCountry;
  const label = classifier(selectedCountryId, countries[selectedCountryId], selectedCapital);
  const eligibleCountryIds = aliveCountryIds.filter(countryId => classifier(countryId, countries[countryId], activeCapitalFor(countryId, capitals)) === label);

  return {
    scale,
    label,
    eligibleCountryIds,
    bounds: scopeBounds(eligibleCountryIds, capitals),
  };
}

export function syncProvinceOwners(provinces: Record<string, Province>, countries: Record<string, Country>) {
  const nextProvinces = { ...provinces };
  Object.values(countries).forEach(country => {
    country.provinces.forEach(provinceId => {
      const province = nextProvinces[provinceId];
      if (province) {
        nextProvinces[provinceId] = { ...province, ownerId: country.id };
      }
    });
  });
  return nextProvinces;
}

export function provinceList(provinceIds: string[], provinces: Record<string, Province>) {
  if (provinceIds.length === 0) return "no provinces";
  const names = provinceIds.slice(0, 3).map(provinceId => provinces[provinceId]?.name ?? provinceId);
  const suffix = provinceIds.length > 3 ? ` and ${provinceIds.length - 3} more` : "";
  return `${names.join(", ")}${suffix}`;
}

export function describeCombatTurn(turn: CombatTurnOutcome, countries: Record<string, Country>, provinces: Record<string, Province>) {
  const active = countries[turn.activeCountryId]?.name ?? turn.activeCountryId;
  const target = countries[turn.targetCountryId]?.name ?? turn.targetCountryId;
  const taken = provinceList(turn.capturedProvinces, provinces);
  const interceptPrefix = turn.interceptedByCountryId
    ? `${countries[turn.interceptedByCountryId]?.name ?? turn.interceptedByCountryId} intercepted a +${turn.interceptedRoll ?? 0} conquest roll and forced a re-spin. `
    : "";
  const blitzSuffix = typeof turn.blitzRoll === "number" ? ` Blitz action chained a secondary ${turn.blitzRoll > 0 ? "+" : ""}${turn.blitzRoll} roll.` : "";

  if (turn.action === "camp") {
    return `${interceptPrefix}${active} rolled 0 and built an army camp for a permanent +25 initiative.${blitzSuffix}`;
  }

  if (turn.action === "interceptor") {
    return `${interceptPrefix}${active} rolled 0 and gained 1 interceptor charge.${blitzSuffix}`;
  }

  if (turn.action === "support") {
    return `${interceptPrefix}${active} rolled 0 and rallied public support, banking 1 blitz action.${blitzSuffix}`;
  }

  if (turn.action === "nuke") {
    return `${interceptPrefix}${active} rolled 0, launched its once-per-war tactical nuke at ${target}'s capital, fallout rolled ${turn.falloutRoll ?? 0}, burned ${turn.incineratedProvinceIds.length} province(s), and inflicted -100 war initiative: ${taken}.${blitzSuffix}`;
  }

  if (turn.action === "counter") {
    return `${interceptPrefix}${active} pressed into ${target}, rolled ${turn.roll}, and counter operations cost it ${turn.capturedProvinces.length} province(s): ${taken}.${blitzSuffix}`;
  }

  return `${interceptPrefix}${active} attacked ${target}, rolled +${turn.roll}, and captured ${turn.capturedProvinces.length} province(s): ${taken}.${blitzSuffix}`;
}

export function dominantWarCountry(attacker: Country, defender: Country) {
  const attackerScore = controlledDevelopmentScore(attacker) * 1.2 + attacker.provinces.length * 8 + attacker.strategicPower * 2;
  const defenderScore = controlledDevelopmentScore(defender) * 1.2 + defender.provinces.length * 8 + defender.strategicPower * 2;
  return attackerScore >= defenderScore ? attacker.id : defender.id;
}

export function warPowerScore(country: Country, enemy: Country) {
  const development = controlledDevelopmentScore(country);
  const territory = country.provinces.length * 7;
  const capitalPressure = country.provinces.includes(enemy.capitalProvinceId) ? 35 : 0;
  return development * 1.25 + territory + country.strategicPower * 2 + capitalPressure;
}

export function warDominance(attacker: Country, defender: Country) {
  const attackerScore = warPowerScore(attacker, defender);
  const defenderScore = warPowerScore(defender, attacker);
  const total = Math.max(1, attackerScore + defenderScore);
  const attackerShare = attackerScore / total;
  const defenderShare = defenderScore / total;
  return attackerShare >= defenderShare
    ? { countryId: attacker.id, share: attackerShare }
    : { countryId: defender.id, share: defenderShare };
}

export function incineratedInWar(turns: CombatTurnOutcome[]) {
  return Array.from(new Set(turns.flatMap(turn => turn.incineratedProvinceIds)));
}

export function diceOnlyLog(turn: CombatTurnOutcome, countries: Record<string, Country>) {
  const active = countries[turn.activeCountryId]?.name ?? turn.activeCountryId;
  const target = countries[turn.targetCountryId]?.name ?? turn.targetCountryId;
  const roll = turn.roll > 0 ? `+${turn.roll}` : String(turn.roll);
  if (turn.roll === 0) return `${active} rolled 0. Special orders are resolving against ${target}.`;
  return `${active} rolled ${roll}. Orders are resolving against ${target}.`;
}

export function controlledCountryIdsAtThreshold(
  country: Country,
  countries: Record<string, Country>,
  provinces: Record<string, Province>,
  threshold = 0.7
) {
  const controlledByOrigin = new Map<string, number>();
  country.provinces.forEach(provinceId => {
    const initialCountryId = provinces[provinceId]?.initialCountryId;
    if (!initialCountryId || initialCountryId === "ATA") return;
    controlledByOrigin.set(initialCountryId, (controlledByOrigin.get(initialCountryId) ?? 0) + 1);
  });

  return Array.from(controlledByOrigin.entries())
    .filter(([countryId, count]) => {
      const originalFootprint = countries[countryId]?.initialProvinceCount ?? 0;
      return originalFootprint > 0 && count / originalFootprint >= threshold;
    })
    .map(([countryId]) => countryId);
}

export function isIndependenceWar(war: ActiveWar) {
  return war.id.includes("_liberation_") || war.id.includes("_enclave_");
}

export function isRebelWar(war: ActiveWar) {
  return isIndependenceWar(war) || war.id.includes("_civil_");
}

export function rebelLeadershipSignature(country: Country) {
  return [
    country.id,
    country.name,
    country.government,
    country.religion,
    country.unlockedFormations.join("|"),
  ].join("::");
}

export function rebelSuppressionKey(overlord: Country, rebelIdentity: string) {
  return `${rebelLeadershipSignature(overlord)}=>${rebelIdentity}`;
}

export function isRebelSuppressed(suppressedRebelKeys: Record<string, true>, overlord: Country, rebelIdentity: string) {
  return Boolean(suppressedRebelKeys[rebelSuppressionKey(overlord, rebelIdentity)]);
}

export function reclaimedIndependenceProvinces(winner: Country, loser: Country, provinces: Record<string, Province>) {
  const homeland = Object.values(provinces)
    .filter(p => (p.ownerId === loser.id || loser.provinces.includes(p.id)) && p.initialCountryId === winner.baseId)
    .map(p => p.id);
  if (homeland.length > 0) return homeland;
  return [];
}

export function campaignFavoriteRank(favoriteId: string | null, winnerId: string | null, completedWarResults: WarResult[]) {
  if (!favoriteId || !winnerId) return null;
  if (favoriteId === winnerId) return 1;
  const eliminatedOrder = completedWarResults
    .map(result => result.loserId)
    .filter((loserId): loserId is string => Boolean(loserId));
  const eliminationIndex = eliminatedOrder.indexOf(favoriteId);
  if (eliminationIndex < 0) return null;
  const survivorsAfterFavorite = eliminatedOrder.length - eliminationIndex;
  return survivorsAfterFavorite + 1;
}

export function campaignFavoritePlacement(favoriteId: string | null, winnerId: string | null, placements: Record<string, number>) {
  if (!favoriteId) return null;
  if (favoriteId === winnerId) return 1;
  return placements[favoriteId] ?? null;
}

export function campaignPayoutForRank(stake: number, rank: number | null) {
  if (stake <= 0 || !rank || rank > 3) return 0;
  if (rank === 1) return stake * 2;
  if (rank === 2) return Math.round(stake * 1.5);
  return stake;
}

export function campaignConclusionLog(rank: number | null, payout: number, favorite: Country | null | undefined) {
  if (!favorite) return "Campaign ended without a favorite payout.";
  if (rank === 1) return `${favorite.name} ranked first. Campaign payout: ${payout} tickets.`;
  if (rank === 2) return `${favorite.name} ranked second. Campaign payout: ${payout} tickets.`;
  if (rank === 3) return `${favorite.name} ranked third. Campaign stake returned: ${payout} tickets.`;
  return `${favorite.name} fell outside the top three. Campaign stake lost.`;
}

export function getCountryCost(country: Country): number {
  return countryCost(country);
}

export function getCountryTier(country: Country) {
  const development = controlledDevelopmentScore(country);
  const absorbedScale = country.absorbedCountryIds.length;
  const conqueredScale = Math.max(0, country.provinces.length - country.initialProvinceCount);
  if (development >= 820 && country.provinces.length >= 220 && absorbedScale >= 8) return "Hegemon";
  if (MODERN_EMPIRES.has(country.baseId) && country.campaignPhaseBorn === 0) return "Empire";
  if (country.unlockedFormations.length > 0 && development >= 360 && country.provinces.length >= 55) return "Empire";
  if (development >= 520 && country.provinces.length >= 95 && absorbedScale >= 3) return "Empire";
  if (conqueredScale >= 90 && development >= 470 && absorbedScale >= 2) return "Empire";
  return "Kingdom";
}

export function getCountrySpecialModifierTotal(country: Country) {
  return country.specialModifiers.reduce((total, modifier) => total + modifier.value, 0);
}

export function getCountryDevelopmentScore(country: Country) {
  return controlledDevelopmentScore(country);
}

export function getCountryReligionModifier(country: Country) {
  return religionModifier(country.religion);
}

export function getCountryReligionModifierLabel(country: Country) {
  return religionModifierLabel(country.religion);
}

export function resolveWarTurnState(state: GameState, war: ActiveWar, logs: string[]): TurnResolution {
  const attacker = { ...state.countries[war.attackerId] };
  const defender = { ...state.countries[war.defenderId] };
  const adjacencyMap: Record<string, string[]> = {};
  const provinceInitialCountryIds: Record<string, string> = {};
  Object.values(state.provinces).forEach(province => {
    adjacencyMap[province.id] = province.adjacentProvinceIds;
    provinceInitialCountryIds[province.id] = province.initialCountryId;
  });

  const rngState = { ...state.rngState };
  const activeWar = {
    ...war,
    usedNukesByCountryId: { ...(war.usedNukesByCountryId ?? {}) },
    initiativePenalties: { ...(war.initiativePenalties ?? {}) },
  };
  const turn = resolveCombatTurn(attacker, defender, adjacencyMap, rngState, provinceInitialCountryIds, activeWar);
  const countries = {
    ...state.countries,
    [attacker.id]: attacker,
    [defender.id]: defender,
  };
  let activeWars = state.activeWars.map(candidate => candidate.id === war.id ? activeWar : candidate);
  let player = state.player;
  let stage: CampaignStage = "Combat";
  let currentBet = state.currentBet;
  let selectedWarId = state.selectedWarId;
  const warTurns = {
    ...state.warTurns,
    [war.id]: [...(state.warTurns[war.id] ?? []), turn],
  };
  let completedWarResults = state.completedWarResults;
  let countryPlacements = state.countryPlacements;
  let suppressedRebelKeys = state.suppressedRebelKeys;
  let lastCombatOutcome = state.lastCombatOutcome;
  const turnsForWar = warTurns[war.id];
  const dominance = turnsForWar.length >= 150 ? warDominance(countries[war.attackerId], countries[war.defenderId]) : null;
  const resolvedWinnerId = turn.winnerId ?? (dominance && dominance.share >= LONG_WAR_ANNEXATION_THRESHOLD ? dominance.countryId : null);
  const endedByDominance = !turn.winnerId && Boolean(resolvedWinnerId);
  const endedByStalemate = !turn.winnerId && !resolvedWinnerId && Boolean(dominance);

  logs.push(describeCombatTurn(turn, countries, state.provinces));

  if (resolvedWinnerId) {
    const loserId = resolvedWinnerId === attacker.id ? defender.id : attacker.id;
    const crushedRebelIdentity = isRebelWar(war) && loserId === war.defenderId ? state.countries[war.defenderId]?.baseId ?? war.defenderId : null;
    const independenceVictory = isIndependenceWar(war) && resolvedWinnerId === defender.id;
    if (independenceVictory) {
      const winner = countries[resolvedWinnerId];
      const loser = countries[loserId];
      const reclaimed = reclaimedIndependenceProvinces(winner, loser, state.provinces);
      countries[resolvedWinnerId] = {
        ...winner,
        provinces: Array.from(new Set([...winner.provinces, ...reclaimed])),
        eventModifier: Math.max(winner.eventModifier, winner.eventModifier + 4),
      };
      countries[loserId] = {
        ...loser,
        provinces: loser.provinces.filter(provinceId => !reclaimed.includes(provinceId)),
        eventModifier: Math.min(loser.eventModifier, loser.eventModifier - 4),
      };
      const activeWarBets = new Map(state.player.activeWarBets);
      const bet = activeWarBets.get(war.id) ?? null;
      activeWarBets.delete(war.id);
      const wonBet = bet ? bet.predictedWinnerId === resolvedWinnerId : null;
      const nextTickets = bet
        ? (wonBet ? state.player.tickets + bet.amount * 2 : state.player.tickets - bet.amount)
        : state.player.tickets;
      const result: WarResult = {
        warId: war.id,
        winnerId: resolvedWinnerId,
        loserId,
        bet,
        wonBet,
        turns: warTurns[war.id],
        formationName: null,
      };
      completedWarResults = [...state.completedWarResults, result];
      activeWars = state.activeWars.filter(candidate => candidate.id !== war.id);
      player = { ...state.player, tickets: Math.max(0, nextTickets), activeWarBets };
      saveTicketWallet(player.tickets);
      currentBet = null;
      selectedWarId = activeWars[0]?.id ?? null;
      lastCombatOutcome = {
        attackerId: attacker.id,
        defenderId: defender.id,
        winnerId: resolvedWinnerId,
        rounds: warTurns[war.id].map(round => ({
          activeCountryId: round.activeCountryId,
          roll: round.roll,
          capturedProvinces: round.capturedProvinces,
        })),
      };
      logs.push(`${countries[resolvedWinnerId].name} won its independence war after ${warTurns[war.id].length} rolls and reclaimed ${reclaimed.length} homeland province(s).`);
      if (bet) {
        logs.push(wonBet ? `Bet won. Payout: ${bet.amount * 2} tickets.` : `Bet lost. Stake forfeited: ${bet.amount} tickets.`);
      }
      stage = activeWars.length > 0 ? "WarSelection" : "CombatResult";
    } else {
      const winner = countries[resolvedWinnerId];
      const loser = countries[loserId];
      const loserStartingProvinceCount = state.countries[loserId]?.provinces.length ?? loser.provinces.length;
      const loserProvincesFromState = Object.values(state.provinces)
        .filter(p => p.ownerId === loserId)
        .map(p => p.id);
      const mergedProvinces = Array.from(new Set([...winner.provinces, ...loser.provinces, ...loserProvincesFromState]));

      const inheritedGovernments = Array.from(new Set([...winner.absorbedGovernments, loser.government, ...loser.absorbedGovernments]));
      const controlledAtThreshold = controlledCountryIdsAtThreshold(winner, countries, state.provinces, 0.7);
      const inheritedCountryIds = Array.from(new Set([...winner.absorbedCountryIds, loser.baseId, ...loser.absorbedCountryIds, ...controlledAtThreshold]));
      const enforcedReligion = winner.religion;
      const formationResult = applyCountryFormation({
        ...winner,
        provinces: mergedProvinces,
        armyCampsCount: winner.armyCampsCount + loser.armyCampsCount,
        population: winner.population + loser.population,
        area: winner.area + loser.area,
        religion: enforcedReligion,
        absorbedGovernments: inheritedGovernments,
        absorbedCountryIds: inheritedCountryIds,
        largestAbsorbedProvinceCount: Math.max(winner.largestAbsorbedProvinceCount, loser.largestAbsorbedProvinceCount, loserStartingProvinceCount),
        strategicPower: Math.max(winner.strategicPower, winner.strategicPower + Math.max(1, Math.round(loser.strategicPower * 0.12))),
      }, countries);

      countries[resolvedWinnerId] = formationResult.country;
      countries[loserId] = { ...loser, isAlive: false, provinces: [] };
      if (crushedRebelIdentity) {
        suppressedRebelKeys = {
          ...suppressedRebelKeys,
          [rebelSuppressionKey(winner, crushedRebelIdentity)]: true,
          [rebelSuppressionKey(formationResult.country, crushedRebelIdentity)]: true,
        };
        logs.push(`${formationResult.country.name} crushed ${loser.name}; this rebel line will not rise again under the current leadership.`);
      }
      const aliveAfterElimination = state.campaignScope
        ? state.campaignScope.eligibleCountryIds.filter(countryId => countries[countryId]?.isAlive && countryId !== loserId).length
        : Object.values(countries).filter(country => country.isAlive && country.id !== loserId).length;
      countryPlacements = {
        ...state.countryPlacements,
        [loserId]: Math.max(2, aliveAfterElimination + 1),
      };
      const activeWarBets = new Map(state.player.activeWarBets);
      const bet = activeWarBets.get(war.id) ?? null;
      activeWarBets.delete(war.id);
      const wonBet = bet ? bet.predictedWinnerId === resolvedWinnerId : null;
      const nextTickets = bet
        ? (wonBet ? state.player.tickets + bet.amount * 2 : state.player.tickets - bet.amount)
        : state.player.tickets;
      const result: WarResult = {
        warId: war.id,
        winnerId: resolvedWinnerId,
        loserId,
        bet,
        wonBet,
        turns: warTurns[war.id],
        formationName: formationResult.formationName,
      };

      completedWarResults = [...state.completedWarResults, result];
      activeWars = state.activeWars.filter(candidate => candidate.id !== war.id);
      activeWars = activeWars
        .map(w => {
          if (w.defenderId === loserId) {
            logs.push(`⚠️ Target shift: Since ${loser.name} was eliminated, ${countries[w.attackerId]?.name || w.attackerId} now targets ${countries[resolvedWinnerId]?.name || resolvedWinnerId} (who absorbed them).`);
            return {
              ...w,
              defenderId: resolvedWinnerId,
            };
          }
          return w;
        })
        .filter(w => {
          const attackerAlive = countries[w.attackerId]?.isAlive;
          if (!attackerAlive) {
            logs.push(`⚠️ War cancelled: ${countries[w.attackerId]?.name || w.attackerId} was eliminated, cancelling their attack on ${countries[w.defenderId]?.name || w.defenderId}.`);
          }
          return attackerAlive;
        });
      player = { ...state.player, tickets: Math.max(0, nextTickets), activeWarBets };
      saveTicketWallet(player.tickets);
      currentBet = null;
      selectedWarId = activeWars[0]?.id ?? null;
      lastCombatOutcome = {
        attackerId: attacker.id,
        defenderId: defender.id,
        winnerId: resolvedWinnerId,
        rounds: warTurns[war.id].map(round => ({
          activeCountryId: round.activeCountryId,
          roll: round.roll,
          capturedProvinces: round.capturedProvinces,
        })),
      };
      logs.push(`${countries[resolvedWinnerId].name} won the war after ${warTurns[war.id].length} rolls${endedByDominance ? " by dominance" : ""}.`);
      if (formationResult.formationName) {
        logs.push(`${countries[resolvedWinnerId].name} proclaimed a new national destiny: ${formationResult.formationName}.`);
      }
      if (winner.religion !== loser.religion) {
        logs.push(`${countries[resolvedWinnerId].name} enforced ${enforcedReligion} across annexed ${loser.name} territories.`);
      }
      if (bet) {
        logs.push(wonBet ? `Bet won. Payout: ${bet.amount * 2} tickets.` : `Bet lost. Stake forfeited: ${bet.amount} tickets.`);
        if (nextTickets <= 0) {
          logs.push("Wallet is empty. Next bets must be earned from future payouts or safety-net rules.");
        }
      }
      stage = activeWars.length > 0 ? "WarSelection" : "CombatResult";
    }
  } else if (endedByStalemate && dominance) {
    const activeWarBets = new Map(state.player.activeWarBets);
    const bet = activeWarBets.get(war.id) ?? null;
    activeWarBets.delete(war.id);
    const result: WarResult = {
      warId: war.id,
      winnerId: null,
      loserId: null,
      bet,
      wonBet: null,
      turns: warTurns[war.id],
    };

    completedWarResults = [...state.completedWarResults, result];
    activeWars = state.activeWars.filter(candidate => candidate.id !== war.id);
    player = { ...state.player, activeWarBets };
    currentBet = null;
    selectedWarId = activeWars[0]?.id ?? null;
    lastCombatOutcome = {
      attackerId: attacker.id,
      defenderId: defender.id,
      winnerId: null,
      rounds: warTurns[war.id].map(round => ({
        activeCountryId: round.activeCountryId,
        roll: round.roll,
        capturedProvinces: round.capturedProvinces,
      })),
    };
    logs.push(`${attacker.name} and ${defender.name} reached a 150-roll border settlement. ${countries[dominance.countryId].name} led at ${Math.round(dominance.share * 100)}%, below the ${Math.round(LONG_WAR_ANNEXATION_THRESHOLD * 100)}% annexation threshold.`);
    if (bet) {
      logs.push(`War bet on ${state.countries[bet.predictedWinnerId]?.name ?? bet.predictedWinnerId} was returned after stalemate.`);
    }
    stage = activeWars.length > 0 ? "WarSelection" : "CombatResult";
  }

  const provinces = syncProvinceOwners(state.provinces, countries);
  turn.incineratedProvinceIds.forEach(provinceId => {
    const province = provinces[provinceId];
    if (province) {
      provinces[provinceId] = { ...province, isIncinerated: true };
    }
  });
  if (resolvedWinnerId) {
    incineratedInWar(warTurns[war.id]).forEach(provinceId => {
      const province = provinces[provinceId];
      if (province) {
        provinces[provinceId] = { ...province, isIncinerated: false };
      }
    });
  }

  return {
    countries,
    provinces,
    rngState,
    activeWars,
    selectedWarId,
    currentBet,
    lastCombatOutcome,
    player,
    warTurns,
    completedWarResults,
    countryPlacements,
    suppressedRebelKeys,
    stage,
    logs,
    turn,
  };
}

export function getValidTargetsForCountry(
  countryId: string,
  countries: Record<string, Country>,
  provinces: Record<string, Province>,
  eligibleCountryIds: string[],
  capitals: CapitalRecord[] = []
): string[] {
  const country = countries[countryId];
  if (!country || !country.isAlive) return [];

  const eligibleSet = new Set(eligibleCountryIds);
  const ownerByProvinceId = new Map<string, string>();
  Object.values(countries).forEach(c => {
    if (!c.isAlive) return;
    c.provinces.forEach(provId => ownerByProvinceId.set(provId, c.id));
  });

  // Collect land neighbors
  const neighborCountryIds = new Set<string>();
  country.provinces.forEach(provId => {
    const prov = provinces[provId];
    if (!prov || prov.isIncinerated) return;
    prov.adjacentProvinceIds.forEach(adjId => {
      const adjacentProvince = provinces[adjId];
      if (adjacentProvince?.isIncinerated) return;
      const ownerId = ownerByProvinceId.get(adjId);
      if (ownerId && ownerId !== countryId && countries[ownerId]?.isAlive && eligibleSet.has(ownerId)) {
        neighborCountryIds.add(ownerId);
      }
    });
  });

  if (neighborCountryIds.size > 0) {
    return Array.from(neighborCountryIds);
  }

  // If isolated (e.g. islands), find naval targets within scope
  const attackerCapital = capitals.find(capital => capital.countryId === countryId);
  if (!attackerCapital) return [];

  const availableCountries = Object.values(countries).filter(
    c => c.isAlive && c.id !== countryId && eligibleSet.has(c.id)
  );

  const candidates = availableCountries
    .map(c => {
      const targetCapital = capitals.find(capital => capital.countryId === c.id);
      const dist = targetCapital
        ? (function capitalDistance(a: CapitalRecord, b: CapitalRecord) {
            const toRadians = (val: number) => val * Math.PI / 180;
            const earthKm = 6371;
            const dLat = toRadians(b.latitude - a.latitude);
            const dLon = toRadians(b.longitude - a.longitude);
            const lat1 = toRadians(a.latitude);
            const lat2 = toRadians(b.latitude);
            const h =
              Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1) * Math.cos(lat2) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
            return 2 * earthKm * Math.asin(Math.min(1, Math.sqrt(h)));
          })(attackerCapital, targetCapital)
        : Number.POSITIVE_INFINITY;
      return { countryId: c.id, distance: dist };
    })
    .filter(candidate => Number.isFinite(candidate.distance))
    .sort((a, b) => a.distance - b.distance);

  const nearby = candidates.filter(candidate => candidate.distance <= 10000);
  return (nearby.length > 0 ? nearby : candidates).slice(0, 12).map(c => c.countryId);
}


