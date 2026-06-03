const fs = require("fs");
const path = require("path");

const RAW_DIR = path.join(__dirname, "..", "data", "raw");
const ASSET_DIR = path.join(__dirname, "..", "public", "map");

if (!fs.existsSync(ASSET_DIR)) {
  fs.mkdirSync(ASSET_DIR, { recursive: true });
}

const ADMIN1_FILE = path.join(RAW_DIR, "admin1.geojson");
const CAPITALS_FILE = path.join(RAW_DIR, "capitals.geojson");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

function toId(value) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "-")
    .replace(/[^A-Z0-9-]/g, "");
}

function quantize(value, precision) {
  const scale = Math.pow(10, precision);
  return Math.round(value * scale) / scale;
}

function getSqSegDist(p, p1, p2) {
  let x = p1[0];
  let y = p1[1];
  let dx = p2[0] - x;
  let dy = p2[1] - y;
  if (dx !== 0 || dy !== 0) {
    const t = ((p[0] - x) * dx + (p[1] - y) * dy) / (dx * dx + dy * dy);
    if (t > 1) {
      x = p2[0];
      y = p2[1];
    } else if (t > 0) {
      x += dx * t;
      y += dy * t;
    }
  }
  dx = p[0] - x;
  dy = p[1] - y;
  return dx * dx + dy * dy;
}

function simplifyRDP(points, epsilon) {
  if (points.length <= 2) return points;
  let maxSqDist = 0;
  let index = 0;
  const end = points.length - 1;
  for (let i = 1; i < end; i++) {
    const sqDist = getSqSegDist(points[i], points[0], points[end]);
    if (sqDist > maxSqDist) {
      index = i;
      maxSqDist = sqDist;
    }
  }
  if (maxSqDist > epsilon * epsilon) {
    const results1 = simplifyRDP(points.slice(0, index + 1), epsilon);
    const results2 = simplifyRDP(points.slice(index), epsilon);
    return results1.slice(0, results1.length - 1).concat(results2);
  }
  return [points[0], points[end]];
}

function pointKey(point) {
  return `${point[0]},${point[1]}`;
}

function segmentKey(a, b) {
  const aKey = pointKey(a);
  const bKey = pointKey(b);
  return aKey < bKey ? `${aKey}|${bKey}` : `${bKey}|${aKey}`;
}

function extractRings(geometry) {
  if (!geometry) return [];
  if (geometry.type === "Polygon") {
    return geometry.coordinates || [];
  }
  if (geometry.type === "MultiPolygon") {
    return geometry.coordinates.flat();
  }
  return [];
}

function buildAdjacency(polygons) {
  const segmentToProvinces = new Map();
  const adjacency = new Map();

  polygons.forEach((polygon) => {
    adjacency.set(polygon.id, new Set());
    polygon.rings.forEach((ring) => {
      for (let i = 0; i < ring.length - 1; i += 1) {
        const start = ring[i];
        const end = ring[i + 1];
        const key = segmentKey(start, end);
        const set = segmentToProvinces.get(key) || new Set();
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
        adjacency.get(ids[i]).add(ids[j]);
        adjacency.get(ids[j]).add(ids[i]);
      }
    }
  });

  const result = {};
  adjacency.forEach((neighbors, id) => {
    result[id] = Array.from(neighbors).sort();
  });

  return result;
}

function computeCentroid(ring) {
  let area = 0;
  let x = 0;
  let y = 0;

  for (let i = 0; i < ring.length - 1; i += 1) {
    const [x0, y0] = ring[i];
    const [x1, y1] = ring[i + 1];
    const cross = x0 * y1 - x1 * y0;
    area += cross;
    x += (x0 + x1) * cross;
    y += (y0 + y1) * cross;
  }

  if (area === 0) {
    const fallback = ring[0] || [0, 0];
    return { x: fallback[0], y: fallback[1] };
  }

  area *= 0.5;
  return { x: x / (6 * area), y: y / (6 * area) };
}

function distance(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function prepare() {
  if (!fs.existsSync(ADMIN1_FILE)) {
    throw new Error("Missing admin1.geojson in data/raw");
  }

  if (!fs.existsSync(CAPITALS_FILE)) {
    throw new Error("Missing capitals.geojson in data/raw");
  }

  const admin1 = readJson(ADMIN1_FILE);
  const capitalsRaw = readJson(CAPITALS_FILE);

  const rawProvinces = [];
  admin1.features.forEach((feature) => {
    const props = feature.properties || {};
    const countryId = toId(props.ADM0_A3 || props.adm0_a3 || props.SOV_A3);
    const admin1Name = props.NAME_1 || props.name || props.NAME || "Unknown";
    const admin1Code = props.ISO_3166_2 || props.adm1_code || admin1Name;
    const provinceId = toId(`${countryId}-${admin1Code}`);

    const rings = extractRings(feature.geometry).map((ring) =>
      ring.map((point) => [
        quantize(point[0], 5),
        quantize(point[1], 5),
      ])
    );
    rawProvinces.push({ id: provinceId, rings });
  });

  const adjacency = buildAdjacency(rawProvinces);

  const provinces = [];
  const provinceCentroids = new Map();

  admin1.features.forEach((feature) => {
    const props = feature.properties || {};
    const countryId = toId(props.ADM0_A3 || props.adm0_a3 || props.SOV_A3);
    const admin1Name = props.NAME_1 || props.name || props.NAME || "Unknown";
    const admin1Code = props.ISO_3166_2 || props.adm1_code || admin1Name;
    const provinceId = toId(`${countryId}-${admin1Code}`);

    const rings = extractRings(feature.geometry).map((ring) => {
      const simplified = simplifyRDP(ring, 0.02);
      return simplified.map((point) => [
        quantize(point[0], 5),
        quantize(point[1], 5),
      ]);
    });

    const centroid = computeCentroid(rings[0] || []);
    provinceCentroids.set(provinceId, centroid);

    provinces.push({
      id: provinceId,
      name: admin1Name,
      countryId,
      rings,
    });
  });

  const provinceRecords = provinces.map((province) => {
    const projectedRings = province.rings.map((ring) =>
      ring.map((pt) => [
        quantize(pt[0] + 180, 2),
        quantize(90 - pt[1], 2),
      ])
    );

    let minX = 360, maxX = 0, minY = 180, maxY = 0;
    projectedRings.forEach((ring) => {
      ring.forEach((pt) => {
        if (pt[0] < minX) minX = pt[0];
        if (pt[0] > maxX) maxX = pt[0];
        if (pt[1] < minY) minY = pt[1];
        if (pt[1] > maxY) maxY = pt[1];
      });
    });

    return {
      id: province.id,
      name: province.name,
      countryId: province.countryId,
      adjacentProvinceIds: adjacency[province.id] || [],
      rings: projectedRings,
      bounds: [quantize(minX, 2), quantize(minY, 2), quantize(maxX, 2), quantize(maxY, 2)],
    };
  });

  const capitals = capitalsRaw.features
    .filter((feature) => {
      const props = feature.properties || {};
      return props.FEATURECLA === "Admin-0 capital" || props.CAPITAL === "primary";
    })
    .map((feature) => {
      const props = feature.properties || {};
      const coords = feature.geometry.coordinates || [0, 0];
      return {
        countryId: toId(props.ADM0_A3 || props.ISO_A3 || props.SOV_A3),
        name: props.NAME || props.NAMEASCII || "Capital",
        latitude: coords[1],
        longitude: coords[0],
      };
    });

  const countriesById = new Map();
  provinceRecords.forEach((province) => {
    const entry = countriesById.get(province.countryId) || {
      id: province.countryId,
      name: province.countryId,
      provinceIds: [],
      capitalProvinceId: "",
    };
    entry.provinceIds.push(province.id);
    countriesById.set(province.countryId, entry);
  });

  capitals.forEach((capital) => {
    const country = countriesById.get(capital.countryId);
    if (!country) return;
    const capitalPoint = { x: capital.longitude, y: capital.latitude };
    let closest = country.provinceIds[0];
    let closestDistance = Number.POSITIVE_INFINITY;

    country.provinceIds.forEach((provinceId) => {
      const centroid = provinceCentroids.get(provinceId);
      if (!centroid) return;
      const d = distance(centroid, capitalPoint);
      if (d < closestDistance) {
        closestDistance = d;
        closest = provinceId;
      }
    });

    country.capitalProvinceId = closest || country.capitalProvinceId;
  });

  const countries = Array.from(countriesById.values()).map((country) => ({
    ...country,
    name: country.name,
  }));

  // Build SVG
  let minX = 180, maxX = -180, minY = 90, maxY = -90;
  provinces.forEach(p => {
    p.rings.forEach(ring => {
      ring.forEach(pt => {
        if (pt[0] < minX) minX = pt[0];
        if (pt[0] > maxX) maxX = pt[0];
        if (pt[1] < minY) minY = pt[1];
        if (pt[1] > maxY) maxY = pt[1];
      });
    });
  });

  function toPath(rings) {
    return rings.map(ring => {
      return ring.map((pt, i) => {
        const x = quantize(pt[0] + 180, 2);
        const y = quantize(90 - pt[1], 2);
        return `${i === 0 ? 'M' : 'L'}${x},${y}`;
      }).join(' ') + 'Z';
    }).join(' ');
  }

  const svgPaths = provinces.map(p => {
    return `<path id="${p.id}" data-country="${p.countryId}" class="province" d="${toPath(p.rings)}" />`;
  }).join('\n  ');

  const svgMarkup = `<svg viewBox="0 0 360 180" xmlns="http://www.w3.org/2000/svg">\n  ${svgPaths}\n</svg>`;
  fs.writeFileSync(path.join(ASSET_DIR, "map.svg"), svgMarkup, "utf8");

  writeJson(path.join(ASSET_DIR, "provinces.json"), provinceRecords);
  writeJson(path.join(ASSET_DIR, "countries.json"), countries);
  writeJson(path.join(ASSET_DIR, "capitals.json"), capitals);

  console.log("Map data prepared:");
  console.log(`- Provinces: ${provinceRecords.length}`);
  console.log(`- Countries: ${countries.length}`);
  console.log(`- Capitals: ${capitals.length}`);
}

prepare();
