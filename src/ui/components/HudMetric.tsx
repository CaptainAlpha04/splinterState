import React from "react";

const hudMetricStyle: React.CSSProperties = {
  minWidth: 0,
  padding: "4px 12px",
  borderRight: "1px solid rgba(193, 150, 84, 0.22)",
  display: "flex",
  flexDirection: "column",
  justifyContent: "center",
  alignItems: "flex-start",
  background: "linear-gradient(90deg, rgba(255,226,147,0.04), rgba(255,255,255,0))",
};

export function HudMetric({ label, value }: { label: string; value: string }) {
  const icons: Record<string, string> = {
    Stage: "⏳",
    Powers: "👑",
    Tickets: "🎟️",
    Scope: "🗺️",
    Favorite: "👑",
    Wars: "⚔️",
  };
  return (
    <div style={hudMetricStyle}>
      <span style={{ fontSize: 10, color: "#bfa36d", textTransform: "uppercase", fontWeight: 700, letterSpacing: 0.5, display: "flex", alignItems: "center", gap: 3 }}>
        {icons[label] ?? "◆"} {label}
      </span>
      <strong style={{ fontSize: 13, color: "#fff5d6", fontWeight: 800 }}>{value}</strong>
    </div>
  );
}
