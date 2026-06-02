"use client";

import { useMemo } from "react";
import { countryWheelBreakdown } from "../../engine/mechanics/initiativeWheel";
import { useGameStore } from "../../store/gameStore";

type WheelCanvasProps = {
  size: number;
};

export default function WheelCanvas({ size }: WheelCanvasProps) {
  const countries = useGameStore(state => state.countries);
  const activeWars = useGameStore(state => state.activeWars);
  const selectedWarId = useGameStore(state => state.selectedWarId);

  const wheelState = useMemo(() => {
    const war = activeWars.find(candidate => candidate.id === selectedWarId) ?? activeWars[0];
    const attacker = war ? countries[war.attackerId] : null;
    const defender = war ? countries[war.defenderId] : null;

    if (!war || !attacker || !defender) {
      return {
        label: "No active war",
        attackerName: "Standing by",
        defenderName: "Awaiting match",
        attackerPower: 1,
        defenderPower: 1,
        attackerPortion: 0.5,
        defenderPortion: 0.5,
      };
    }

    const attackerBreakdown = countryWheelBreakdown(
      attacker,
      attacker.provinces.length,
      attacker.provinces.includes(defender.capitalProvinceId)
    );
    const defenderBreakdown = countryWheelBreakdown(
      defender,
      defender.provinces.length,
      defender.provinces.includes(attacker.capitalProvinceId)
    );
    const total = Math.max(1, attackerBreakdown.total + defenderBreakdown.total);

    return {
      label: `${attacker.name} vs ${defender.name}`,
      attackerName: attacker.name,
      defenderName: defender.name,
      attackerPower: attackerBreakdown.total,
      defenderPower: defenderBreakdown.total,
      attackerPortion: attackerBreakdown.total / total,
      defenderPortion: defenderBreakdown.total / total,
    };
  }, [activeWars, countries, selectedWarId]);

  return (
    <div style={{ minHeight: Math.max(96, size * 0.56) }} className="probability-card">
      <div className="probability-title">{wheelState.label}</div>
      <div className="probability-row">
        <strong>{Math.round(wheelState.attackerPortion * 100)}%</strong>
        <span>initiative chance</span>
        <strong>{Math.round(wheelState.defenderPortion * 100)}%</strong>
      </div>
      <div className="probability-track" aria-label="Initiative probability split">
        <div className="probability-attacker" style={{ width: `${wheelState.attackerPortion * 100}%` }} />
        <div className="probability-defender" style={{ width: `${wheelState.defenderPortion * 100}%` }} />
      </div>
      <div className="probability-names">
        <span>{wheelState.attackerName}<b>{wheelState.attackerPower}</b></span>
        <span>{wheelState.defenderName}<b>{wheelState.defenderPower}</b></span>
      </div>
      <style jsx>{`
        .probability-card {
          border: 1px solid rgba(214,173,99,0.42);
          padding: 12px;
          background:
            linear-gradient(135deg, rgba(214,173,99,0.11), transparent 38%),
            linear-gradient(180deg, rgba(18,27,39,0.94), rgba(7,10,16,0.98));
          box-shadow: inset 0 0 28px rgba(214,173,99,0.06), 0 12px 22px rgba(0,0,0,0.24);
          clip-path: polygon(0 0, calc(100% - 12px) 0, 100% 12px, 100% 100%, 12px 100%, 0 calc(100% - 12px));
        }
        .probability-title {
          color: #fff0c8;
          font-weight: 900;
          margin-bottom: 10px;
        }
        .probability-row,
        .probability-names {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 10px;
          color: #9fb0c6;
          font-size: 12px;
        }
        .probability-row strong {
          color: #f8d37e;
          font-size: 22px;
        }
        .probability-track {
          display: flex;
          height: 18px;
          margin: 8px 0;
          overflow: hidden;
          border: 1px solid rgba(248,211,126,0.38);
          background: #070b10;
          box-shadow: inset 0 0 14px rgba(0,0,0,0.7);
        }
        .probability-attacker,
        .probability-defender {
          transition: width 360ms ease;
        }
        .probability-attacker {
          background: linear-gradient(90deg, #2f6fa4, #6eb6ff);
        }
        .probability-defender {
          background: linear-gradient(90deg, #c05a45, #8f2e2b);
        }
        .probability-names span {
          min-width: 0;
          color: #d6dfed;
        }
        .probability-names b {
          margin-left: 6px;
          color: #f8d37e;
        }
      `}</style>
    </div>
  );
}
