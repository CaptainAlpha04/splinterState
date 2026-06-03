export type ActiveWar = {
  id: string;
  attackerId: string;
  defenderId: string;
  attackerOccupiedCapital: boolean;
  defenderOccupiedCapital: boolean;
  incineratedProvinceIds: string[];
  usedNukesByCountryId?: Record<string, boolean>;
  initiativePenalties?: Record<string, number>;
};
