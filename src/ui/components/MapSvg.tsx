"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type React from "react";
import { countryWheelBreakdown } from "../../engine/mechanics/initiativeWheel";
import { getCountryCost, getCountrySpecialModifierTotal, getCountryTier, useGameStore } from "../../store/gameStore";

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
  const [viewport, setViewport] = useState<Viewport>({ scale: 1, x: 0, y: 0 });
  const [hoveredProvinceId, setHoveredProvinceId] = useState<string | null>(null);

  const countries = useGameStore(state => state.countries);
  const provinces = useGameStore(state => state.provinces);
  const capitals = useGameStore(state => state.capitals);
  const activeWars = useGameStore(state => state.activeWars);
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
      const ownerId = province.initialCountryId;
      if (!neighbors[ownerId]) neighbors[ownerId] = new Set();
      province.adjacentProvinceIds.forEach(adjacentId => {
        const adjacentOwnerId = provinces[adjacentId]?.initialCountryId;
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
      let color = hashCountryColor(countryId);
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
  const inspectedProvince = hoveredProvince ?? selectedProvince;
  const inspectedCountry = inspectedProvince ? countries[inspectedProvince.ownerId] : null;
  const hoveredCountryId = hoveredProvince?.ownerId ?? null;
  const inspectedCapital = inspectedCountry
    ? capitals.find(capital => capital.countryId === inspectedCountry.id)
    : null;
  const inspectedWheel = inspectedCountry
    ? countryWheelBreakdown(inspectedCountry, inspectedCountry.provinces.length, false)
    : null;
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
      const shouldShowMajorLabel = viewport.scale >= 1.55 && LABEL_COUNTRIES.has(country.id);
      if (!isFocus && !shouldShowMajorLabel) return;

      if (!uniqueByCountry.has(country.id)) {
        uniqueByCountry.set(country.id, capital);
      }
    });
    return Array.from(uniqueByCountry.values());
  }, [capitals, countries, eligibleCountryIds, hoveredCountryId, selectedCountryId, viewport.scale]);
  const activeViewBox = useMemo(() => {
    const bounds = campaignScope?.bounds ?? { minX: -180, maxX: 180, minY: -55, maxY: 85 };
    const x = bounds.minX + 180;
    const y = 90 - bounds.maxY;
    const width = Math.max(8, bounds.maxX - bounds.minX);
    const height = Math.max(8, bounds.maxY - bounds.minY);
    return `${x} ${y} ${width} ${height}`;
  }, [campaignScope]);

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
    setViewport({ scale: 1, x: 0, y: 0 });
  }, [activeViewBox]);

  useEffect(() => {
    const mapLayer = mapLayerRef.current;
    if (!mapLayer) return;

    mapLayer.querySelectorAll<SVGPathElement>(".province").forEach(path => {
      const province = provinces[path.id];
      const ownerId = province?.ownerId ?? path.dataset.country ?? "";
      const fill = province?.isIncinerated ? "#16181f" : countryColors[ownerId] ?? "#2a3445";
      const isAntarctica = province?.initialCountryId === "ATA" || ownerId === "ATA";
      const isOutOfScope = eligibleCountryIds ? !eligibleCountryIds.has(ownerId) : false;
      const isSelected = selectedProvinceId === path.id || selectedCountryId === ownerId;
      const isHovered = hoveredProvinceId === path.id || hoveredCountryId === ownerId;

      path.style.display = isAntarctica ? "none" : "";
      path.style.fill = fill;
      path.style.opacity = isOutOfScope ? "0.1" : "0.92";
      path.style.stroke = isSelected || isHovered ? "#f8f1d0" : "rgba(3, 8, 14, 0.55)";
      path.style.strokeWidth = selectedCountryId === ownerId ? "0.42px" : isHovered ? "0.38px" : "0.09px";
      path.style.vectorEffect = "non-scaling-stroke";
      path.style.cursor = "pointer";
      path.style.transition = "fill 180ms ease, opacity 140ms ease, stroke 120ms ease";
    });
  }, [countryColors, eligibleCountryIds, hoveredCountryId, hoveredProvinceId, provinces, selectedCountryId, selectedProvinceId]);

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
    const nextScale = clampScale(viewport.scale * (event.deltaY > 0 ? 0.88 : 1.14));
    const ratio = nextScale / viewport.scale;

    setViewport({
      scale: nextScale,
      x: pointerX - (pointerX - viewport.x) * ratio,
      y: pointerY - (pointerY - viewport.y) * ratio,
    });
  }

  function handlePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    dragStateRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: viewport.x,
      originY: viewport.y,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const drag = dragStateRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    setViewport(current => ({
      ...current,
      x: drag.originX + event.clientX - drag.startX,
      y: drag.originY + event.clientY - drag.startY,
    }));
  }

  function handlePointerUp(event: React.PointerEvent<HTMLDivElement>) {
    if (dragStateRef.current?.pointerId === event.pointerId) {
      dragStateRef.current = null;
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  function handleMapClick(event: React.MouseEvent<HTMLDivElement>) {
    const target = event.target as Element | null;
    const provincePath = target?.closest?.(".province") as SVGPathElement | null;
    const provinceId = provincePath?.id ?? hoveredProvinceId;
    const province = provinceId ? provinces[provinceId] : null;
    selectProvince(provinceId ?? null);
    selectCountry(province?.ownerId ?? null);
  }

  function handleMapMove(event: React.MouseEvent<HTMLDivElement>) {
    const target = event.target as Element | null;
    const provincePath = target?.closest?.(".province") as SVGPathElement | null;
    setHoveredProvinceId(provincePath?.id ?? null);
  }

  function adjustZoom(multiplier: number) {
    setViewport(current => ({ ...current, scale: clampScale(current.scale * multiplier) }));
  }

  const transform = `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.scale}, ${viewport.scale * MAP_Y_STRETCH})`;

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
      onMouseLeave={() => setHoveredProvinceId(null)}
      style={{
        border: "1px solid rgba(207,167,95,0.28)",
        borderRadius: 3,
        background:
          "radial-gradient(circle at 50% 35%, #112334 0%, #081521 52%, #04080d 100%)",
        width: "100%",
        height: "100%",
        overflow: "hidden",
        position: "relative",
        touchAction: "none",
        boxShadow:
          "inset 0 0 0 1px rgba(255,255,255,0.035), inset 0 0 90px rgba(0,0,0,0.36), 0 18px 60px rgba(0,0,0,0.24)",
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
        }}
      />

      <svg
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
        }}
      >
        {capitals.map(capital => {
          const country = countries[capital.countryId];
          if (country?.id === "ATA") return null;
          if (eligibleCountryIds && !eligibleCountryIds.has(capital.countryId)) return null;
          if (!country?.isAlive || !country.capitalProvinceId) return null;
          if (selectedCountryId !== country.id && hoveredCountryId !== country.id && viewport.scale < 1.55) return null;
          if (viewport.scale >= 1.55 && !LABEL_COUNTRIES.has(country.id) && selectedCountryId !== country.id && hoveredCountryId !== country.id) return null;
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
          const label = `${country.flag} ${country.id}`;

          return (
            <g key={`${capital.countryId}-label`} transform={`translate(${capital.longitude + 180} ${90 - capital.latitude})`}>
              <rect
                x={0.9}
                y={isFocus ? -4.9 : -4.2}
                width={Math.max(10, label.length * 3.2)}
                height={isFocus ? 5.8 : 5}
                rx={1.4}
                fill={isFocus ? "rgba(239,224,190,0.96)" : "rgba(12,13,16,0.76)"}
                stroke={countryColors[country.id] ?? "#334155"}
                strokeWidth="0.18"
                vectorEffect="non-scaling-stroke"
              />
              <text
                x={2.2}
                y={isFocus ? -0.8 : -0.9}
                fill={isFocus ? "#13100b" : "#f7ead0"}
                fontSize={isFocus ? 3.1 : 2.7}
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
      </svg>

      <div
        style={{
          position: "absolute",
          left: 14,
          top: 14,
          display: "flex",
          gap: 6,
          background: "linear-gradient(180deg, rgba(32,27,20,0.88), rgba(6,9,14,0.86))",
          border: "1px solid rgba(207,167,95,0.3)",
          borderRadius: 3,
          padding: 6,
          backdropFilter: "blur(8px)",
        }}
      >
        <button type="button" onClick={() => adjustZoom(1.22)} style={controlButtonStyle} title="Zoom in">
          +
        </button>
        <button type="button" onClick={() => adjustZoom(0.82)} style={controlButtonStyle} title="Zoom out">
          -
        </button>
        <button type="button" onClick={() => setViewport({ scale: 1, x: 0, y: 0 })} style={controlButtonStyle} title="Reset map">
          Reset
        </button>
      </div>

      {inspectedProvince && inspectedCountry ? (
        <div
          style={{
            position: "absolute",
            left: 14,
            bottom: 14,
            maxWidth: 320,
            background: "linear-gradient(180deg, rgba(32,27,20,0.94), rgba(6,9,14,0.94))",
            border: "1px solid rgba(207,167,95,0.34)",
            borderRadius: 3,
            padding: "10px 12px",
            backdropFilter: "blur(10px)",
          }}
        >
          <div style={{ color: "#f8fafc", fontWeight: 800 }}>{inspectedCountry.flag} {inspectedCountry.name}</div>
          <div style={{ color: "#a8b3c2", fontSize: 13 }}>
            {inspectedProvince.name} · {getCountryTier(inspectedCountry)} · {inspectedCountry.government}
            {inspectedCountry.capitalProvinceId === inspectedProvince.id ? " · capital" : ""}
          </div>
          <div style={{ color: "#748397", fontSize: 12, marginTop: 4, lineHeight: 1.35 }}>
            {inspectedCountry.provinces.length} provinces · {getCountryCost(inspectedCountry)} tickets · wheel {inspectedWheel?.total ?? 0}
            <br />
            land {inspectedWheel?.provincePower ?? 0} · gov {governmentModifierLabel(inspectedCountry.government)} · event {signed(inspectedCountry.eventModifier)} · special {signed(getCountrySpecialModifierTotal(inspectedCountry))}
            {inspectedCapital ? ` · ${inspectedCapital.name}` : ""}
          </div>
          <div style={{ color: "#cbd5e1", fontSize: 12, marginTop: 6 }}>
            {inspectedCountry.specialModifiers.map(modifier => `${modifier.label} ${signed(modifier.value)}`).join(" · ")}
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
        }
        .war-pulse {
          animation: warPulse 1.6s ease-in-out infinite;
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

const controlButtonStyle: React.CSSProperties = {
  minWidth: 34,
  height: 30,
  border: "1px solid rgba(207,167,95,0.45)",
  borderRadius: 3,
  background: "linear-gradient(180deg, #3b2d1c, #11151d)",
  color: "#f6ead0",
  cursor: "pointer",
  fontWeight: 800,
  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.1), 0 2px 0 rgba(0,0,0,0.5)",
};

function signed(value: number) {
  return value > 0 ? `+${value}` : String(value);
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
