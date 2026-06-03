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
  "#2f5f8f",
  "#8e4f9f",
  "#2f7b4a",
  "#a66f2c",
  "#5f64a7",
  "#a34338",
  "#3d897c",
  "#897742",
  "#7a4f7f",
  "#4f7c9e",
  "#76934a",
  "#9a5a66",
  "#4d7350",
  "#8b6b3d",
  "#b4557a",
  "#528c5d",
  "#456fa3",
  "#a15d3a",
  "#6f5eb0",
  "#3f8f95",
  "#9b8045",
  "#8a5171",
  "#597d3f",
  "#386b74",
  "#a2484f",
  "#5d7ca8",
  "#7c6f39",
  "#ab6c84",
  "#40805c",
  "#8c5c3d",
  "#5d5a94",
  "#9d8c52",
  "#44798a",
  "#9a5151",
  "#587546",
  "#6c669e",
  "#a56f3f",
  "#3f826f",
];

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
  if (countryId === "IND") return "#b97927";
  if (countryId === "BRA") return "#2f7b4a";

  return COUNTRY_PALETTE[paletteIndex(countryId)];
}

export default function MapSvg({ svgMarkup }: MapSvgProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapLayerRef = useRef<HTMLDivElement | null>(null);
  const dragStateRef = useRef<{ pointerId: number; startX: number; startY: number; originX: number; originY: number } | null>(null);
  const pendingViewportRef = useRef<Viewport | null>(null);
  const viewportRef = useRef<Viewport>({ scale: 1, x: 0, y: 0 });
  const frameRef = useRef<number | null>(null);
  const overlayRef = useRef<SVGSVGElement | null>(null);
  const viewportCommitTimerRef = useRef<number | null>(null);
  const hoverTimerRef = useRef<number | null>(null);
  const hoverProgressFrameRef = useRef<number | null>(null);
  const [viewport, setViewport] = useState<Viewport>({ scale: 1, x: 0, y: 0 });
  const [hoveredProvinceId, setHoveredProvinceId] = useState<string | null>(null);
  const [pinnedProvinceId, setPinnedProvinceId] = useState<string | null>(null);
  const [hoverProgress, setHoverProgress] = useState(0);

  const countries = useGameStore(state => state.countries);
  const provinces = useGameStore(state => state.provinces);
  const capitals = useGameStore(state => state.capitals);
  const activeWars = useGameStore(state => state.activeWars);
  const warTurns = useGameStore(state => state.warTurns);
  const selectedWarId = useGameStore(state => state.selectedWarId);
  const selectedProvinceId = useGameStore(state => state.selectedProvinceId);
  const selectedCountryId = useGameStore(state => state.selectedCountryId);
  const campaignScope = useGameStore(state => state.campaignScope);
  const selectProvince = useGameStore(state => state.selectProvince);
  const selectCountry = useGameStore(state => state.selectCountry);

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
      const usedByNeighbors = new Set(
        Array.from(neighbors[countryId] ?? [])
          .map(neighborId => colors[neighborId])
          .filter(Boolean)
      );
      let color = countries[countryId]?.mapColor ?? hashCountryColor(countryId);
      for (let offset = 0; usedByNeighbors.has(color) && offset < COUNTRY_PALETTE.length; offset += 1) {
        color = COUNTRY_PALETTE[(paletteIndex(countryId) + offset) % COUNTRY_PALETTE.length];
      }
      colors[countryId] = color;
    });

    colors.ATA = "#746c69";
    return colors;
  }, [countries, provinces]);

  const selectedProvince = selectedProvinceId ? provinces[selectedProvinceId] : null;
  const hoveredProvince = hoveredProvinceId ? provinces[hoveredProvinceId] : null;
  const pinnedProvince = pinnedProvinceId ? provinces[pinnedProvinceId] : null;
  const inspectedProvince = pinnedProvince ?? hoveredProvince ?? selectedProvince;
  const inspectedCountry = inspectedProvince ? countries[inspectedProvince.ownerId] : null;
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
  const activeViewBox = useMemo(() => {
    const bounds = campaignScope?.bounds ?? { minX: -180, maxX: 180, minY: -55, maxY: 85 };
    const x = bounds.minX + 180;
    const y = 90 - bounds.maxY;
    const width = Math.max(8, bounds.maxX - bounds.minX);
    const height = Math.max(8, bounds.maxY - bounds.minY);
    return `${x} ${y} ${width} ${height}`;
  }, [campaignScope]);

  function viewportTransform(nextViewport: Viewport) {
    return `translate3d(${nextViewport.x}px, ${nextViewport.y}px, 0) scale(${nextViewport.scale}, ${nextViewport.scale * MAP_Y_STRETCH})`;
  }

  function applyViewportTransform(nextViewport: Viewport) {
    const transform = viewportTransform(nextViewport);
    if (mapLayerRef.current) {
      mapLayerRef.current.style.transform = transform;
    }
    if (overlayRef.current) {
      overlayRef.current.style.transform = transform;
    }
  }

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

  useEffect(() => {
    if (mapLayerRef.current) {
      mapLayerRef.current.innerHTML = svgMarkup;
      const svg = mapLayerRef.current.querySelector("svg");
      svg?.setAttribute("viewBox", activeViewBox);
      svg?.setAttribute("preserveAspectRatio", "xMidYMid meet");
    }
  }, [activeViewBox, svgMarkup]);

  useEffect(() => {
    const svg = mapLayerRef.current?.querySelector("svg");
    svg?.setAttribute("viewBox", activeViewBox);
    const resetViewport = { scale: 1, x: 0, y: 0 };
    viewportRef.current = resetViewport;
    applyViewportTransform(resetViewport);
    setViewport(resetViewport);
  }, [activeViewBox]);

  useEffect(() => {
    const mapLayer = mapLayerRef.current;
    if (!mapLayer) return;

    mapLayer.querySelectorAll<SVGPathElement>(".province").forEach(path => {
      const province = provinces[path.id];
      const ownerId = province?.ownerId ?? path.dataset.country ?? "";
      const fill = province?.isIncinerated ? "#16181f" : countryColors[ownerId] ?? countries[ownerId]?.mapColor ?? "#2a3445";
      const isAntarctica = province?.initialCountryId === "ATA" || ownerId === "ATA";
      const isOutOfScope = eligibleCountryIds ? !eligibleCountryIds.has(ownerId) : false;
      const isSelected = selectedProvinceId === path.id || selectedCountryId === ownerId;
      const isHoveredCountryBorder = hoveredFrontierProvinceIds.owned.has(path.id);
      const isHoveredForeignBorder = hoveredFrontierProvinceIds.adjacentForeign.has(path.id);
      const isRecentCapture = recentCapturedProvinceIds.has(path.id);

      path.style.display = isAntarctica ? "none" : "";
      path.style.fill = fill;
      path.style.opacity = isOutOfScope ? "0.1" : isHoveredCountryBorder || isHoveredForeignBorder ? "0.98" : "0.92";
      path.style.stroke = isSelected
        ? "#f8f1d0"
        : isHoveredCountryBorder
          ? "#ffe7a3"
          : isHoveredForeignBorder
            ? "rgba(255,172,80,0.72)"
            : "rgba(3, 8, 14, 0.55)";
      path.style.strokeWidth = isSelected || isHoveredCountryBorder
        ? "0.42px"
        : isHoveredForeignBorder
          ? "0.24px"
          : "0.09px";
      path.style.vectorEffect = "non-scaling-stroke";
      path.style.cursor = "pointer";
      path.classList.toggle("province-frontier-focus", isHoveredCountryBorder);
      path.classList.toggle("province-frontier-neighbor", isHoveredForeignBorder);
      path.classList.toggle("province-captured", isRecentCapture);
      path.style.transition = "fill 180ms ease, opacity 140ms ease, stroke 120ms ease";
    });
  }, [countryColors, eligibleCountryIds, hoveredFrontierProvinceIds, provinces, recentCapturedProvinceIds, selectedCountryId, selectedProvinceId]);

  function clampScale(value: number) {
    return Math.min(9, Math.max(1, value));
  }

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
    applyViewportTransform(nextViewport);
    commitViewportSoon(nextViewport);
  }

  function handlePointerDown(event: React.PointerEvent<HTMLDivElement>) {
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

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const drag = dragStateRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    pendingViewportRef.current = {
      scale: viewportRef.current.scale,
      x: drag.originX + event.clientX - drag.startX,
      y: drag.originY + event.clientY - drag.startY,
    };
    if (frameRef.current === null) {
      frameRef.current = window.requestAnimationFrame(() => {
        frameRef.current = null;
        const nextViewport = pendingViewportRef.current;
        if (nextViewport) {
          pendingViewportRef.current = null;
          viewportRef.current = nextViewport;
          applyViewportTransform(nextViewport);
        }
      });
    }
  }

  function handlePointerUp(event: React.PointerEvent<HTMLDivElement>) {
    if (dragStateRef.current?.pointerId === event.pointerId) {
      dragStateRef.current = null;
      event.currentTarget.releasePointerCapture(event.pointerId);
      commitViewportSoon(viewportRef.current, true);
    }
  }

  function handleMapClick(event: React.MouseEvent<HTMLDivElement>) {
    const target = event.target as Element | null;
    const provincePath = target?.closest?.(".province") as SVGPathElement | null;
    const provinceId = provincePath?.id ?? hoveredProvinceId;
    const province = provinceId ? provinces[provinceId] : null;
    setPinnedProvinceId(null);
    setHoverProgress(0);
    selectProvince(provinceId ?? null);
    selectCountry(province?.ownerId ?? null);
  }

  function handleMapMove(event: React.MouseEvent<HTMLDivElement>) {
    const target = event.target as Element | null;
    const provincePath = target?.closest?.(".province") as SVGPathElement | null;
    const nextHoveredProvinceId = provincePath?.id ?? null;
    if (nextHoveredProvinceId !== hoveredProvinceId) {
      setHoveredProvinceId(nextHoveredProvinceId);
    }
  }

  const transform = viewportTransform(viewport);

  return (
    <div
      ref={containerRef}
      onWheel={handleWheel}
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
        border: "0",
        borderRadius: 0,
        background:
          "radial-gradient(circle at 50% 35%, #112334 0%, #081521 52%, #04080d 100%)",
        width: "100%",
        height: "100%",
        overflow: "hidden",
        position: "relative",
        touchAction: "none",
        boxShadow:
          "inset 0 0 90px rgba(0,0,0,0.36)",
      }}
    >
      <div
        ref={mapLayerRef}
        style={{
          width: "100%",
          height: "100%",
          display: "block",
          transform,
          transformOrigin: "center center",
          willChange: "transform",
          backfaceVisibility: "hidden",
          contain: "layout paint size",
        }}
      />

      <svg
        ref={overlayRef}
        viewBox={activeViewBox}
        preserveAspectRatio="xMidYMid meet"
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          pointerEvents: "none",
          transform,
          transformOrigin: "center center",
          overflow: "visible",
          willChange: "transform",
          backfaceVisibility: "hidden",
        }}
      >
        {capitals.map(capital => {
          const country = countries[capital.countryId];
          if (country?.id === "ATA") return null;
          if (eligibleCountryIds && !eligibleCountryIds.has(capital.countryId)) return null;
          if (!country?.isAlive || !country.capitalProvinceId) return null;
          const development = getCountryDevelopmentScore(country);
          const shouldShowCapital =
            selectedCountryId === country.id ||
            hoveredCountryId === country.id ||
            (viewport.scale >= 1.35 && LABEL_COUNTRIES.has(country.id)) ||
            (viewport.scale >= 2.25 && development >= 180) ||
            viewport.scale >= 4;
          if (!shouldShowCapital) return null;
          const capitalOwnerId = provinces[country.capitalProvinceId]?.ownerId ?? country.id;
          const isOccupied = capitalOwnerId !== country.id;

          return (
            <circle
              key={`${capital.countryId}-${capital.name}`}
              cx={capital.longitude + 180}
              cy={90 - capital.latitude}
              r={isOccupied ? 0.86 : 0.58}
              fill={isOccupied ? "#ffdd66" : "#f8fafc"}
              stroke={countryColors[capitalOwnerId] ?? "#111827"}
              strokeWidth="0.2"
              vectorEffect="non-scaling-stroke"
            />
          );
        })}
        {labelCapitals.map(capital => {
          const country = countries[capital.countryId];
          if (!country) return null;
          const isFocus = selectedCountryId === country.id || hoveredCountryId === country.id;
          const showFullName = viewport.scale >= 2.6 && country.name.length <= 18;
          const displayName = isFocus
            ? truncateMapLabel(country.name, viewport.scale >= 3 ? 18 : 14)
            : showFullName
              ? truncateMapLabel(country.name, 16)
              : country.id;
          const label = isFocus ? `${country.flag} ${displayName}` : displayName;
          const fontSize = (isFocus ? 2.15 : 1.45) * Math.max(0.42, Math.min(1, 1 / Math.sqrt(viewport.scale)));
          const labelWidth = Math.min(isFocus ? 34 : 20, Math.max(isFocus ? 12 : 5.5, label.length * fontSize * 1.45 + 2.4));
          const labelHeight = (isFocus ? 4.2 : 2.95) * Math.max(0.58, Math.min(1, 1 / Math.sqrt(viewport.scale)));
          const labelY = -labelHeight * 0.82;

          return (
            <g key={`${capital.countryId}-label`} transform={`translate(${capital.longitude + 180} ${90 - capital.latitude})`}>
              <title>{country.flag} {country.name}</title>
              <rect
                x={0.7}
                y={labelY}
                width={labelWidth}
                height={labelHeight}
                rx={0.9}
                fill={isFocus ? "rgba(239,224,190,0.96)" : "rgba(12,13,16,0.76)"}
                stroke={countryColors[country.id] ?? "#334155"}
                strokeWidth="0.18"
                vectorEffect="non-scaling-stroke"
              />
              <text
                x={1.6}
                y={labelY + labelHeight * 0.68}
                fill={isFocus ? "#13100b" : "#f7ead0"}
                fontSize={fontSize}
                fontWeight={isFocus ? 800 : 700}
                style={{ userSelect: "none" }}
              >
                {label}
              </text>
            </g>
          );
        })}
        {activeWars.map(war => {
          const attackerCapital = capitals.find(capital => capital.countryId === war.attackerId);
          const defenderCapital = capitals.find(capital => capital.countryId === war.defenderId);
          const attacker = countries[war.attackerId];
          const defender = countries[war.defenderId];
          if (!attackerCapital || !defenderCapital || !attacker || !defender) return null;
          const x1 = attackerCapital.longitude + 180;
          const y1 = 90 - attackerCapital.latitude;
          const x2 = defenderCapital.longitude + 180;
          const y2 = 90 - defenderCapital.latitude;
          const midX = (x1 + x2) / 2;
          const midY = (y1 + y2) / 2;

          return (
            <g key={`${war.id}-front`}>
              <line
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke="rgba(248, 211, 126, 0.72)"
                strokeWidth="0.34"
                strokeDasharray="1.4 1.1"
                vectorEffect="non-scaling-stroke"
              />
              <circle
                cx={midX}
                cy={midY}
                r={1.1}
                fill="#f8d37e"
                stroke="rgba(55,20,10,0.8)"
                strokeWidth="0.2"
                vectorEffect="non-scaling-stroke"
                className="war-pulse"
              />
            </g>
          );
        })}
        {Array.from(
          new Map(
            capitals
              .map(capital => [capital.countryId, capital] as const)
          ).values()
        ).map(capital => {
          const country = countries[capital.countryId];
          if (!country?.isAlive || country.id === "ATA" || country.armyCampsCount <= 0) return null;
          if (eligibleCountryIds && !eligibleCountryIds.has(country.id)) return null;
          return (
            <g
              key={`${country.id}-${capital.name}-shield`}
              transform={`translate(${capital.longitude + 181.2} ${90 - capital.latitude + 1.2})`}
              className="map-token"
            >
              <circle r="1.65" fill="rgba(18,24,34,0.92)" stroke="#f8d37e" strokeWidth="0.18" vectorEffect="non-scaling-stroke" />
              <path d="M -0.65 -0.85 L 0.65 -0.85 L 0.42 0.55 L 0 0.95 L -0.42 0.55 Z" fill="#f8d37e" />
            </g>
          );
        })}
      </svg>

      {inspectedProvince && inspectedCountry ? (
        <div className="country-dossier">
          <div className="dossier-topline">
            <span className="dossier-flag">{inspectedCountry.flag}</span>
            <div>
              <strong>{inspectedCountry.name}</strong>
              <span>{inspectedProvince.name}{inspectedCountry.capitalProvinceId === inspectedProvince.id ? " / capital" : ""}</span>
            </div>
          </div>
          <div className="dossier-rank">
            <span>{getCountryTier(inspectedCountry)}</span>
            <span>{inspectedCountry.government}</span>
            <span>{inspectedCountry.religion}</span>
          </div>
          <div className="dossier-lock">
            <span>{pinnedProvinceId ? "Pinned dossier - click map to release" : "Hold hover to pin dossier"}</span>
            <strong>{Math.round(pinnedProvinceId ? 100 : hoverProgress)}%</strong>
            <i style={{ width: `${pinnedProvinceId ? 100 : hoverProgress}%` }} />
          </div>
          <div className="dossier-stats">
            <DossierStat icon="🎯" label="Initiative" value={inspectedWheel?.total ?? 0} detail="Turn-order chance only. Initiative decides who acts on a roll; it is not used for campaign score or long-war dominance." />
            <DossierStat icon="🏰" label="Land" value={inspectedWheel?.provincePower ?? 0} detail="Controlled development plus current territory footprint. This is the backbone of combat momentum." />
            <DossierStat icon="📜" label="Dev" value={getCountryDevelopmentScore(inspectedCountry)} detail="Population, area, strategic power, current footprint, and formations. This decides tier and buy-in more than raw province count." />
            <DossierStat icon="☀️" label="Faith" value={signed(getCountryReligionModifier(inspectedCountry))} detail={`${getCountryReligionModifierLabel(inspectedCountry)} adds directly to initiative for this country.`} />
            <DossierStat icon="⚖️" label="Gov" value={governmentModifierLabel(inspectedCountry.government)} detail="Government ideology modifier. It adds to initiative alongside faith, events, and special modifiers." />
            <DossierStat icon="🌩️" label="Event" value={signed(inspectedCountry.eventModifier)} detail="Temporary modifier rolled during the Event Horizon. It resets next phase." />
            <DossierStat icon="🎟️" label="Cost" value={getCountryCost(inspectedCountry)} detail="Favorite buy-in. Expensive powers have stronger starting position and better payout risk." />
            <DossierStat icon="🧭" label="Provinces" value={inspectedCountry.provinces.length} detail="Current province count. It affects capture volume, but no longer defines empire rank by itself." />
            <DossierStat icon="🪖" label="Camps" value={inspectedCountry.armyCampsCount} detail="Army camps are permanent territory-bound assets. Each camp adds +25 initiative and is inherited by a full annexation victor." />
            <DossierStat icon="📡" label="Intercept" value={inspectedCountry.interceptorCharges} detail="Interceptor charges stack up to 3. The next enemy positive conquest roll is nullified, then initiative immediately re-spins." />
            <DossierStat icon="📣" label="Blitz" value={inspectedCountry.blitzActions} detail="Blitz actions are banked public support. The next initiative win chains a back-to-back secondary action roll." />
          </div>
          <div className="dossier-mods">
            <ModifierChip label="Army Camp +25 each" detail="Long-term initiative scaling. Annexing a country inherits its accumulated camps." icon="🪖" />
            <ModifierChip label={`Interceptor ${inspectedCountry.interceptorCharges}/3`} detail="Defensive counter-play. Automatically blocks the next enemy +1 to +8 conquest roll and forces a re-spin." icon="📡" />
            <ModifierChip label={`Blitz Actions ${inspectedCountry.blitzActions}`} detail="Aggressive tempo. The next won initiative spin gets a secondary action roll in the same turn." icon="📣" />
            <ModifierChip
              label={`${getCountryReligionModifierLabel(inspectedCountry)} ${signed(getCountryReligionModifier(inspectedCountry))}`}
              detail={`${inspectedCountry.religion} modifies initiative by ${signed(getCountryReligionModifier(inspectedCountry))}.`}
              icon="☀️"
            />
            {inspectedCountry.specialModifiers.map(modifier => (
              <ModifierChip
                key={modifier.label}
                label={`${modifier.label} ${signed(modifier.value)}`}
                detail={modifier.description}
                icon={modifierIcon(modifier.label)}
              />
            ))}
            {inspectedCapital ? <ModifierChip label={`Capital ${inspectedCapital.name}`} detail="Capital control matters for occupation pressure and campaign identity." icon="🏛️" /> : null}
          </div>
        </div>
      ) : null}

      <style jsx global>{`
        @keyframes warPulse {
          0%, 100% { opacity: 0.55; }
          50% { opacity: 1; }
        }
        .province {
          filter: saturate(1.08) contrast(1.06);
        }
        .province:hover {
          filter: brightness(1.2) saturate(1.18);
          stroke: #f8f1d0 !important;
          stroke-width: 0.38px !important;
        }
        .province-frontier-focus {
          filter: brightness(1.13) saturate(1.2) drop-shadow(0 0 1.8px rgba(248,211,126,0.42));
        }
        .province-frontier-neighbor {
          filter: brightness(1.03) saturate(1.08);
        }
        .province-captured {
          animation: provinceCapture 1.1s ease-out both;
          filter: brightness(1.35) saturate(1.35) drop-shadow(0 0 2px rgba(248,211,126,0.75));
        }
        @keyframes provinceCapture {
          0% { opacity: 0.55; stroke-width: 1px; }
          45% { opacity: 1; stroke-width: 0.7px; }
          100% { opacity: 0.92; stroke-width: 0.12px; }
        }
        .war-pulse {
          animation: warPulse 1.6s ease-in-out infinite;
        }
        .map-token {
          filter: drop-shadow(0 1px 1px rgba(0,0,0,0.85));
        }
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
        .dossier-stats span {
          position: relative;
          padding: 7px 8px;
          color: #8fa0b5;
          font-size: 11px;
          text-transform: uppercase;
          background: rgba(6,13,23,0.68);
          border: 1px solid rgba(248,211,126,0.22);
        }
        .dossier-stat em {
          display: block;
          font-style: normal;
          font-size: 14px;
          margin-bottom: 2px;
        }
        .dossier-stats strong {
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
          z-index: 8;
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
          pointer-events: auto;
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
        .dossier-stat:hover .nested-tooltip,
        .nested-tooltip:hover {
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
        svg {
          width: 100%;
          height: 100%;
          display: block;
          max-width: none;
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
