"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type React from "react";
import type { Country } from "../../engine/models/country";
import MapSvg from "../../ui/components/MapSvg";
import Sidebar from "../../ui/components/Sidebar";
import { getCountryDevelopmentScore, getCountryTier, type CampaignScale, useGameStore } from "../../store/gameStore";
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
  const countryPlacements = useGameStore(state => state.countryPlacements);
  const logs = useGameStore(state => state.logs);
  const setCampaignScale = useGameStore(state => state.setCampaignScale);
  const resetCampaign = useGameStore(state => state.resetCampaign);
  const isResolvingTurn = useGameStore(state => state.isResolvingTurn);
  const isAutoPlaying = useGameStore(state => state.isAutoPlaying);
  const autoSpeed = useGameStore(state => state.autoSpeed);
  const toggleAutoPlay = useGameStore(state => state.toggleAutoPlay);
  const setAutoSpeed = useGameStore(state => state.setAutoSpeed);
  const rollSelectedWarTurn = useGameStore(state => state.rollSelectedWarTurn);
  const autoResolveSelectedWarChunk = useGameStore(state => state.autoResolveSelectedWarChunk);
  const [svgMarkup, setSvgMarkup] = useState("");

  useEffect(() => {
    initializeGame();
    loadMapAssets().then(assets => setSvgMarkup(assets.svgMarkup));
  }, [initializeGame]);

  useGameAudio(stage, logs);

  useEffect(() => {
    if (!isAutoPlaying || stage !== "Combat" || isResolvingTurn || activeWars.length === 0) return;
    const delay = autoSpeed <= 1 ? 1700 : autoSpeed >= 4 ? 1200 : 1400;
    const timer = window.setTimeout(() => {
      if (autoSpeed <= 1) rollSelectedWarTurn();
      else autoResolveSelectedWarChunk();
    }, delay);
    return () => window.clearTimeout(timer);
  }, [activeWars.length, autoResolveSelectedWarChunk, autoSpeed, isAutoPlaying, isResolvingTurn, rollSelectedWarTurn, stage]);

  const favorite = player.campaignFavoriteCountryId
    ? countries[player.campaignFavoriteCountryId]
    : null;
  const notifications = logs.slice(-3).reverse();
  const leaderboard = useMemo(
    () => buildLeaderboard(countries, countryPlacements, campaignScope?.eligibleCountryIds ?? null),
    [campaignScope?.eligibleCountryIds, countries, countryPlacements]
  );
  const frontRunner = leaderboard[0] ?? null;
  const favoriteRank = favorite ? leaderboard.find(entry => entry.country.id === favorite.id)?.rank ?? countryPlacements[favorite.id] ?? null : null;
  const promotions = useMemo(
    () => completedWarResults
      .filter(result => result.formationName && result.winnerId)
      .map(result => ({
        countryId: result.winnerId as string,
        countryName: countries[result.winnerId as string]?.name ?? result.winnerId,
        formationName: result.formationName as string,
      }))
      .slice(-8)
      .reverse(),
    [completedWarResults, countries]
  );

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
          <div style={autoControlStyle}>
            <button type="button" onClick={toggleAutoPlay} style={autoButtonStyle} title={isAutoPlaying ? "Pause auto rolls" : "Play auto rolls"}>
              {isAutoPlaying ? "⏸" : "▶"}
            </button>
            {[1, 2, 4].map(speed => (
              <button
                key={speed}
                type="button"
                onClick={() => setAutoSpeed(speed)}
                style={speed === autoSpeed ? activeSpeedButtonStyle : speedButtonStyle}
                title={`${speed}x auto speed`}
              >
                {speed}x
              </button>
            ))}
          </div>
          {frontRunner ? <FrontRunnerPanel entry={frontRunner} /> : null}
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
      {stage === "PickScope" ? <StartScene tickets={player.tickets} onPickScale={setCampaignScale} /> : null}
      {stage === "CampaignWon" || stage === "GameOver" ? (
        <EndScene
          won={stage === "CampaignWon"}
          favoriteId={favorite?.id ?? null}
          favoriteName={favorite ? `${favorite.flag} ${favorite.name}` : "your favorite"}
          favoriteRank={favoriteRank}
          leaderboard={leaderboard}
          promotions={promotions}
          tickets={player.tickets}
          wars={completedWarResults.length}
          onRestart={resetCampaign}
        />
      ) : null}
      <style jsx global>{`
        @keyframes splinterNoticeFade {
          0% { opacity: 0; transform: translateY(-6px); }
          10% { opacity: 1; transform: translateY(0); }
          72% { opacity: 1; transform: translateY(0); }
          100% { opacity: 0; transform: translateY(-4px); }
        }
        @keyframes commandGlow {
          0%, 100% { filter: drop-shadow(0 0 0 rgba(248,211,126,0)); }
          50% { filter: drop-shadow(0 0 14px rgba(248,211,126,0.42)); }
        }
        @keyframes medalDrop {
          0% { opacity: 0; transform: translateY(-12px) scale(0.82); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </main>
  );
}

function useGameAudio(stage: string, logs: string[]) {
  const unlockedRef = useRef(false);
  const musicRef = useRef<HTMLAudioElement | null>(null);
  const previousStageRef = useRef(stage);
  const previousLogCountRef = useRef(logs.length);

  const play = (file: string, volume = 0.55) => {
    if (!unlockedRef.current) return;
    const audio = new Audio(`/sounds/${file}.mp3`);
    audio.volume = volume;
    void audio.play().catch(() => undefined);
  };

  useEffect(() => {
    const unlock = () => {
      unlockedRef.current = true;
      if (!musicRef.current) {
        const music = new Audio("/sounds/music_campaign_loop.mp3");
        music.loop = true;
        music.volume = 0.22;
        musicRef.current = music;
      }
      if (stage !== "PickScope") {
        void musicRef.current.play().catch(() => undefined);
      }
      window.removeEventListener("pointerdown", unlock);
    };
    window.addEventListener("pointerdown", unlock, { once: true });
    return () => window.removeEventListener("pointerdown", unlock);
  }, [stage]);

  useEffect(() => {
    if (!unlockedRef.current || !musicRef.current) return;
    if (stage === "PickScope" || stage === "CampaignWon" || stage === "GameOver") {
      musicRef.current.pause();
    } else {
      void musicRef.current.play().catch(() => undefined);
    }

    if (previousStageRef.current !== stage) {
      if (stage === "CampaignWon") play("victory", 0.75);
      if (stage === "GameOver") play("defeat", 0.72);
      if (stage === "Betting" || stage === "WarSelection") play("ui_card_select", 0.45);
      previousStageRef.current = stage;
    }
  }, [stage]);

  useEffect(() => {
    if (logs.length <= previousLogCountRef.current) return;
    const latest = logs[logs.length - 1] ?? "";
    previousLogCountRef.current = logs.length;
    if (/nuke/i.test(latest)) play("nuke_launch", 0.72);
    else if (/captured|counter operations/i.test(latest)) play("province_capture", 0.58);
    else if (/rolled|dice/i.test(latest)) play("dice_roll", 0.58);
    else if (/broke away|Civil war/i.test(latest)) play("rebellion", 0.62);
    else if (/War erupted|placed|selected/i.test(latest)) play("ui_card_select", 0.45);
  }, [logs]);
}

function StartScene({ tickets, onPickScale }: { tickets: number; onPickScale: (scale: CampaignScale) => void }) {
  const scales: Array<{ scale: CampaignScale; title: string; icon: string; copy: string }> = [
    { scale: "World War", title: "World War", icon: "🌍", copy: "Every surviving country enters the long campaign." },
    { scale: "Continent War", title: "Continent War", icon: "🛡️", copy: "Anchor on one continent and lock the camera there." },
    { scale: "Regional War", title: "Regional War", icon: "🗡️", copy: "A shorter knife fight inside one theater." },
  ];

  return (
    <div style={sceneOverlayStyle}>
      <section style={scenePanelStyle}>
        <div style={warRoomBackdropStyle}>
          <span>⚔️</span><span>🎲</span><span>☢️</span><span>👑</span>
        </div>
        <div style={sceneTitleBlockStyle}>
          <span>Splinter States</span>
          <h1>Choose Your War</h1>
          <p style={sceneLeadStyle}>Banked tickets carry between campaigns. Pick the scale, then buy an anchor country on the map.</p>
        </div>
        <div style={walletRibbonStyle}>
          <span>🎟️ War Treasury</span>
          <strong>{tickets}</strong>
        </div>
        <div style={scaleGridStyle}>
          {scales.map(item => (
            <button key={item.scale} type="button" onClick={() => onPickScale(item.scale)} style={scaleCardStyle}>
              <span style={scaleIconStyle}>{item.icon}</span>
              <strong>{item.title}</strong>
              <span>{item.copy}</span>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

type LeaderboardEntry = {
  country: Country;
  rank: number;
  score: number;
  tier: string;
};

type PromotionEntry = {
  countryId: string;
  countryName: string;
  formationName: string;
};

function EndScene({
  won,
  favoriteId,
  favoriteName,
  favoriteRank,
  leaderboard,
  promotions,
  tickets,
  wars,
  onRestart,
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
}) {
  const winner = leaderboard[0];
  return (
    <div style={sceneOverlayStyle}>
      <section style={{ ...scenePanelStyle, borderColor: won ? "rgba(120, 220, 150, 0.6)" : "rgba(220, 90, 70, 0.62)" }}>
        {won ? <div style={victoryBurstStyle} /> : null}
        <div style={endBannerStyle}>
          {won ? "🏆" : "💀"}
        </div>
        <div style={sceneTitleBlockStyle}>
          <span>{won ? "Campaign Victory" : "Campaign Lost"}</span>
          <h1>{won ? "Placed on the Podium" : "Your Favorite Fell"}</h1>
          <p style={sceneLeadStyle}>
            Winner: {winner ? `${winner.country.flag} ${winner.country.name}` : "Unknown"}. Your line: {favoriteName}
            {favoriteRank ? `, rank ${favoriteRank}` : ""}. The treasury has been updated for the next campaign.
          </p>
        </div>
        <div style={scoreCardStyle}>
          <strong>{favoriteName}</strong>
          <div style={scoreGridStyle}>
            <span><small>Final Wallet</small><b>{tickets}</b></span>
            <span><small>Wars Resolved</small><b>{wars}</b></span>
            <span><small>Your Rank</small><b>{favoriteRank ? `#${favoriteRank}` : "Unranked"}</b></span>
          </div>
        </div>
        <div style={ledgerGridStyle}>
          <section style={ledgerPanelStyle}>
            <strong>Final Ranking</strong>
            <div style={rankListStyle}>
              {leaderboard.slice(0, 8).map(entry => (
                <div key={entry.country.id} style={entry.country.id === favoriteId ? favoriteRankRowStyle : rankRowStyle}>
                  <b>#{entry.rank}</b>
                  <span>{entry.country.flag} {entry.country.name}</span>
                  <small>{entry.tier} / {entry.country.provinces.length} provinces / score {entry.score}</small>
                </div>
              ))}
            </div>
          </section>
          <section style={ledgerPanelStyle}>
            <strong>Promotions</strong>
            <div style={rankListStyle}>
              {promotions.length > 0 ? promotions.map(item => (
                <div key={`${item.countryId}-${item.formationName}`} style={rankRowStyle}>
                  <b>⬆</b>
                  <span>{item.countryName}</span>
                  <small>formed {item.formationName}</small>
                </div>
              )) : <p style={sceneLeadStyle}>No major promotions recorded.</p>}
            </div>
          </section>
        </div>
        <button type="button" onClick={onRestart} style={restartButtonStyle}>
          New Campaign
        </button>
      </section>
    </div>
  );
}

function FrontRunnerPanel({ entry }: { entry: LeaderboardEntry }) {
  const detail = `${entry.country.name}: ${entry.tier}, score ${entry.score}, ${entry.country.provinces.length} provinces, ${entry.country.government}, ${entry.country.religion}.`;
  return (
    <div style={frontRunnerStyle} title={detail}>
      <span>👑 Favorite</span>
      <strong>{entry.country.flag} {entry.country.name}</strong>
      <small>{entry.tier} / {entry.score}</small>
    </div>
  );
}

function buildLeaderboard(
  countries: Record<string, Country>,
  placements: Record<string, number>,
  eligibleCountryIds: string[] | null
): LeaderboardEntry[] {
  const eligible = eligibleCountryIds ? new Set(eligibleCountryIds) : null;
  const entries = Object.values(countries)
    .filter(country => !eligible || eligible.has(country.id))
    .map(country => {
      const isAlive = country.provinces.length > 0;
      const rank = isAlive ? 1 : placements[country.id] ?? 999;
      return {
        country,
        rank,
        score: getCountryDevelopmentScore(country),
        tier: getCountryTier(country),
      };
    });

  return entries.sort((a, b) => {
    if (a.rank !== b.rank) return a.rank - b.rank;
    if (b.score !== a.score) return b.score - a.score;
    return b.country.provinces.length - a.country.provinces.length;
  });
}

function HudMetric({ label, value }: { label: string; value: string }) {
  const icons: Record<string, string> = {
    Stage: "⏳",
    Tickets: "🎟️",
    Scope: "🗺️",
    Favorite: "👑",
    Wars: "⚔️",
  };
  return (
    <div style={hudMetricStyle}>
      <span>{icons[label] ?? "◆"} {label}</span>
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
    CampaignWon: "Victory",
    GameOver: "Game Over",
  };
  return labels[stage] ?? stage;
}

const shellStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) 430px",
  gridTemplateRows: "64px minmax(0, 1fr)",
  height: "100vh",
  background:
    "radial-gradient(circle at 50% -20%, rgba(173,126,49,0.22), transparent 34%), linear-gradient(180deg, #19120b 0%, #0b1119 42%, #03060a 100%)",
  color: "#e8dfc8",
  overflow: "hidden",
};

const statusBarStyle: React.CSSProperties = {
  gridColumn: "1 / -1",
  display: "grid",
  gridTemplateColumns: "240px repeat(5, minmax(120px, 1fr))",
  alignItems: "stretch",
  borderBottom: "2px solid rgba(210, 165, 82, 0.55)",
  background:
    "linear-gradient(180deg, rgba(72,51,28,0.98), rgba(24,21,18,0.98)), repeating-linear-gradient(90deg, rgba(255,255,255,0.04) 0 1px, transparent 1px 12px)",
  boxShadow: "0 10px 30px rgba(0,0,0,0.48), inset 0 -1px 0 rgba(255,234,170,0.18)",
};

const brandPlateStyle: React.CSSProperties = {
  padding: "8px 14px",
  borderRight: "1px solid rgba(193, 150, 84, 0.34)",
  display: "grid",
  alignContent: "center",
  color: "#f6ead0",
  textShadow: "0 1px 0 #000",
  background: "radial-gradient(circle at 10% 20%, rgba(255,226,147,0.2), transparent 38%)",
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
  padding: "9px 12px",
  borderRight: "1px solid rgba(193, 150, 84, 0.22)",
  display: "grid",
  alignContent: "center",
  gap: 1,
  background:
    "linear-gradient(90deg, rgba(255,226,147,0.075), rgba(255,255,255,0))",
};

const mapDeckStyle: React.CSSProperties = {
  minHeight: 0,
  padding: 0,
  overflow: "hidden",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const mapFrameStyle: React.CSSProperties = {
  width: "100%",
  maxWidth: "100%",
  height: "100%",
  maxHeight: "100%",
  position: "relative",
  border: "0",
  borderRadius: 0,
  background: "#04080d",
  boxShadow:
    "inset 0 0 70px rgba(0,0,0,0.42)",
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

const autoControlStyle: React.CSSProperties = {
  position: "absolute",
  left: 14,
  top: 14,
  zIndex: 8,
  display: "flex",
  gap: 6,
  padding: 6,
  background: "linear-gradient(180deg, rgba(35,25,15,0.92), rgba(7,10,15,0.9))",
  border: "1px solid rgba(207,167,95,0.42)",
  boxShadow: "0 10px 24px rgba(0,0,0,0.38), inset 0 1px 0 rgba(255,255,255,0.08)",
};

const frontRunnerStyle: React.CSSProperties = {
  position: "absolute",
  left: 14,
  top: 62,
  zIndex: 8,
  minWidth: 168,
  maxWidth: 230,
  display: "grid",
  gap: 2,
  padding: "7px 10px",
  color: "#f6e8c8",
  background: "linear-gradient(135deg, rgba(85,58,24,0.94), rgba(7,11,16,0.9))",
  border: "1px solid rgba(248,211,126,0.44)",
  boxShadow: "0 14px 32px rgba(0,0,0,0.4), inset 0 0 22px rgba(248,211,126,0.08)",
  clipPath: "polygon(0 0, calc(100% - 13px) 0, 100% 13px, 100% 100%, 0 100%)",
  pointerEvents: "auto",
  textShadow: "0 1px 0 #000",
  fontSize: 12,
};

const autoButtonStyle: React.CSSProperties = {
  minWidth: 38,
  height: 34,
  border: "1px solid rgba(248,211,126,0.44)",
  background: "linear-gradient(180deg, #6f4a1d, #1b1208)",
  color: "#fff1c9",
  cursor: "pointer",
  fontWeight: 900,
};

const speedButtonStyle: React.CSSProperties = {
  ...autoButtonStyle,
  minWidth: 42,
  background: "linear-gradient(180deg, #263142, #0f141d)",
  color: "#c9d2df",
};

const activeSpeedButtonStyle: React.CSSProperties = {
  ...speedButtonStyle,
  border: "1px solid #f8d37e",
  background: "linear-gradient(180deg, #9b6a26, #3c240d)",
  color: "#fff1c9",
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

const sceneOverlayStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 20,
  display: "grid",
  placeItems: "center",
  background:
    "radial-gradient(circle at 50% 32%, rgba(106,71,28,0.56), rgba(3,6,10,0.9) 62%), repeating-linear-gradient(45deg, rgba(255,255,255,0.025) 0 1px, transparent 1px 9px)",
  backdropFilter: "blur(3px)",
};

const scenePanelStyle: React.CSSProperties = {
  position: "relative",
  width: "min(760px, calc(100vw - 48px))",
  border: "2px solid rgba(228, 181, 92, 0.68)",
  borderRadius: 0,
  padding: 24,
  background:
    "linear-gradient(135deg, rgba(98,67,29,0.22), transparent 34%), linear-gradient(180deg, rgba(48,37,24,0.97), rgba(11,14,19,0.99))",
  boxShadow: "0 34px 90px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.14), inset 0 0 50px rgba(228,181,92,0.08)",
  clipPath: "polygon(0 0, calc(100% - 22px) 0, 100% 22px, 100% 100%, 22px 100%, 0 calc(100% - 22px))",
  overflow: "hidden",
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

const scaleGridStyle: React.CSSProperties = {
  position: "relative",
  zIndex: 1,
  display: "grid",
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  gap: 12,
};

const scaleCardStyle: React.CSSProperties = {
  minHeight: 150,
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

const scoreGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  gap: 10,
};

const ledgerGridStyle: React.CSSProperties = {
  position: "relative",
  zIndex: 1,
  display: "grid",
  gridTemplateColumns: "1.2fr 0.8fr",
  gap: 12,
  margin: "12px 0 16px",
};

const ledgerPanelStyle: React.CSSProperties = {
  minHeight: 180,
  maxHeight: 260,
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
