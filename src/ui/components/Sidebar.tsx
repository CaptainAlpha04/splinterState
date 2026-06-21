"use client";

import { useMemo, useState, useEffect } from "react";
import type React from "react";
import type { Country } from "../../engine/models/country";
import { countryWheelBreakdown } from "../../engine/mechanics/initiativeWheel";
import {
  getCountryCost,
  getCountryDevelopmentScore,
  getCountryReligionModifier,
  getCountryTier,
  getValidTargetsForCountry,
  type CampaignScale,
  useGameStore,
} from "../../store/gameStore";
import RollLog from "./RollLog";

const campaignScales: CampaignScale[] = ["Story Mode", "World War", "Continent War", "Regional War"];

export default function Sidebar({
  isCollapsed,
  setIsCollapsed,
  isMobile,
}: {
  isCollapsed: boolean;
  setIsCollapsed: (c: boolean) => void;
  isMobile: boolean;
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [controlMode, setControlMode] = useState<"auto" | "manual">("auto");

  const isLoaded = useGameStore(state => state.isLoaded);
  const stage = useGameStore(state => state.stage);
  const player = useGameStore(state => state.player);
  const countries = useGameStore(state => state.countries);
  const provinces = useGameStore(state => state.provinces);
  const activeWars = useGameStore(state => state.activeWars);
  const selectedProvinceId = useGameStore(state => state.selectedProvinceId);
  const selectedCountryId = useGameStore(state => state.selectedCountryId);
  const selectedWarId = useGameStore(state => state.selectedWarId);
  const campaignScope = useGameStore(state => state.campaignScope);
  const completedWarResults = useGameStore(state => state.completedWarResults);
  const setCampaignScale = useGameStore(state => state.setCampaignScale);
  const chooseFavorite = useGameStore(state => state.chooseFavorite);
  const rollCampaignEvents = useGameStore(state => state.rollCampaignEvents);
  const selectWar = useGameStore(state => state.selectWar);
  const selectCountry = useGameStore(state => state.selectCountry);
  const focusCountry = useGameStore(state => state.focusCountry);
  const selectProvince = useGameStore(state => state.selectProvince);
  const skipAllWars = useGameStore(state => state.skipAllWars);
  const continueAfterWar = useGameStore(state => state.continueAfterWar);
  const resetCampaign = useGameStore(state => state.resetCampaign);
  const resolveManualWarPairing = useGameStore(state => state.resolveManualWarPairing);
  const playerControlMode = useGameStore(state => state.playerControlMode);
  const manualControlAttackSkipped = useGameStore(state => state.manualControlAttackSkipped);
  const capitals = useGameStore(state => state.capitals);

  const selectedProvince = selectedProvinceId ? provinces[selectedProvinceId] : null;
  const selectedCountry = selectedCountryId ? countries[selectedCountryId] : null;

  const countryCost = selectedCountry ? getCountryCost(selectedCountry) : 0;
  const canBuySelected = Boolean(
    selectedCountry &&
    campaignScope?.eligibleCountryIds.includes(selectedCountry.id) &&
    countryCost <= player.tickets
  );

  const stageTitle = useMemo(() => {
    switch (stage) {
      case "PickScope": return "Campaign Scale";
      case "PickFavorite": return "Campaign Favorite";
      case "EventHorizon": return "Event Horizon";
      case "ManualWarPairing": return "Manual Targeting";
      case "WarSelection": return "War Room";
      case "Betting": return "Wager Phase";
      case "Combat": return "Live Combat";
      case "CombatResult": return "Aftermath";
      case "CampaignWon": return "Victory";
      case "GameOver": return "Campaign Over";
      default: return "Campaign";
    }
  }, [stage]);

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const query = searchQuery.toLowerCase().trim();
    return Object.values(countries).filter(
      c => c.provinces.length > 0 && c.name.toLowerCase().includes(query)
    );
  }, [searchQuery, countries]);

  const activeSidebarStyle = isMobile ? {
    ...mobileSidebarStyle,
    bottom: isCollapsed ? -420 : 0,
  } : {
    ...desktopSidebarStyle,
    right: isCollapsed ? -420 : 20,
  };

  const handleCountryFocus = (countryId: string) => {
    const country = countries[countryId];
    if (country && country.provinces.length > 0) {
      selectCountry(countryId);
      const capProvId = country.capitalProvinceId;
      const firstProvId = country.provinces[0];
      selectProvince(capProvId && country.provinces.includes(capProvId) ? capProvId : firstProvId);
      focusCountry(countryId);
    }
  };

  return (
    <>
      {isMobile && isCollapsed && (
        <button
          type="button"
          onClick={() => setIsCollapsed(false)}
          style={mobilePullUpStyle}
        >
          📜 Show Logs & Wars
        </button>
      )}

      <aside style={activeSidebarStyle}>
        {!isMobile && (
          <button
            type="button"
            onClick={() => setIsCollapsed(!isCollapsed)}
            style={desktopToggleButtonStyle}
            title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
          >
            {isCollapsed ? "◀" : "▶"}
          </button>
        )}

        <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid rgba(193, 150, 84, 0.24)", paddingBottom: 8 }}>
          <h2 style={{ margin: 0, color: "#f3e7cf", fontSize: 20 }}>{stageTitle}</h2>
          {isMobile && (
            <button
              type="button"
              onClick={() => setIsCollapsed(true)}
              style={{
                background: "none",
                border: "none",
                color: "#cfa24b",
                fontSize: 18,
                cursor: "pointer",
                padding: "2px 6px",
              }}
            >
              ✕
            </button>
          )}
        </header>

        <div style={{ display: "flex", flexDirection: "column", gap: 12, flex: 1, overflowY: "auto", marginTop: 4 }}>
          {/* Country Search Box */}
          {isLoaded && stage !== "PickScope" && (
            <div style={{ padding: "2px 4px", position: "relative" }}>
              <input
                type="text"
                placeholder="🔍 Search countries..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={searchInputStyle}
              />
              {searchResults.length > 0 && (
                <div style={searchResultsDropdownStyle}>
                  {searchResults.map(c => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => {
                        handleCountryFocus(c.id);
                        setSearchQuery("");
                      }}
                      style={searchResultButtonStyle}
                    >
                      <strong>{c.flag} {c.name}</strong>
                      <span style={{ color: "#cfa24b", fontSize: 10 }}>{getCountryTier(c)} ({c.provinces.length} prov)</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {!isLoaded ? <Panel muted>Loading map assets...</Panel> : null}

          {stage === "PickScope" ? (
            <Panel>
              <p style={copyStyle}>Choose the campaign length. Continent and regional campaigns lock once you buy the favorite country that anchors them.</p>
              <div style={{ display: "grid", gap: 8 }}>
                {campaignScales.map(scale => (
                  <button key={scale} type="button" onClick={() => setCampaignScale(scale)} style={primaryButtonStyle}>
                    {scale}
                  </button>
                ))}
              </div>
            </Panel>
          ) : null}

          {stage === "PickFavorite" ? (
            <Panel>
              <CountryIntel country={selectedCountry} provinceName={selectedProvince?.name} compact />
              {selectedCountry ? (
                <>
                  <div style={priceRowStyle}>
                    <span>Favorite buy-in</span>
                    <strong>{countryCost} tickets</strong>
                  </div>

                  <div style={{ display: "grid", gap: 6, margin: "12px 0 16px" }}>
                    <span style={{ fontSize: 11, color: "#a8b3c2", fontWeight: "bold", textTransform: "uppercase", letterSpacing: 0.5 }}>Control Mode</span>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                      <button
                        key="auto-mode"
                        type="button"
                        onClick={() => setControlMode("auto")}
                        style={controlMode === "auto" ? activeModeButtonStyle : modeButtonStyle}
                      >
                        🤖 Auto Mode
                      </button>
                      <button
                        key="manual-mode"
                        type="button"
                        onClick={() => setControlMode("manual")}
                        style={controlMode === "manual" ? activeModeButtonStyle : modeButtonStyle}
                      >
                        🎮 Manual Control
                      </button>
                    </div>
                    <p style={{ ...copyStyle, fontSize: 11.5, margin: "4px 0 0", opacity: 0.8 }}>
                      {controlMode === "auto" 
                        ? "Spectator mode: matches resolve automatically. You only place bets." 
                        : "Playable mode: pick target countries to attack in each phase, or skip to defend."}
                    </p>
                  </div>

                  <button
                    type="button"
                    disabled={!canBuySelected}
                    onClick={() => chooseFavorite(selectedCountry.id, controlMode)}
                    style={canBuySelected ? primaryButtonStyle : disabledButtonStyle}
                  >
                    Buy Favorite
                  </button>
                  {!canBuySelected ? <p style={warningStyle}>Not enough tickets or outside selected scope.</p> : null}
                </>
              ) : (
                <p style={copyStyle}>Click a country on the map to inspect its price and pick your campaign favorite.</p>
              )}
            </Panel>
          ) : null}

          {stage === "ManualWarPairing" ? (
            (() => {
              const favoriteId = player.campaignFavoriteCountryId;
              const favorite = favoriteId ? countries[favoriteId] : null;
              const validTargets = favoriteId && campaignScope
                ? getValidTargetsForCountry(
                    favoriteId,
                    countries,
                    provinces,
                    campaignScope.eligibleCountryIds,
                    capitals
                  ).map(id => countries[id]).filter(Boolean)
                : [];
              return (
                <Panel>
                  <p style={copyStyle}>
                    <strong>{favorite?.flag} {favorite?.name}</strong>: Manual Targeting Phase. Select a neighboring country inside the campaign scope to attack this phase, or skip to defend.
                  </p>

                  {selectedCountry && selectedCountry.id !== favoriteId ? (
                    <div style={{ marginTop: 10, padding: 8, border: "1px solid rgba(210,165,82,0.3)", borderRadius: 4, background: "rgba(0,0,0,0.2)" }}>
                      <CountryIntel country={selectedCountry} compact />
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 10 }}>
                        <button
                          type="button"
                          disabled={!validTargets.some(t => t.id === selectedCountryId)}
                          onClick={() => resolveManualWarPairing(selectedCountryId)}
                          style={validTargets.some(t => t.id === selectedCountryId) ? primaryButtonStyle : disabledButtonStyle}
                        >
                          Declare War
                        </button>
                        <button
                          type="button"
                          onClick={() => resolveManualWarPairing(null)}
                          style={dangerButtonStyle}
                        >
                          Skip Attack
                        </button>
                      </div>
                      {!validTargets.some(t => t.id === selectedCountryId) ? (
                        <p style={warningStyle}>Selected country is not a valid neighboring target.</p>
                      ) : null}
                    </div>
                  ) : (
                    <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
                      <button
                        type="button"
                        onClick={() => resolveManualWarPairing(null)}
                        style={dangerButtonStyle}
                      >
                        Skip Attack (Pass Turn)
                      </button>
                    </div>
                  )}

                  {validTargets.length > 0 ? (
                    <div style={{ marginTop: 14 }}>
                      <span style={{ fontSize: 11, color: "#a8b3c2", fontWeight: "bold", textTransform: "uppercase" }}>Valid Targets ({validTargets.length})</span>
                      <div style={{ display: "grid", gap: 6, maxHeight: "150px", overflowY: "auto", marginTop: 6, paddingRight: 4 }}>
                        {validTargets.map(target => {
                          const isSelected = target.id === selectedCountryId;
                          return (
                            <button
                              key={target.id}
                              type="button"
                              onClick={() => {
                                selectCountry(target.id);
                                focusCountry(target.id);
                              }}
                              style={isSelected ? activeModeButtonStyle : modeButtonStyle}
                            >
                              {target.flag} {target.name}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <p style={{ ...copyStyle, color: "#ef4444", marginTop: 10 }}>No valid neighboring targets available this phase.</p>
                  )}
                </Panel>
              );
            })()
          ) : null}

          {stage === "EventHorizon" ? (
            <Panel>
              <p style={copyStyle}>Your favorite is locked. Roll event modifiers for every in-scope country, then wars erupt along valid borders.</p>
              <button type="button" onClick={rollCampaignEvents} style={primaryButtonStyle}>Roll Events</button>
            </Panel>
          ) : null}

          {stage === "WarSelection" || stage === "Betting" || stage === "Combat" ? (
            <Panel>
              {activeWars.length === 0 ? (
                <p style={copyStyle}>No active conflicts in this theater.</p>
              ) : (
                <div style={{ display: "grid", gap: 8 }}>
                  <p style={copyStyle}>
                    {stage === "WarSelection"
                      ? "Select a war from the list to enter the Betting & Combat phases."
                      : stage === "Betting"
                      ? "Active theater. Set your stake and predictions in the Battle Room widget."
                      : "Tactical rolls active. Roll dice in the Battle Room widget to resolve."}
                  </p>
                  <div style={{ display: "grid", gap: 6, maxHeight: "180px", overflowY: "auto", paddingRight: 4 }}>
                    {activeWars.map(war => {
                      const isCurrent = war.id === selectedWarId;
                      return (
                        <div key={war.id} style={{ display: "flex", gap: 4, alignItems: "stretch", width: "100%" }}>
                          <button
                            type="button"
                            onClick={() => handleCountryFocus(war.attackerId)}
                            style={warCountryButtonStyle}
                            title={`Zoom to ${countries[war.attackerId]?.name}`}
                          >
                            {countries[war.attackerId]?.flag} {countries[war.attackerId]?.name}
                          </button>
                          
                          <button
                            type="button"
                            onClick={() => selectWar(war.id)}
                            style={isCurrent ? warVsButtonSelectedStyle : warVsButtonStyle}
                            title="Select conflict front"
                          >
                            ⚔️
                          </button>
                          
                          <button
                            type="button"
                            onClick={() => handleCountryFocus(war.defenderId)}
                            style={warCountryButtonStyle}
                            title={`Zoom to ${countries[war.defenderId]?.name}`}
                          >
                            {countries[war.defenderId]?.flag} {countries[war.defenderId]?.name}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                  {completedWarResults.length > 0 ? (
                    <div style={{ color: "#94a3b8", fontSize: 12, marginTop: 4 }}>
                      Completed this phase: <strong>{completedWarResults.length}</strong>
                    </div>
                  ) : null}
                  {stage === "WarSelection" && (
                    <button type="button" onClick={skipAllWars} style={dangerButtonStyle}>
                      Skip All Wars
                    </button>
                  )}
                </div>
              )}
            </Panel>
          ) : null}

          {stage === "CombatResult" ? (
            <Panel>
              <p style={copyStyle}>All wars in this phase are resolved. Strategic map has been updated.</p>
              <button type="button" onClick={continueAfterWar} style={primaryButtonStyle}>Next Event Horizon</button>
            </Panel>
          ) : null}

          {stage === "GameOver" || stage === "CampaignWon" ? (
            <Panel>
              <p style={copyStyle}>
                {stage === "CampaignWon"
                  ? "Congratulations! Your campaign favorite is the last country standing."
                  : "Your campaign favorite has been eliminated from the theater."}
              </p>
              <button type="button" onClick={resetCampaign} style={primaryButtonStyle}>New Campaign</button>
            </Panel>
          ) : null}

          {stage !== "PickScope" && stage !== "PickFavorite" ? (
            <RollLog />
          ) : null}
        </div>
      </aside>
    </>
  );
}

function CountryIntel({ country, provinceName, compact = false }: { country: Country | null | undefined; provinceName?: string; compact?: boolean }) {
  if (!country) {
    return <p style={copyStyle}>No country selected.</p>;
  }

  const wheel = countryWheelBreakdown(country, country.provinces.length, false);
  const tooltip = `${country.name}: ${getCountryTier(country)}, ${country.government}, ${country.religion}. Development ${getCountryDevelopmentScore(country)}, initiative ${wheel.total}, ${country.provinces.length} provinces.`;

  return (
    <div style={{ display: "grid", gap: compact ? 5 : 8 }} title={tooltip}>
      <div>
        <div style={{ color: "#f8fafc", fontWeight: 800 }}>{country.flag} {country.name}</div>
        {provinceName ? <div style={{ color: "#8492a6", fontSize: 12 }}>Province: {provinceName}</div> : null}
      </div>
      <div style={detailGridStyle}>
        <span>Tier</span><strong>{getCountryTier(country)}</strong>
        <span>Buy-in</span><strong>{getCountryCost(country)}</strong>
        <span>Initiative</span><strong>{wheel.total}</strong>
        {!compact ? (
          <>
            <span>Government</span><strong>{country.government}</strong>
            <span>Religion</span><strong>{country.religion}</strong>
            <span>Development</span><strong>{getCountryDevelopmentScore(country)}</strong>
            <span>Camps</span><strong>{country.armyCampsCount}</strong>
            <span>Intercept</span><strong>{country.interceptorCharges}/3</strong>
            <span>Blitz</span><strong>{country.blitzActions}</strong>
          </>
        ) : null}
      </div>
    </div>
  );
}

function Panel({ children, muted = false }: { children: React.ReactNode; muted?: boolean }) {
  return <section style={{ ...panelStyle, color: muted ? "#94a3b8" : "#cbd5e1" }}>{children}</section>;
}

// Styling Constants
const desktopSidebarStyle: React.CSSProperties = {
  position: "absolute",
  top: 80,
  bottom: 20,
  width: 380,
  zIndex: 20,
  display: "flex",
  flexDirection: "column",
  gap: 12,
  background: "rgba(22, 18, 14, 0.96)",
  backdropFilter: "blur(10px)",
  border: "2px solid rgba(210, 165, 82, 0.55)",
  boxShadow: "0 16px 40px rgba(0,0,0,0.65), inset 0 0 32px rgba(210, 165, 82, 0.08)",
  padding: 18,
  transition: "right 0.3s ease-in-out",
};

const desktopToggleButtonStyle: React.CSSProperties = {
  position: "absolute",
  top: "50%",
  left: -30,
  transform: "translateY(-50%)",
  width: 30,
  height: 60,
  background: "rgba(22, 18, 14, 0.96)",
  border: "2px solid rgba(210, 165, 82, 0.55)",
  borderRight: "none",
  borderRadius: "8px 0 0 8px",
  color: "#cfa24b",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 14,
  zIndex: 21,
  boxShadow: "-8px 0 16px rgba(0,0,0,0.3)",
};

const mobileSidebarStyle: React.CSSProperties = {
  position: "absolute",
  left: 0,
  right: 0,
  height: 420,
  zIndex: 20,
  display: "flex",
  flexDirection: "column",
  gap: 12,
  background: "rgba(22, 18, 14, 0.98)",
  borderTop: "3px solid rgba(210, 165, 82, 0.7)",
  boxShadow: "0 -10px 30px rgba(0,0,0,0.6)",
  padding: "12px 16px",
  transition: "bottom 0.3s ease-in-out",
};

const mobilePullUpStyle: React.CSSProperties = {
  position: "absolute",
  left: "50%",
  bottom: 12,
  transform: "translateX(-50%)",
  background: "rgba(22, 18, 14, 0.96)",
  border: "1px solid rgba(210, 165, 82, 0.55)",
  borderRadius: "20px 20px 0 0",
  padding: "8px 20px",
  color: "#fff1cf",
  fontSize: 12,
  fontWeight: "bold",
  cursor: "pointer",
  zIndex: 19,
  boxShadow: "0 -4px 12px rgba(0,0,0,0.4)",
  display: "flex",
  alignItems: "center",
  gap: 6,
};

const panelStyle: React.CSSProperties = {
  border: "1px solid rgba(211,166,88,0.42)",
  borderRadius: 0,
  padding: 12,
  background: "linear-gradient(180deg, rgba(28,34,43,0.94), rgba(7,10,16,0.96))",
  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.07), inset 0 0 28px rgba(211,166,88,0.05), 0 8px 20px rgba(0,0,0,0.28)",
};

const copyStyle: React.CSSProperties = {
  margin: "0 0 8px",
  color: "#a8b3c2",
  fontSize: 13,
  lineHeight: 1.4,
};

const warningStyle: React.CSSProperties = {
  margin: "8px 0 0",
  color: "#fca5a5",
  fontSize: 12,
};

const primaryButtonStyle: React.CSSProperties = {
  border: "1px solid #c49a54",
  borderRadius: 0,
  background: "linear-gradient(180deg, #a97b35, #4d3518)",
  color: "#fff3d0",
  padding: "9px 12px",
  cursor: "pointer",
  fontWeight: 800,
  textShadow: "0 1px 0 #1c1208",
  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.18), 0 3px 0 #26190b, 0 8px 16px rgba(0,0,0,0.24)",
};

const disabledButtonStyle: React.CSSProperties = {
  border: "1px solid #334155",
  borderRadius: 3,
  background: "linear-gradient(180deg, #202736, #111722)",
  color: "#64748b",
  padding: "9px 11px",
  cursor: "not-allowed",
  fontWeight: 800,
};

const dangerButtonStyle: React.CSSProperties = {
  ...primaryButtonStyle,
  border: "1px solid #b91c1c",
  background: "linear-gradient(180deg, #9c2f23, #57140e)",
  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.15), 0 3px 0 #2b0b08",
};

const priceRowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  color: "#cbd5e1",
  margin: "8px 0",
  fontSize: 13,
};

const detailGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr auto",
  gap: "4px 10px",
  color: "#9ca3af",
  fontSize: 12,
};

const searchInputStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  padding: "8px 12px",
  borderRadius: "4px",
  background: "rgba(0, 0, 0, 0.45)",
  border: "1px solid rgba(210, 165, 82, 0.4)",
  color: "#fff1cf",
  fontSize: "13px",
  outline: "none",
};

const searchResultsDropdownStyle: React.CSSProperties = {
  position: "absolute",
  top: "100%",
  left: 4,
  right: 4,
  zIndex: 30,
  background: "rgba(22, 18, 14, 0.98)",
  border: "1px solid rgba(210, 165, 82, 0.55)",
  maxHeight: "180px",
  overflowY: "auto",
  boxShadow: "0 8px 16px rgba(0, 0, 0, 0.55)",
};

const searchResultButtonStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  width: "100%",
  padding: "8px 12px",
  background: "none",
  border: "none",
  borderBottom: "1px solid rgba(193, 150, 84, 0.12)",
  color: "#e2e8f0",
  cursor: "pointer",
  textAlign: "left",
  fontSize: "12px",
  transition: "background 0.15s ease",
};

const warCountryButtonStyle: React.CSSProperties = {
  background: "rgba(30, 38, 50, 0.8)",
  border: "1px solid rgba(184, 139, 74, 0.22)",
  borderRadius: 3,
  color: "#e2e8f0",
  padding: "6px 8px",
  fontSize: 11,
  cursor: "pointer",
  textAlign: "left",
  textOverflow: "ellipsis",
  overflow: "hidden",
  whiteSpace: "nowrap",
  display: "block",
  transition: "border 0.15s ease, background 0.15s ease",
};

const warVsButtonStyle: React.CSSProperties = {
  background: "rgba(22, 18, 14, 0.96)",
  border: "1px solid rgba(210, 165, 82, 0.4)",
  color: "#cfa24b",
  cursor: "pointer",
  width: 32,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 11,
  borderRadius: 3,
  transition: "background 0.15s ease",
};

const warVsButtonSelectedStyle: React.CSSProperties = {
  ...warVsButtonStyle,
  border: "1px solid #e7c06b",
  background: "linear-gradient(180deg, #9d6f30, #583912)",
  color: "#fff1cf",
  boxShadow: "0 0 10px rgba(248, 211, 126, 0.2)",
};

const modeButtonStyle: React.CSSProperties = {
  padding: "8px 12px",
  background: "rgba(255, 255, 255, 0.05)",
  border: "1px solid rgba(255, 255, 255, 0.15)",
  color: "#a8b3c2",
  fontSize: 12,
  fontWeight: "bold",
  cursor: "pointer",
  borderRadius: 4,
  textAlign: "center",
  transition: "all 0.18s ease-in-out",
};

const activeModeButtonStyle: React.CSSProperties = {
  ...modeButtonStyle,
  background: "linear-gradient(180deg, #9d6f30, #583912)",
  border: "1px solid #d6ad63",
  color: "#fff1cf",
  boxShadow: "0 0 10px rgba(193, 150, 84, 0.3)",
};
