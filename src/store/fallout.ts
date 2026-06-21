import type { Country } from "../engine/models/country";
import type { Province } from "../engine/models/province";

export function cleanNuclearFallout(
  provinces: Record<string, Province>,
  countries: Record<string, Country>
): { provinces: Record<string, Province>; countries: Record<string, Country>; logs: string[] } {
  const nextProvinces = { ...provinces };
  const nextCountries = { ...countries };
  const logs: string[] = [];

  const incineratedIds = Object.keys(nextProvinces).filter(id => nextProvinces[id].isIncinerated);

  if (incineratedIds.length === 0) {
    return { provinces: nextProvinces, countries: nextCountries, logs };
  }

  const countryProvinces: Record<string, string[]> = {};
  Object.keys(nextCountries).forEach(cId => {
    countryProvinces[cId] = [...nextCountries[cId].provinces];
  });

  incineratedIds.forEach(provId => {
    const province = nextProvinces[provId];
    const previousOwnerId = province.ownerId;

    const neighborCounts: Record<string, number> = {};
    province.adjacentProvinceIds.forEach(adjId => {
      const adjProv = nextProvinces[adjId];
      if (adjProv) {
        const ownerId = adjProv.ownerId;
        if (ownerId && nextCountries[ownerId]?.isAlive && ownerId !== "ATA") {
          neighborCounts[ownerId] = (neighborCounts[ownerId] ?? 0) + 1;
        }
      }
    });

    let newOwnerId = previousOwnerId;
    const candidates = Object.entries(neighborCounts);

    if (candidates.length > 0) {
      candidates.sort((a, b) => {
        const countDiff = b[1] - a[1];
        if (countDiff !== 0) return countDiff;
        const powerA = nextCountries[a[0]]?.strategicPower ?? 0;
        const powerB = nextCountries[b[0]]?.strategicPower ?? 0;
        return powerB - powerA;
      });

      newOwnerId = candidates[0][0];
    }

    nextProvinces[provId] = {
      ...province,
      isIncinerated: false,
      ownerId: newOwnerId,
    };

    if (previousOwnerId && previousOwnerId !== newOwnerId) {
      if (countryProvinces[previousOwnerId]) {
        countryProvinces[previousOwnerId] = countryProvinces[previousOwnerId].filter(id => id !== provId);
      }
      if (countryProvinces[newOwnerId]) {
        if (!countryProvinces[newOwnerId].includes(provId)) {
          countryProvinces[newOwnerId].push(provId);
        }
      }
      
      const prevName = nextCountries[previousOwnerId]?.name ?? previousOwnerId;
      const newName = nextCountries[newOwnerId]?.name ?? newOwnerId;
      logs.push(`☢️ Fallout cleared: Province ${province.name || provId} reclaimed by neighbor ${newName} (previously owned by ${prevName}).`);
    } else {
      const ownerName = nextCountries[newOwnerId]?.name ?? newOwnerId;
      logs.push(`☢️ Fallout cleared: Province ${province.name || provId} returned back to ${ownerName}.`);
    }
  });

  Object.keys(countryProvinces).forEach(cId => {
    if (nextCountries[cId]) {
      nextCountries[cId] = {
        ...nextCountries[cId],
        provinces: countryProvinces[cId],
        isAlive: cId === "ATA" ? false : countryProvinces[cId].length > 0,
      };
    }
  });

  return { provinces: nextProvinces, countries: nextCountries, logs };
}
