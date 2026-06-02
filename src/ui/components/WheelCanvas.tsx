"use client";

import { useEffect, useMemo, useRef } from "react";
import { countryWheelBreakdown } from "../../engine/mechanics/initiativeWheel";
import { useGameStore } from "../../store/gameStore";

type WheelCanvasProps = {
  size: number;
};

export default function WheelCanvas({ size }: WheelCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
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

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const center = size / 2;
    const radius = center - 8;
    ctx.clearRect(0, 0, size, size);

    const gradient = ctx.createRadialGradient(center, center, 12, center, center, center);
    gradient.addColorStop(0, "#182235");
    gradient.addColorStop(1, "#07111c");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);

    const slices = [wheelState.attackerPortion, wheelState.defenderPortion];
    const colors = ["#496f9f", "#9f4535"];
    let start = -Math.PI / 2;

    slices.forEach((portion, index) => {
      const angle = portion * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(center, center);
      ctx.arc(center, center, radius, start, start + angle);
      ctx.closePath();
      ctx.fillStyle = colors[index];
      ctx.fill();
      start += angle;
    });

    ctx.strokeStyle = "#c9b37a";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(center, center, radius, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = "#070b10";
    ctx.beginPath();
    ctx.arc(center, center, radius * 0.34, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(220,194,128,0.62)";
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = "#f3e7cf";
    ctx.font = "700 13px ui-sans-serif, system-ui";
    ctx.textAlign = "center";
    ctx.fillText(`${Math.round(wheelState.attackerPortion * 100)}%`, center, center - 3);
    ctx.fillStyle = "#b7a983";
    ctx.font = "12px ui-sans-serif, system-ui";
    ctx.fillText(`${Math.round(wheelState.defenderPortion * 100)}%`, center, center + 14);
  }, [size, wheelState]);

  return (
    <div>
      <canvas
        ref={canvasRef}
        width={size}
        height={size}
        style={{ width: size, height: size, borderRadius: "50%" }}
      />
      <div style={{ marginTop: 10, color: "#cbd5e1", fontSize: 13, lineHeight: 1.45 }}>
        <div style={{ color: "#f3e7cf", fontWeight: 800 }}>{wheelState.label}</div>
        <div>
          <span style={{ color: "#9bc2ea" }}>{wheelState.attackerName} power {wheelState.attackerPower}</span>
          {" / "}
          <span style={{ color: "#eaa094" }}>{wheelState.defenderName} power {wheelState.defenderPower}</span>
        </div>
      </div>
    </div>
  );
}
