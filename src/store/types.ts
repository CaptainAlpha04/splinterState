import type { Country } from "../engine/models/country";
import type { Province } from "../engine/models/province";
import type { ActiveWar } from "../engine/models/war";
import type { PlayerState } from "../engine/models/player";
import type { CapitalRecord } from "../lib/data/loadMapAssets";
import type { CombatOutcome, CombatTurnOutcome } from "../engine/mechanics/combatResolution";
import type { RngState } from "../engine/rng/seededRng";

export type TurnResolution = {
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


export type CampaignScale = "World War" | "Continent War" | "Regional War" | "Story Mode";
export type CampaignStage =
  | "PickScope"
  | "PickFavorite"
  | "EventHorizon"
  | "ManualWarPairing"
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
  focusedCountryId: string | null;
  selectedWarId: string | null;
  campaignScope: CampaignScope | null;
  isStoryMode: boolean;
  storyModeScale: "Regional War" | "Continent War" | "World War" | null;
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
  playerControlMode: "auto" | "manual";
  manualControlAttackSkipped: boolean;

  initializeGame: () => Promise<void>;
  selectProvince: (provinceId: string | null) => void;
  selectCountry: (countryId: string | null) => void;
  setCampaignScale: (scale: CampaignScale) => void;
  chooseFavorite: (countryId: string, controlMode: "auto" | "manual") => void;
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
  focusCountry: (countryId: string | null) => void;
  resetCampaign: () => void;
  resolveManualWarPairing: (targetCountryId: string | null) => void;
};
