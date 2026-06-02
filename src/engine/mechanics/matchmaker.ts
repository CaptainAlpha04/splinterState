import type { Country } from "../models/country";
import type { Province } from "../models/province";
import type { ActiveWar } from "../models/war";
import { nextInt, type RngState } from "../rng/seededRng";

export type MatchmakingResult = {
  newWars: ActiveWar[];
};

export function runMatchmaking(
  countries: Record<string, Country>,
  provinces: Record<string, Province>,
  activeWars: ActiveWar[],
  rngState: RngState,
  maxWars: number = 5
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

  for (const attacker of availableCountries) {
    if (newWars.length + activeWars.length >= maxWars) break;
    if (busyCountryIds.has(attacker.id)) continue;

    // Find all bordering neighbor countries
    const neighborCountryIds = new Set<string>();
    
    attacker.provinces.forEach(provId => {
      const prov = provinces[provId];
      if (!prov || prov.isIncinerated) return;
      prov.adjacentProvinceIds.forEach(adjId => {
        const adjacentProvince = provinces[adjId];
        if (adjacentProvince?.isIncinerated) return;
        // Find which country owns this adjacent province
        const ownerId = ownerByProvinceId.get(adjId);
        const owner = ownerId ? countries[ownerId] : null;
        if (owner && owner.id !== attacker.id && !busyCountryIds.has(owner.id)) {
          neighborCountryIds.add(owner.id);
        }
      });
    });

    const neighbors = Array.from(neighborCountryIds);
    const fallbackTargets = availableCountries
      .filter(country => country.id !== attacker.id && !busyCountryIds.has(country.id))
      .map(country => country.id);
    const targetPool = neighbors.length > 0 ? neighbors : fallbackTargets;

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
