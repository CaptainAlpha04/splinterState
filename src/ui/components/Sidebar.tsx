"use client";

import { useMemo, useState } from "react";
import type React from "react";
import type { Country } from "../../engine/models/country";
import { countryWheelBreakdown } from "../../engine/mechanics/initiativeWheel";
import {
  getCountryCost,
  getCountrySpecialModifierTotal,
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
  const setCampaignScale = useGameStore(state => state.setCampaignScale);
  const chooseFavorite = useGameStore(state => state.chooseFavorite);
  const rollCampaignEvents = useGameStore(state => state.rollCampaignEvents);
  const selectWar = useGameStore(state => state.selectWar);
  const placeWarBet = useGameStore(state => state.placeWarBet);
  const rollSelectedWarTurn = useGameStore(state => state.rollSelectedWarTurn);
  const skipSelectedWar = useGameStore(state => state.skipSelectedWar);
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
            </div>
          )}
        </Panel>
      ) : null}

      {(stage === "Betting" || stage === "Combat") && selectedWar ? (
        <Panel>
            <div style={{ display: "grid", gap: 10 }}>
              <WheelCanvas size={160} />
              {selectedWarCountries.map(country => (
                <button
                  key={country.id}
                  type="button"
                  disabled={stage === "Combat"}
                  onClick={() => placeWarBet(country.id, Math.min(betAmount, player.tickets))}
                  style={currentBet?.predictedWinnerId === country.id ? selectedButtonStyle : stage === "Combat" ? disabledButtonStyle : warButtonStyle}
                >
                  {country.flag} {country.name}
                  <span>
                    {getCountryTier(country)} · power {countryWheelBreakdown(country, country.provinces.length, false).total} · mods {signed(getCountrySpecialModifierTotal(country) + country.eventModifier)}
                  </span>
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
                    <span>Latest Dice</span>
                    <strong>{latestTurn ? signed(latestTurn.roll) : "-"}</strong>
                    <small>{latestTurn ? `${countries[latestTurn.activeCountryId]?.name ?? latestTurn.activeCountryId} acted` : "Awaiting player roll"}</small>
                  </div>
                  <button type="button" onClick={rollSelectedWarTurn} style={primaryButtonStyle}>
                    Roll Dice
                  </button>
                  <button type="button" onClick={skipSelectedWar} style={dangerButtonStyle}>
                    Skip War
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

      {stage !== "PickScope" && stage !== "Betting" && stage !== "Combat" ? (
        <Panel>
          <CountryIntel country={selectedCountry} provinceName={selectedProvince?.name} compact />
        </Panel>
      ) : null}

      {stage === "WarSelection" || stage === "CombatResult" || stage === "GameOver" ? <RollLog /> : null}
    </aside>
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
        <span>Wheel power</span><strong>{wheel.total}</strong>
        <span>Land power</span><strong>{wheel.provincePower}</strong>
        <span>Modifiers</span><strong>{signed(wheel.government + wheel.special + wheel.event + wheel.armyCamps)}</strong>
        <span>Event modifier</span><strong>{signed(country.eventModifier)}</strong>
        <span>Army camps</span><strong>{country.armyCampsCount}</strong>
        <span>Provinces</span><strong>{country.provinces.length}</strong>
      </div>
      {!compact ? (
        <div style={{ display: "grid", gap: 6 }}>
          {country.specialModifiers.map(modifier => (
            <div key={modifier.label} style={modifierStyle}>
              <strong>{modifier.label} {signed(modifier.value)}</strong>
              <span>{modifier.description}</span>
            </div>
          ))}
        </div>
      ) : null}
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
  padding: 16,
  borderLeft: "1px solid rgba(184,139,74,0.38)",
  background: "linear-gradient(180deg, rgba(22,18,15,0.98), rgba(8,11,17,0.98))",
  display: "flex",
  flexDirection: "column",
  gap: 12,
  height: "100%",
  overflowY: "auto",
  boxShadow: "inset 10px 0 28px rgba(0,0,0,0.28)",
};

const panelStyle: React.CSSProperties = {
  border: "1px solid rgba(184,139,74,0.32)",
  borderRadius: 4,
  padding: 12,
  background: "linear-gradient(180deg, rgba(26,31,38,0.92), rgba(10,14,21,0.94))",
  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05), 0 10px 24px rgba(0,0,0,0.22)",
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
  borderRadius: 3,
  background: "linear-gradient(180deg, #8f6830, #4d3518)",
  color: "#fff3d0",
  padding: "10px 12px",
  cursor: "pointer",
  fontWeight: 800,
  textShadow: "0 1px 0 #1c1208",
  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.18), 0 2px 0 #26190b",
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
};

const selectedButtonStyle: React.CSSProperties = {
  ...primaryButtonStyle,
  background: "linear-gradient(180deg, #2b6f63, #173b36)",
  border: "1px solid #77d1b9",
  display: "grid",
  gap: 4,
  textAlign: "left",
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

const modifierStyle: React.CSSProperties = {
  border: "1px solid rgba(184,139,74,0.22)",
  borderRadius: 3,
  padding: "7px 8px",
  background: "linear-gradient(180deg, rgba(23,29,37,0.78), rgba(9,13,19,0.82))",
  color: "#cbd5e1",
  display: "grid",
  gap: 2,
  fontSize: 12,
  lineHeight: 1.35,
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
  gridTemplateColumns: "1fr auto",
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
