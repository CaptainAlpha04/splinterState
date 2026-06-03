import { create } from "zustand";
import type { Country, ReligiousDenomination } from "../engine/models/country";
import type { GovernmentType } from "../engine/models/enums";
import type { Province } from "../engine/models/province";
import type { ActiveWar } from "../engine/models/war";
import type { PlayerState } from "../engine/models/player";
import { governmentModifier } from "../engine/rules/modifiers";
import { loadMapAssets, type CapitalRecord } from "../lib/data/loadMapAssets";
import { runMatchmaking } from "../engine/mechanics/matchmaker";
import { countryWheelBreakdown } from "../engine/mechanics/initiativeWheel";
import { resolveCombat, resolveCombatTurn, type CombatOutcome, type CombatTurnOutcome } from "../engine/mechanics/combatResolution";
import { createEntropySeed, createRng, nextInt, type RngState } from "../engine/rng/seededRng";
import {
  MODERN_EMPIRES,
  applyCountryFormation,
  buildMetadataIndex,
  controlledDevelopmentScore,
  countryTicketCost,
  metadataFlag,
  metadataName,
  metadataRegion,
  metadataSubregion,
  modernStrategicPower,
  religionForCountry,
  religionModifier,
  religionModifierLabel,
  rebelName,
  type CountryMetadataIndex,
} from "../engine/content/countryContent";

export type CampaignScale = "World War" | "Continent War" | "Regional War";
export type CampaignStage =
  | "PickScope"
  | "PickFavorite"
  | "EventHorizon"
  | "WarSelection"
  | "Betting"
  | "Combat"
  | "CombatResult"
  | "CampaignWon"
  | "GameOver";

export type CampaignScope = {
  scale: CampaignScale;
  label: string;
  eligibleCountryIds: string[];
  bounds: { minX: number; maxX: number; minY: number; maxY: number };
};

export type WarBet = {
  warId: string;
  predictedWinnerId: string;
  amount: number;
};

export type WarResult = {
  warId: string;
  winnerId: string | null;
  loserId: string | null;
  bet: WarBet | null;
  wonBet: boolean | null;
  turns: CombatTurnOutcome[];
  formationName?: string | null;
};

export type GameState = {
  isLoaded: boolean;
  stage: CampaignStage;
  countries: Record<string, Country>;
  provinces: Record<string, Province>;
  capitals: CapitalRecord[];
  activeWars: ActiveWar[];
  player: PlayerState;
  logs: string[];
  selectedProvinceId: string | null;
  selectedCountryId: string | null;
  selectedWarId: string | null;
  campaignScope: CampaignScope | null;
  currentBet: WarBet | null;
  lastCombatOutcome: CombatOutcome | null;
  warTurns: Record<string, CombatTurnOutcome[]>;
  completedWarResults: WarResult[];
  countryPlacements: Record<string, number>;
  suppressedRebelKeys: Record<string, true>;
  campaignPhase: number;
  forcedWars: ActiveWar[];
  rngState: RngState;
  isResolvingTurn: boolean;
  isAutoPlaying: boolean;
  autoSpeed: number;

  initializeGame: () => Promise<void>;
  selectProvince: (provinceId: string | null) => void;
  selectCountry: (countryId: string | null) => void;
  setCampaignScale: (scale: CampaignScale) => void;
  chooseFavorite: (countryId: string) => void;
  rollCampaignEvents: () => void;
  generateWars: () => void;
  selectWar: (warId: string) => void;
  placeWarBet: (predictedWinnerId: string, amount: number) => void;
  rollSelectedWarTurn: () => void;
  skipSelectedWar: () => void;
  skipAllWars: () => void;
  autoResolveSelectedWarChunk: () => void;
  toggleAutoPlay: () => void;
  setAutoSpeed: (speed: number) => void;
  continueAfterWar: () => void;
  resolveSelectedWar: () => void;
  resetCampaign: () => void;
};

function newCampaignRng() {
  return createRng(createEntropySeed());
}

const TICKET_WALLET_KEY = "splinter-states-ticket-wallet";
const BASE_TICKETS = 500;

function normalizeTicketWallet(tickets: number) {
  return Math.max(BASE_TICKETS, Math.round(tickets));
}

function loadTicketWallet() {
  if (typeof window === "undefined") return BASE_TICKETS;
  const stored = window.localStorage.getItem(TICKET_WALLET_KEY);
  const parsed = stored ? Number(stored) : BASE_TICKETS;
  return Number.isFinite(parsed) ? normalizeTicketWallet(parsed) : BASE_TICKETS;
}

function saveTicketWallet(tickets: number) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(TICKET_WALLET_KEY, String(normalizeTicketWallet(tickets)));
}
const COUNTRY_NAMES: Record<string, string> = {
  USA: "United States",
  RUS: "Russia",
  CHN: "China",
  IND: "India",
  BRA: "Brazil",
  CAN: "Canada",
  MEX: "Mexico",
  GBR: "United Kingdom",
  FRA: "France",
  DEU: "Germany",
  ITA: "Italy",
  ESP: "Spain",
  PRT: "Portugal",
  NLD: "Netherlands",
  BEL: "Belgium",
  CHE: "Switzerland",
  AUT: "Austria",
  POL: "Poland",
  UKR: "Ukraine",
  TUR: "Turkey",
  IRN: "Iran",
  IRQ: "Iraq",
  SAU: "Saudi Arabia",
  PAK: "Pakistan",
  AFG: "Afghanistan",
  JPN: "Japan",
  KOR: "South Korea",
  PRK: "North Korea",
  IDN: "Indonesia",
  AUS: "Australia",
  ZAF: "South Africa",
  EGY: "Egypt",
  NGA: "Nigeria",
  ETH: "Ethiopia",
  ARG: "Argentina",
  CHL: "Chile",
  COL: "Colombia",
  PER: "Peru",
  VEN: "Venezuela",
  CUB: "Cuba",
  VNM: "Vietnam",
  THA: "Thailand",
  MMR: "Myanmar",
  KAZ: "Kazakhstan",
};

const FLAGS: Record<string, string> = {
  USA: "🇺🇸",
  RUS: "🇷🇺",
  CHN: "🇨🇳",
  IND: "🇮🇳",
  BRA: "🇧🇷",
  CAN: "🇨🇦",
  MEX: "🇲🇽",
  GBR: "🇬🇧",
  FRA: "🇫🇷",
  DEU: "🇩🇪",
  ITA: "🇮🇹",
  ESP: "🇪🇸",
  PRT: "🇵🇹",
  NLD: "🇳🇱",
  BEL: "🇧🇪",
  CHE: "🇨🇭",
  AUT: "🇦🇹",
  POL: "🇵🇱",
  UKR: "🇺🇦",
  TUR: "🇹🇷",
  IRN: "🇮🇷",
  IRQ: "🇮🇶",
  SAU: "🇸🇦",
  PAK: "🇵🇰",
  AFG: "🇦🇫",
  JPN: "🇯🇵",
  KOR: "🇰🇷",
  PRK: "🇰🇵",
  IDN: "🇮🇩",
  AUS: "🇦🇺",
  ZAF: "🇿🇦",
  EGY: "🇪🇬",
  NGA: "🇳🇬",
  ETH: "🇪🇹",
  ARG: "🇦🇷",
  CHL: "🇨🇱",
  COL: "🇨🇴",
  PER: "🇵🇪",
  VEN: "🇻🇪",
  CUB: "🇨🇺",
  VNM: "🇻🇳",
  THA: "🇹🇭",
  MMR: "🇲🇲",
  KAZ: "🇰🇿",
};

const STRATEGIC_POWER: Record<string, number> = {
  USA: 110,
  CHN: 106,
  RUS: 98,
  IND: 90,
  BRA: 70,
  CAN: 66,
  AUS: 62,
  JPN: 60,
  DEU: 58,
  FRA: 56,
  GBR: 55,
  TUR: 50,
  IRN: 48,
  IDN: 48,
  MEX: 47,
  KOR: 45,
  SAU: 44,
  PAK: 43,
  ARG: 42,
  ZAF: 40,
  EGY: 39,
  NGA: 38,
  ITA: 38,
  ESP: 36,
  POL: 35,
  UKR: 35,
  KAZ: 34,
  COL: 32,
  ETH: 32,
  THA: 31,
  VNM: 31,
  MMR: 28,
  PER: 28,
  CHL: 26,
  VEN: 26,
  CUB: 22,
  ECU: 18,
};

function countryCost(country: Country): number {
  return countryTicketCost(country);
}

function displayName(countryId: string): string {
  return COUNTRY_NAMES[countryId] ?? countryId;
}

function flagFor(countryId: string): string {
  return FLAGS[countryId] ?? "⚑";
}

const MAP_COLORS = [
  "#2f5f8f", "#8e4f9f", "#2f7b4a", "#a66f2c", "#5f64a7", "#a34338",
  "#3d897c", "#897742", "#7a4f7f", "#4f7c9e", "#76934a", "#9a5a66",
  "#4d7350", "#8b6b3d", "#b4557a", "#528c5d", "#456fa3", "#a15d3a",
  "#6f5eb0", "#3f8f95", "#9b8045", "#8a5171", "#597d3f", "#386b74",
];

function initialMapColor(countryId: string) {
  let hash = 0;
  for (let i = 0; i < countryId.length; i += 1) {
    hash = countryId.charCodeAt(i) + ((hash << 5) - hash);
  }
  return MAP_COLORS[Math.abs(hash) % MAP_COLORS.length];
}

function normalizeRegion(countryId: string, region: string, subregion = "") {
  if (CONTINENT_OVERRIDES[countryId]) return CONTINENT_OVERRIDES[countryId];
  if (region === "Americas") {
    return subregion === "South America" ? "South America" : "North America";
  }
  return region || "Unassigned";
}

function normalizeSubregion(countryId: string, subregion: string) {
  return REGION_OVERRIDES[countryId] ?? (subregion || "Unassigned");
}

function strategicPowerFor(countryId: string, metadata: CountryMetadataIndex, provinceCount: number): number {
  return modernStrategicPower(countryId, metadata, provinceCount);
}

function rebelPowerFor(parent: Country, rebelProvinceCount: number) {
  const share = rebelProvinceCount / Math.max(1, parent.provinces.length);
  return Math.max(10, Math.round(parent.strategicPower * Math.max(0.2, share * 0.7)));
}

function rebelGovernmentFor(parent: Country): GovernmentType {
  const absorbed = parent.absorbedGovernments.filter(government => government !== parent.government);
  if (absorbed.length > 0) return absorbed[0];
  if (parent.government === "Communism") return "Revolutionary";
  if (parent.government === "Revolutionary") return "Democracy";
  if (parent.government === "Caliphate") return "Revolutionary";
  if (parent.subregion === "Middle East" || parent.subregion === "Northern Africa") return "Caliphate";
  return "Revolutionary";
}

function rebelReligionFor(parent: Country, government: GovernmentType): ReligiousDenomination {
  if (government === "Communism" || government === "Revolutionary") return "State Atheism";
  if (government === "Caliphate") return parent.religion === "Shia Islam" ? "Shia Islam" : "Sunni Islam";
  return parent.religion;
}

function rebellionChance(country: Country) {
  if (country.provinces.length < 10) return 0;
  const tier = getCountryTier(country);
  if (tier === "Empire") return Math.min(18, 9 + country.absorbedGovernments.length * 2);
  return 0;
}

function rebelProvinceCount(country: Country, rngState: RngState) {
  const base = 0.12 + nextInt(rngState, 0, 8) / 100;
  const maxByAbsorbed = Math.max(5, country.largestAbsorbedProvinceCount || 5);
  const desired = Math.round(country.provinces.length * base);
  return Math.max(5, Math.min(country.provinces.length - 1, maxByAbsorbed, desired));
}

function takeRebelProvinces(country: Country, provinces: Record<string, Province>, rngState: RngState) {
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

function connectedOwnedBlocks(provinceIds: string[], provinces: Record<string, Province>) {
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

function occupiedHomelandBlocks(country: Country, countries: Record<string, Country>, provinces: Record<string, Province>) {
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

function disconnectedEnclaveBlock(country: Country, provinces: Record<string, Province>) {
  const blocks = connectedOwnedBlocks(country.provinces, provinces);
  if (blocks.length <= 1) return null;
  return blocks
    .slice(1)
    .filter(block => block.length >= 5)
    .sort((a, b) => b.length - a.length)[0] ?? null;
}

function dominantInitialCountryId(provinceIds: string[], provinces: Record<string, Province>) {
  const counts = new Map<string, number>();
  provinceIds.forEach(provinceId => {
    const initialCountryId = provinces[provinceId]?.initialCountryId;
    if (!initialCountryId || initialCountryId === "ATA") return;
    counts.set(initialCountryId, (counts.get(initialCountryId) ?? 0) + 1);
  });
  return Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}

function buildBreakawayCountry(args: {
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

function eventLabel(modifier: number) {
  if (modifier >= 8) return "Golden mobilization";
  if (modifier >= 4) return "Officer corps rally";
  if (modifier > 0) return "Local initiative";
  if (modifier <= -8) return "State paralysis";
  if (modifier <= -4) return "Supply scandal";
  if (modifier < 0) return "Border unrest";
  return "Quiet front";
}

function plausibleGovernment(countryId: string): GovernmentType {
  if (["CHN", "CUB", "VNM", "LAO", "PRK"].includes(countryId)) return "Communism";
  if (["SAU", "IRN", "IRQ", "AFG", "PAK", "YEM", "OMN", "ARE", "QAT", "KWT", "SYR", "JOR"].includes(countryId)) return "Caliphate";
  if (["RUS", "KAZ", "BLR", "AZE", "THA", "MMR"].includes(countryId)) return "Aristocracy";
  if (["VEN", "BOL", "NIC", "LBY", "SDN"].includes(countryId)) return "Revolutionary";
  return "Democracy";
}

function countrySpecialModifiers(countryId: string, strategicPower: number, population: number, area: number) {
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

function activeCapitalFor(countryId: string, capitals: CapitalRecord[]): CapitalRecord | null {
  return capitals.find(capital => capital.countryId === countryId) ?? null;
}

const CONTINENT_OVERRIDES: Record<string, string> = {
  TUR: "Asia",
  IRN: "Asia",
  IRQ: "Asia",
  SYR: "Asia",
  JOR: "Asia",
  ISR: "Asia",
  LBN: "Asia",
  SAU: "Asia",
  YEM: "Asia",
  OMN: "Asia",
  ARE: "Asia",
  QAT: "Asia",
  KWT: "Asia",
  BHR: "Asia",
  ARM: "Asia",
  AZE: "Asia",
  GEO: "Asia",
  CYP: "Asia",
  RUS: "Europe",
  KAZ: "Asia",
  EGY: "Africa",
};

const REGION_OVERRIDES: Record<string, string> = {
  TUR: "Middle East",
  IRN: "Middle East",
  IRQ: "Middle East",
  SYR: "Middle East",
  JOR: "Middle East",
  ISR: "Middle East",
  LBN: "Middle East",
  SAU: "Middle East",
  YEM: "Middle East",
  OMN: "Middle East",
  ARE: "Middle East",
  QAT: "Middle East",
  KWT: "Middle East",
  BHR: "Middle East",
  ARM: "Middle East",
  AZE: "Middle East",
  GEO: "Middle East",
  PAK: "South Asia",
  AFG: "South Asia",
  IND: "South Asia",
  NPL: "South Asia",
  BGD: "South Asia",
  LKA: "South Asia",
  BTN: "South Asia",
  KAZ: "Central Asia",
  UZB: "Central Asia",
  TKM: "Central Asia",
  KGZ: "Central Asia",
  TJK: "Central Asia",
  CHN: "East Asia",
  MNG: "East Asia",
  JPN: "East Asia",
  KOR: "East Asia",
  PRK: "East Asia",
  VNM: "Southeast Asia",
  THA: "Southeast Asia",
  MMR: "Southeast Asia",
  LAO: "Southeast Asia",
  KHM: "Southeast Asia",
  MYS: "Southeast Asia",
  IDN: "Southeast Asia",
  PHL: "Southeast Asia",
  SGP: "Southeast Asia",
  EGY: "Northern Africa",
};

function continentForCountry(countryId: string, country: Country | undefined, capital: CapitalRecord | null): string {
  return CONTINENT_OVERRIDES[countryId] ?? country?.region ?? continentFromCapital(capital);
}

function regionForCountry(countryId: string, country: Country | undefined, capital: CapitalRecord | null): string {
  return REGION_OVERRIDES[countryId] ?? country?.subregion ?? regionFromCapital(capital);
}

function continentFromCapital(capital: CapitalRecord | null): string {
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

function regionFromCapital(capital: CapitalRecord | null): string {
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

function scopeBounds(countryIds: string[], capitals: CapitalRecord[]) {
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

function buildScope(scale: CampaignScale, selectedCountryId: string | null, countries: Record<string, Country>, capitals: CapitalRecord[]): CampaignScope {
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

function syncProvinceOwners(provinces: Record<string, Province>, countries: Record<string, Country>) {
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

function provinceList(provinceIds: string[], provinces: Record<string, Province>) {
  if (provinceIds.length === 0) return "no provinces";
  const names = provinceIds.slice(0, 3).map(provinceId => provinces[provinceId]?.name ?? provinceId);
  const suffix = provinceIds.length > 3 ? ` and ${provinceIds.length - 3} more` : "";
  return `${names.join(", ")}${suffix}`;
}

function describeCombatTurn(turn: CombatTurnOutcome, countries: Record<string, Country>, provinces: Record<string, Province>) {
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

function dominantWarCountry(attacker: Country, defender: Country) {
  const attackerScore = controlledDevelopmentScore(attacker) * 1.2 + attacker.provinces.length * 8 + attacker.strategicPower * 2;
  const defenderScore = controlledDevelopmentScore(defender) * 1.2 + defender.provinces.length * 8 + defender.strategicPower * 2;
  return attackerScore >= defenderScore ? attacker.id : defender.id;
}

function warDominance(attacker: Country, defender: Country) {
  const attackerScore = warPowerScore(attacker, defender);
  const defenderScore = warPowerScore(defender, attacker);
  const total = Math.max(1, attackerScore + defenderScore);
  const attackerShare = attackerScore / total;
  const defenderShare = defenderScore / total;
  return attackerShare >= defenderShare
    ? { countryId: attacker.id, share: attackerShare }
    : { countryId: defender.id, share: defenderShare };
}

function incineratedInWar(turns: CombatTurnOutcome[]) {
  return Array.from(new Set(turns.flatMap(turn => turn.incineratedProvinceIds)));
}

function diceOnlyLog(turn: CombatTurnOutcome, countries: Record<string, Country>) {
  const active = countries[turn.activeCountryId]?.name ?? turn.activeCountryId;
  const target = countries[turn.targetCountryId]?.name ?? turn.targetCountryId;
  const roll = turn.roll > 0 ? `+${turn.roll}` : String(turn.roll);
  if (turn.roll === 0) return `${active} rolled 0. Special orders are resolving against ${target}.`;
  return `${active} rolled ${roll}. Orders are resolving against ${target}.`;
}

type TurnResolution = {
  countries: Record<string, Country>;
  provinces: Record<string, Province>;
  rngState: RngState;
  activeWars: ActiveWar[];
  selectedWarId: string | null;
  currentBet: WarBet | null;
  lastCombatOutcome: CombatOutcome | null;
  player: PlayerState;
  warTurns: Record<string, CombatTurnOutcome[]>;
  completedWarResults: WarResult[];
  countryPlacements: Record<string, number>;
  suppressedRebelKeys: Record<string, true>;
  stage: CampaignStage;
  logs: string[];
  turn: CombatTurnOutcome;
};

const LONG_WAR_ANNEXATION_THRESHOLD = 0.68;

function warPowerScore(country: Country, enemy: Country) {
  const development = controlledDevelopmentScore(country);
  const territory = country.provinces.length * 7;
  const capitalPressure = country.provinces.includes(enemy.capitalProvinceId) ? 35 : 0;
  return development * 1.25 + territory + country.strategicPower * 2 + capitalPressure;
}

function controlledCountryIdsAtThreshold(
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

function isIndependenceWar(war: ActiveWar) {
  return war.id.includes("_liberation_") || war.id.includes("_enclave_");
}

function isRebelWar(war: ActiveWar) {
  return isIndependenceWar(war) || war.id.includes("_civil_");
}

function rebelLeadershipSignature(country: Country) {
  return [
    country.id,
    country.name,
    country.government,
    country.religion,
    country.unlockedFormations.join("|"),
  ].join("::");
}

function rebelSuppressionKey(overlord: Country, rebelIdentity: string) {
  return `${rebelLeadershipSignature(overlord)}=>${rebelIdentity}`;
}

function isRebelSuppressed(suppressedRebelKeys: Record<string, true>, overlord: Country, rebelIdentity: string) {
  return Boolean(suppressedRebelKeys[rebelSuppressionKey(overlord, rebelIdentity)]);
}

function reclaimedIndependenceProvinces(winner: Country, loser: Country, provinces: Record<string, Province>) {
  const homeland = loser.provinces.filter(provinceId => provinces[provinceId]?.initialCountryId === winner.baseId);
  if (homeland.length > 0) return homeland;
  return [];
}

function resolveWarTurnState(state: GameState, war: ActiveWar, logs: string[]): TurnResolution {
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
    if (endedByDominance) {
      countries[resolvedWinnerId] = {
        ...countries[resolvedWinnerId],
        provinces: Array.from(new Set([...countries[resolvedWinnerId].provinces, ...countries[loserId].provinces])),
      };
      countries[loserId] = { ...countries[loserId], provinces: [] };
    }

    const winner = countries[resolvedWinnerId];
    const loser = countries[loserId];
    const loserStartingProvinceCount = state.countries[loserId]?.provinces.length ?? loser.provinces.length;
    const inheritedGovernments = Array.from(new Set([...winner.absorbedGovernments, loser.government, ...loser.absorbedGovernments]));
    const controlledAtThreshold = controlledCountryIdsAtThreshold(winner, countries, state.provinces, 0.7);
    const inheritedCountryIds = Array.from(new Set([...winner.absorbedCountryIds, loser.baseId, ...loser.absorbedCountryIds, ...controlledAtThreshold]));
    const enforcedReligion = winner.religion;
    const formationResult = applyCountryFormation({
      ...winner,
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

function campaignFavoriteRank(favoriteId: string | null, winnerId: string | null, completedWarResults: WarResult[]) {
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

function campaignFavoritePlacement(favoriteId: string | null, winnerId: string | null, placements: Record<string, number>) {
  if (!favoriteId) return null;
  if (favoriteId === winnerId) return 1;
  return placements[favoriteId] ?? null;
}

function campaignPayoutForRank(stake: number, rank: number | null) {
  if (stake <= 0 || !rank || rank > 3) return 0;
  if (rank === 1) return stake * 2;
  if (rank === 2) return Math.round(stake * 1.5);
  return stake;
}

function campaignConclusionLog(rank: number | null, payout: number, favorite: Country | null | undefined) {
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

export const useGameStore = create<GameState>((set, get) => ({
  isLoaded: false,
  stage: "PickScope",
  countries: {},
  provinces: {},
  capitals: [],
  activeWars: [],
  player: {
    tickets: 500,
    campaignFavoriteCountryId: null,
    campaignStake: 0,
    activeWarBets: new Map(),
  },
  logs: [],
  selectedProvinceId: null,
  selectedCountryId: null,
  selectedWarId: null,
  campaignScope: null,
  currentBet: null,
  lastCombatOutcome: null,
  warTurns: {},
  completedWarResults: [],
  countryPlacements: {},
  suppressedRebelKeys: {},
  campaignPhase: 0,
  forcedWars: [],
  rngState: newCampaignRng(),
  isResolvingTurn: false,
  isAutoPlaying: false,
  autoSpeed: 1,

  initializeGame: async () => {
    const assets = await loadMapAssets();
    const rngState = newCampaignRng();
    const walletTickets = loadTicketWallet();
    const metadata = buildMetadataIndex(assets.metadata);

    const provinceMap: Record<string, Province> = {};
    assets.provinces.forEach(p => {
      provinceMap[p.id] = {
        id: p.id,
        name: p.name,
        initialCountryId: p.countryId,
        ownerId: p.countryId,
        adjacentProvinceIds: p.adjacentProvinceIds,
        isIncinerated: false,
      };
    });

    const countryMap: Record<string, Country> = {};
    assets.countries.forEach(c => {
      const government = plausibleGovernment(c.id);
      const record = metadata[c.id];
      const strategicPower = strategicPowerFor(c.id, metadata, c.provinceIds.length);
      const region = normalizeRegion(c.id, metadataRegion(c.id, metadata), metadataSubregion(c.id, metadata));
      const subregion = normalizeSubregion(c.id, metadataSubregion(c.id, metadata));
      countryMap[c.id] = {
        id: c.id,
        baseId: c.id,
        name: metadataName(c.id, metadata),
        flag: metadataFlag(c.id, metadata),
        mapColor: initialMapColor(c.id),
        provinces: c.provinceIds,
        initialProvinceCount: c.provinceIds.length,
        strategicPower,
        population: record?.population ?? 0,
        area: record?.area ?? 0,
        region,
        subregion,
        absorbedGovernments: [government],
        absorbedCountryIds: [c.id],
        unlockedFormations: [],
        largestAbsorbedProvinceCount: 0,
        campaignPhaseBorn: 0,
        capitalProvinceId: c.capitalProvinceId,
        government,
        religion: religionForCountry(c.id, region, subregion),
        specialModifiers: countrySpecialModifiers(c.id, strategicPower, record?.population ?? 0, record?.area ?? 0),
        armyCampsCount: 0,
        interceptorCharges: 0,
        blitzActions: 0,
        disconnectedPhaseCount: 0,
        eventModifier: 0,
        isAlive: c.id !== "ATA",
      };
    });

    set({
      isLoaded: true,
      stage: "PickScope",
      provinces: provinceMap,
      countries: countryMap,
      capitals: assets.capitals,
      activeWars: [],
      selectedProvinceId: null,
      selectedCountryId: null,
      selectedWarId: null,
      campaignScope: null,
      currentBet: null,
      lastCombatOutcome: null,
      warTurns: {},
      completedWarResults: [],
      countryPlacements: {},
      suppressedRebelKeys: {},
      campaignPhase: 0,
      forcedWars: [],
      rngState,
      isResolvingTurn: false,
      isAutoPlaying: false,
      autoSpeed: get().autoSpeed,
      player: {
        tickets: walletTickets,
        campaignFavoriteCountryId: null,
        campaignStake: 0,
        activeWarBets: new Map(),
      },
      logs: ["Map loaded. Choose a campaign scale."],
    });
  },

  selectProvince: (provinceId) => {
    const province = provinceId ? get().provinces[provinceId] : null;
    set({
      selectedProvinceId: provinceId,
      selectedCountryId: province?.ownerId ?? null,
    });
  },

  selectCountry: (countryId) => {
    set({ selectedCountryId: countryId });
  },

  setCampaignScale: (scale) => {
    const state = get();
    const scope = buildScope(scale, state.selectedCountryId, state.countries, state.capitals);
    set({
      campaignScope: scope,
      stage: "PickFavorite",
      logs: [...state.logs, `${scale} selected: ${scope.label}. Pick a campaign favorite.`],
    });
  },

  chooseFavorite: (countryId) => {
    const state = get();
    const country = state.countries[countryId];
    if (!country || !state.campaignScope?.eligibleCountryIds.includes(countryId)) return;

    const cost = countryCost(country);
    if (cost > state.player.tickets) {
      set({ logs: [...state.logs, `${country.name} costs ${cost} tickets. Wallet: ${state.player.tickets}.`] });
      return;
    }

    const campaignScope = buildScope(state.campaignScope.scale, countryId, state.countries, state.capitals);
    const nextTickets = state.player.tickets - cost;
    saveTicketWallet(nextTickets);

    set({
      campaignScope,
      player: {
        ...state.player,
        tickets: nextTickets,
        campaignFavoriteCountryId: countryId,
        campaignStake: cost,
      },
      selectedCountryId: countryId,
      stage: "EventHorizon",
      logs: [...state.logs, `${country.name} bought as campaign favorite for ${cost} tickets. Scope locked: ${campaignScope.label}.`],
    });
  },

  rollCampaignEvents: () => {
    const state = get();
    if (!state.campaignScope) return;

    const rngState = { ...state.rngState };
    const countries = { ...state.countries };
    let campaignScope = state.campaignScope;
    const logs = [...state.logs, "Event horizon triggered."];
    const rebelCountryIds: string[] = [];
    const forcedWars: ActiveWar[] = [];
    let rebellionsThisHorizon = 0;
    const rebelsAllowed = state.campaignPhase > 0;

    state.campaignScope.eligibleCountryIds.forEach(countryId => {
      const country = countries[countryId];
      if (!country?.isAlive) return;

      const eventModifier = nextInt(rngState, -10, 12);
      countries[countryId] = { ...country, eventModifier };
      if (Math.abs(eventModifier) >= 4) {
        logs.push(`${country.name}: ${eventLabel(eventModifier)} (${eventModifier > 0 ? "+" : ""}${eventModifier}).`);
      }

      const updatedCountry = countries[countryId];
      const chance = rebellionChance(updatedCountry);
      const homelandCandidate = occupiedHomelandBlocks(updatedCountry, countries, state.provinces)[0];
      if (
        rebelsAllowed &&
        rebellionsThisHorizon < 3 &&
        homelandCandidate &&
        !isRebelSuppressed(state.suppressedRebelKeys, updatedCountry, homelandCandidate.originalCountryId) &&
        nextInt(rngState, 1, 100) <= 22
      ) {
        const baseCountry = countries[homelandCandidate.originalCountryId];
        const rebelId = homelandCandidate.originalCountryId;
        const rebelProvinceIds = homelandCandidate.provinceIds;
        const rebelCountry = buildBreakawayCountry({
          id: rebelId,
          sourceCountry: updatedCountry,
          baseCountry,
          provinceIds: rebelProvinceIds,
          phase: state.campaignPhase,
          name: baseCountry?.name ?? `${updatedCountry.subregion} Liberation Front`,
          flag: baseCountry?.flag ?? "⚑",
          government: baseCountry?.government ?? rebelGovernmentFor(updatedCountry),
          religion: baseCountry?.religion ?? rebelReligionFor(updatedCountry, rebelGovernmentFor(updatedCountry)),
        });

        countries[countryId] = {
          ...updatedCountry,
          provinces: updatedCountry.provinces.filter(provinceId => !rebelProvinceIds.includes(provinceId)),
          eventModifier: Math.min(updatedCountry.eventModifier, updatedCountry.eventModifier - 4),
        };
        countries[rebelId] = rebelCountry;
        rebelCountryIds.push(rebelId);
        forcedWars.push({
          id: `${countryId}_liberation_${rebelId}_${state.campaignPhase}`,
          attackerId: countryId,
          defenderId: rebelId,
          attackerOccupiedCapital: false,
          defenderOccupiedCapital: false,
          incineratedProvinceIds: [],
        });
        rebellionsThisHorizon += 1;
        logs.push(`${rebelCountry.name} declared independence from ${updatedCountry.name}, reclaiming ${rebelProvinceIds.length} homeland province(s).`);
        return;
      }

      const enclaveBlock = disconnectedEnclaveBlock(updatedCountry, state.provinces);
      const disconnectedPhaseCount = enclaveBlock ? updatedCountry.disconnectedPhaseCount + 1 : 0;
      countries[countryId] = { ...countries[countryId], disconnectedPhaseCount };
      if (rebelsAllowed && rebellionsThisHorizon < 3 && enclaveBlock && disconnectedPhaseCount >= 3) {
        const dominantCountryId = dominantInitialCountryId(enclaveBlock, state.provinces);
        const baseCountry = dominantCountryId ? countries[dominantCountryId] : null;
        const baseAvailable = baseCountry && !baseCountry.isAlive;
        const rebelId = baseAvailable ? baseCountry.id : `ENC_${countryId}_${state.campaignPhase}_${rebelCountryIds.length}`;
        const rebelIdentity = baseAvailable ? baseCountry.baseId : `enclave:${dominantCountryId ?? updatedCountry.subregion}`;
        if (!isRebelSuppressed(state.suppressedRebelKeys, updatedCountry, rebelIdentity) && nextInt(rngState, 1, 100) <= 20) {
        const rebelGovernment = baseCountry?.government ?? rebelGovernmentFor(updatedCountry);
        const rebelReligion = baseCountry?.religion ?? rebelReligionFor(updatedCountry, rebelGovernment);
        const rebelCountry = buildBreakawayCountry({
          id: rebelId,
          sourceCountry: updatedCountry,
          baseCountry: baseAvailable ? baseCountry : null,
          provinceIds: enclaveBlock,
          phase: state.campaignPhase,
          name: baseAvailable ? baseCountry.name : `${updatedCountry.subregion} Free State`,
          flag: baseAvailable ? baseCountry.flag : "⚑",
          government: rebelGovernment,
          religion: rebelReligion,
        });

        const currentCountry = countries[countryId];
        countries[countryId] = {
          ...currentCountry,
          provinces: currentCountry.provinces.filter(provinceId => !enclaveBlock.includes(provinceId)),
          disconnectedPhaseCount: 0,
          eventModifier: Math.min(currentCountry.eventModifier, currentCountry.eventModifier - 3),
        };
        countries[rebelId] = rebelCountry;
        rebelCountryIds.push(rebelId);
        forcedWars.push({
          id: `${countryId}_enclave_${rebelId}_${state.campaignPhase}`,
          attackerId: countryId,
          defenderId: rebelId,
          attackerOccupiedCapital: false,
          defenderOccupiedCapital: false,
          incineratedProvinceIds: [],
        });
        rebellionsThisHorizon += 1;
        logs.push(`${rebelCountry.name} seceded from an isolated ${updatedCountry.name} enclave after ${disconnectedPhaseCount} disconnected phase(s).`);
          return;
        }
      }

      const currentCountry = countries[countryId];
      if (rebelsAllowed && rebellionsThisHorizon < 3 && chance > 0 && nextInt(rngState, 1, 100) <= chance) {
        const rebelProvinceIds = takeRebelProvinces(currentCountry, state.provinces, rngState);
        if (rebelProvinceIds.length > 0 && rebelProvinceIds.length < currentCountry.provinces.length) {
          const rebelGovernment = rebelGovernmentFor(currentCountry);
          const rebelReligion = rebelReligionFor(currentCountry, rebelGovernment);
          const rebelIdentity = `civil:${rebelGovernment}:${rebelReligion}`;
          if (isRebelSuppressed(state.suppressedRebelKeys, currentCountry, rebelIdentity)) return;
          const rebelId = `REB_${countryId}_${state.logs.length}_${rebelCountryIds.length}`;
          const rebelCountry: Country = {
            id: rebelId,
            baseId: rebelIdentity,
            name: rebelName(currentCountry, rebelGovernment),
            flag: "⚑",
            mapColor: initialMapColor(rebelId),
            provinces: rebelProvinceIds,
            initialProvinceCount: rebelProvinceIds.length,
            strategicPower: rebelPowerFor(currentCountry, rebelProvinceIds.length),
            population: Math.round(currentCountry.population * (rebelProvinceIds.length / Math.max(1, currentCountry.provinces.length))),
            area: Math.round(currentCountry.area * (rebelProvinceIds.length / Math.max(1, currentCountry.provinces.length))),
            region: currentCountry.region,
            subregion: currentCountry.subregion,
            absorbedGovernments: [rebelGovernment],
            absorbedCountryIds: [rebelId],
            unlockedFormations: [],
            largestAbsorbedProvinceCount: 0,
            campaignPhaseBorn: state.campaignPhase,
            capitalProvinceId: rebelProvinceIds[0],
            government: rebelGovernment,
            religion: rebelReligion,
            specialModifiers: [
              {
                label: religionModifierLabel(rebelReligion),
                value: Math.max(7, religionModifier(rebelReligion)),
                description: "The breakaway regime uses faith and ideology to mobilize quickly.",
              },
            ],
            armyCampsCount: 0,
            interceptorCharges: 0,
            blitzActions: 0,
            disconnectedPhaseCount: 0,
            eventModifier: nextInt(rngState, 2, 8),
            isAlive: true,
          };

          countries[countryId] = {
            ...currentCountry,
            provinces: currentCountry.provinces.filter(provinceId => !rebelProvinceIds.includes(provinceId)),
            eventModifier: Math.min(currentCountry.eventModifier, currentCountry.eventModifier - 3),
          };
          countries[rebelId] = rebelCountry;
          rebelCountryIds.push(rebelId);
          forcedWars.push({
            id: `${countryId}_civil_${rebelId}_${state.campaignPhase}`,
            attackerId: countryId,
            defenderId: rebelId,
            attackerOccupiedCapital: false,
            defenderOccupiedCapital: false,
            incineratedProvinceIds: [],
          });
          rebellionsThisHorizon += 1;
          logs.push(`${rebelCountry.name} broke away from ${currentCountry.name}, seizing ${rebelProvinceIds.length} province(s). Civil war is locked in.`);
        }
      }
    });

    if (rebelCountryIds.length > 0) {
      campaignScope = {
        ...campaignScope,
        eligibleCountryIds: [...campaignScope.eligibleCountryIds, ...rebelCountryIds],
      };
    }

    const provinces = syncProvinceOwners(state.provinces, countries);

    set({
      countries,
      provinces,
      campaignScope,
      rngState,
      stage: "WarSelection",
      currentBet: null,
      selectedWarId: null,
      lastCombatOutcome: null,
      warTurns: {},
      completedWarResults: [],
      forcedWars,
      campaignPhase: state.campaignPhase + 1,
      logs,
    });
    get().generateWars();
  },

  generateWars: () => {
    const state = get();
    if (!state.campaignScope) return;

    const scopedCountries: Record<string, Country> = {};
    state.campaignScope.eligibleCountryIds.forEach(countryId => {
      const country = state.countries[countryId];
      if (country?.isAlive) scopedCountries[countryId] = country;
    });

    const scopedAliveIds = Object.keys(scopedCountries);
    if (scopedAliveIds.length <= 1) {
      const winnerId = scopedAliveIds[0] ?? null;
      const countryPlacements = winnerId ? { ...state.countryPlacements, [winnerId]: 1 } : state.countryPlacements;
      const rank = campaignFavoritePlacement(state.player.campaignFavoriteCountryId, winnerId, countryPlacements);
      const payout = campaignPayoutForRank(state.player.campaignStake, rank);
      const favorite = state.player.campaignFavoriteCountryId ? state.countries[state.player.campaignFavoriteCountryId] : null;
      const nextTickets = state.player.tickets + payout;
      saveTicketWallet(nextTickets);
      set({
        activeWars: [],
        selectedWarId: null,
        stage: rank <= 3 ? "CampaignWon" : "GameOver",
        player: {
          ...state.player,
          tickets: nextTickets,
          campaignStake: 0,
        },
        countryPlacements,
        logs: [
          ...state.logs,
          winnerId ? `${state.countries[winnerId].name} is the last country standing.` : "No countries remain in scope.",
          campaignConclusionLog(rank, payout, favorite),
        ],
      });
      return;
    }

    const rngState = { ...state.rngState };
    const forcedWars = state.forcedWars.filter(war => scopedCountries[war.attackerId]?.isAlive && scopedCountries[war.defenderId]?.isAlive);
    const result = runMatchmaking(scopedCountries, state.provinces, forcedWars, rngState, 6, state.capitals);
    let activeWars = [...forcedWars, ...result.newWars];
    if (activeWars.length === 0 && scopedAliveIds.length > 1) {
      const contenders = scopedAliveIds
        .map(countryId => scopedCountries[countryId])
        .filter(Boolean)
        .sort((a, b) => controlledDevelopmentScore(b) - controlledDevelopmentScore(a));
      if (contenders[0] && contenders[1]) {
        activeWars = [{
          id: `${contenders[0].id}_vs_${contenders[1].id}_${Date.now()}`,
          attackerId: contenders[0].id,
          defenderId: contenders[1].id,
          attackerOccupiedCapital: false,
          defenderOccupiedCapital: false,
          incineratedProvinceIds: [],
        }];
      }
    }
    const logs = [...state.logs];
    if (activeWars.length === 0) {
      logs.push("No in-scope border wars erupted.");
    } else {
      activeWars.forEach(war => {
        const isForcedCivilWar = forcedWars.some(forced => forced.id === war.id);
        logs.push(`${isForcedCivilWar ? "Civil war ignited" : "War erupted"}: ${state.countries[war.attackerId].name} vs ${state.countries[war.defenderId].name}.`);
      });
    }

    set({
      activeWars,
      selectedWarId: activeWars[0]?.id ?? null,
      warTurns: {},
      completedWarResults: [],
      forcedWars: [],
      rngState,
      logs,
    });
  },

  selectWar: (warId) => {
    const state = get();
    const existingBet = state.player.activeWarBets.get(warId) ?? null;
    set({
      selectedWarId: warId,
      currentBet: existingBet,
      stage: existingBet ? "Combat" : "Betting",
    });
  },

  placeWarBet: (predictedWinnerId, amount) => {
    const state = get();
    if (!state.selectedWarId || amount <= 0 || amount > state.player.tickets) return;

    const activeWarBets = new Map(state.player.activeWarBets);
    activeWarBets.set(state.selectedWarId, { warId: state.selectedWarId, predictedWinnerId, amount });

    set({
      currentBet: { warId: state.selectedWarId, predictedWinnerId, amount },
      player: {
        ...state.player,
        activeWarBets,
      },
      stage: "Combat",
      logs: [...state.logs, `${amount} tickets placed on ${state.countries[predictedWinnerId].name}.`],
    });
  },

  rollSelectedWarTurn: () => {
    const state = get();
    if (state.isResolvingTurn) return;
    const war = state.activeWars.find(candidate => candidate.id === state.selectedWarId);
    if (!war) return;

    const resolution = resolveWarTurnState(state, war, [...state.logs]);
    const diceLog = diceOnlyLog(resolution.turn, state.countries);
    const finalLogs = [...state.logs, diceLog, ...resolution.logs.slice(state.logs.length)];
    set({
      rngState: resolution.rngState,
      warTurns: resolution.warTurns,
      stage: "Combat",
      isResolvingTurn: true,
      logs: [...state.logs, diceLog],
    });

    window.setTimeout(() => {
      set({
        countries: resolution.countries,
        provinces: resolution.provinces,
        activeWars: resolution.activeWars,
        selectedWarId: resolution.selectedWarId,
        currentBet: resolution.currentBet,
        lastCombatOutcome: resolution.lastCombatOutcome,
        player: resolution.player,
        warTurns: resolution.warTurns,
        completedWarResults: resolution.completedWarResults,
        countryPlacements: resolution.countryPlacements,
        suppressedRebelKeys: resolution.suppressedRebelKeys,
        stage: resolution.stage,
        logs: finalLogs,
        isResolvingTurn: false,
      });
    }, 1000);
  },

  skipSelectedWar: () => {
    if (get().isResolvingTurn) return;
    let guard = 1200;
    while (guard > 0) {
      const before = get();
      const warId = before.selectedWarId;
      if (!warId || !before.activeWars.some(war => war.id === warId) || before.stage === "GameOver" || before.stage === "CampaignWon") break;
      const war = before.activeWars.find(candidate => candidate.id === warId);
      if (!war) break;
      const resolution = resolveWarTurnState(before, war, [...before.logs]);
      set({
        countries: resolution.countries,
        provinces: resolution.provinces,
        rngState: resolution.rngState,
        activeWars: resolution.activeWars,
        selectedWarId: resolution.selectedWarId,
        currentBet: resolution.currentBet,
        lastCombatOutcome: resolution.lastCombatOutcome,
        player: resolution.player,
        warTurns: resolution.warTurns,
        completedWarResults: resolution.completedWarResults,
        countryPlacements: resolution.countryPlacements,
        suppressedRebelKeys: resolution.suppressedRebelKeys,
        stage: resolution.stage,
        logs: resolution.logs,
        isResolvingTurn: false,
      });
      if (!resolution.activeWars.some(candidate => candidate.id === warId)) break;
      guard -= 1;
    }
  },

  autoResolveSelectedWarChunk: () => {
    const start = get();
    if (start.isResolvingTurn) return;
    const speed = start.autoSpeed;
    if (speed <= 1) {
      get().rollSelectedWarTurn();
      return;
    }

    const maxTurns = speed >= 4 ? 40 : 12;
    let state = start;
    let resolution: TurnResolution | null = null;
    let turnsResolved = 0;
    const firstWarId = state.selectedWarId;
    const summaryLogs = [...state.logs];

    while (turnsResolved < maxTurns) {
      const war = state.activeWars.find(candidate => candidate.id === state.selectedWarId);
      if (!war || !firstWarId || war.id !== firstWarId || state.stage === "GameOver" || state.stage === "CampaignWon") break;
      resolution = resolveWarTurnState(state, war, summaryLogs);
      turnsResolved += 1;
      state = {
        ...state,
        countries: resolution.countries,
        provinces: resolution.provinces,
        rngState: resolution.rngState,
        activeWars: resolution.activeWars,
        selectedWarId: resolution.selectedWarId,
        currentBet: resolution.currentBet,
        lastCombatOutcome: resolution.lastCombatOutcome,
        player: resolution.player,
        warTurns: resolution.warTurns,
        completedWarResults: resolution.completedWarResults,
        countryPlacements: resolution.countryPlacements,
        suppressedRebelKeys: resolution.suppressedRebelKeys,
        stage: resolution.stage,
        logs: resolution.logs,
      };
      if (!state.activeWars.some(candidate => candidate.id === firstWarId)) break;
    }

    if (!resolution) return;
    const latestWarTurns = firstWarId ? resolution.warTurns[firstWarId] ?? [] : [];
    const capturedCount = latestWarTurns.slice(-turnsResolved).reduce((total, turn) => total + turn.capturedProvinces.length, 0);
    const finalLogs = [
      ...start.logs,
      `Auto ${speed}x resolved ${turnsResolved} turn(s)${capturedCount > 0 ? ` and shifted ${capturedCount} province(s)` : ""}.`,
      ...resolution.logs.slice(summaryLogs.length),
    ];

    set({
      countries: resolution.countries,
      provinces: resolution.provinces,
      rngState: resolution.rngState,
      activeWars: resolution.activeWars,
      selectedWarId: resolution.selectedWarId,
      currentBet: resolution.currentBet,
      lastCombatOutcome: resolution.lastCombatOutcome,
      player: resolution.player,
      warTurns: resolution.warTurns,
      completedWarResults: resolution.completedWarResults,
      countryPlacements: resolution.countryPlacements,
      suppressedRebelKeys: resolution.suppressedRebelKeys,
      stage: resolution.stage,
      logs: finalLogs,
      isResolvingTurn: false,
    });
  },

  skipAllWars: () => {
    const start = get();
    if (start.isResolvingTurn || start.activeWars.length === 0) return;
    set({
      stage: "Combat",
      selectedWarId: start.selectedWarId ?? start.activeWars[0].id,
      isResolvingTurn: true,
      isAutoPlaying: true,
      logs: [...start.logs, `War sweep started: resolving ${start.activeWars.length} war(s).`],
    });

    let guard = 220 * Math.max(1, start.activeWars.length) + 80;
    const step = () => {
      const state = get();
      if (state.activeWars.length === 0 || state.stage === "GameOver" || state.stage === "CampaignWon" || guard <= 0) {
        if (guard <= 0) {
          set({ logs: [...state.logs, "War sweep stopped by emergency guard. Remaining wars need manual review."], isResolvingTurn: false, isAutoPlaying: false });
        } else {
          set({ isResolvingTurn: false, isAutoPlaying: false });
        }
        return;
      }
      if (!state.isAutoPlaying) {
        window.setTimeout(step, 160);
        return;
      }
      if (!state.selectedWarId || !state.activeWars.some(war => war.id === state.selectedWarId)) {
        set({ selectedWarId: state.activeWars[0].id, stage: "Combat" });
      }
      const current = get();
      const firstWar = current.activeWars.find(candidate => candidate.id === current.selectedWarId) ?? current.activeWars[0];
      if (!firstWar) {
        set({ isResolvingTurn: false });
        return;
      }
      const speed = current.autoSpeed;
      const turnsPerStep = speed >= 4 ? 40 : speed >= 2 ? 12 : 1;
      const delay = speed >= 4 ? 520 : speed >= 2 ? 760 : 1050;
      const logStart = current.logs.length;
      const workingLogs = [...current.logs];
      let workingState = current;
      let resolution: TurnResolution | null = null;
      let turnsResolved = 0;

      while (turnsResolved < turnsPerStep && guard > 0) {
        const war = workingState.activeWars.find(candidate => candidate.id === firstWar.id);
        if (!war || workingState.stage === "GameOver" || workingState.stage === "CampaignWon") break;
        resolution = resolveWarTurnState(workingState, war, workingLogs);
        turnsResolved += 1;
        guard -= 1;
        workingState = {
          ...workingState,
          countries: resolution.countries,
          provinces: resolution.provinces,
          rngState: resolution.rngState,
          activeWars: resolution.activeWars,
          selectedWarId: resolution.selectedWarId,
          currentBet: resolution.currentBet,
          lastCombatOutcome: resolution.lastCombatOutcome,
          player: resolution.player,
          warTurns: resolution.warTurns,
          completedWarResults: resolution.completedWarResults,
          countryPlacements: resolution.countryPlacements,
          suppressedRebelKeys: resolution.suppressedRebelKeys,
          stage: resolution.stage,
          logs: resolution.logs,
        };
        if (!resolution.activeWars.some(candidate => candidate.id === firstWar.id)) break;
      }

      if (!resolution) {
        set({ isResolvingTurn: false });
        return;
      }
      const warEnded = !resolution.activeWars.some(candidate => candidate.id === firstWar.id);
      const newLogs = resolution.logs.slice(logStart);
      const terminalLogs = newLogs.filter(log => /won the war|border settlement|Bet won|Bet lost|returned|proclaimed|enforced|survived/i.test(log));
      const latestTurns = resolution.warTurns[firstWar.id] ?? [];
      const capturedCount = latestTurns.slice(-turnsResolved).reduce((total, turn) => total + turn.capturedProvinces.length, 0);
      const attackerName = current.countries[firstWar.attackerId]?.name ?? firstWar.attackerId;
      const defenderName = current.countries[firstWar.defenderId]?.name ?? firstWar.defenderId;
      const logs = turnsResolved > 1
        ? [
          ...current.logs,
          `Auto sweep ${speed}x resolved ${turnsResolved} roll(s) in ${attackerName} vs ${defenderName}${capturedCount > 0 ? ` and shifted ${capturedCount} province(s)` : ""}.`,
          ...terminalLogs,
        ]
        : resolution.logs;
      set({
        countries: resolution.countries,
        provinces: resolution.provinces,
        rngState: resolution.rngState,
        activeWars: resolution.activeWars,
        selectedWarId: resolution.selectedWarId,
        currentBet: resolution.currentBet,
        lastCombatOutcome: resolution.lastCombatOutcome,
        player: resolution.player,
        warTurns: resolution.warTurns,
        completedWarResults: resolution.completedWarResults,
        countryPlacements: resolution.countryPlacements,
        suppressedRebelKeys: resolution.suppressedRebelKeys,
        stage: resolution.stage,
        logs,
        isResolvingTurn: true,
      });
      window.setTimeout(step, warEnded ? 950 : delay);
    };
    window.setTimeout(step, 120);
  },

  toggleAutoPlay: () => {
    const state = get();
    set({ isAutoPlaying: !state.isAutoPlaying });
  },

  setAutoSpeed: (speed) => {
    set({ autoSpeed: [1, 2, 4].includes(speed) ? speed : 1 });
  },

  continueAfterWar: () => {
    const state = get();
    if (state.activeWars.length > 0) {
      set({ stage: "WarSelection", selectedWarId: state.activeWars[0].id, currentBet: null });
      return;
    }

    const aliveInScope = state.campaignScope
      ? state.campaignScope.eligibleCountryIds.filter(countryId => state.countries[countryId]?.isAlive)
      : Object.values(state.countries).filter(country => country.isAlive).map(country => country.id);

    if (aliveInScope.length <= 1) {
      const winnerId = aliveInScope[0] ?? null;
      const countryPlacements = winnerId ? { ...state.countryPlacements, [winnerId]: 1 } : state.countryPlacements;
      const rank = campaignFavoritePlacement(state.player.campaignFavoriteCountryId, winnerId, countryPlacements);
      const payout = campaignPayoutForRank(state.player.campaignStake, rank);
      const favorite = state.player.campaignFavoriteCountryId ? state.countries[state.player.campaignFavoriteCountryId] : null;
      const nextTickets = state.player.tickets + payout;
      saveTicketWallet(nextTickets);
      set({
        stage: rank <= 3 ? "CampaignWon" : "GameOver",
        player: {
          ...state.player,
          tickets: nextTickets,
          campaignStake: 0,
        },
        countryPlacements,
        logs: [
          ...state.logs,
          winnerId ? `${state.countries[winnerId].name} is the last country standing.` : "No countries remain in scope.",
          campaignConclusionLog(rank, payout, favorite),
        ],
      });
      return;
    }

    set({ stage: "EventHorizon", selectedWarId: null, currentBet: null });
  },

  resolveSelectedWar: () => {
    get().skipSelectedWar();
  },

  resetCampaign: () => {
    void get().initializeGame();
  },
}));

