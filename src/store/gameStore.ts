import { create } from "zustand";
import type { Country } from "../engine/models/country";
import type { Province } from "../engine/models/province";
import type { ActiveWar } from "../engine/models/war";
import type { GameState, TurnResolution } from "./types";
import { createEntropySeed, createRng, nextInt } from "../engine/rng/seededRng";
import {
  saveTicketWallet,
  loadTicketWallet,
  countryCost,
  initialMapColor,
  activeCapitalFor,
  regionForCountry,
  continentForCountry,
  buildScope,
  syncProvinceOwners,
  describeCombatTurn,
  isRebelSuppressed,
  rebelGovernmentFor,
  rebelReligionFor,
  buildBreakawayCountry,
  dominantInitialCountryId,
  eventLabel,
  plausibleGovernment,
  countrySpecialModifiers,
  occupiedHomelandBlocks,
  rebelPowerFor,
  disconnectedEnclaveBlock,
  takeRebelProvinces,
  campaignFavoritePlacement,
  campaignPayoutForRank,
  campaignConclusionLog,
  isRebelWar,
  isIndependenceWar,
  reclaimedIndependenceProvinces,
  incineratedInWar,
  diceOnlyLog,
  resolveWarTurnState,
  newCampaignRng,
  strategicPowerFor,
  normalizeRegion,
  normalizeSubregion,
  rebellionChance,
  getValidTargetsForCountry,
} from "./helpers";
import { cleanNuclearFallout } from "./fallout";
import { loadMapAssets } from "../lib/data/loadMapAssets";
import { runMatchmaking } from "../engine/mechanics/matchmaker";
import {
  buildMetadataIndex,
  controlledDevelopmentScore,
  metadataFlag,
  metadataName,
  metadataRegion,
  metadataSubregion,
  religionForCountry,
  rebelName,
  religionModifier,
  religionModifierLabel,
} from "../engine/content/countryContent";

export type {
  CampaignScale,
  CampaignStage,
  CampaignScope,
  WarBet,
  WarResult,
  GameState,
} from "./types";

export {
  getCountryCost,
  getCountryTier,
  getCountrySpecialModifierTotal,
  getCountryDevelopmentScore,
  getCountryReligionModifier,
  getCountryReligionModifierLabel,
  getValidTargetsForCountry,
} from "./helpers";

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
  focusedCountryId: null,
  selectedWarId: null,
  campaignScope: null,
  isStoryMode: false,
  storyModeScale: null,
  currentBet: null,
  lastCombatOutcome: null,
  warTurns: {},
  completedWarResults: [],
  countryPlacements: {},
  suppressedRebelKeys: {},
  campaignPhase: 0,
  forcedWars: [],
  rngState: newCampaignRng(createRng, createEntropySeed),
  isResolvingTurn: false,
  isAutoPlaying: false,
  autoSpeed: 1,
  playerControlMode: "auto",
  manualControlAttackSkipped: false,

  initializeGame: async () => {
    const assets = await loadMapAssets();
    const rngState = newCampaignRng(createRng, createEntropySeed);
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
        rings: p.rings,
        bounds: p.bounds,
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
      isStoryMode: false,
      storyModeScale: null,
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
      playerControlMode: "auto",
      manualControlAttackSkipped: false,
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

  focusCountry: (countryId) => {
    set({ focusedCountryId: countryId });
  },

  setCampaignScale: (scale) => {
    const state = get();
    const isStory = scale === "Story Mode";
    const actualScale = isStory ? "Regional War" : scale;
    const scope = buildScope(actualScale, state.selectedCountryId, state.countries, state.capitals);
    set({
      isStoryMode: isStory,
      storyModeScale: isStory ? "Regional War" : null,
      campaignScope: {
        ...scope,
        scale: isStory ? "Story Mode" : scope.scale
      },
      stage: "PickFavorite",
      logs: [...state.logs, `${scale} selected: ${scope.label}. Pick a campaign favorite.`],
    });
  },

  chooseFavorite: (countryId, controlMode) => {
    const state = get();
    const country = state.countries[countryId];
    if (!country || !state.campaignScope?.eligibleCountryIds.includes(countryId)) return;

    const cost = countryCost(country);
    if (cost > state.player.tickets) {
      set({ logs: [...state.logs, `${country.name} costs ${cost} tickets. Wallet: ${state.player.tickets}.`] });
      return;
    }

    const isStory = state.isStoryMode;
    const buildScale = isStory ? "Regional War" : state.campaignScope.scale;
    const campaignScope = buildScope(buildScale, countryId, state.countries, state.capitals);
    const nextTickets = state.player.tickets - cost;
    saveTicketWallet(nextTickets);

    set({
      campaignScope: {
        ...campaignScope,
        scale: isStory ? "Story Mode" : campaignScope.scale,
      },
      player: {
        ...state.player,
        tickets: nextTickets,
        campaignFavoriteCountryId: countryId,
        campaignStake: cost,
      },
      selectedCountryId: countryId,
      stage: "EventHorizon",
      playerControlMode: controlMode,
      manualControlAttackSkipped: false,
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

    const nextStage = state.playerControlMode === "manual" ? "ManualWarPairing" : "WarSelection";
    set({
      countries,
      provinces,
      campaignScope,
      rngState,
      stage: nextStage,
      currentBet: null,
      selectedWarId: null,
      lastCombatOutcome: null,
      warTurns: {},
      completedWarResults: [],
      forcedWars,
      campaignPhase: state.campaignPhase + 1,
      logs,
      manualControlAttackSkipped: false,
    });
    if (state.playerControlMode !== "manual") {
      get().generateWars();
    }
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
      const favorite = state.player.campaignFavoriteCountryId ? state.countries[state.player.campaignFavoriteCountryId] : null;

      // Story Mode progression check
      if (state.isStoryMode && winnerId && winnerId === state.player.campaignFavoriteCountryId) {
        const currentScale = state.storyModeScale;
        if (currentScale === "Regional War") {
          const nextScope = buildScope("Continent War", winnerId, state.countries, state.capitals);
          set({
            storyModeScale: "Continent War",
            campaignScope: {
              ...nextScope,
              scale: "Story Mode",
            },
            activeWars: [],
            selectedWarId: null,
            stage: "EventHorizon",
            completedWarResults: [],
            forcedWars: [],
            campaignPhase: state.campaignPhase + 1,
            logs: [
              ...state.logs,
              `🏆 REGIONAL DOMINANCE ACHIEVED! ${favorite?.flag} ${favorite?.name} has unified the region of ${state.campaignScope?.label}.`,
              `🌍 Story Mode: Entering CONTINENTAL DOMINANCE in ${nextScope.label}. Roll event modifiers for the new continental contenders.`
            ]
          });
          return;
        } else if (currentScale === "Continent War") {
          const nextScope = buildScope("World War", winnerId, state.countries, state.capitals);
          set({
            storyModeScale: "World War",
            campaignScope: {
              ...nextScope,
              scale: "Story Mode",
            },
            activeWars: [],
            selectedWarId: null,
            stage: "EventHorizon",
            completedWarResults: [],
            forcedWars: [],
            campaignPhase: state.campaignPhase + 1,
            logs: [
              ...state.logs,
              `🏆 CONTINENTAL DOMINANCE ACHIEVED! ${favorite?.flag} ${favorite?.name} has unified the continent of ${state.campaignScope?.label}.`,
              `🌌 Story Mode: Entering WORLD DOMINANCE. Roll event modifiers for the remaining global powers.`
            ]
          });
          return;
        }
      }

      const payout = campaignPayoutForRank(state.player.campaignStake, rank);
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
    const skipAttackerIds = new Set<string>();
    if (state.playerControlMode === "manual" && state.manualControlAttackSkipped) {
      if (state.player.campaignFavoriteCountryId) {
        skipAttackerIds.add(state.player.campaignFavoriteCountryId);
      }
    }
    const result = runMatchmaking(
      scopedCountries,
      state.provinces,
      forcedWars,
      rngState,
      6,
      state.capitals,
      skipAttackerIds
    );
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

    const { provinces: cleanedProvinces, countries: cleanedCountries, logs: falloutLogs } = cleanNuclearFallout(state.provinces, state.countries);

    const aliveInScope = state.campaignScope
      ? state.campaignScope.eligibleCountryIds.filter(countryId => cleanedCountries[countryId]?.isAlive)
      : Object.values(cleanedCountries).filter(country => country.isAlive).map(country => country.id);

    if (aliveInScope.length <= 1) {
      const winnerId = aliveInScope[0] ?? null;
      const countryPlacements = winnerId ? { ...state.countryPlacements, [winnerId]: 1 } : state.countryPlacements;
      const rank = campaignFavoritePlacement(state.player.campaignFavoriteCountryId, winnerId, countryPlacements);
      const favorite = state.player.campaignFavoriteCountryId ? cleanedCountries[state.player.campaignFavoriteCountryId] : null;

      // Story Mode progression check
      if (state.isStoryMode && winnerId && winnerId === state.player.campaignFavoriteCountryId) {
        const currentScale = state.storyModeScale;
        if (currentScale === "Regional War") {
          const nextScope = buildScope("Continent War", winnerId, cleanedCountries, state.capitals);
          set({
            provinces: cleanedProvinces,
            countries: cleanedCountries,
            storyModeScale: "Continent War",
            campaignScope: {
              ...nextScope,
              scale: "Story Mode",
            },
            activeWars: [],
            selectedWarId: null,
            stage: "EventHorizon",
            completedWarResults: [],
            forcedWars: [],
            campaignPhase: state.campaignPhase + 1,
            logs: [
              ...state.logs,
              ...falloutLogs,
              `🏆 REGIONAL DOMINANCE ACHIEVED! ${favorite?.flag} ${favorite?.name} has unified the region of ${state.campaignScope?.label}.`,
              `🌍 Story Mode: Entering CONTINENTAL DOMINANCE in ${nextScope.label}. Roll event modifiers for the new continental contenders.`
            ]
          });
          return;
        } else if (currentScale === "Continent War") {
          const nextScope = buildScope("World War", winnerId, cleanedCountries, state.capitals);
          set({
            provinces: cleanedProvinces,
            countries: cleanedCountries,
            storyModeScale: "World War",
            campaignScope: {
              ...nextScope,
              scale: "Story Mode",
            },
            activeWars: [],
            selectedWarId: null,
            stage: "EventHorizon",
            completedWarResults: [],
            forcedWars: [],
            campaignPhase: state.campaignPhase + 1,
            logs: [
              ...state.logs,
              ...falloutLogs,
              `🏆 CONTINENTAL DOMINANCE ACHIEVED! ${favorite?.flag} ${favorite?.name} has unified the continent of ${state.campaignScope?.label}.`,
              `🌌 Story Mode: Entering WORLD DOMINANCE. Roll event modifiers for the remaining global powers.`
            ]
          });
          return;
        }
      }

      const payout = campaignPayoutForRank(state.player.campaignStake, rank);
      const nextTickets = state.player.tickets + payout;
      saveTicketWallet(nextTickets);
      set({
        provinces: cleanedProvinces,
        countries: cleanedCountries,
        stage: rank <= 3 ? "CampaignWon" : "GameOver",
        player: {
          ...state.player,
          tickets: nextTickets,
          campaignStake: 0,
        },
        countryPlacements,
        logs: [
          ...state.logs,
          ...falloutLogs,
          winnerId ? `${cleanedCountries[winnerId].name} is the last country standing.` : "No countries remain in scope.",
          campaignConclusionLog(rank, payout, favorite),
        ],
      });
      return;
    }

    set({
      provinces: cleanedProvinces,
      countries: cleanedCountries,
      stage: "EventHorizon",
      selectedWarId: null,
      currentBet: null,
      logs: [...state.logs, ...falloutLogs],
    });
  },

  resolveSelectedWar: () => {
    get().skipSelectedWar();
  },

  resetCampaign: () => {
    void get().initializeGame();
  },

  resolveManualWarPairing: (targetCountryId) => {
    const state = get();
    const favoriteId = state.player.campaignFavoriteCountryId;
    if (!favoriteId) return;

    const logs = [...state.logs];
    if (targetCountryId) {
      const targetCountry = state.countries[targetCountryId];
      const manualWar: ActiveWar = {
        id: `${favoriteId}_vs_${targetCountryId}_${Date.now()}`,
        attackerId: favoriteId,
        defenderId: targetCountryId,
        attackerOccupiedCapital: false,
        defenderOccupiedCapital: false,
        incineratedProvinceIds: [],
      };
      logs.push(`Manual targeting: Declared war on ${targetCountry?.name ?? targetCountryId}.`);
      set({
        forcedWars: [...state.forcedWars, manualWar],
        stage: "WarSelection",
        manualControlAttackSkipped: false,
        logs,
      });
    } else {
      logs.push("Manual targeting: Skipped attack for this phase.");
      set({
        stage: "WarSelection",
        manualControlAttackSkipped: true,
        logs,
      });
    }
    get().generateWars();
  },
}));
