import { create } from "zustand";
import type { Country } from "../engine/models/country";
import type { GovernmentType } from "../engine/models/enums";
import type { Province } from "../engine/models/province";
import type { ActiveWar } from "../engine/models/war";
import type { PlayerState } from "../engine/models/player";
import { governmentModifier } from "../engine/rules/modifiers";
import { resolveTier } from "../engine/rules/tiers";
import { loadMapAssets, type CapitalRecord } from "../lib/data/loadMapAssets";
import { runMatchmaking } from "../engine/mechanics/matchmaker";
import { resolveCombat, resolveCombatTurn, type CombatOutcome, type CombatTurnOutcome } from "../engine/mechanics/combatResolution";
import { createRng, nextInt, type RngState } from "../engine/rng/seededRng";

export type CampaignScale = "World War" | "Continent War" | "Regional War";
export type CampaignStage =
  | "PickScope"
  | "PickFavorite"
  | "EventHorizon"
  | "WarSelection"
  | "Betting"
  | "Combat"
  | "CombatResult"
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
  winnerId: string;
  loserId: string;
  bet: WarBet | null;
  wonBet: boolean | null;
  turns: CombatTurnOutcome[];
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
  rngState: RngState;

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
  continueAfterWar: () => void;
  resolveSelectedWar: () => void;
  resetCampaign: () => void;
};

const INITIAL_SEED = 8675309;
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
  const subdivisionTax = Math.min(90, Math.round(Math.sqrt(country.provinces.length) * 7));
  return Math.max(25, country.strategicPower * 4 + subdivisionTax);
}

function displayName(countryId: string): string {
  return COUNTRY_NAMES[countryId] ?? countryId;
}

function flagFor(countryId: string): string {
  return FLAGS[countryId] ?? "⚑";
}

function strategicPowerFor(countryId: string, provinceCount: number): number {
  return STRATEGIC_POWER[countryId] ?? Math.max(12, Math.min(34, Math.round(Math.sqrt(Math.max(1, provinceCount)) * 4)));
}

function rebelPowerFor(parent: Country, rebelProvinceCount: number) {
  const share = rebelProvinceCount / Math.max(1, parent.provinces.length);
  return Math.max(10, Math.round(parent.strategicPower * Math.max(0.2, share * 0.7)));
}

function rebelGovernmentFor(parent: Country): GovernmentType {
  if (parent.government === "Communism") return "Revolutionary";
  if (parent.government === "Revolutionary") return "Democracy";
  if (parent.government === "Caliphate") return "Aristocracy";
  return "Revolutionary";
}

function rebellionChance(country: Country) {
  if (country.provinces.length < 3) return 0;
  const tier = getCountryTier(country);
  if (tier === "Hegemon") return Math.min(50, 32 + Math.round(country.provinces.length / 6));
  if (tier === "Empire") return 25;
  return Math.min(5, 1 + Math.floor(country.provinces.length / 18));
}

function rebelProvinceCount(country: Country, rngState: RngState) {
  const tier = getCountryTier(country);
  const base = tier === "Hegemon" ? 0.18 : tier === "Empire" ? 0.12 : 0.08;
  const jitter = nextInt(rngState, 0, 8) / 100;
  return Math.max(1, Math.min(country.provinces.length - 1, Math.round(country.provinces.length * (base + jitter))));
}

function takeRebelProvinces(country: Country, rngState: RngState) {
  const shuffled = [...country.provinces];
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = nextInt(rngState, 0, i);
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, rebelProvinceCount(country, rngState));
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

function countrySpecialModifiers(countryId: string, provinceCount: number) {
  const modifiers = [];
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
  } else if (strategicPowerFor(countryId, provinceCount) >= 52) {
    modifiers.push({ label: "Continental Mass", value: 8, description: "Large territory creates operational resilience." });
  } else if (strategicPowerFor(countryId, provinceCount) >= 30) {
    modifiers.push({ label: "Regional Command", value: 5, description: "Medium-scale administration improves mobilization." });
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
  EGY: "North Africa",
};

function continentForCountry(countryId: string, capital: CapitalRecord | null): string {
  return CONTINENT_OVERRIDES[countryId] ?? continentFromCapital(capital);
}

function regionForCountry(countryId: string, capital: CapitalRecord | null): string {
  return REGION_OVERRIDES[countryId] ?? regionFromCapital(capital);
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
  const label = classifier(selectedCountryId, selectedCapital);
  const eligibleCountryIds = aliveCountryIds.filter(countryId => classifier(countryId, activeCapitalFor(countryId, capitals)) === label);

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

  if (turn.action === "camp") {
    return `${active} rolled 0 and built an army camp.`;
  }

  if (turn.action === "counter") {
    return `${active} pressed into ${target}, rolled ${turn.roll}, and counter operations cost it ${turn.capturedProvinces.length} province(s): ${taken}.`;
  }

  return `${active} attacked ${target}, rolled +${turn.roll}, and captured ${turn.capturedProvinces.length} province(s): ${taken}.`;
}

export function getCountryCost(country: Country): number {
  return countryCost(country);
}

export function getCountryTier(country: Country) {
  return resolveTier(country.strategicPower, country.id);
}

export function getCountrySpecialModifierTotal(country: Country) {
  return country.specialModifiers.reduce((total, modifier) => total + modifier.value, 0);
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
  rngState: createRng(INITIAL_SEED),

  initializeGame: async () => {
    const assets = await loadMapAssets();
    const rngState = createRng(INITIAL_SEED);

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
      countryMap[c.id] = {
        id: c.id,
        name: displayName(c.id),
        flag: flagFor(c.id),
        provinces: c.provinceIds,
        strategicPower: strategicPowerFor(c.id, c.provinceIds.length),
        capitalProvinceId: c.capitalProvinceId,
        government,
        specialModifiers: countrySpecialModifiers(c.id, c.provinceIds.length),
        armyCampsCount: 0,
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
      rngState,
      player: {
        tickets: 500,
        campaignFavoriteCountryId: null,
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

    set({
      campaignScope,
      player: {
        ...state.player,
        tickets: state.player.tickets - cost,
        campaignFavoriteCountryId: countryId,
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
    let rebellionsThisHorizon = 0;

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
      if (rebellionsThisHorizon < 3 && chance > 0 && nextInt(rngState, 1, 100) <= chance) {
        const rebelProvinceIds = takeRebelProvinces(updatedCountry, rngState);
        if (rebelProvinceIds.length > 0 && rebelProvinceIds.length < updatedCountry.provinces.length) {
          const rebelId = `REB_${countryId}_${state.logs.length}_${rebelCountryIds.length}`;
          const rebelGovernment = rebelGovernmentFor(updatedCountry);
          const rebelCountry: Country = {
            id: rebelId,
            name: `${updatedCountry.name} Rebels`,
            flag: "⚑",
            provinces: rebelProvinceIds,
            strategicPower: rebelPowerFor(updatedCountry, rebelProvinceIds.length),
            capitalProvinceId: rebelProvinceIds[0],
            government: rebelGovernment,
            specialModifiers: [
              {
                label: "Insurgent Momentum",
                value: 9,
                description: "A fresh breakaway force receives early initiative.",
              },
            ],
            armyCampsCount: 0,
            eventModifier: nextInt(rngState, 2, 8),
            isAlive: true,
          };

          countries[countryId] = {
            ...updatedCountry,
            provinces: updatedCountry.provinces.filter(provinceId => !rebelProvinceIds.includes(provinceId)),
            eventModifier: Math.min(updatedCountry.eventModifier, updatedCountry.eventModifier - 3),
          };
          countries[rebelId] = rebelCountry;
          rebelCountryIds.push(rebelId);
          rebellionsThisHorizon += 1;
          logs.push(`${rebelCountry.name} broke away from ${updatedCountry.name}, seizing ${rebelProvinceIds.length} province(s).`);
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
      set({
        activeWars: [],
        selectedWarId: null,
        stage: winnerId === state.player.campaignFavoriteCountryId ? "CombatResult" : "GameOver",
        logs: [...state.logs, winnerId ? `${state.countries[winnerId].name} is the last country standing.` : "No countries remain in scope."],
      });
      return;
    }

    const rngState = { ...state.rngState };
    const result = runMatchmaking(scopedCountries, state.provinces, [], rngState, 6);
    const logs = [...state.logs];
    if (result.newWars.length === 0) {
      logs.push("No in-scope border wars erupted.");
    } else {
      result.newWars.forEach(war => {
        logs.push(`War erupted: ${state.countries[war.attackerId].name} vs ${state.countries[war.defenderId].name}.`);
      });
    }

    set({
      activeWars: result.newWars,
      selectedWarId: result.newWars[0]?.id ?? null,
      warTurns: {},
      completedWarResults: [],
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
    const war = state.activeWars.find(candidate => candidate.id === state.selectedWarId);
    if (!war) return;

    const attacker = { ...state.countries[war.attackerId] };
    const defender = { ...state.countries[war.defenderId] };
    const adjacencyMap: Record<string, string[]> = {};
    Object.values(state.provinces).forEach(province => {
      adjacencyMap[province.id] = province.adjacentProvinceIds;
    });

    const rngState = { ...state.rngState };
    const turn = resolveCombatTurn(attacker, defender, adjacencyMap, rngState);
    const countries = {
      ...state.countries,
      [attacker.id]: attacker,
      [defender.id]: defender,
    };
    let activeWars = state.activeWars;
    let player = state.player;
    let stage: CampaignStage = "Combat";
    let currentBet = state.currentBet;
    let selectedWarId = state.selectedWarId;
    const logs = [...state.logs, describeCombatTurn(turn, countries, state.provinces)];
    const warTurns = {
      ...state.warTurns,
      [war.id]: [...(state.warTurns[war.id] ?? []), turn],
    };
    let completedWarResults = state.completedWarResults;
    let lastCombatOutcome = state.lastCombatOutcome;

    if (turn.winnerId) {
      const loserId = turn.winnerId === attacker.id ? defender.id : attacker.id;
      countries[loserId] = { ...countries[loserId], isAlive: false, provinces: [] };
      const bet = state.player.activeWarBets.get(war.id) ?? null;
      const wonBet = bet ? bet.predictedWinnerId === turn.winnerId : null;
      const nextTickets = bet
        ? (wonBet ? state.player.tickets + bet.amount * 2 : state.player.tickets - bet.amount)
        : state.player.tickets;
      const result: WarResult = {
        warId: war.id,
        winnerId: turn.winnerId,
        loserId,
        bet,
        wonBet,
        turns: warTurns[war.id],
      };

      completedWarResults = [...state.completedWarResults, result];
      activeWars = state.activeWars.filter(candidate => candidate.id !== war.id);
      player = { ...state.player, tickets: Math.max(0, nextTickets) };
      currentBet = null;
      selectedWarId = activeWars[0]?.id ?? null;
      lastCombatOutcome = {
        attackerId: attacker.id,
        defenderId: defender.id,
        winnerId: turn.winnerId,
        rounds: warTurns[war.id].map(round => ({
          activeCountryId: round.activeCountryId,
          roll: round.roll,
          capturedProvinces: round.capturedProvinces,
        })),
      };
      logs.push(`${countries[turn.winnerId].name} won the war after ${warTurns[war.id].length} rolls.`);
      if (bet) {
        logs.push(wonBet ? `Bet won. Payout: ${bet.amount * 2} tickets.` : `Bet lost. Stake forfeited: ${bet.amount} tickets.`);
        if (nextTickets <= 0) {
          logs.push("Wallet is empty. Next bets must be earned from future payouts or safety-net rules.");
        }
      }
      stage = activeWars.length > 0 ? "WarSelection" : "CombatResult";
    }

    const provinces = syncProvinceOwners(state.provinces, countries);

    set({
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
      stage,
      logs,
    });
  },

  skipSelectedWar: () => {
    let guard = 1200;
    while (guard > 0) {
      const before = get();
      const warId = before.selectedWarId;
      if (!warId || !before.activeWars.some(war => war.id === warId) || before.stage === "GameOver") break;
      get().rollSelectedWarTurn();
      const after = get();
      if (!after.activeWars.some(war => war.id === warId)) break;
      guard -= 1;
    }
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
      set({
        stage: winnerId === state.player.campaignFavoriteCountryId ? "CombatResult" : "GameOver",
        logs: [...state.logs, winnerId ? `${state.countries[winnerId].name} is the last country standing.` : "No countries remain in scope."],
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
