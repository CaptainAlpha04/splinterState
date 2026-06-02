export type NuclearStrikeResult = {
  incineratedProvinceIds: string[];
  capturedProvinceIds: string[];
};

export function resolveNuclearStrike(): NuclearStrikeResult {
  // TODO: Implement BFS-based nuclear capture + incineration.
  return { incineratedProvinceIds: [], capturedProvinceIds: [] };
}
