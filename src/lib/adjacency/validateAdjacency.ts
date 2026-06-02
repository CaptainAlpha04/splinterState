import type { AdjacencyMap } from "./buildAdjacency";

export type AdjacencyIssue = {
  provinceId: string;
  message: string;
};

export function validateAdjacency(map: AdjacencyMap): AdjacencyIssue[] {
  const issues: AdjacencyIssue[] = [];

  Object.entries(map).forEach(([provinceId, neighbors]) => {
    if (neighbors.length === 0) {
      issues.push({
        provinceId,
        message: "Province has no neighbors.",
      });
    }
  });

  return issues;
}
