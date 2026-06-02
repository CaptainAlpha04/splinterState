"use client";

import { useEffect, useState } from "react";
import type React from "react";
import MapSvg from "../../ui/components/MapSvg";
import Sidebar from "../../ui/components/Sidebar";
import { useGameStore } from "../../store/gameStore";
import { loadMapAssets } from "../../lib/data/loadMapAssets";

export default function GamePage() {
  const isLoaded = useGameStore(state => state.isLoaded);
  const initializeGame = useGameStore(state => state.initializeGame);
  const stage = useGameStore(state => state.stage);
  const player = useGameStore(state => state.player);
  const countries = useGameStore(state => state.countries);
  const campaignScope = useGameStore(state => state.campaignScope);
  const activeWars = useGameStore(state => state.activeWars);
  const completedWarResults = useGameStore(state => state.completedWarResults);
  const logs = useGameStore(state => state.logs);
  const [svgMarkup, setSvgMarkup] = useState("");

  useEffect(() => {
    initializeGame();
    loadMapAssets().then(assets => setSvgMarkup(assets.svgMarkup));
  }, [initializeGame]);

  const favorite = player.campaignFavoriteCountryId
    ? countries[player.campaignFavoriteCountryId]
    : null;
  const notifications = logs.slice(-3).reverse();

  return (
    <main style={shellStyle}>
      <div style={statusBarStyle}>
        <div style={brandPlateStyle}>
          <span style={brandKickerStyle}>Splinter States</span>
          <strong>Campaign Command</strong>
        </div>
        <HudMetric label="Stage" value={stageLabel(stage)} />
        <HudMetric label="Tickets" value={player.tickets.toString()} />
        <HudMetric label="Scope" value={campaignScope?.label ?? "Unclaimed"} />
        <HudMetric label="Favorite" value={favorite ? `${favorite.flag} ${favorite.name}` : "None"} />
        <HudMetric label="Wars" value={`${activeWars.length} live / ${completedWarResults.length} done`} />
      </div>
      <section style={mapDeckStyle}>
        <div style={mapFrameStyle}>
          {isLoaded && svgMarkup ? (
            <MapSvg svgMarkup={svgMarkup} />
          ) : (
            <div style={loadingStyle}>Loading simulation...</div>
          )}
          <div style={notificationStackStyle}>
            {notifications.map((log, index) => (
              <div key={`${logs.length}-${index}-${log}`} style={noticeStyle}>
                {log}
              </div>
            ))}
          </div>
        </div>
      </section>
      <Sidebar />
      <style jsx global>{`
        @keyframes splinterNoticeFade {
          0% { opacity: 0; transform: translateY(-6px); }
          10% { opacity: 1; transform: translateY(0); }
          72% { opacity: 1; transform: translateY(0); }
          100% { opacity: 0; transform: translateY(-4px); }
        }
      `}</style>
    </main>
  );
}

function HudMetric({ label, value }: { label: string; value: string }) {
  return (
    <div style={hudMetricStyle}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function stageLabel(stage: string) {
  const labels: Record<string, string> = {
    PickScope: "Choose Scale",
    PickFavorite: "Anchor Pick",
    EventHorizon: "Events",
    WarSelection: "War Room",
    Betting: "Wager",
    Combat: "Combat",
    CombatResult: "Aftermath",
    GameOver: "Game Over",
  };
  return labels[stage] ?? stage;
}

const shellStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) 388px",
  gridTemplateRows: "54px minmax(0, 1fr)",
  height: "100vh",
  background:
    "linear-gradient(180deg, #16120e 0%, #0c1118 38%, #06080d 100%)",
  color: "#e8dfc8",
  overflow: "hidden",
};

const statusBarStyle: React.CSSProperties = {
  gridColumn: "1 / -1",
  display: "grid",
  gridTemplateColumns: "240px repeat(5, minmax(120px, 1fr))",
  alignItems: "stretch",
  borderBottom: "1px solid rgba(193, 150, 84, 0.38)",
  background:
    "linear-gradient(180deg, rgba(50,42,32,0.98), rgba(18,18,20,0.98))",
  boxShadow: "0 8px 22px rgba(0,0,0,0.34)",
};

const brandPlateStyle: React.CSSProperties = {
  padding: "8px 14px",
  borderRight: "1px solid rgba(193, 150, 84, 0.34)",
  display: "grid",
  alignContent: "center",
  color: "#f6ead0",
  textShadow: "0 1px 0 #000",
};

const brandKickerStyle: React.CSSProperties = {
  color: "#bfa36d",
  fontSize: 11,
  fontWeight: 800,
  textTransform: "uppercase",
  letterSpacing: 0,
};

const hudMetricStyle: React.CSSProperties = {
  minWidth: 0,
  padding: "8px 12px",
  borderRight: "1px solid rgba(193, 150, 84, 0.22)",
  display: "grid",
  alignContent: "center",
  gap: 1,
  background:
    "linear-gradient(90deg, rgba(255,255,255,0.035), rgba(255,255,255,0))",
};

const mapDeckStyle: React.CSSProperties = {
  minHeight: 0,
  padding: 12,
  overflow: "hidden",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const mapFrameStyle: React.CSSProperties = {
  width: "min(100%, calc((100vh - 78px) * 1.333))",
  maxWidth: "100%",
  height: "auto",
  maxHeight: "100%",
  aspectRatio: "4 / 3",
  position: "relative",
  border: "1px solid rgba(193, 150, 84, 0.42)",
  borderRadius: 4,
  background: "#04080d",
  boxShadow:
    "inset 0 0 0 1px rgba(255,255,255,0.04), inset 0 0 70px rgba(0,0,0,0.42), 0 18px 44px rgba(0,0,0,0.34)",
};

const loadingStyle: React.CSSProperties = {
  height: "100%",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  color: "#c7b991",
};

const notificationStackStyle: React.CSSProperties = {
  position: "absolute",
  right: 14,
  top: 14,
  width: 320,
  display: "grid",
  gap: 8,
  pointerEvents: "none",
};

const noticeStyle: React.CSSProperties = {
  border: "1px solid rgba(207, 167, 95, 0.42)",
  borderRadius: 3,
  padding: "8px 10px",
  background:
    "linear-gradient(180deg, rgba(32,27,20,0.92), rgba(9,13,18,0.9))",
  color: "#f2e7cb",
  fontSize: 13,
  lineHeight: 1.35,
  boxShadow: "0 8px 20px rgba(0,0,0,0.34)",
  animation: "splinterNoticeFade 7s ease forwards",
};
