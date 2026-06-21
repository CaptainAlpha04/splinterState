import React from "react";
import type { CampaignScale } from "../../store/types";

const sceneOverlayStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 30,
  display: "grid",
  placeItems: "center",
  background:
    "radial-gradient(circle at 50% 32%, rgba(106,71,28,0.56), rgba(3,6,10,0.9) 62%), repeating-linear-gradient(45deg, rgba(255,255,255,0.025) 0 1px, transparent 1px 9px)",
  backdropFilter: "blur(3px)",
};

const sceneTitleBlockStyle: React.CSSProperties = {
  position: "relative",
  zIndex: 1,
  display: "grid",
  gap: 4,
  marginBottom: 20,
  color: "#f5e6c8",
  textShadow: "0 2px 0 rgba(0,0,0,0.6)",
};

const sceneLeadStyle: React.CSSProperties = {
  maxWidth: 560,
  margin: "4px 0 0",
  color: "#cbbf9d",
  fontSize: 14,
  lineHeight: 1.45,
};

const warRoomBackdropStyle: React.CSSProperties = {
  position: "absolute",
  inset: 0,
  display: "flex",
  justifyContent: "space-around",
  alignItems: "center",
  color: "rgba(255,226,147,0.08)",
  fontSize: 86,
  transform: "rotate(-8deg) scale(1.08)",
  pointerEvents: "none",
};

const walletRibbonStyle: React.CSSProperties = {
  position: "relative",
  zIndex: 1,
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: 14,
  padding: "10px 12px",
  color: "#ffe9b7",
  background: "linear-gradient(90deg, rgba(106,63,20,0.86), rgba(14,20,30,0.86))",
  border: "1px solid rgba(248,211,126,0.38)",
  boxShadow: "inset 0 0 24px rgba(248,211,126,0.08)",
};

const scaleCardStyle: React.CSSProperties = {
  minHeight: 120,
  border: "1px solid rgba(230,190,120,0.5)",
  borderRadius: 0,
  padding: 14,
  display: "grid",
  alignContent: "end",
  gap: 8,
  color: "#f9edce",
  textAlign: "left",
  cursor: "pointer",
  background:
    "linear-gradient(180deg, rgba(84,63,35,0.36), rgba(8,12,18,0.94)), radial-gradient(circle at 50% 20%, rgba(216,153,66,0.3), transparent 45%)",
  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.12), 0 8px 0 rgba(0,0,0,0.32)",
  animation: "commandGlow 3.2s ease-in-out infinite",
};

const scaleIconStyle: React.CSSProperties = {
  fontSize: 34,
  filter: "drop-shadow(0 3px 0 rgba(0,0,0,0.55))",
};

export function StartScene({
  tickets,
  onPickScale,
  isMobile,
}: {
  tickets: number;
  onPickScale: (scale: CampaignScale) => void;
  isMobile: boolean;
}) {
  const scales: Array<{ scale: CampaignScale; title: string; icon: string; copy: string }> = [
    { scale: "Story Mode", title: "Story Mode", icon: "👑", copy: "Progression: Regional ➔ Continental ➔ World Dominance." },
    { scale: "World War", title: "World War", icon: "🌍", copy: "Every surviving country enters the long campaign." },
    { scale: "Continent War", title: "Continent War", icon: "🛡️", copy: "Anchor on one continent and lock the camera there." },
    { scale: "Regional War", title: "Regional War", icon: "🗡️", copy: "A shorter knife fight inside one theater." },
  ];

  const responsiveScenePanelStyle: React.CSSProperties = {
    position: "relative",
    width: "min(760px, calc(100vw - 32px))",
    maxHeight: "90vh",
    overflowY: "auto",
    border: "2.5px solid #cfa24b",
    borderRadius: 8,
    padding: isMobile ? 16 : 24,
    background:
      "linear-gradient(135deg, rgba(207,167,95,0.08), transparent 34%), linear-gradient(180deg, rgba(28,21,14,0.99), rgba(11,14,19,0.99))",
    boxShadow: "0 34px 90px rgba(0,0,0,0.8), inset 0 1px 0 rgba(255,255,255,0.12), inset 0 0 50px rgba(207,167,95,0.08)",
  };

  const responsiveScaleGridStyle: React.CSSProperties = {
    position: "relative",
    zIndex: 1,
    display: "grid",
    gridTemplateColumns: isMobile ? "1fr" : "repeat(4, minmax(0, 1fr))",
    gap: 12,
  };

  return (
    <div style={sceneOverlayStyle}>
      <section style={responsiveScenePanelStyle}>
        <div style={warRoomBackdropStyle}>
          <span>⚔️</span><span>🎲</span><span>☢️</span><span>👑</span>
        </div>
        <div style={sceneTitleBlockStyle}>
          <span style={{ fontSize: isMobile ? 12 : 14, color: "#cfa24b", textTransform: "uppercase", fontWeight: "bold", letterSpacing: 1.5 }}>Splinter States</span>
          <h1 style={{ fontSize: isMobile ? 26 : 36, margin: "4px 0", fontFamily: "'Cinzel', 'Georgia', serif", fontWeight: 900, color: "#fff" }}>Choose Your War</h1>
          <p style={sceneLeadStyle}>Banked tickets carry between campaigns. Pick the scale, then buy an anchor country on the map.</p>
        </div>
        <div style={walletRibbonStyle}>
          <span style={{ fontSize: 13, textTransform: "uppercase", fontWeight: "bold", letterSpacing: 0.5 }}>🎟️ War Treasury</span>
          <strong style={{ fontSize: 18, color: "#fff" }}>{tickets}</strong>
        </div>
        <div style={responsiveScaleGridStyle}>
          {scales.map(item => (
            <button
              key={item.scale}
              type="button"
              onClick={() => onPickScale(item.scale)}
              style={scaleCardStyle}
              className="scale-card-hover"
            >
              <span style={scaleIconStyle}>{item.icon}</span>
              <strong style={{ fontSize: 16, color: "#fff5d6" }}>{item.title}</strong>
              <span style={{ fontSize: 11, opacity: 0.85, lineHeight: 1.35 }}>{item.copy}</span>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
