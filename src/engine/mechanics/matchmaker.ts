import type { Country } from "../models/country";
import type { Province } from "../models/province";
import type { ActiveWar } from "../models/war";
import { nextInt, type RngState } from "../rng/seededRng";

export type MatchmakingCapital = {
  countryId: string;
  latitude: number;
  longitude: number;
};

export type MatchmakingResult = {
  newWars: ActiveWar[];
};

export function runMatchmaking(
  countries: Record<string, Country>,
  provinces: Record<string, Province>,
  activeWars: ActiveWar[],
  rngState: RngState,
  maxWars: number = 5,
  capitals: MatchmakingCapital[] = []
): MatchmakingResult {
  const newWars: ActiveWar[] = [];
  
  const busyCountryIds = new Set<string>();
  activeWars.forEach(w => {
    busyCountryIds.add(w.attackerId);
    busyCountryIds.add(w.defenderId);
  });

  const availableCountries = Object.values(countries).filter(c => c.isAlive && !busyCountryIds.has(c.id));
  const ownerByProvinceId = new Map<string, string>();

  Object.values(countries).forEach(country => {
    if (!country.isAlive) return;
    country.provinces.forEach(provinceId => ownerByProvinceId.set(provinceId, country.id));
  });
  
  // Shuffle available countries
  for (let i = availableCountries.length - 1; i > 0; i--) {
    const j = nextInt(rngState, 0, i);
    [availableCountries[i], availableCountries[j]] = [availableCountries[j], availableCountries[i]];
  }

  const landNeighborIdsByCountry = new Map<string, Set<string>>();
  availableCountries.forEach(country => {
    landNeighborIdsByCountry.set(country.id, collectLandNeighbors(country, countries, provinces, ownerByProvinceId));
  });

  for (const attacker of availableCountries) {
    if (newWars.length + activeWars.length >= maxWars) break;
    if (busyCountryIds.has(attacker.id)) continue;

    const neighborCountryIds = landNeighborIdsByCountry.get(attacker.id) ?? new Set<string>();

    const neighbors = Array.from(neighborCountryIds).filter(countryId => !busyCountryIds.has(countryId));
    const navalTargets = neighbors.length === 0
      ? nearbyNavalTargets(attacker, availableCountries, capitals, landNeighborIdsByCountry, busyCountryIds)
      : [];
    const targetPool = neighbors.length > 0 ? neighbors : navalTargets;

    if (targetPool.length > 0) {
      const targetId = targetPool[nextInt(rngState, 0, targetPool.length - 1)];
      const defender = countries[targetId];

      if (defender && !busyCountryIds.has(defender.id)) {
        newWars.push({
          id: `${attacker.id}_vs_${defender.id}_${Date.now()}`,
          attackerId: attacker.id,
          defenderId: defender.id,
          attackerOccupiedCapital: false,
          defenderOccupiedCapital: false,
          incineratedProvinceIds: []
        });

        busyCountryIds.add(attacker.id);
        busyCountryIds.add(defender.id);
      }
    }
  }

  return { newWars };
}

function collectLandNeighbors(
  country: Country,
  countries: Record<string, Country>,
  provinces: Record<string, Province>,
  ownerByProvinceId: Map<string, string>
) {
  const neighborCountryIds = new Set<string>();
  country.provinces.forEach(provId => {
    const prov = provinces[provId];
    if (!prov || prov.isIncinerated) return;
    prov.adjacentProvinceIds.forEach(adjId => {
      const adjacentProvince = provinces[adjId];
      if (adjacentProvince?.isIncinerated) return;
      const ownerId = ownerByProvinceId.get(adjId);
      const owner = ownerId ? countries[ownerId] : null;
      if (owner && owner.id !== country.id) {
        neighborCountryIds.add(owner.id);
      }
    });
  });
  return neighborCountryIds;
}

function nearbyNavalTargets(
  attacker: Country,
  availableCountries: Country[],
  capitals: MatchmakingCapital[],
  landNeighborIdsByCountry: Map<string, Set<string>>,
  busyCountryIds: Set<string>
) {
  const attackerCapital = capitals.find(capital => capital.countryId === attacker.id);
  if (!attackerCapital) return [];

  const attackerIsIsolated = (landNeighborIdsByCountry.get(attacker.id)?.size ?? 0) === 0;
  if (!attackerIsIsolated) return [];

  const candidates = availableCountries
    .filter(country => country.id !== attacker.id && !busyCountryIds.has(country.id))
    .map(country => {
      const targetCapital = capitals.find(capital => capital.countryId === country.id);
      return {
        country,
        distance: targetCapital ? capitalDistance(attackerCapital, targetCapital) : Number.POSITIVE_INFINITY,
      };
    })
    .filter(candidate => Number.isFinite(candidate.distance))
    .sort((a, b) => a.distance - b.distance);

  const nearby = candidates.filter(candidate => candidate.distance <= 3200);
  return (nearby.length > 0 ? nearby : candidates)
    .slice(0, 4)
    .map(candidate => candidate.country.id);
}

function capitalDistance(a: MatchmakingCapital, b: MatchmakingCapital) {
  const toRadians = (value: number) => value * Math.PI / 180;
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
}
