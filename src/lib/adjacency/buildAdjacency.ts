export type Polygon = {
  id: string;
  rings: Array<Array<[number, number]>>;
};

export type AdjacencyMap = Record<string, string[]>;

function pointKey(point: [number, number]): string {
  return `${point[0]},${point[1]}`;
}

function segmentKey(a: [number, number], b: [number, number]): string {
  const aKey = pointKey(a);
  const bKey = pointKey(b);
  return aKey < bKey ? `${aKey}|${bKey}` : `${bKey}|${aKey}`;
}

export function buildAdjacency(polygons: Polygon[]): AdjacencyMap {
  const segmentToProvinces = new Map<string, Set<string>>();
  const adjacency = new Map<string, Set<string>>();

  polygons.forEach((polygon) => {
    adjacency.set(polygon.id, new Set());
    polygon.rings.forEach((ring) => {
      for (let i = 0; i < ring.length - 1; i += 1) {
        const key = segmentKey(ring[i], ring[i + 1]);
        const set = segmentToProvinces.get(key) ?? new Set();
        set.add(polygon.id);
        segmentToProvinces.set(key, set);
      }
    });
  });

  segmentToProvinces.forEach((provinceIds) => {
    const ids = Array.from(provinceIds);
    if (ids.length < 2) return;
    for (let i = 0; i < ids.length; i += 1) {
      for (let j = i + 1; j < ids.length; j += 1) {
        adjacency.get(ids[i])?.add(ids[j]);
        adjacency.get(ids[j])?.add(ids[i]);
      }
    }
  });

  const result: AdjacencyMap = {};
  adjacency.forEach((neighbors, id) => {
    result[id] = Array.from(neighbors).sort();
  });

  return result;
}
