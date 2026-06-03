"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type React from "react";
import { countryWheelBreakdown } from "../../engine/mechanics/initiativeWheel";
import {
  getCountryCost,
  getCountryDevelopmentScore,
  getCountryReligionModifier,
  getCountryReligionModifierLabel,
  getCountrySpecialModifierTotal,
  getCountryTier,
  useGameStore,
} from "../../store/gameStore";

type MapSvgProps = {
  svgMarkup: string;
};

type Viewport = {
  scale: number;
  x: number;
  y: number;
};

const LABEL_COUNTRIES = new Set([
  "USA",
  "RUS",
  "CHN",
  "IND",
  "BRA",
  "CAN",
  "MEX",
  "GBR",
  "FRA",
  "DEU",
  "TUR",
  "IRN",
  "SAU",
  "PAK",
  "JPN",
  "IDN",
  "AUS",
  "ZAF",
  "EGY",
  "NGA",
]);

const MAP_Y_STRETCH = 1.22;
const COUNTRY_PALETTE = [
  // Blues (Royal, Slate, Prussian, Sky)
  "#3a5f8a", "#4a709c", "#2f5075", "#5c7ea6", "#3f6d9e", "#4b82b3", "#284b70",
  // Greens (Olive, Forest, Sage, Mint, Lime)
  "#528c5a", "#3b7346", "#689c74", "#4a7852", "#8aa867", "#769c52", "#5f8742", "#8ebf73", "#3a6952", "#4da375",
  // Reds & Pinks (Burgundy, Terracotta, Rose, Crimson)
  "#a64242", "#b85656", "#8f3030", "#c25d5d", "#ab4865", "#b85675", "#8c354e", "#bf5a47", "#ad4536", "#8a2f22",
  // Purples & Plums (Royal Purple, Lilac, Amethyst)
  "#784a8a", "#8e5fa3", "#5c336b", "#9c6cb3", "#78528a", "#523363", "#8a4f7c", "#a35f93", "#6e3361",
  // Yellows, Golds & Oranges (Ochre, Sand, Amber, Rust)
  "#bfa363", "#d6ba7c", "#a68849", "#bd8e3a", "#cfa24b", "#bfa658", "#bd7d3a", "#ab6b29", "#c77f3c", "#b0662a",
  // Teals & Cyans (Deep Teal, Sea Green, Turquoise)
  "#386e75", "#4c858c", "#275459", "#569ea6", "#3d828a", "#45938a", "#29665f", "#52ab9e",
  // Browns & Earth (Sienna, Sepia, Umber)
  "#a17355", "#bd8b6c", "#875b3e", "#a6683f", "#8c5630", "#b57f59", "#946f56", "#73533d"
];

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null;
}

function colorDistance(c1: string, c2: string): number {
  const rgb1 = hexToRgb(c1);
  const rgb2 = hexToRgb(c2);
  if (!rgb1 || !rgb2) return 999;
  const rDiff = rgb1.r - rgb2.r;
  const gDiff = rgb1.g - rgb2.g;
  const bDiff = rgb1.b - rgb2.b;
  return Math.sqrt(2 * rDiff * rDiff + 4 * gDiff * gDiff + 3 * bDiff * bDiff);
}

function getDarkLabelColor(hex: string): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return "rgba(42, 37, 33, 0.85)";
  const r = Math.round(rgb.r * 0.22 + 18 * 0.78);
  const g = Math.round(rgb.g * 0.22 + 16 * 0.78);
  const b = Math.round(rgb.b * 0.22 + 14 * 0.78);
  return `rgba(${r}, ${g}, ${b}, 0.82)`;
}

function paletteIndex(countryId: string, salt = 0): number {
  let hash = 0;
  for (let i = 0; i < countryId.length; i += 1) {
    hash = countryId.charCodeAt(i) + salt + ((hash << 5) - hash);
  }
  return Math.abs(hash) % COUNTRY_PALETTE.length;
}

function hashCountryColor(countryId: string): string {
  if (countryId === "USA") return "#2f5f8f";
  if (countryId === "CHN") return "#9f4535";
  if (countryId === "RUS") return "#7260a9";
  if (countryId === "IND") return "#d6742a"; // Orange override
  if (countryId === "PAK") return "#3d7d4f"; // Green override
  if (countryId === "AFG") return "#ffffff"; // White override
  if (countryId === "BRA") return "#2f7b4a";

  return COUNTRY_PALETTE[paletteIndex(countryId)];
}

function pointInPolygon(pt: [number, number], rings: number[][][]): boolean {
  if (rings.length === 0) return false;
  let inside = false;
  
  for (let r = 0; r < rings.length; r++) {
    const ring = rings[r];
    let ringInside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const xi = ring[i][0], yi = ring[i][1];
      const xj = ring[j][0], yj = ring[j][1];
      const intersect = ((yi > pt[1]) !== (yj > pt[1]))
          && (pt[0] < (xj - xi) * (pt[1] - yi) / (yj - yi) + xi);
      if (intersect) ringInside = !ringInside;
    }
    if (r === 0) {
      if (!ringInside) return false;
      inside = true;
    } else {
      if (ringInside) return false; // Hole exclusion
    }
  }
  return inside;
}

export default function MapSvg({ svgMarkup }: MapSvgProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const dragStateRef = useRef<{ pointerId: number; startX: number; startY: number; originX: number; originY: number } | null>(null);
  const viewportRef = useRef<Viewport>({ scale: 1, x: 0, y: 0 });
  const frameRef = useRef<number | null>(null);
  const hoverTimerRef = useRef<number | null>(null);
  const hoverProgressFrameRef = useRef<number | null>(null);
  const viewportCommitTimerRef = useRef<number | null>(null);
  
  const [viewport, setViewport] = useState<Viewport>({ scale: 1, x: 0, y: 0 });
  const [hoveredProvinceId, setHoveredProvinceId] = useState<string | null>(null);
  const [pinnedProvinceId, setPinnedProvinceId] = useState<string | null>(null);
  const [hoverProgress, setHoverProgress] = useState(0);
  const [dossierCollapsed, setDossierCollapsed] = useState(true);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const countries = useGameStore(state => state.countries);
  const provinces = useGameStore(state => state.provinces);
  const capitals = useGameStore(state => state.capitals);
  const activeWars = useGameStore(state => state.activeWars);
  const warTurns = useGameStore(state => state.warTurns);
  const selectedWarId = useGameStore(state => state.selectedWarId);
  const selectedProvinceId = useGameStore(state => state.selectedProvinceId);
  const selectedCountryId = useGameStore(state => state.selectedCountryId);
  const focusedCountryId = useGameStore(state => state.focusedCountryId);
  const campaignScope = useGameStore(state => state.campaignScope);
  const selectProvince = useGameStore(state => state.selectProvince);
  const selectCountry = useGameStore(state => state.selectCountry);
  const focusCountry = useGameStore(state => state.focusCountry);

  const countryColors = useMemo(() => {
    const colors: Record<string, string> = {};
    const neighbors: Record<string, Set<string>> = {};

    Object.values(countries).forEach(country => {
      neighbors[country.id] = new Set();
    });

    Object.values(provinces).forEach(province => {
      const ownerId = province.ownerId;
      if (!neighbors[ownerId]) neighbors[ownerId] = new Set();
      province.adjacentProvinceIds.forEach(adjacentId => {
        const adjacentOwnerId = provinces[adjacentId]?.ownerId;
        if (adjacentOwnerId && adjacentOwnerId !== ownerId) {
          neighbors[ownerId].add(adjacentOwnerId);
          if (!neighbors[adjacentOwnerId]) neighbors[adjacentOwnerId] = new Set();
          neighbors[adjacentOwnerId].add(ownerId);
        }
      });
    });

    const orderedCountryIds = Object.values(countries)
      .filter(country => country.id !== "ATA")
      .sort((a, b) => (neighbors[b.id]?.size ?? 0) - (neighbors[a.id]?.size ?? 0) || b.strategicPower - a.strategicPower)
      .map(country => country.id);

    orderedCountryIds.forEach(countryId => {
      const neighborsWithColors = Array.from(neighbors[countryId] ?? [])
        .map(neighborId => colors[neighborId])
        .filter(Boolean);

      // Explicit color overrides requested by the user
      if (countryId === "IND") {
        colors[countryId] = "#d6742a"; // Orange
        return;
      }
      if (countryId === "PAK") {
        colors[countryId] = "#3d7d4f"; // Green
        return;
      }
      if (countryId === "AFG") {
        colors[countryId] = "#ffffff"; // White
        return;
      }

      // Get the default/formable map color or hash color
      let defaultColor = countries[countryId]?.mapColor ?? hashCountryColor(countryId);

      // Check if the default color conflicts with neighbors (visual distance threshold of 85)
      let bestColor = defaultColor;
      let hasConflict = false;
      for (const neighborColor of neighborsWithColors) {
        if (colorDistance(bestColor, neighborColor) < 85) {
          hasConflict = true;
          break;
        }
      }

      // If it conflicts, find a suitable color from the palette
      if (hasConflict) {
        let foundSuit = false;
        const startIdx = paletteIndex(countryId);
        for (let offset = 0; offset < COUNTRY_PALETTE.length; offset += 1) {
          const candidateColor = COUNTRY_PALETTE[(startIdx + offset) % COUNTRY_PALETTE.length];
          let candidateConflict = false;
          for (const neighborColor of neighborsWithColors) {
            if (colorDistance(candidateColor, neighborColor) < 85) {
              candidateConflict = true;
              break;
            }
          }
          if (!candidateConflict) {
            bestColor = candidateColor;
            foundSuit = true;
            break;
          }
        }

        // Fallback: maximize minimum distance to neighbors if all colors in palette conflict
        if (!foundSuit) {
          let maxMinDist = -1;
          for (let offset = 0; offset < COUNTRY_PALETTE.length; offset += 1) {
            const candidateColor = COUNTRY_PALETTE[(startIdx + offset) % COUNTRY_PALETTE.length];
            let minDist = 999;
            for (const neighborColor of neighborsWithColors) {
              const dist = colorDistance(candidateColor, neighborColor);
              if (dist < minDist) {
                minDist = dist;
              }
            }
            if (minDist > maxMinDist) {
              maxMinDist = minDist;
              bestColor = candidateColor;
            }
          }
        }
      }

      colors[countryId] = bestColor;
    });

    colors.ATA = "#746c69";
    return colors;
  }, [countries, provinces]);

  const selectedProvince = selectedProvinceId ? provinces[selectedProvinceId] : null;
  const hoveredProvince = hoveredProvinceId ? provinces[hoveredProvinceId] : null;
  const pinnedProvince = pinnedProvinceId ? provinces[pinnedProvinceId] : null;
  const inspectedProvince = pinnedProvince ?? hoveredProvince ?? selectedProvince;
  const inspectedCountry = inspectedProvince ? countries[inspectedProvince.ownerId] : null;

  useEffect(() => {
    if (inspectedCountry?.id) {
      setDossierCollapsed(true);
    }
  }, [inspectedCountry?.id]);
  const hoveredCountryId = (pinnedProvince ?? hoveredProvince)?.ownerId ?? null;

  const hoveredFrontierProvinceIds = useMemo(() => {
    const owned = new Set<string>();
    const adjacentForeign = new Set<string>();
    const country = hoveredCountryId ? countries[hoveredCountryId] : null;
    if (!country) return { owned, adjacentForeign };

    country.provinces.forEach(provinceId => {
      owned.add(provinceId);
      provinces[provinceId]?.adjacentProvinceIds.forEach(adjacentId => {
        if (provinces[adjacentId]?.ownerId !== hoveredCountryId) {
          adjacentForeign.add(adjacentId);
        }
      });
    });

    return { owned, adjacentForeign };
  }, [countries, hoveredCountryId, provinces]);

  const inspectedCapital = inspectedCountry
    ? capitals.find(capital => capital.countryId === inspectedCountry.id)
    : null;
  const inspectedWheel = inspectedCountry
    ? countryWheelBreakdown(inspectedCountry, inspectedCountry.provinces.length, false)
    : null;
  const recentCapturedProvinceIds = useMemo(() => {
    const currentWarTurns = selectedWarId ? warTurns[selectedWarId] ?? [] : [];
    return new Set(currentWarTurns.slice(-3).flatMap(turn => turn.capturedProvinces));
  }, [selectedWarId, warTurns]);

  const eligibleCountryIds = useMemo(
    () => (campaignScope ? new Set(campaignScope.eligibleCountryIds) : null),
    [campaignScope]
  );

  const countryMainlands = useMemo(() => {
    const mainlands: Record<string, {
      minX: number;
      maxX: number;
      minY: number;
      maxY: number;
      centerX: number;
      centerY: number;
      areaWeight: number;
    }> = {};

    Object.values(countries).forEach(country => {
      if (!country.isAlive || country.id === "ATA") return;

      const ownedProvinces = new Set(country.provinces);
      const visited = new Set<string>();
      const components: string[][] = [];

      country.provinces.forEach(provId => {
        if (visited.has(provId)) return;
        const component: string[] = [];
        const queue: string[] = [provId];
        visited.add(provId);

        while (queue.length > 0) {
          const currentId = queue.shift()!;
          component.push(currentId);
          const prov = provinces[currentId];
          if (prov && prov.adjacentProvinceIds) {
            prov.adjacentProvinceIds.forEach(adjId => {
              if (ownedProvinces.has(adjId) && !visited.has(adjId)) {
                visited.add(adjId);
                queue.push(adjId);
              }
            });
          }
        }
        components.push(component);
      });

      // Refined Mainland Selection
      let mainlandComponent: string[] = [];

      // 1. Try capital first (if owned by the country)
      if (country.capitalProvinceId && ownedProvinces.has(country.capitalProvinceId)) {
        mainlandComponent = components.find(comp => comp.includes(country.capitalProvinceId)) || [];
      }

      // 2. Fall back to largest component by province count, tie-break with wrap-corrected weight
      if (mainlandComponent.length === 0 && components.length > 0) {
        const getCompWeight = (comp: string[]) => {
          let w = 0;
          comp.forEach(id => {
            const prov = provinces[id];
            if (prov && prov.bounds) {
              const [pMinX, pMinY, pMaxX, pMaxY] = prov.bounds;
              const rawWidth = pMaxX - pMinX;
              const pWidth = rawWidth > 180 ? (360 - rawWidth) : rawWidth;
              w += Math.max(0.0001, pWidth * (pMaxY - pMinY));
            }
          });
          return w;
        };

        components.sort((a, b) => {
          if (b.length !== a.length) {
            return b.length - a.length;
          }
          return getCompWeight(b) - getCompWeight(a);
        });

        mainlandComponent = components[0];
      }

      if (mainlandComponent.length === 0) return;

      // Compute bounds and weighted center for the mainland component
      let minX = 360, maxX = 0, minY = 180, maxY = 0;
      let weightedSumX = 0, weightedSumY = 0, totalWeight = 0;

      mainlandComponent.forEach(provId => {
        const prov = provinces[provId];
        if (prov && prov.bounds) {
          const [pMinX, pMinY, pMaxX, pMaxY] = prov.bounds;
          if (pMinX < minX) minX = pMinX;
          if (pMaxX > maxX) maxX = pMaxX;
          if (pMinY < minY) minY = pMinY;
          if (pMaxY > maxY) maxY = pMaxY;

          const rawWidth = pMaxX - pMinX;
          const pWidth = rawWidth > 180 ? (360 - rawWidth) : rawWidth;
          const pHeight = pMaxY - pMinY;
          const weight = Math.max(0.0001, pWidth * pHeight);

          let pCenterX = (pMinX + pMaxX) / 2;
          if (rawWidth > 180) {
            pCenterX = (pMinX + pMaxX + 360) / 2;
            if (pCenterX >= 360) pCenterX -= 360;
          }

          weightedSumX += pCenterX * weight;
          weightedSumY += ((pMinY + pMaxY) / 2) * weight;
          totalWeight += weight;
        }
      });

      if (totalWeight > 0) {
        mainlands[country.id] = {
          minX,
          maxX,
          minY,
          maxY,
          centerX: weightedSumX / totalWeight,
          centerY: weightedSumY / totalWeight,
          areaWeight: totalWeight,
        };
      }
    });

    return mainlands;
  }, [countries, provinces]);

  const labelCapitals = useMemo(() => {
    const uniqueByCountry = new Map<string, (typeof capitals)[number]>();
    capitals.forEach(capital => {
      const country = countries[capital.countryId];
      if (!country?.isAlive || country.id === "ATA") return;
      if (eligibleCountryIds && !eligibleCountryIds.has(country.id)) return;

      const isFocus = selectedCountryId === country.id || hoveredCountryId === country.id;
      const development = getCountryDevelopmentScore(country);
      const provinceCount = country.provinces.length;
      const shouldShowMajorLabel = viewport.scale >= 1.25 && LABEL_COUNTRIES.has(country.id);
      const shouldShowLargeLabel = viewport.scale >= 1.75 && (provinceCount >= 12 || development >= 260);
      const shouldShowRegionalLabel = viewport.scale >= 2.7 && (provinceCount >= 4 || development >= 160);
      const shouldShowLocalLabel = viewport.scale >= 4.1 && provinceCount >= 1;
      if (!isFocus && !shouldShowMajorLabel && !shouldShowLargeLabel && !shouldShowRegionalLabel && !shouldShowLocalLabel) return;

      if (!uniqueByCountry.has(country.id)) {
        uniqueByCountry.set(country.id, capital);
      }
    });
    return Array.from(uniqueByCountry.values());
  }, [capitals, countries, eligibleCountryIds, hoveredCountryId, selectedCountryId, viewport.scale]);

  const activeViewBounds = useMemo(() => {
    return campaignScope?.bounds ?? { minX: -180, maxX: 180, minY: -55, maxY: 85 };
  }, [campaignScope]);

  // Compute projection scales
  const getMapScales = (width: number, height: number) => {
    const bounds = activeViewBounds;
    const worldMinX = bounds.minX + 180;
    const worldMaxX = bounds.maxX + 180;
    const worldMinY = 90 - bounds.maxY;
    const worldMaxY = 90 - bounds.minY;
    const worldWidth = Math.max(1, worldMaxX - worldMinX);
    const worldHeight = Math.max(1, worldMaxY - worldMinY);

    const fitScaleX = width / worldWidth;
    const fitScaleY = height / worldHeight;
    const fitScale = Math.min(fitScaleX, fitScaleY);

    const fitOffsetX = (width - worldWidth * fitScale) / 2 - worldMinX * fitScale;
    const fitOffsetY = (height - worldHeight * fitScale) / 2 - worldMinY * fitScale;

    return { fitScale, fitOffsetX, fitOffsetY };
  };

  const redrawMap = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    
    if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
      canvas.width = width * dpr;
      canvas.height = height * dpr;
    }
    ctx.resetTransform();
    ctx.scale(dpr, dpr);

    // 1. Draw radial background gradient
    const bgGrad = ctx.createRadialGradient(
      width / 2,
      height * 0.35,
      0,
      width / 2,
      height * 0.35,
      Math.max(width, height)
    );
    bgGrad.addColorStop(0, "#112334");
    bgGrad.addColorStop(0.52, "#081521");
    bgGrad.addColorStop(1, "#04080d");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    ctx.save();

    // 2. Apply Camera viewport matrices
    const { fitScale, fitOffsetX, fitOffsetY } = getMapScales(width, height);
    ctx.translate(viewportRef.current.x, viewportRef.current.y);
    ctx.scale(viewportRef.current.scale, viewportRef.current.scale);
    ctx.translate(fitOffsetX, fitOffsetY);
    ctx.scale(fitScale, fitScale * MAP_Y_STRETCH);

    const activeScale = viewportRef.current.scale * fitScale;
    const invScale = 1 / activeScale;

    // 3. Draw Provinces
    Object.values(provinces).forEach(province => {
      if (province.initialCountryId === "ATA" || province.ownerId === "ATA") return;
      if (!province.rings) return;

      const ownerId = province.ownerId;
      const isOutOfScope = eligibleCountryIds ? !eligibleCountryIds.has(ownerId) : false;

      // Colors
      let fillStyle = countryColors[ownerId] ?? countries[ownerId]?.mapColor ?? "#2a3445";
      if (province.isIncinerated) {
        fillStyle = "#16181f";
      }

      ctx.fillStyle = fillStyle;
      
      // Draw rings
      ctx.beginPath();
      province.rings.forEach(ring => {
        if (ring.length === 0) return;
        ctx.moveTo(ring[0][0], ring[0][1]);
        for (let i = 1; i < ring.length; i++) {
          ctx.lineTo(ring[i][0], ring[i][1]);
        }
      });

      ctx.globalAlpha = isOutOfScope ? 0.1 : 0.92;
      ctx.fill();

      // Highlight the hovered province
      if (hoveredProvinceId === province.id) {
        ctx.save();
        ctx.fillStyle = "rgba(255, 255, 255, 0.22)";
        ctx.fill();
        ctx.restore();
      }

      // Border lines style
      const isSelected = selectedProvinceId === province.id || selectedCountryId === ownerId;
      const isHoveredProvince = hoveredProvinceId === province.id;
      const isHoveredCountryBorder = hoveredFrontierProvinceIds.owned.has(province.id);
      const isHoveredForeignBorder = hoveredFrontierProvinceIds.adjacentForeign.has(province.id);
      const isRecentCapture = recentCapturedProvinceIds.has(province.id);

      let strokeStyle = "rgba(3, 8, 14, 0.55)";
      let lineWidth = 0.09;

      if (isHoveredProvince) {
        strokeStyle = "#ffffff";
        lineWidth = 0.45;
        ctx.globalAlpha = 1.0;
      } else if (isSelected) {
        strokeStyle = "#f8f1d0";
        lineWidth = 0.42;
        ctx.globalAlpha = 0.98;
      } else if (isHoveredCountryBorder) {
        strokeStyle = "#ffe7a3";
        lineWidth = 0.42;
        ctx.globalAlpha = 0.98;
      } else if (isHoveredForeignBorder) {
        strokeStyle = "rgba(255,172,80,0.72)";
        lineWidth = 0.24;
        ctx.globalAlpha = 0.98;
      }

      if (isRecentCapture) {
        strokeStyle = "#f8d37e";
        lineWidth = 0.35;
      }

      ctx.strokeStyle = strokeStyle;
      ctx.lineWidth = lineWidth * invScale;
      ctx.stroke();
    });

    ctx.globalAlpha = 1.0;

    // 3.5 Draw Country Names Overlay
    Object.values(countries).forEach(country => {
      if (!country.isAlive || country.id === "ATA") return;
      if (eligibleCountryIds && !eligibleCountryIds.has(country.id)) return;

      const mainland = countryMainlands[country.id];
      if (!mainland) return;

      const countryWidthScreen = (mainland.maxX - mainland.minX) * activeScale;
      const countryHeightScreen = (mainland.maxY - mainland.minY) * activeScale * MAP_Y_STRETCH;

      const strategicPower = country.strategicPower || 10;
      const baseFontSize = (10 + Math.sqrt(strategicPower) * 0.75) * 0.8;
      const scaleMultiplier = Math.min(1.6, Math.max(0.8, viewportRef.current.scale * 0.65));
      const fontSize = baseFontSize * scaleMultiplier * 0.85; // 15% smaller

      ctx.save();
      ctx.resetTransform();
      ctx.scale(dpr, dpr);

      // Classic Bold Times-like Serif Effect
      ctx.font = `bold ${fontSize}px Georgia, 'Times New Roman', serif`;
      
      // Reset letter-spacing
      if ('letterSpacing' in ctx) {
        (ctx as any).letterSpacing = "normal";
      }

      const displayName = country.name.toUpperCase();
      const textMetrics = ctx.measureText(displayName);
      const textWidth = textMetrics.width;
      
      // Strict spacing checks to ensure text does not overshoot the country bounds
      const safetyPadding = 32;
      const widthThreshold = textWidth * 1.55 + safetyPadding;
      const heightThreshold = fontSize * 1.6 + 10;

      if (countryWidthScreen >= widthThreshold && countryHeightScreen >= heightThreshold) {
        const screenX = (mainland.centerX * fitScale + fitOffsetX) * viewportRef.current.scale + viewportRef.current.x;
        const screenY = (mainland.centerY * fitScale * MAP_Y_STRETCH + fitOffsetY) * viewportRef.current.scale + viewportRef.current.y;

        // Faint outline for legibility
        ctx.strokeStyle = "rgba(43, 47, 52, 0.72)";
        ctx.lineWidth = 3.5;
        ctx.lineJoin = "round";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.strokeText(displayName, screenX, screenY);

        // Fill text with map print overlay color
        ctx.fillStyle = "rgba(255, 255, 255, 0.74)";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(displayName, screenX, screenY);
      }
      ctx.restore();
    });

    // 4. Draw Active War Lines
    activeWars.forEach(war => {
      const attackerCapital = capitals.find(c => c.countryId === war.attackerId);
      const defenderCapital = capitals.find(c => c.countryId === war.defenderId);
      if (!attackerCapital || !defenderCapital) return;

      const x1 = attackerCapital.longitude + 180;
      const y1 = 90 - attackerCapital.latitude;
      const x2 = defenderCapital.longitude + 180;
      const y2 = 90 - defenderCapital.latitude;

      // Connecting dash line
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.strokeStyle = "rgba(248, 211, 126, 0.72)";
      ctx.lineWidth = 0.34 * invScale;
      ctx.setLineDash([1.4 * invScale, 1.1 * invScale]);
      ctx.stroke();
      ctx.setLineDash([]);

      // Middle pulse node
      const midX = (x1 + x2) / 2;
      const midY = (y1 + y2) / 2;
      ctx.beginPath();
      ctx.arc(midX, midY, 1.1 * invScale, 0, 2 * Math.PI);
      ctx.fillStyle = "#f8d37e";
      ctx.strokeStyle = "rgba(55,20,10,0.8)";
      ctx.lineWidth = 0.2 * invScale;
      ctx.fill();
      ctx.stroke();
    });

    // 5. Draw Army Camps
    const capitalsByCountry = new Map<string, typeof capitals[number]>();
    capitals.forEach(c => {
      const country = countries[c.countryId];
      if (country?.isAlive && country.id !== "ATA" && country.armyCampsCount > 0) {
        if (!eligibleCountryIds || eligibleCountryIds.has(country.id)) {
          capitalsByCountry.set(country.id, c);
        }
      }
    });

    capitalsByCountry.forEach((capital, countryId) => {
      const country = countries[countryId];
      const cx = capital.longitude + 181.2;
      const cy = 90 - capital.latitude + 1.2;

      ctx.beginPath();
      ctx.arc(cx, cy, 1.65 * invScale, 0, 2 * Math.PI);
      ctx.fillStyle = "rgba(18,24,34,0.92)";
      ctx.strokeStyle = "#f8d37e";
      ctx.lineWidth = 0.18 * invScale;
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = "#f8d37e";
      ctx.beginPath();
      ctx.moveTo(cx - 0.65 * invScale, cy - 0.85 * invScale);
      ctx.lineTo(cx + 0.65 * invScale, cy - 0.85 * invScale);
      ctx.lineTo(cx + 0.42 * invScale, cy + 0.55 * invScale);
      ctx.lineTo(cx, cy + 0.95 * invScale);
      ctx.lineTo(cx - 0.42 * invScale, cy + 0.55 * invScale);
      ctx.closePath();
      ctx.fill();
    });

    // 6. Draw Capitals
    capitals.forEach(capital => {
      const country = countries[capital.countryId];
      if (country?.id === "ATA") return;
      if (eligibleCountryIds && !eligibleCountryIds.has(capital.countryId)) return;
      if (!country?.isAlive || !country.capitalProvinceId) return;

      const development = getCountryDevelopmentScore(country);
      const shouldShowCapital =
        selectedCountryId === country.id ||
        hoveredCountryId === country.id ||
        (viewportRef.current.scale >= 1.35 && LABEL_COUNTRIES.has(country.id)) ||
        (viewportRef.current.scale >= 2.25 && development >= 180) ||
        viewportRef.current.scale >= 4;

      if (!shouldShowCapital) return;

      const cx = capital.longitude + 180;
      const cy = 90 - capital.latitude;
      const capitalOwnerId = provinces[country.capitalProvinceId]?.ownerId ?? country.id;
      const isOccupied = capitalOwnerId !== country.id;

      ctx.beginPath();
      ctx.arc(cx, cy, (isOccupied ? 0.86 : 0.58) * invScale, 0, 2 * Math.PI);
      ctx.fillStyle = isOccupied ? "#ffdd66" : "#f8fafc";
      ctx.strokeStyle = countryColors[capitalOwnerId] ?? "#111827";
      ctx.lineWidth = 0.2 * invScale;
      ctx.fill();
      ctx.stroke();
    });

    // 7. Draw Labels
    labelCapitals.forEach(capital => {
      const country = countries[capital.countryId];
      if (!country) return;
      const isFocus = selectedCountryId === country.id || hoveredCountryId === country.id;
      const showFullName = viewportRef.current.scale >= 2.6 && country.name.length <= 18;
      const displayName = isFocus
        ? truncateMapLabel(country.name, viewportRef.current.scale >= 3 ? 18 : 14)
        : showFullName
          ? truncateMapLabel(country.name, 16)
          : country.id;
      const label = isFocus ? `${country.flag} ${displayName}` : displayName;

      const cx = capital.longitude + 180;
      const cy = 90 - capital.latitude;

      const baseFontSize = (isFocus ? 2.15 : 1.45) * Math.max(0.42, Math.min(1, 1 / Math.sqrt(viewportRef.current.scale)));
      const fontSizeWorld = baseFontSize * invScale * 0.42;

      ctx.font = `bold ${fontSizeWorld}px Inter, system-ui, sans-serif`;
      const textWidth = ctx.measureText(label).width;

      const labelHeight = (isFocus ? 4.2 : 2.95) * Math.max(0.58, Math.min(1, 1 / Math.sqrt(viewportRef.current.scale))) * invScale * 0.42;
      const labelWidth = textWidth + 1.2 * invScale;
      const labelX = cx + 0.7 * invScale;
      const labelY = cy - labelHeight * 0.82;

      ctx.fillStyle = isFocus ? "rgba(255, 255, 255, 0.96)" : "rgba(255, 255, 255, 0.76)";
      ctx.strokeStyle = countryColors[country.id] ?? "#646464";
      ctx.lineWidth = 0.18 * invScale;

      const rx = 0.9 * invScale;
      ctx.beginPath();
      ctx.roundRect(labelX, labelY, labelWidth, labelHeight, rx);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = isFocus ? "#13100b" : "#f7ead0";
      ctx.textBaseline = "middle";
      ctx.fillText(label, labelX + 0.6 * invScale, labelY + labelHeight / 2);
    });

    ctx.restore();
  };

  useEffect(() => {
    if (hoverTimerRef.current !== null) {
      window.clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
    if (hoverProgressFrameRef.current !== null) {
      window.cancelAnimationFrame(hoverProgressFrameRef.current);
      hoverProgressFrameRef.current = null;
    }

    if (!hoveredProvinceId || pinnedProvinceId) {
      setHoverProgress(pinnedProvinceId ? 100 : 0);
      return;
    }

    const startedAt = window.performance.now();
    const lockDelayMs = 3000;

    const tick = () => {
      const nextProgress = Math.min(100, ((window.performance.now() - startedAt) / lockDelayMs) * 100);
      setHoverProgress(nextProgress);
      if (nextProgress < 100) {
        hoverProgressFrameRef.current = window.requestAnimationFrame(tick);
      }
    };

    hoverProgressFrameRef.current = window.requestAnimationFrame(tick);
    hoverTimerRef.current = window.setTimeout(() => {
      setPinnedProvinceId(hoveredProvinceId);
      setHoverProgress(100);
    }, lockDelayMs);

    return () => {
      if (hoverTimerRef.current !== null) {
        window.clearTimeout(hoverTimerRef.current);
        hoverTimerRef.current = null;
      }
      if (hoverProgressFrameRef.current !== null) {
        window.cancelAnimationFrame(hoverProgressFrameRef.current);
        hoverProgressFrameRef.current = null;
      }
    };
  }, [hoveredProvinceId, pinnedProvinceId]);

  function commitViewportSoon(nextViewport: Viewport, immediate = false) {
    if (viewportCommitTimerRef.current !== null) {
      window.clearTimeout(viewportCommitTimerRef.current);
      viewportCommitTimerRef.current = null;
    }
    if (immediate) {
      setViewport(nextViewport);
      return;
    }
    viewportCommitTimerRef.current = window.setTimeout(() => {
      viewportCommitTimerRef.current = null;
      setViewport(viewportRef.current);
    }, 120);
  }

  // Bind Redraw to store state changes
  useEffect(() => {
    redrawMap();
  }, [
    provinces,
    countryColors,
    countryMainlands,
    selectedProvinceId,
    selectedCountryId,
    hoveredProvinceId,
    activeWars,
    labelCapitals,
    viewport,
  ]);

  // Handle ResizeObserver to redraw
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const observer = new ResizeObserver(() => {
      redrawMap();
    });
    observer.observe(canvas);
    return () => observer.disconnect();
  }, []);

  function clampScale(value: number) {
    return Math.min(9, Math.max(0.4, value));
  }

  const findProvinceAt = (worldX: number, worldY: number): string | null => {
    for (const province of Object.values(provinces)) {
      if (province.initialCountryId === "ATA" || province.ownerId === "ATA") continue;
      if (!province.bounds || !province.rings) continue;

      const [minX, minY, maxX, maxY] = province.bounds;
      if (worldX < minX || worldX > maxX || worldY < minY || worldY > maxY) {
        continue;
      }

      if (pointInPolygon([worldX, worldY], province.rings)) {
        return province.id;
      }
    }
    return null;
  };

  const getEventWorldCoordinates = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const rect = canvas.getBoundingClientRect();
    const px = event.clientX - rect.left;
    const py = event.clientY - rect.top;

    const { fitScale, fitOffsetX, fitOffsetY } = getMapScales(rect.width, rect.height);
    const viewX = (px - viewportRef.current.x) / viewportRef.current.scale;
    const viewY = (py - viewportRef.current.y) / viewportRef.current.scale;

    const worldX = (viewX - fitOffsetX) / fitScale;
    const worldY = (viewY - fitOffsetY) / (fitScale * MAP_Y_STRETCH);

    return { worldX, worldY };
  };

  function handleWheel(event: React.WheelEvent<HTMLDivElement>) {
    event.preventDefault();
    const container = containerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const pointerX = event.clientX - rect.left;
    const pointerY = event.clientY - rect.top;
    const currentViewport = viewportRef.current;
    const nextScale = clampScale(currentViewport.scale * (event.deltaY > 0 ? 0.88 : 1.14));
    const ratio = nextScale / currentViewport.scale;

    const nextViewport = {
      scale: nextScale,
      x: pointerX - (pointerX - currentViewport.x) * ratio,
      y: pointerY - (pointerY - currentViewport.y) * ratio,
    };
    
    viewportRef.current = nextViewport;
    redrawMap();
    commitViewportSoon(nextViewport);
  }

  function handlePointerDown(event: React.PointerEvent<HTMLCanvasElement>) {
    if (event.button !== 0) return;
    dragStateRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: viewportRef.current.x,
      originY: viewportRef.current.y,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event: React.PointerEvent<HTMLCanvasElement>) {
    const drag = dragStateRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    const nextViewport = {
      scale: viewportRef.current.scale,
      x: drag.originX + event.clientX - drag.startX,
      y: drag.originY + event.clientY - drag.startY,
    };

    viewportRef.current = nextViewport;
    
    if (frameRef.current === null) {
      frameRef.current = window.requestAnimationFrame(() => {
        frameRef.current = null;
        redrawMap();
      });
    }
  }

  function handlePointerUp(event: React.PointerEvent<HTMLCanvasElement>) {
    if (dragStateRef.current?.pointerId === event.pointerId) {
      dragStateRef.current = null;
      event.currentTarget.releasePointerCapture(event.pointerId);
      commitViewportSoon(viewportRef.current, true);
    }
  }

  function handleMapClick(event: React.MouseEvent<HTMLCanvasElement>) {
    const pt = getEventWorldCoordinates(event);
    if (!pt) return;
    
    const provinceId = findProvinceAt(pt.worldX, pt.worldY);
    const province = provinceId ? provinces[provinceId] : null;

    setPinnedProvinceId(null);
    setHoverProgress(0);
    selectProvince(provinceId ?? null);
    selectCountry(province?.ownerId ?? null);
  }

  function handleMapMove(event: React.MouseEvent<HTMLCanvasElement>) {
    const pt = getEventWorldCoordinates(event);
    if (!pt) return;

    const nextHoveredProvinceId = findProvinceAt(pt.worldX, pt.worldY);
    if (nextHoveredProvinceId !== hoveredProvinceId) {
      setHoveredProvinceId(nextHoveredProvinceId);
    }
  }

  useEffect(() => {
    if (!focusedCountryId) return;

    const mainland = countryMainlands[focusedCountryId];
    if (mainland) {
      const canvas = canvasRef.current;
      if (canvas) {
        const width = canvas.clientWidth;
        const height = canvas.clientHeight;
        
        const { fitScale, fitOffsetX, fitOffsetY } = getMapScales(width, height);

        const targetScale = 3.0;
        const nextViewport = {
          scale: targetScale,
          x: width / 2 - (mainland.centerX * fitScale + fitOffsetX) * targetScale,
          y: height / 2 - (mainland.centerY * fitScale * MAP_Y_STRETCH + fitOffsetY) * targetScale,
        };

        const country = countries[focusedCountryId];
        if (country && country.provinces.length > 0) {
          selectCountry(focusedCountryId);
          const capProvId = country.capitalProvinceId;
          const firstProvId = country.provinces[0];
          selectProvince(capProvId && country.provinces.includes(capProvId) ? capProvId : firstProvId);
          setDossierCollapsed(true); // Always keep minimized by default
        }

        viewportRef.current = nextViewport;
        setViewport(nextViewport);
        redrawMap();
      }
    }
    focusCountry(null);
  }, [focusedCountryId, countryMainlands, countries, selectCountry, selectProvince, focusCountry]);

  return (
    <div
      ref={containerRef}
      onWheel={handleWheel}
      style={{
        border: "0",
        borderRadius: 0,
        background: "#04080d",
        width: "100%",
        height: "100%",
        overflow: "hidden",
        position: "relative",
        touchAction: "none",
        boxShadow: "inset 0 0 90px rgba(0,0,0,0.36)",
      }}
    >
      <canvas
        ref={canvasRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onClick={handleMapClick}
        onMouseMove={handleMapMove}
        onMouseLeave={() => {
          setHoveredProvinceId(null);
          if (!pinnedProvinceId) setHoverProgress(0);
        }}
        style={{
          width: "100%",
          height: "100%",
          display: "block",
          cursor: "pointer",
        }}
      />

      {inspectedProvince && inspectedCountry ? (
        dossierCollapsed ? (
          <div className="country-dossier collapsed" onClick={() => setDossierCollapsed(false)} style={{ cursor: "pointer" }} title="Click to expand full stats">
            <div className="dossier-topline">
              <span className="dossier-flag">{inspectedCountry.flag}</span>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }}>
                <div style={{ display: "grid", gap: "2px" }}>
                  <strong style={{ fontSize: "16px", color: "#fff5d6" }}>{inspectedCountry.name}</strong>
                  <span style={{ fontSize: "11px", color: "#94a3b8" }}>{getCountryTier(inspectedCountry)} • {inspectedCountry.government} • Click to expand</span>
                </div>
                <span style={{ fontSize: "16px", color: "#cfa24b" }}>➕</span>
              </div>
            </div>
            <div className="dossier-lock" style={{ marginTop: 8 }}>
              <span>{pinnedProvinceId ? "Pinned dossier - click map to release" : "Hold hover to pin dossier"}</span>
              <strong>{Math.round(pinnedProvinceId ? 100 : hoverProgress)}%</strong>
              <i style={{ width: `${pinnedProvinceId ? 100 : hoverProgress}%` }} />
            </div>
          </div>
        ) : (
          <div className="country-dossier pokemon-card">
            {/* Pokémon Card Header */}
            <div className="pokemon-header">
              <div className="pokemon-name-block">
                <span className="pokemon-flag">{inspectedCountry.flag}</span>
                <div style={{ display: "grid", gap: 1 }}>
                  <span className="pokemon-stage">{getCountryTier(inspectedCountry)}</span>
                  <strong className="pokemon-name">{inspectedCountry.name}</strong>
                </div>
              </div>
              <div className="pokemon-hp-block" title="Favorite buy-in. Expensive powers have stronger starting position.">
                <small>COST</small>
                <strong>🎟️{getCountryCost(inspectedCountry)}</strong>
              </div>
            </div>

            {/* Illustration Frame */}
            <div className="pokemon-frame">
              <div className="pokemon-illustration">
                <span>{inspectedCountry.government} • {inspectedCountry.religion} Faith</span>
                <span>Capital: {inspectedCapital?.name ?? "None"}</span>
              </div>
            </div>

            {/* Dossier Lock Progress Bar */}
            <div className="dossier-lock">
              <span>{pinnedProvinceId ? "Pinned dossier - click map to release" : "Hold hover to pin dossier"}</span>
              <strong>{Math.round(pinnedProvinceId ? 100 : hoverProgress)}%</strong>
              <i style={{ width: `${pinnedProvinceId ? 100 : hoverProgress}%` }} />
            </div>

            {/* Moves Panel (Grouped stats) */}
            <div className="pokemon-attacks">
              {/* Move 1: Initiative / Combat Roll */}
              <div className="pokemon-move" title="Turn-order chance. Initiative decides who acts on a roll.">
                <div className="move-header">
                  <span className="move-cost">🎯 ☀️ ⚖️</span>
                  <span className="move-name">Tactical Initiative</span>
                  <strong className="move-damage">{inspectedWheel?.total ?? 0}</strong>
                </div>
                <p className="move-desc">
                  Initiative power. Modified by Faith ({signed(getCountryReligionModifier(inspectedCountry))}) & Gov ({governmentModifierLabel(inspectedCountry.government)}).
                </p>
              </div>

              {/* Move 2: Land footprint / Dev */}
              <div className="pokemon-move" title="Controlled development plus current territory footprint.">
                <div className="move-header">
                  <span className="move-cost">🏰 📜 🧭</span>
                  <span className="move-name">Strategic Land Power</span>
                  <strong className="move-damage">{getCountryDevelopmentScore(inspectedCountry)}</strong>
                </div>
                <p className="move-desc">
                  Backbone power. Based on {inspectedCountry.provinces.length} provinces and temporary Event mods ({signed(inspectedCountry.eventModifier)}).
                </p>
              </div>

              {/* Passive Ability: Defense */}
              <div className="pokemon-ability" title="Camps add permanent initiative. Interceptors block enemy conquest rolls.">
                <span className="ability-badge">PASSIVE</span>
                <strong>Interceptor Screen: {inspectedCountry.interceptorCharges}/3 Charges</strong>
                <p className="move-desc">
                  Nullifies enemy rolls & triggers re-spins. Army Camps (🪖 {inspectedCountry.armyCampsCount}) add permanent +25 initiative.
                </p>
              </div>

              {/* Special Ability: Blitz (only if they have support) */}
              {inspectedCountry.blitzActions > 0 && (
                <div className="pokemon-ability special" title="Blitz support allows chaining back-to-back rolls on initiative win.">
                  <span className="ability-badge special">BLITZ</span>
                  <strong>Blitz Campaign: {inspectedCountry.blitzActions} Banked</strong>
                  <p className="move-desc">Banked public support chains a secondary action roll on initiative win.</p>
                </div>
              )}
            </div>

            {/* Modifier Chips / Special Rules */}
            {inspectedCountry.specialModifiers.length > 0 && (
              <div className="dossier-mods-pokemon">
                <span style={{ fontSize: 9, fontWeight: "bold", color: "#bfa36d", textTransform: "uppercase" }}>Special Modifiers</span>
                <div className="pokemon-mods-list">
                  {inspectedCountry.specialModifiers.map(mod => (
                    <span key={mod.label} className="pokemon-mod-chip" title={mod.description}>
                      {modifierIcon(mod.label)} {mod.label} {signed(mod.value)}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Minimizer Trigger Button */}
            <div className="pokemon-footer">
              <span className="footer-code">Splinter States TCG</span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setDossierCollapsed(true);
                }}
                className="pokemon-collapse-btn"
              >
                ➖ Minimize Card
              </button>
            </div>
          </div>
        )
      ) : null}

      <style jsx global>{`
        .country-dossier {
          position: absolute;
          left: 22px;
          bottom: 22px;
          width: min(520px, calc(100% - 44px));
          padding: 16px;
          color: #f8f1d0;
          background:
            linear-gradient(135deg, rgba(248,211,126,0.16), transparent 32%),
            linear-gradient(180deg, rgba(35,27,16,0.95), rgba(6,9,14,0.96));
          border: 1px solid rgba(248,211,126,0.46);
          box-shadow: 0 16px 36px rgba(0,0,0,0.45), inset 0 0 32px rgba(248,211,126,0.08);
          clip-path: none;
          backdrop-filter: blur(10px);
          overflow: visible;
          pointer-events: auto;
          z-index: 10;
          transition: all 0.2s ease-in-out;
        }
        .country-dossier.pokemon-card {
          width: 320px;
          border: 3px double #cfa24b;
          border-radius: 12px;
          background: linear-gradient(135deg, rgba(42,32,22,0.98), rgba(12,15,20,0.98));
          box-shadow: 0 16px 40px rgba(0,0,0,0.7), inset 0 0 24px rgba(207,167,95,0.1);
          padding: 12px;
          color: #f7e8c6;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .pokemon-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-bottom: 1.5px solid rgba(207,167,95,0.4);
          padding-bottom: 4px;
        }
        .pokemon-name-block {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .pokemon-flag {
          font-size: 24px;
          background: rgba(0,0,0,0.3);
          border: 1px solid rgba(207,167,95,0.3);
          padding: 2px 4px;
          border-radius: 4px;
        }
        .pokemon-stage {
          font-size: 8px;
          text-transform: uppercase;
          color: #cfa24b;
          font-weight: 800;
          letter-spacing: 0.5px;
        }
        .pokemon-name {
          font-size: 16px;
          font-weight: 900;
          color: #fff;
          text-shadow: 0 1px 2px rgba(0,0,0,0.8);
        }
        .pokemon-hp-block {
          text-align: right;
          display: flex;
          flex-direction: column;
        }
        .pokemon-hp-block small {
          font-size: 7px;
          color: #8492a6;
          font-weight: 800;
        }
        .pokemon-hp-block strong {
          font-size: 13px;
          color: #f3e7cf;
        }
        .pokemon-frame {
          border: 1px solid rgba(207,167,95,0.25);
          background: rgba(0,0,0,0.4);
          padding: 4px 8px;
          border-radius: 4px;
        }
        .pokemon-illustration {
          display: flex;
          justify-content: space-between;
          font-size: 9px;
          color: #b9c2d0;
          font-style: italic;
        }
        .pokemon-attacks {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .pokemon-move {
          border-bottom: 1px solid rgba(207,167,95,0.12);
          padding-bottom: 6px;
        }
        .move-header {
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .move-cost {
          font-size: 11px;
          filter: drop-shadow(0 1px 1px rgba(0,0,0,0.5));
        }
        .move-name {
          font-size: 11px;
          font-weight: 800;
          color: #fff5d6;
          flex: 1;
        }
        .move-damage {
          font-size: 12px;
          color: #cfa24b;
          font-weight: 900;
        }
        .move-desc {
          margin: 2px 0 0;
          font-size: 9.5px;
          color: #a8b3c2;
          line-height: 1.3;
        }
        .pokemon-ability {
          background: rgba(207,167,95,0.06);
          border: 1.5px dashed rgba(207,167,95,0.3);
          border-radius: 4px;
          padding: 6px;
        }
        .pokemon-ability.special {
          background: rgba(239,68,68,0.04);
          border-color: rgba(239,68,68,0.25);
        }
        .ability-badge {
          background: #cfa24b;
          color: #16120e;
          font-size: 8px;
          font-weight: 900;
          padding: 1px 4px;
          border-radius: 2px;
          margin-right: 6px;
          display: inline-block;
        }
        .ability-badge.special {
          background: #ef4444;
          color: #fff;
        }
        .dossier-mods-pokemon {
          display: flex;
          flex-direction: column;
          gap: 4px;
          margin-top: 4px;
        }
        .pokemon-mods-list {
          display: flex;
          flex-wrap: wrap;
          gap: 4px;
        }
        .pokemon-mod-chip {
          font-size: 9px;
          padding: 2px 6px;
          background: rgba(207,167,95,0.12);
          border: 1px solid rgba(207,167,95,0.22);
          color: #ffe9b7;
        }
        .pokemon-footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-top: 1px solid rgba(248,211,126,0.18);
          padding-top: 8px;
          margin-top: 4px;
        }
        .footer-code {
          font-size: 9px;
          color: #8492a6;
          font-style: italic;
        }
        .pokemon-collapse-btn {
          background: rgba(248,211,126,0.12);
          border: 1px solid rgba(248,211,126,0.46);
          color: #cfa24b;
          font-size: 10px;
          cursor: pointer;
          padding: 4px 8px;
          font-weight: bold;
          transition: background 0.15s ease;
        }
        .pokemon-collapse-btn:hover {
          background: rgba(248,211,126,0.24);
        }
        .country-dossier.collapsed {
          padding: 10px 14px;
          width: 280px;
          overflow: hidden;
        }
        .country-dossier.collapsed::before {
          inset: 4px;
        }
        .country-dossier.collapsed .dossier-topline {
          grid-template-columns: 36px 1fr;
          gap: 10px;
        }
        .country-dossier.collapsed .dossier-flag {
          width: 36px;
          height: 36px;
          font-size: 20px;
        }
        @media (max-width: 767px) {
          .country-dossier {
            left: 10px;
            bottom: 72px;
            width: calc(100% - 20px);
            max-width: 320px;
            z-index: 11;
          }
        }
        .country-dossier::before {
          content: "";
          position: absolute;
          inset: 6px;
          border: 1px solid rgba(248,211,126,0.16);
          pointer-events: none;
        }
        .dossier-topline {
          display: grid;
          grid-template-columns: 52px 1fr;
          gap: 12px;
          align-items: center;
        }
        .dossier-flag {
          display: grid;
          place-items: center;
          width: 52px;
          height: 52px;
          font-size: 28px;
          background: rgba(9,13,20,0.72);
          border: 1px solid rgba(248,211,126,0.35);
          box-shadow: inset 0 0 18px rgba(248,211,126,0.08);
        }
        .dossier-topline strong {
          display: block;
          color: #fff5d6;
          font-size: 29px;
          font-weight: 950;
          line-height: 1.05;
          text-shadow: 0 2px 0 rgba(0,0,0,0.8);
        }
        .dossier-topline span:last-child,
        .dossier-rank {
          color: #b9c2d0;
          font-size: 13px;
        }
        .dossier-rank {
          display: flex;
          flex-wrap: wrap;
          gap: 7px;
          margin-top: 9px;
        }
        .dossier-rank span {
          padding: 5px 8px;
          background: rgba(12,18,28,0.78);
          border: 1px solid rgba(248,211,126,0.18);
        }
        .dossier-lock {
          position: relative;
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 8px;
          align-items: center;
          margin-top: 10px;
          padding: 7px 9px 9px;
          color: #d8caa7;
          font-size: 12px;
          background: rgba(8,12,18,0.7);
          border: 1px solid rgba(248,211,126,0.22);
          overflow: hidden;
        }
        .dossier-lock strong {
          color: #fff5d6;
          font-size: 12px;
        }
        .dossier-lock i {
          position: absolute;
          left: 0;
          bottom: 0;
          height: 3px;
          background: linear-gradient(90deg, #c2802e, #ffe6a3);
          box-shadow: 0 0 14px rgba(248,211,126,0.45);
          transition: width 90ms linear;
        }
        .dossier-stats {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 7px;
          margin-top: 12px;
        }
        .dossier-stat {
          position: relative;
          padding: 7px 8px;
          color: #8fa0b5;
          font-size: 11px;
          text-transform: uppercase;
          background: rgba(6,13,23,0.68);
          border: 1px solid rgba(248,211,126,0.22);
          display: grid;
          gap: 2px;
        }
        .dossier-stat em {
          display: block;
          font-style: normal;
          font-size: 14px;
          margin-bottom: 2px;
        }
        .dossier-stat strong {
          display: block;
          margin-top: 2px;
          color: #fff5d6;
          font-size: 17px;
          text-transform: none;
        }
        .nested-tooltip {
          position: absolute !important;
          left: 0;
          bottom: calc(100% + 10px);
          z-index: 100;
          width: 300px;
          max-width: min(300px, calc(100vw - 48px));
          min-height: 84px;
          padding: 12px 12px 12px 38px !important;
          color: #f7e8c6 !important;
          font-size: 12px !important;
          line-height: 1.35;
          text-transform: none !important;
          background:
            linear-gradient(180deg, rgba(45,35,22,0.98), rgba(7,11,17,0.98));
          border: 1px solid rgba(248,211,126,0.58) !important;
          box-shadow: 0 16px 32px rgba(0,0,0,0.55), inset 0 0 28px rgba(248,211,126,0.08);
          opacity: 0;
          visibility: hidden;
          transform: translateY(4px);
          transition: opacity 140ms ease 520ms, transform 140ms ease 520ms, visibility 0ms linear 520ms;
          pointer-events: none;
        }
        .nested-tooltip .tooltip-icon {
          position: absolute;
          left: 12px;
          top: 14px;
          width: 18px;
          height: 18px;
          display: grid;
          place-items: center;
          font-size: 15px;
          background: rgba(248,211,126,0.12);
          border: 1px solid rgba(248,211,126,0.28);
        }
        .nested-tooltip b {
          display: block;
          margin-bottom: 4px;
          color: #fff5d6;
          font-size: 13px;
        }
        .dossier-stat:hover .nested-tooltip {
          opacity: 1;
          visibility: visible;
          transform: translateY(0);
        }
        .dossier-mods {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          margin-top: 10px;
        }
        .dossier-mods span {
          position: relative;
          padding: 6px 8px;
          color: #ffe2a3;
          font-size: 12px;
          background: rgba(119,74,20,0.35);
          border: 1px solid rgba(248,211,126,0.24);
        }
      `}</style>
    </div>
  );
}

function signed(value: number) {
  return value > 0 ? `+${value}` : String(value);
}

function DossierStat({ icon, label, value, detail }: { icon: string; label: string; value: string | number; detail: string }) {
  return (
    <span className="dossier-stat">
      <em>{icon}</em>
      {label}
      <strong>{value}</strong>
      <span className="nested-tooltip">
        <em className="tooltip-icon">{icon}</em>
        <b>{label}</b>
        {detail}
      </span>
    </span>
  );
}

function ModifierChip({ icon, label, detail }: { icon: string; label: string; detail: string }) {
  return (
    <span className="dossier-stat">
      {label}
      <span className="nested-tooltip">
        <em className="tooltip-icon">{icon}</em>
        <b>{label}</b>
        {detail}
      </span>
    </span>
  );
}

function governmentModifierLabel(government: string) {
  const values: Record<string, number> = {
    Communism: 10,
    Caliphate: 6,
    Democracy: 4,
    Aristocracy: 2,
    Revolutionary: 8,
  };
  return signed(values[government] ?? 0);
}

function modifierIcon(label: string) {
  if (/order|faith|zeal|catholic|sun/i.test(label)) return "☀️";
  if (/industrial|mobilization|factory/i.test(label)) return "🏭";
  if (/command|army|military|defense/i.test(label)) return "🛡️";
  if (/naval|fleet|island|coast/i.test(label)) return "⚓";
  if (/capital|bureau|state/i.test(label)) return "🏛️";
  return "✦";
}

function truncateMapLabel(name: string, maxLength: number) {
  if (name.length <= maxLength) return name;
  const words = name.split(" ");
  if (words.length > 1) {
    const initials = words.slice(1).map(word => word[0]).join("");
    const compact = `${words[0]} ${initials}`;
    if (compact.length <= maxLength) return compact;
  }
  return `${name.slice(0, Math.max(3, maxLength - 1)).trimEnd()}…`;
}
