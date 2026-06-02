export type ConquestResult = {
  capturedProvinceIds: string[];
};

export function bfsConquest(
  startProvinceIds: string[],
  targetProvinceIds: Set<string>,
  amount: number,
  adjacencyMap: Record<string, string[]>
): ConquestResult {
  if (amount <= 0) return { capturedProvinceIds: [] };

  const captured = new Set<string>();
  const queue = [...startProvinceIds];
  const visited = new Set<string>(startProvinceIds);

  while (queue.length > 0 && captured.size < amount) {
    const current = queue.shift()!;
    const neighbors = adjacencyMap[current] || [];

    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        visited.add(neighbor);
        if (targetProvinceIds.has(neighbor)) {
          captured.add(neighbor);
          queue.push(neighbor); // Expand from newly captured territory
          if (captured.size >= amount) {
            break;
          }
        }
      }
    }
  }

  if (captured.size === 0 && targetProvinceIds.size > 0) {
    return { capturedProvinceIds: Array.from(targetProvinceIds).slice(0, amount) };
  }

  return { capturedProvinceIds: Array.from(captured) };
}
