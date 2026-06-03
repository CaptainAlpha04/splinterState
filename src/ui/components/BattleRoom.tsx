"use client";

import { useState } from "react";
import { useGameStore, getCountryTier } from "../../store/gameStore";
import WheelCanvas from "./WheelCanvas";

export default function BattleRoom() {
  const [betAmount, setBetAmount] = useState(50);
  const stage = useGameStore(state => state.stage);
  const player = useGameStore(state => state.player);
  const countries = useGameStore(state => state.countries);
  const activeWars = useGameStore(state => state.activeWars);
  const selectedWarId = useGameStore(state => state.selectedWarId);
  const currentBet = useGameStore(state => state.currentBet);
  const warTurns = useGameStore(state => state.warTurns);
  const isResolvingTurn = useGameStore(state => state.isResolvingTurn);
  const placeWarBet = useGameStore(state => state.placeWarBet);
  const rollSelectedWarTurn = useGameStore(state => state.rollSelectedWarTurn);
  const skipSelectedWar = useGameStore(state => state.skipSelectedWar);
  const skipAllWars = useGameStore(state => state.skipAllWars);
  const focusCountry = useGameStore(state => state.focusCountry);
  const selectCountry = useGameStore(state => state.selectCountry);
  const selectProvince = useGameStore(state => state.selectProvince);

  const selectedWar = activeWars.find(war => war.id === selectedWarId) ?? null;
  if (!selectedWar) return null;

  const attacker = countries[selectedWar.attackerId];
  const defender = countries[selectedWar.defenderId];
  if (!attacker || !defender) return null;

  const selectedWarTurns = warTurns[selectedWar.id] ?? [];
  const latestTurn = selectedWarTurns[selectedWarTurns.length - 1] ?? null;

  const handlePlaceBet = (countryId: string) => {
    const country = countries[countryId];
    if (country && country.provinces.length > 0) {
      selectCountry(countryId);
      const capProvId = country.capitalProvinceId;
      const firstProvId = country.provinces[0];
      selectProvince(capProvId && country.provinces.includes(capProvId) ? capProvId : firstProvId);
      focusCountry(countryId);
    }
    if (stage === "Betting") {
      placeWarBet(countryId, Math.min(betAmount, player.tickets));
    }
  };

  return (
    <div className="battle-room-card">
      <div className="battle-header">
        <span className="battle-badge">⚔️ TACTICAL ENGAGEMENT</span>
        <h3>{stage === "Betting" ? "Place Your Wager" : "Active Frontline"}</h3>
      </div>

      <div className="battle-combatants">
        {/* Attacker */}
        <button
          type="button"
          onClick={() => handlePlaceBet(attacker.id)}
          className={`combatant-card attacker ${currentBet?.predictedWinnerId === attacker.id ? "selected" : ""}`}
          title={`Zoom and inspect ${attacker.name}`}
        >
          <span className="flag">{attacker.flag}</span>
          <div className="info">
            <span className="name">{attacker.name}</span>
            <span className="meta">{getCountryTier(attacker)} / {attacker.government}</span>
          </div>
        </button>

        {/* VS / Dice */}
        <div className="battle-vs">
          <DiceFace value={latestTurn?.roll ?? null} />
        </div>

        {/* Defender */}
        <button
          type="button"
          onClick={() => handlePlaceBet(defender.id)}
          className={`combatant-card defender ${currentBet?.predictedWinnerId === defender.id ? "selected" : ""}`}
          title={`Zoom and inspect ${defender.name}`}
        >
          <span className="flag">{defender.flag}</span>
          <div className="info">
            <span className="name">{defender.name}</span>
            <span className="meta">{getCountryTier(defender)} / {defender.government}</span>
          </div>
        </button>
      </div>

      <div className="battle-details">
        <WheelCanvas size={150} />
      </div>

      {stage === "Betting" ? (
        <div className="betting-controls">
          <div className="slider-header">
            <span>Ticket Stake</span>
            <strong>🎟️ {betAmount}</strong>
          </div>
          <input
            type="range"
            min={1}
            max={Math.max(1, player.tickets)}
            value={betAmount}
            onChange={e => setBetAmount(Number(e.target.value))}
            className="bet-slider"
          />
          <p className="helper-text">Select your favored side above, set the wager amount, and click their card to place the bet.</p>
        </div>
      ) : (
        <div className="combat-controls">
          <div className="combat-ticker">
            <span>Round Actions: <strong>{selectedWarTurns.length}</strong></span>
            {latestTurn ? (
              <span className="action-text">
                <strong>{countries[latestTurn.activeCountryId]?.name}</strong>: {latestTurn.action}
              </span>
            ) : (
              <span>Waiting for initial roll...</span>
            )}
          </div>

          {latestTurn?.roll === 0 ? (
            <SpecialOutcomeStrip active={latestTurn.action} weights={latestTurn.directiveWeights} />
          ) : null}

          <div className="actions-row">
            <button
              type="button"
              disabled={isResolvingTurn}
              onClick={rollSelectedWarTurn}
              className="action-btn primary"
            >
              {isResolvingTurn ? "⚔️ Rolling..." : "⚔️ Roll Battle Dice"}
            </button>
            <button
              type="button"
              disabled={isResolvingTurn}
              onClick={skipSelectedWar}
              className="action-btn secondary"
            >
              Skip War
            </button>
            <button
              type="button"
              disabled={isResolvingTurn}
              onClick={skipAllWars}
              className="action-btn danger"
            >
              Skip All
            </button>
          </div>
        </div>
      )}

      <style jsx>{`
        .battle-room-card {
          border: 2px solid rgba(210, 165, 82, 0.55);
          padding: 16px;
          background: linear-gradient(180deg, rgba(28, 22, 16, 0.98), rgba(12, 15, 20, 0.98));
          box-shadow: 0 16px 40px rgba(0,0,0,0.65), inset 0 0 32px rgba(210, 165, 82, 0.08);
          backdrop-filter: blur(10px);
          display: grid;
          gap: 14px;
          border-radius: 8px;
        }
        .battle-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-bottom: 1px solid rgba(193, 150, 84, 0.24);
          padding-bottom: 8px;
        }
        .battle-header h3 {
          margin: 0;
          color: #f3e7cf;
          font-size: 16px;
          text-transform: uppercase;
          letter-spacing: 1px;
        }
        .battle-badge {
          color: #cfa24b;
          font-size: 11px;
          font-weight: 800;
        }
        .battle-combatants {
          display: grid;
          grid-template-columns: 1fr auto 1fr;
          gap: 12px;
          align-items: center;
        }
        .combatant-card {
          border: 1px solid rgba(184, 139, 74, 0.35);
          background: rgba(10, 15, 23, 0.5);
          padding: 8px 12px;
          display: flex;
          align-items: center;
          gap: 10px;
          cursor: pointer;
          transition: all 180ms ease;
          text-align: left;
          border-radius: 4px;
        }
        .combatant-card:hover:not(:disabled) {
          border-color: #cfa24b;
          background: rgba(193, 150, 84, 0.08);
        }
        .combatant-card.selected {
          border-color: #f8d37e;
          background: linear-gradient(180deg, rgba(85,58,24,0.36), rgba(18,40,33,0.38));
          box-shadow: 0 0 12px rgba(248, 211, 126, 0.15);
          border-radius: 4px;
        }
        .combatant-card:disabled {
          cursor: default;
        }
        .combatant-card .flag {
          font-size: 28px;
        }
        .combatant-card .info {
          display: grid;
          gap: 1px;
          min-width: 0;
        }
        .combatant-card .name {
          font-weight: 800;
          color: #fff;
          font-size: 14px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .combatant-card .meta {
          font-size: 11px;
          color: #94a3b8;
        }
        .battle-vs {
          display: flex;
          justify-content: center;
        }
        .betting-controls {
          display: grid;
          gap: 8px;
          background: rgba(0, 0, 0, 0.25);
          padding: 10px;
          border: 1px solid rgba(193, 150, 84, 0.12);
          border-radius: 4px;
        }
        .slider-header {
          display: flex;
          justify-content: space-between;
          font-size: 13px;
          color: #cbd5e1;
        }
        .bet-slider {
          width: 100%;
          cursor: pointer;
          accent-color: #cfa24b;
        }
        .helper-text {
          margin: 0;
          font-size: 11px;
          color: #8492a6;
          line-height: 1.35;
        }
        .combat-controls {
          display: grid;
          gap: 10px;
        }
        .combat-ticker {
          display: flex;
          justify-content: space-between;
          font-size: 12px;
          color: #b9c2d0;
          background: rgba(0, 0, 0, 0.35);
          padding: 6px 10px;
          border-radius: 4px;
          align-items: center;
        }
        .action-text {
          color: #f8d37e;
          text-align: right;
          max-width: 60%;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .actions-row {
          display: grid;
          grid-template-columns: 1.5fr 1fr 1fr;
          gap: 8px;
        }
        .action-btn {
          border: 1px solid rgba(193, 150, 84, 0.35);
          color: #fff;
          padding: 10px;
          font-weight: 800;
          cursor: pointer;
          font-size: 13px;
          transition: all 150ms ease;
          border-radius: 4px;
        }
        .action-btn.primary {
          border-color: #cfa24b;
          background: linear-gradient(180deg, #9d6f30, #583912);
          color: #fff1cf;
        }
        .action-btn.primary:hover:not(:disabled) {
          background: linear-gradient(180deg, #b38038, #694418);
        }
        .action-btn.secondary {
          background: linear-gradient(180deg, #334155, #1e293b);
          border-color: rgba(148,163,184,0.3);
        }
        .action-btn.secondary:hover:not(:disabled) {
          background: linear-gradient(180deg, #475569, #334155);
        }
        .action-btn.danger {
          background: linear-gradient(180deg, #9c2f23, #57140e);
          border-color: #b91c1c;
        }
        .action-btn.danger:hover:not(:disabled) {
          background: linear-gradient(180deg, #b5382b, #691811);
        }
        .action-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        @media (max-width: 767px) {
          .battle-combatants {
            grid-template-columns: 1fr;
            gap: 8px;
          }
          .battle-vs {
            order: -1;
            margin-bottom: 4px;
          }
          .actions-row {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}

function DiceFace({ value }: { value: number | null }) {
  const display = value === null ? "?" : value > 0 ? `+${value}` : String(value);
  return (
    <div key={display} className="dice-pop dice-face">
      <span>{display}</span>
      <style jsx>{`
        .dice-face {
          width: 52px;
          height: 52px;
          border-radius: 8px;
          display: grid;
          place-items: center;
          border: 2px solid #f1d28a;
          background: radial-gradient(circle at 30% 30%, #fff6e0, #d59d4a 60%, #5c350d 100%);
          color: #271405;
          font-size: 20px;
          font-weight: 950;
          box-shadow: 0 4px 10px rgba(0,0,0,0.5), inset 0 0 8px rgba(255,255,255,0.2);
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

function SpecialOutcomeStrip({ active, weights }: { active: string; weights?: Record<"camp" | "interceptor" | "support" | "nuke", number> }) {
  const outcomes = [
    { id: "camp", icon: "🪖", label: "Camp", detail: "Permanent +25 initiative. If annexed, victor inherits." },
    { id: "interceptor", icon: "📡", label: "Intercept", detail: "Charges blocks enemy +1 to +8 roll and re-spins wheel." },
    { id: "support", icon: "📣", label: "Support", detail: "Blitz action grants back-to-back secondary action roll." },
    { id: "nuke", icon: "☢️", label: "Nuke", detail: "Burns enemy capital provinces and inflicts -100 initiative." },
  ];
  
  const total = weights ? Math.max(1, weights.camp + weights.interceptor + weights.support + weights.nuke) : 1;
  const percent = (key: keyof typeof weights) => weights ? Math.round((weights[key] / total) * 100) : 25;

  return (
    <div className="special-strip">
      <div className="strip-header">
        <span>⚡ ZERO DIRECTIVE OUTCOME</span>
      </div>
      <div className="special-grid">
        {outcomes.map(outcome => {
          const isActive = active === outcome.id;
          return (
            <div
              key={outcome.id}
              className={`special-cell ${isActive ? "active" : ""}`}
              title={outcome.detail}
            >
              <span className="icon">{outcome.icon}</span>
              <span className="label">{outcome.label}</span>
              <span className="weight">{weights ? `${percent(outcome.id as any)}%` : ""}</span>
            </div>
          );
        })}
      </div>
      <style jsx>{`
        .special-strip {
          background: rgba(0, 0, 0, 0.4);
          border: 1px solid rgba(193, 150, 84, 0.18);
          padding: 8px;
          border-radius: 4px;
          display: grid;
          gap: 6px;
        }
        .strip-header {
          font-size: 10px;
          font-weight: 800;
          color: #cfa24b;
        }
        .special-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 4px;
        }
        .special-cell {
          background: rgba(10, 15, 23, 0.8);
          border: 1px solid rgba(148, 163, 184, 0.15);
          padding: 4px;
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          font-size: 9px;
          border-radius: 3px;
          opacity: 0.6;
          transition: all 180ms ease;
        }
        .special-cell.active {
          border-color: #f8d37e;
          background: radial-gradient(circle at 50% 20%, rgba(248,211,126,0.22), rgba(10,15,23,0.9));
          box-shadow: 0 0 10px rgba(248, 211, 126, 0.15);
          opacity: 1;
        }
        .special-cell .icon {
          font-size: 16px;
          margin-bottom: 2px;
        }
        .special-cell .label {
          color: #d6dfed;
          font-weight: 600;
        }
        .special-cell .weight {
          color: #8492a6;
          font-size: 8px;
        }
      `}</style>
    </div>
  );
}
