"use client";

import { useMemo, useState } from "react";
import type React from "react";
import type { Country } from "../../engine/models/country";
import { countryWheelBreakdown } from "../../engine/mechanics/initiativeWheel";
import {
  getCountryCost,
  getCountryDevelopmentScore,
  getCountryReligionModifier,
  getCountryTier,
  type CampaignScale,
  useGameStore,
} from "../../store/gameStore";
import WheelCanvas from "./WheelCanvas";
import RollLog from "./RollLog";

const campaignScales: CampaignScale[] = ["World War", "Continent War", "Regional War"];

export default function Sidebar() {
  const [betAmount, setBetAmount] = useState(50);
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
  const currentBet = useGameStore(state => state.currentBet);
  const lastCombatOutcome = useGameStore(state => state.lastCombatOutcome);
  const warTurns = useGameStore(state => state.warTurns);
  const completedWarResults = useGameStore(state => state.completedWarResults);
  const isResolvingTurn = useGameStore(state => state.isResolvingTurn);
  const setCampaignScale = useGameStore(state => state.setCampaignScale);
  const chooseFavorite = useGameStore(state => state.chooseFavorite);
  const rollCampaignEvents = useGameStore(state => state.rollCampaignEvents);
  const selectWar = useGameStore(state => state.selectWar);
  const placeWarBet = useGameStore(state => state.placeWarBet);
  const rollSelectedWarTurn = useGameStore(state => state.rollSelectedWarTurn);
  const skipSelectedWar = useGameStore(state => state.skipSelectedWar);
  const skipAllWars = useGameStore(state => state.skipAllWars);
  const continueAfterWar = useGameStore(state => state.continueAfterWar);
  const resetCampaign = useGameStore(state => state.resetCampaign);

  const selectedProvince = selectedProvinceId ? provinces[selectedProvinceId] : null;
  const selectedCountry = selectedCountryId ? countries[selectedCountryId] : null;
  const selectedWar = activeWars.find(war => war.id === selectedWarId) ?? null;
  const selectedWarCountries = selectedWar
    ? [countries[selectedWar.attackerId], countries[selectedWar.defenderId]].filter(Boolean)
    : [];
  const selectedWarTurns = selectedWar ? warTurns[selectedWar.id] ?? [] : [];
  const latestTurn = selectedWarTurns[selectedWarTurns.length - 1] ?? null;

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
      case "WarSelection": return "War Room";
      case "Betting": return "Wager";
      case "Combat": return "Live War";
      case "CombatResult": return "Aftermath";
      case "CampaignWon": return "Victory";
      case "GameOver": return "Campaign Over";
      default: return "Campaign";
    }
  }, [stage]);

  return (
    <aside style={sidebarStyle}>
      <header>
        <h2 style={{ margin: 0, color: "#f3e7cf", fontSize: 24 }}>{stageTitle}</h2>
      </header>

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
          <CountryIntel country={selectedCountry} provinceName={selectedProvince?.name} />
          {selectedCountry ? (
            <>
              <div style={priceRowStyle}>
                <span>Favorite buy-in</span>
                <strong>{countryCost} tickets</strong>
              </div>
              <button
                type="button"
                disabled={!canBuySelected}
                onClick={() => chooseFavorite(selectedCountry.id)}
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

      {stage === "EventHorizon" ? (
        <Panel>
          <p style={copyStyle}>Your favorite is locked. Roll event modifiers for every in-scope country, then wars erupt along valid borders.</p>
          <button type="button" onClick={rollCampaignEvents} style={primaryButtonStyle}>Roll Events</button>
        </Panel>
      ) : null}

      {stage === "WarSelection" ? (
        <Panel>
          {activeWars.length === 0 ? (
            <p style={copyStyle}>No wars erupted in this scope. Start another campaign or choose a broader scale.</p>
          ) : (
            <div style={{ display: "grid", gap: 8 }}>
              <p style={copyStyle}>Review each planned war. Open a war to place its own bet, then roll it manually or skip to the result.</p>
              {activeWars.map(war => (
                <button key={war.id} type="button" onClick={() => selectWar(war.id)} style={warButtonStyle}>
                  <strong>{countries[war.attackerId]?.flag} {countries[war.attackerId]?.name}</strong>
                  <span>vs</span>
                  <strong>{countries[war.defenderId]?.flag} {countries[war.defenderId]?.name}</strong>
                </button>
              ))}
              {completedWarResults.length > 0 ? (
                <div style={{ color: "#94a3b8", fontSize: 13 }}>
                  Completed this phase: {completedWarResults.length}
                </div>
              ) : null}
              <button type="button" onClick={skipAllWars} style={dangerButtonStyle}>
                Skip All Wars
              </button>
            </div>
          )}
        </Panel>
      ) : null}

      {(stage === "Betting" || stage === "Combat") && selectedWar ? (
        <Panel>
            <div style={{ display: "grid", gap: 10 }}>
              <WheelCanvas size={160} />
              <DiceFace value={latestTurn?.roll ?? null} large />
              {selectedWarCountries.map(country => (
                <button
                  key={country.id}
                  type="button"
                  disabled={stage === "Combat"}
                  onClick={() => placeWarBet(country.id, Math.min(betAmount, player.tickets))}
                  style={currentBet?.predictedWinnerId === country.id ? selectedCardButtonStyle : stage === "Combat" ? disabledCardButtonStyle : cardButtonStyle}
                >
                  <CountryCard country={country} selected={currentBet?.predictedWinnerId === country.id} />
                </button>
              ))}
              {stage === "Betting" ? (
                <label style={{ color: "#cbd5e1", fontSize: 13 }}>
                  Ticket stake
                  <input
                    type="number"
                    min={1}
                    max={Math.max(1, player.tickets)}
                    value={betAmount}
                    onChange={event => setBetAmount(Number(event.target.value))}
                    style={inputStyle}
                  />
                </label>
              ) : null}
              {stage === "Betting" ? (
                <p style={copyStyle}>Pick a war favorite above. Each war has its own bet.</p>
              ) : (
                <>
                  <div style={combatStatusStyle}>
                    <strong>Rolls in this war</strong>
                    <span>{selectedWarTurns.length}</span>
                  </div>
                  <div style={dicePanelStyle}>
                    <div>
                      <span>Latest Dice</span>
                      <strong>{latestTurn ? signed(latestTurn.roll) : "-"}</strong>
                      <small>{latestTurn ? `${countries[latestTurn.activeCountryId]?.name ?? latestTurn.activeCountryId} acted / ${latestTurn.action}` : "Awaiting player roll"}</small>
                    </div>
                  </div>
                  {latestTurn?.roll === 0 ? <SpecialOutcomeStrip active={latestTurn.action} /> : null}
                  <button type="button" disabled={isResolvingTurn} onClick={rollSelectedWarTurn} style={isResolvingTurn ? disabledButtonStyle : primaryButtonStyle}>
                    {isResolvingTurn ? "Resolving..." : "Roll Dice"}
                  </button>
                  <button type="button" disabled={isResolvingTurn} onClick={skipSelectedWar} style={isResolvingTurn ? disabledButtonStyle : dangerButtonStyle}>
                    Skip War
                  </button>
                  <button type="button" disabled={isResolvingTurn} onClick={skipAllWars} style={isResolvingTurn ? disabledButtonStyle : dangerButtonStyle}>
                    Skip All Wars
                  </button>
                </>
              )}
            </div>
        </Panel>
      ) : null}

      {stage === "CombatResult" ? (
        <Panel>
          <p style={copyStyle}>All wars in this phase are resolved. Last winner: {lastCombatOutcome?.winnerId ? countries[lastCombatOutcome.winnerId]?.name : "Unknown"}.</p>
          <button type="button" onClick={continueAfterWar} style={primaryButtonStyle}>Next Event Horizon</button>
        </Panel>
      ) : null}

      {stage === "GameOver" ? (
        <Panel>
          <p style={copyStyle}>Your campaign favorite failed to become the last country standing.</p>
          <button type="button" onClick={resetCampaign} style={primaryButtonStyle}>New Campaign</button>
        </Panel>
      ) : null}

      {stage === "CampaignWon" ? (
        <Panel>
          <p style={copyStyle}>Your campaign favorite is the last country standing.</p>
          <button type="button" onClick={resetCampaign} style={primaryButtonStyle}>New Campaign</button>
        </Panel>
      ) : null}

      {stage === "WarSelection" || stage === "CombatResult" || stage === "GameOver" ? <RollLog /> : null}
    </aside>
  );
}

function SpecialOutcomeStrip({ active }: { active: string }) {
  const outcomes = [
    { id: "nuke", icon: "☢️", label: "Nuke" },
    { id: "interceptor", icon: "🛡️", label: "Interceptor" },
    { id: "camp", icon: "⛺", label: "Camp" },
    { id: "support", icon: "📣", label: "Support" },
  ];
  return (
    <div style={specialStripStyle}>
      <strong>Zero Special</strong>
      <div style={specialGridStyle}>
        {outcomes.map(outcome => (
          <span key={outcome.id} style={active === outcome.id ? activeSpecialStyle : specialCellStyle}>
            <b>{outcome.icon}</b>
            {outcome.label}
            <small>25%</small>
          </span>
        ))}
      </div>
    </div>
  );
}

function CountryCard({ country, selected }: { country: Country; selected: boolean }) {
  const wheel = countryWheelBreakdown(country, country.provinces.length, false);
  return (
    <div style={countryCardStyle}>
      <div style={countryArtStyle}>
        <span style={{ fontSize: 32 }}>{country.flag}</span>
        <strong>{country.id}</strong>
      </div>
      <div style={{ display: "grid", gap: 4 }}>
        <strong style={{ color: selected ? "#fff4d2" : "#f3e7cf" }}>{country.name}</strong>
        <span>{getCountryTier(country)} / {country.government} / {country.religion}</span>
        <span>Power {wheel.total} / Dev {getCountryDevelopmentScore(country)} / Faith {signed(getCountryReligionModifier(country))}</span>
      </div>
    </div>
  );
}

function DiceFace({ value, large = false }: { value: number | null; large?: boolean }) {
  const display = value === null ? "?" : value > 0 ? `+${value}` : String(value);
  return (
    <div key={display} style={large ? largeDiceWrapStyle : diceFaceStyle} className="dice-pop">
      <span>{display}</span>
      <style jsx>{`
        .dice-pop {
          animation: dicePop 520ms cubic-bezier(0.18, 0.9, 0.25, 1.25);
        }
        @keyframes dicePop {
          0% { transform: rotateX(65deg) rotateZ(-20deg) scale(0.72); }
          45% { transform: rotateX(0deg) rotateZ(14deg) scale(1.14); }
          72% { transform: rotateX(0deg) rotateZ(-6deg) scale(1.04); }
          100% { transform: rotate(0deg) scale(1); }
        }
      `}</style>
    </div>
  );
}

function CountryIntel({ country, provinceName, compact = false }: { country: Country | null | undefined; provinceName?: string; compact?: boolean }) {
  if (!country) {
    return <p style={copyStyle}>No country selected.</p>;
  }

  const wheel = countryWheelBreakdown(country, country.provinces.length, false);

  return (
    <div style={{ display: "grid", gap: compact ? 4 : 8 }}>
      <div>
        <div style={{ color: "#f8fafc", fontWeight: 800 }}>{country.flag} {country.name}</div>
        {provinceName ? <div style={{ color: "#8492a6", fontSize: 13 }}>Province: {provinceName}</div> : null}
      </div>
      <div style={detailGridStyle}>
        <span>Tier</span><strong>{getCountryTier(country)}</strong>
        <span>Buy-in</span><strong>{getCountryCost(country)}</strong>
        <span>Government</span><strong>{country.government}</strong>
        <span>Religion</span><strong>{country.religion}</strong>
        <span>Development</span><strong>{getCountryDevelopmentScore(country)}</strong>
        <span>Wheel power</span><strong>{wheel.total}</strong>
      </div>
    </div>
  );
}

function Panel({ children, muted = false }: { children: React.ReactNode; muted?: boolean }) {
  return <section style={{ ...panelStyle, color: muted ? "#94a3b8" : "#cbd5e1" }}>{children}</section>;
}

function signed(value: number) {
  return value > 0 ? `+${value}` : String(value);
}

const sidebarStyle: React.CSSProperties = {
  padding: 18,
  borderLeft: "2px solid rgba(211,166,88,0.55)",
  background:
    "radial-gradient(circle at 80% 0%, rgba(178,119,39,0.2), transparent 28%), linear-gradient(180deg, rgba(28,20,14,0.99), rgba(6,9,15,0.99))",
  display: "flex",
  flexDirection: "column",
  gap: 12,
  height: "100%",
  overflowY: "auto",
  boxShadow: "inset 12px 0 36px rgba(0,0,0,0.42), inset 1px 0 0 rgba(255,226,147,0.14)",
};

const panelStyle: React.CSSProperties = {
  border: "1px solid rgba(211,166,88,0.42)",
  borderRadius: 0,
  padding: 14,
  background:
    "linear-gradient(135deg, rgba(231,188,96,0.08), transparent 34%), linear-gradient(180deg, rgba(28,34,43,0.94), rgba(7,10,16,0.96))",
  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.07), inset 0 0 28px rgba(211,166,88,0.05), 0 12px 28px rgba(0,0,0,0.28)",
  clipPath: "polygon(0 0, calc(100% - 12px) 0, 100% 12px, 100% 100%, 12px 100%, 0 calc(100% - 12px))",
};

const copyStyle: React.CSSProperties = {
  margin: "0 0 12px",
  color: "#a8b3c2",
  fontSize: 14,
  lineHeight: 1.45,
};

const warningStyle: React.CSSProperties = {
  margin: "8px 0 0",
  color: "#fca5a5",
  fontSize: 13,
};

const primaryButtonStyle: React.CSSProperties = {
  border: "1px solid #c49a54",
  borderRadius: 0,
  background: "linear-gradient(180deg, #a97b35, #4d3518)",
  color: "#fff3d0",
  padding: "10px 12px",
  cursor: "pointer",
  fontWeight: 800,
  textShadow: "0 1px 0 #1c1208",
  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.18), 0 3px 0 #26190b, 0 10px 20px rgba(0,0,0,0.24)",
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

const secondaryButtonStyle: React.CSSProperties = {
  ...primaryButtonStyle,
  border: "1px solid rgba(148,163,184,0.58)",
  background: "linear-gradient(180deg, #344050, #171f2b)",
  color: "#e5edf7",
};

const dangerButtonStyle: React.CSSProperties = {
  ...primaryButtonStyle,
  border: "1px solid #b91c1c",
  background: "linear-gradient(180deg, #9c2f23, #57140e)",
};

const selectedButtonStyle: React.CSSProperties = {
  ...primaryButtonStyle,
  background: "linear-gradient(180deg, #2b6f63, #173b36)",
  border: "1px solid #77d1b9",
  display: "grid",
  gap: 4,
  textAlign: "left",
};

const cardButtonStyle: React.CSSProperties = {
  border: "1px solid rgba(184,139,74,0.3)",
  borderRadius: 0,
  padding: 0,
  background: "linear-gradient(180deg, rgba(32,38,47,0.94), rgba(12,14,19,0.98))",
  color: "#d7c8a5",
  cursor: "pointer",
  textAlign: "left",
  overflow: "hidden",
  boxShadow: "0 5px 0 rgba(0,0,0,0.28), inset 0 0 24px rgba(255,255,255,0.025)",
};

const selectedCardButtonStyle: React.CSSProperties = {
  ...cardButtonStyle,
  border: "1px solid #e7c06b",
  background: "linear-gradient(180deg, rgba(59,85,69,0.96), rgba(18,40,33,0.98))",
};

const disabledCardButtonStyle: React.CSSProperties = {
  ...cardButtonStyle,
  cursor: "not-allowed",
  opacity: 0.72,
};

const countryCardStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "74px minmax(0, 1fr)",
  gap: 10,
  alignItems: "stretch",
  padding: 8,
};

const countryArtStyle: React.CSSProperties = {
  minHeight: 84,
  border: "1px solid rgba(255,232,170,0.28)",
  borderRadius: 6,
  display: "grid",
  placeItems: "center",
  background:
    "radial-gradient(circle at 50% 25%, rgba(244,204,112,0.28), transparent 42%), linear-gradient(160deg, rgba(25,48,68,0.85), rgba(18,13,20,0.96))",
};

const warButtonStyle: React.CSSProperties = {
  border: "1px solid rgba(184,139,74,0.24)",
  borderRadius: 3,
  background: "linear-gradient(180deg, rgba(30,38,50,0.92), rgba(14,19,29,0.96))",
  color: "#e2e8f0",
  padding: "9px 11px",
  cursor: "pointer",
  display: "grid",
  gap: 4,
  textAlign: "left",
};

const priceRowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  color: "#cbd5e1",
  margin: "12px 0",
};

const detailGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr auto",
  gap: "5px 10px",
  color: "#9ca3af",
  fontSize: 13,
};

const combatStatusStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  color: "#cbd5e1",
  border: "1px solid rgba(184,139,74,0.24)",
  borderRadius: 3,
  padding: "8px 10px",
  background: "linear-gradient(180deg, rgba(23,29,37,0.78), rgba(9,13,19,0.82))",
};

const dicePanelStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr)",
  alignItems: "center",
  gap: "2px 10px",
  border: "1px solid rgba(207,167,95,0.34)",
  borderRadius: 3,
  padding: "10px 12px",
  color: "#d7c8a5",
  background:
    "linear-gradient(180deg, rgba(55,42,25,0.72), rgba(16,16,18,0.9))",
  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06)",
};

const specialStripStyle: React.CSSProperties = {
  display: "grid",
  gap: 8,
  padding: 10,
  border: "1px solid rgba(207,167,95,0.34)",
  background: "linear-gradient(180deg, rgba(42,31,20,0.75), rgba(9,13,19,0.9))",
  color: "#f3e7cf",
};

const specialGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
  gap: 6,
};

const specialCellStyle: React.CSSProperties = {
  display: "grid",
  placeItems: "center",
  gap: 2,
  minHeight: 58,
  padding: 5,
  border: "1px solid rgba(148,163,184,0.22)",
  background: "rgba(10,15,23,0.7)",
  color: "#aeb8c7",
  fontSize: 11,
};

const activeSpecialStyle: React.CSSProperties = {
  ...specialCellStyle,
  border: "1px solid #f8d37e",
  background: "radial-gradient(circle at 50% 20%, rgba(248,211,126,0.24), rgba(10,15,23,0.82))",
  color: "#fff1c9",
  boxShadow: "0 0 18px rgba(248,211,126,0.18)",
};

const diceFaceStyle: React.CSSProperties = {
  width: 46,
  height: 46,
  borderRadius: 8,
  display: "grid",
  placeItems: "center",
  border: "2px solid #f1d28a",
  background: "linear-gradient(145deg, #f5ead4, #b88438)",
  color: "#2a1606",
  fontWeight: 950,
  boxShadow: "0 4px 0 rgba(0,0,0,0.42)",
};

const largeDiceWrapStyle: React.CSSProperties = {
  width: 118,
  height: 118,
  margin: "4px auto",
  display: "grid",
  placeItems: "center",
  border: "3px solid #f1d28a",
  background:
    "radial-gradient(circle at 35% 25%, #fff8e6, #d59d4a 48%, #6a3d16 100%)",
  color: "#271405",
  fontSize: 42,
  fontWeight: 950,
  boxShadow: "0 8px 0 rgba(0,0,0,0.46), 0 18px 34px rgba(0,0,0,0.36), inset 0 0 22px rgba(255,255,255,0.24)",
  transformStyle: "preserve-3d",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  marginTop: 6,
  border: "1px solid rgba(184,139,74,0.35)",
  borderRadius: 3,
  background: "#080c12",
  color: "#f8fafc",
  padding: "8px 10px",
};

