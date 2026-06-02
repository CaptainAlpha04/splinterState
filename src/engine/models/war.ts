export type ActiveWar = {
  id: string;
  attackerId: string;
  defenderId: string;
  attackerOccupiedCapital: boolean;
  defenderOccupiedCapital: boolean;
  incineratedProvinceIds: string[];
};
