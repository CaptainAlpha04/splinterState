import React from "react";
import type { Country } from "../../engine/models/country";

export type LeaderboardEntry = {
  country: Country;
  rank: number;
  score: number;
  tier: string;
};

export type PromotionEntry = {
  countryId: string;
  countryName: string;
  formationName: string;
};

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

const endStatsStyle: React.CSSProperties = {
  display: "grid",
  gap: 6,
  marginBottom: 18,
  color: "#d6c8a8",
};

const scoreCardStyle: React.CSSProperties = {
  ...endStatsStyle,
  position: "relative",
  zIndex: 1,
  padding: 16,
  border: "1px solid rgba(230,190,120,0.42)",
  background: "linear-gradient(180deg, rgba(14,20,30,0.82), rgba(5,8,12,0.92))",
  boxShadow: "inset 0 0 34px rgba(230,190,120,0.08)",
};

const endBannerStyle: React.CSSProperties = {
  position: "absolute",
  right: 28,
  top: 24,
  zIndex: 2,
  width: 74,
  height: 74,
  display: "grid",
  placeItems: "center",
  fontSize: 42,
  background: "radial-gradient(circle at 50% 30%, rgba(255,238,180,0.3), rgba(70,42,14,0.72))",
  border: "1px solid rgba(248,211,126,0.45)",
  boxShadow: "0 14px 32px rgba(0,0,0,0.45), inset 0 0 22px rgba(248,211,126,0.12)",
  animation: "medalDrop 420ms ease-out both",
};

const ledgerPanelStyle: React.CSSProperties = {
  minHeight: 140,
  maxHeight: 220,
  overflow: "auto",
  padding: 12,
  border: "1px solid rgba(230,190,120,0.36)",
  background: "linear-gradient(180deg, rgba(17,23,31,0.9), rgba(5,8,12,0.94))",
  boxShadow: "inset 0 0 24px rgba(230,190,120,0.06)",
};

const rankListStyle: React.CSSProperties = {
  display: "grid",
  gap: 7,
  marginTop: 9,
};

const rankRowStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "34px minmax(0, 1fr)",
  gap: "2px 8px",
  alignItems: "center",
  padding: "7px 8px",
  color: "#e8dfc8",
  background: "linear-gradient(90deg, rgba(255,255,255,0.055), rgba(255,255,255,0.015))",
  border: "1px solid rgba(255,255,255,0.07)",
};

const favoriteRankRowStyle: React.CSSProperties = {
  ...rankRowStyle,
  color: "#fff1c8",
  background: "linear-gradient(90deg, rgba(130,88,25,0.72), rgba(25,18,11,0.88))",
  border: "1px solid rgba(248,211,126,0.42)",
};

const victoryBurstStyle: React.CSSProperties = {
  position: "absolute",
  inset: -2,
  pointerEvents: "none",
  background:
    "radial-gradient(circle at 20% 20%, rgba(255,226,147,0.28), transparent 18%), radial-gradient(circle at 80% 28%, rgba(120,220,150,0.22), transparent 20%), radial-gradient(circle at 52% 0%, rgba(255,255,255,0.22), transparent 16%)",
};

const restartButtonStyle: React.CSSProperties = {
  border: "1px solid #d6ad63",
  borderRadius: 5,
  padding: "12px 18px",
  background: "linear-gradient(180deg, #9d6f30, #583912)",
  color: "#fff1cf",
  fontWeight: 900,
  cursor: "pointer",
};

export function EndScene({
  won,
  favoriteId,
  favoriteName,
  favoriteRank,
  leaderboard,
  promotions,
  tickets,
  wars,
  onRestart,
  isMobile,
  isStoryMode = false,
  onContinueWithNewFavorite,
}: {
  won: boolean;
  favoriteId: string | null;
  favoriteName: string;
  favoriteRank: number | null;
  leaderboard: LeaderboardEntry[];
  promotions: PromotionEntry[];
  tickets: number;
  wars: number;
  onRestart: () => void;
  isMobile: boolean;
  isStoryMode?: boolean;
  onContinueWithNewFavorite?: () => void;
}) {
  const winner = leaderboard[0];

  const responsiveScenePanelStyle: React.CSSProperties = {
    position: "relative",
    width: "min(760px, calc(100vw - 32px))",
    maxHeight: "90vh",
    overflowY: "auto",
    border: "3px double",
    borderRadius: 12,
    padding: isMobile ? 16 : 24,
    borderColor: won ? "#78dc96" : "#dc5a46",
    background: won
      ? "linear-gradient(135deg, rgba(120,220,150,0.1), transparent 32%), linear-gradient(180deg, rgba(24,38,28,0.99), rgba(8,12,16,0.99))"
      : "linear-gradient(135deg, rgba(220,90,70,0.1), transparent 32%), linear-gradient(180deg, rgba(38,24,22,0.99), rgba(8,12,16,0.99))",
    boxShadow: won
      ? "0 34px 90px rgba(0,0,0,0.8), inset 0 1px 0 rgba(255,255,255,0.14), inset 0 0 50px rgba(120,220,150,0.08)"
      : "0 34px 90px rgba(0,0,0,0.8), inset 0 1px 0 rgba(255,255,255,0.12), inset 0 0 50px rgba(220,90,70,0.08)",
  };

  const responsiveLedgerGridStyle: React.CSSProperties = {
    position: "relative",
    zIndex: 1,
    display: "grid",
    gridTemplateColumns: isMobile ? "1fr" : "1.2fr 0.8fr",
    gap: 12,
    margin: "12px 0 16px",
  };

  const responsiveScoreGridStyle: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: isMobile ? "1fr" : "repeat(3, minmax(0, 1fr))",
    gap: 10,
  };

  const endRestartButtonStyle: React.CSSProperties = {
    ...restartButtonStyle,
    background: won
      ? "linear-gradient(180deg, #3d7d4f, #1e4d2b)"
      : "linear-gradient(180deg, #9c2f23, #57140e)",
    borderColor: won ? "#78dc96" : "#dc5a46",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.18), 0 3px 0 rgba(0,0,0,0.4)",
    borderRadius: 4,
    width: "100%",
    padding: "14px 20px",
    fontSize: 16,
    textTransform: "uppercase",
    letterSpacing: 1,
  };

  return (
    <div style={sceneOverlayStyle}>
      <section style={responsiveScenePanelStyle}>
        {won ? <div style={victoryBurstStyle} /> : null}
        <div style={endBannerStyle}>
          {won ? "🏆" : "💀"}
        </div>
        <div style={sceneTitleBlockStyle}>
          <span style={{ fontSize: isMobile ? 12 : 14, color: won ? "#78dc96" : "#dc5a46", textTransform: "uppercase", fontWeight: "bold", letterSpacing: 1.5 }}>
            {won ? "Campaign Victory" : "Campaign Lost"}
          </span>
          <h1 style={{ fontSize: isMobile ? 26 : 36, margin: "4px 0", fontFamily: "'Cinzel', 'Georgia', serif", fontWeight: 900, color: "#fff" }}>
            {won ? "Podium Champion" : "Your Favorite Fell"}
          </h1>
          <p style={sceneLeadStyle}>
            Winner: {winner ? `${winner.country.flag} ${winner.country.name}` : "Unknown"}. Your line: {favoriteName}
            {favoriteRank ? `, rank ${favoriteRank}` : ""}. The treasury has been updated for the next campaign.
          </p>
        </div>
        <div style={scoreCardStyle}>
          <strong style={{ color: "#fff5d6", fontSize: 16 }}>{favoriteName}</strong>
          <div style={responsiveScoreGridStyle}>
            <span style={{ display: "flex", flexDirection: "column" }}><small style={{ color: "#a8b3c2", fontSize: 10 }}>Final Wallet</small><b style={{ fontSize: 18, color: "#fff" }}>{tickets}</b></span>
            <span style={{ display: "flex", flexDirection: "column" }}><small style={{ color: "#a8b3c2", fontSize: 10 }}>Wars Resolved</small><b style={{ fontSize: 18, color: "#fff" }}>{wars}</b></span>
            <span style={{ display: "flex", flexDirection: "column" }}><small style={{ color: "#a8b3c2", fontSize: 10 }}>Your Rank</small><b style={{ fontSize: 18, color: won ? "#78dc96" : "#dc5a46" }}>{favoriteRank ? `#${favoriteRank}` : "Unranked"}</b></span>
          </div>
        </div>
        <div style={responsiveLedgerGridStyle}>
          <section style={ledgerPanelStyle}>
            <strong style={{ color: "#cfa24b", borderBottom: "1px solid rgba(193,150,84,0.2)", display: "block", paddingBottom: 4 }}>Final Ranking</strong>
            <div style={rankListStyle}>
              {leaderboard.slice(0, 8).map(entry => (
                <div key={entry.country.id} style={entry.country.id === favoriteId ? favoriteRankRowStyle : rankRowStyle}>
                  <b>#{entry.rank}</b>
                  <span>{entry.country.flag} {entry.country.name}</span>
                  <small style={{ color: "#8492a6", fontSize: 11 }}>{entry.tier} / {entry.country.provinces.length} provinces / score {entry.score}</small>
                </div>
              ))}
            </div>
          </section>
          <section style={ledgerPanelStyle}>
            <strong style={{ color: "#cfa24b", borderBottom: "1px solid rgba(193,150,84,0.2)", display: "block", paddingBottom: 4 }}>Promotions</strong>
            <div style={rankListStyle}>
              {promotions.length > 0 ? promotions.map(item => (
                <div key={`${item.countryId}-${item.formationName}`} style={rankRowStyle}>
                  <b>⬆</b>
                  <span>{item.countryName}</span>
                  <small style={{ color: "#8492a6", fontSize: 11 }}>formed {item.formationName}</small>
                </div>
              )) : <p style={{ ...sceneLeadStyle, fontSize: 12 }}>No major promotions recorded.</p>}
            </div>
          </section>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: isStoryMode && !won ? "1fr 1fr" : "1fr", gap: 12 }}>
          {isStoryMode && !won && onContinueWithNewFavorite ? (
            <button
              type="button"
              onClick={onContinueWithNewFavorite}
              style={{
                ...endRestartButtonStyle,
                background: "linear-gradient(180deg, #9d6f30, #583912)",
                borderColor: "#d6ad63",
                color: "#fff1cf",
              }}
            >
              Continue with New Favorite
            </button>
          ) : null}
          <button type="button" onClick={onRestart} style={endRestartButtonStyle}>
            New Campaign
          </button>
        </div>
      </section>
    </div>
  );
}
