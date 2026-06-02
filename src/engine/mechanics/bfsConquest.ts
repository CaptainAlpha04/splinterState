export type ConquestResult = {
  capturedProvinceIds: string[];
};

export function bfsConquest(
  startProvinceIds: string[],
  targetProvinceIds: Set<string>,
  amount: number,
  adjacencyMap: Record<string, string[]>,
  fallbackAnchorProvinceId?: string
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

  if (captured.size === 0 && targetProvinceIds.size > 0 && fallbackAnchorProvinceId) {
    const fallbackCaptured = new Set<string>();
    const fallbackQueue = [fallbackAnchorProvinceId];
    const fallbackVisited = new Set<string>();

    while (fallbackQueue.length > 0 && fallbackCaptured.size < amount) {
      const current = fallbackQueue.shift()!;
      if (fallbackVisited.has(current)) continue;
      fallbackVisited.add(current);

      if (targetProvinceIds.has(current)) {
        fallbackCaptured.add(current);
      }

      (adjacencyMap[current] || []).forEach(neighbor => {
        if (!fallbackVisited.has(neighbor)) {
          fallbackQueue.push(neighbor);
        }
      });
    }

    if (fallbackCaptured.size > 0) {
      return { capturedProvinceIds: Array.from(fallbackCaptured) };
    }
  }

  if (captured.size === 0 && targetProvinceIds.size > 0) {
    return { capturedProvinceIds: largestTargetPocket(targetProvinceIds, amount, adjacencyMap) };
  }

  return { capturedProvinceIds: Array.from(captured) };
}

function largestTargetPocket(
  targetProvinceIds: Set<string>,
  amount: number,
  adjacencyMap: Record<string, string[]>
) {
  const visited = new Set<string>();
  const pockets: string[][] = [];

  targetProvinceIds.forEach(provinceId => {
    if (visited.has(provinceId)) return;
    const pocket: string[] = [];
    const queue = [provinceId];

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (visited.has(current)) continue;
      visited.add(current);
      pocket.push(current);

      (adjacencyMap[current] || []).forEach(neighbor => {
        if (targetProvinceIds.has(neighbor) && !visited.has(neighbor)) {
          queue.push(neighbor);
        }
      });
    }

    pockets.push(pocket.sort());
  });

  return pockets
    .sort((a, b) => b.length - a.length || a[0].localeCompare(b[0]))[0]
    ?.slice(0, amount) ?? [];
}
