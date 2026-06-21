"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type React from "react";
import type { Country } from "../../engine/models/country";
import MapSvg from "../../ui/components/MapSvg";
import Sidebar from "../../ui/components/Sidebar";
import BattleRoom from "../../ui/components/BattleRoom";
import { getCountryDevelopmentScore, getCountryTier, type CampaignScale, useGameStore } from "../../store/gameStore";
import { loadMapAssets } from "../../lib/data/loadMapAssets";
import { StartScene } from "../../ui/components/StartScene";
import { EndScene, type LeaderboardEntry, type PromotionEntry } from "../../ui/components/EndScene";
import { HudMetric } from "../../ui/components/HudMetric";

export default function GamePage() {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  const isLoaded = useGameStore(state => state.isLoaded);
  const initializeGame = useGameStore(state => state.initializeGame);
  const stage = useGameStore(state => state.stage);
  const player = useGameStore(state => state.player);
  const countries = useGameStore(state => state.countries);
  const campaignScope = useGameStore(state => state.campaignScope);
  const isStoryMode = useGameStore(state => state.isStoryMode);
  const storyModeScale = useGameStore(state => state.storyModeScale);
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
    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      setIsCollapsed(mobile);
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Auto-open sidebar when a war ends or manual pairing stage is reached
  useEffect(() => {
    if (stage === "WarSelection" || stage === "CombatResult" || stage === "ManualWarPairing") {
      setIsCollapsed(false);
    }
  }, [stage]);

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

  const activeCountryCount = useMemo(() => {
    const eligible = campaignScope ? new Set(campaignScope.eligibleCountryIds) : null;
    return Object.values(countries).filter(
      c => c.provinces.length > 0 && (!eligible || eligible.has(c.id))
    ).length;
  }, [countries, campaignScope]);

  const floatingStatusBarStyle: React.CSSProperties = {
    position: "absolute",
    top: isMobile ? 0 : 16,
    left: isMobile ? 0 : "50%",
    transform: isMobile ? "none" : "translateX(-50%)",
    width: isMobile ? "100%" : "auto",
    maxWidth: isMobile ? "100%" : "calc(100% - 32px)",
    zIndex: 10,
    display: "flex",
    flexDirection: "row",
    alignItems: "stretch",
    gap: isMobile ? 4 : 12,
    padding: isMobile ? "6px 8px" : "6px 16px",
    background: "rgba(22, 18, 14, 0.95)",
    backdropFilter: "blur(10px)",
    border: isMobile ? "none" : "1.5px solid rgba(210, 165, 82, 0.55)",
    borderBottom: "2px solid rgba(210, 165, 82, 0.55)",
    borderRadius: isMobile ? 0 : 8,
    boxShadow: "0 10px 30px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,234,170,0.1)",
    overflowX: "auto",
    whiteSpace: "nowrap",
  };

  const autoControlStyle: React.CSSProperties = {
    position: "absolute",
    left: isMobile ? 10 : 20,
    top: isMobile ? 64 : 80,
    zIndex: 8,
    display: "flex",
    gap: 6,
    padding: 6,
    background: "linear-gradient(180deg, rgba(35,25,15,0.92), rgba(7,10,15,0.9))",
    border: "1px solid rgba(207,167,95,0.42)",
    boxShadow: "0 10px 24px rgba(0,0,0,0.38), inset 0 1px 0 rgba(255,255,255,0.08)",
  };

  const notificationStackStyle: React.CSSProperties = {
    position: "absolute",
    left: "50%",
    transform: "translateX(-50%)",
    top: isMobile ? 100 : 76,
    width: isMobile ? "calc(100% - 20px)" : 420,
    display: "grid",
    gap: 6,
    pointerEvents: "none",
    zIndex: 12,
  };

  const battleRoomContainerStyle: React.CSSProperties = {
    position: "absolute",
    bottom: isMobile ? 20 : 20,
    left: isMobile ? 10 : "50%",
    right: isMobile ? 10 : "auto",
    transform: isMobile ? "none" : "translateX(-50%)",
    zIndex: 15,
    width: isMobile ? "auto" : 480,
    maxWidth: isMobile ? "none" : "calc(100% - 40px)",
  };

  const headerTitleStyle: React.CSSProperties = {
    position: "absolute",
    top: isMobile ? 8 : 22,
    left: isMobile ? 10 : 20,
    zIndex: 12,
    fontFamily: "'Cinzel', 'Georgia', serif",
    fontSize: isMobile ? 15 : 24,
    fontWeight: 900,
    textTransform: "uppercase",
    color: "#f6ead0",
    letterSpacing: 2,
    textShadow: "1px 1px 0px #bfa36d, 2px 2px 0px #9f8452, 3px 3px 0px #7f6538, 4px 4px 5px rgba(0,0,0,0.8)",
    pointerEvents: "none",
    display: "flex",
    alignItems: "center",
    gap: isMobile ? 6 : 10,
  };

  return (
    <main style={shellStyle}>
      <h1 style={headerTitleStyle}>
        <svg
          width={isMobile ? 20 : 28}
          height={isMobile ? 20 : 28}
          viewBox="0 0 64 64"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          style={{ filter: "drop-shadow(0 0 6px rgba(207, 167, 95, 0.5))", flexShrink: 0 }}
        >
          <path d="M12 24C16 12 28 8 32 18C36 8 48 12 52 24C44 26 36 28 32 38C28 28 20 26 12 24Z" fill="url(#phoenixGrad)" />
          <path d="M32 38C30 46 24 52 16 56C24 52 28 48 32 44C36 48 40 52 48 56C40 52 34 46 32 38Z" fill="#a97b35" />
          <path d="M32 14C31 16 30 18 30 20C30 24 32 26 32 28C32 26 34 24 34 20C34 18 33 16 32 14Z" fill="#ffe9b7" />
          <path d="M32 8C31.5 10 32.5 11 32 12C31.5 11 31 10 32 8Z" fill="#ffe9b7" />
          <defs>
            <linearGradient id="phoenixGrad" x1="12" y1="24" x2="52" y2="24" gradientUnits="userSpaceOnUse">
              <stop offset="0" stopColor="#a97b35" />
              <stop offset="0.5" stopColor="#ffe9b7" />
              <stop offset="1" stopColor="#a97b35" />
            </linearGradient>
          </defs>
        </svg>
        <span>Splinter States</span>
      </h1>

      <div style={floatingStatusBarStyle}>
        <HudMetric label="Stage" value={stageLabel(stage)} />
        {campaignScope && <HudMetric label="Powers" value={`${activeCountryCount} active`} />}
        <HudMetric label="Tickets" value={player.tickets.toString()} />
        <HudMetric
          label="Scope"
          value={
            campaignScope
              ? `${campaignScope.label}${isStoryMode ? ` (${storyModeScaleLabel(storyModeScale)})` : ""}`
              : "Unclaimed"
          }
        />
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

          {frontRunner ? <FrontRunnerPanel entry={frontRunner} isMobile={isMobile} /> : null}

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

      <Sidebar isCollapsed={isCollapsed} setIsCollapsed={setIsCollapsed} isMobile={isMobile} />

      {(stage === "Betting" || stage === "Combat") && (
        <div style={battleRoomContainerStyle}>
          <BattleRoom />
        </div>
      )}

      {stage === "PickScope" ? (
        <StartScene tickets={player.tickets} onPickScale={setCampaignScale} isMobile={isMobile} />
      ) : null}

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
          isMobile={isMobile}
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
        .scale-card-hover {
          transition: all 0.25s ease-in-out;
        }
        .scale-card-hover:hover {
          transform: translateY(-4px) scale(1.02);
          border-color: #f8d37e !important;
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.2), 0 12px 24px rgba(248,211,126,0.15) !important;
          background: linear-gradient(180deg, rgba(120,90,50,0.45), rgba(8,12,18,0.96)) !important;
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


function FrontRunnerPanel({ entry, isMobile }: { entry: LeaderboardEntry; isMobile: boolean }) {
  const detail = `${entry.country.name}: ${entry.tier}, score ${entry.score}, ${entry.country.provinces.length} provinces, ${entry.country.government}, ${entry.country.religion}.`;
  
  const frontRunnerStyle: React.CSSProperties = {
    position: "absolute",
    left: isMobile ? 10 : 20,
    top: isMobile ? 120 : 136,
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


function stageLabel(stage: string) {
  const labels: Record<string, string> = {
    PickScope: "Choose Scale",
    PickFavorite: "Anchor Pick",
    EventHorizon: "Events",
    ManualWarPairing: "Manual Targeting",
    WarSelection: "War Room",
    Betting: "Wager",
    Combat: "Combat",
    CombatResult: "Aftermath",
    CampaignWon: "Victory",
    GameOver: "Game Over",
  };
  return labels[stage] ?? stage;
}

function storyModeScaleLabel(scale: "Regional War" | "Continent War" | "World War" | null) {
  if (scale === "Regional War") return "Region";
  if (scale === "Continent War") return "Continent";
  if (scale === "World War") return "World";
  return "";
}

// Styling definitions
const shellStyle: React.CSSProperties = {
  position: "relative",
  width: "100vw",
  height: "100vh",
  background:
    "radial-gradient(circle at 50% -20%, rgba(173,126,49,0.22), transparent 34%), linear-gradient(180deg, #19120b 0%, #0b1119 42%, #03060a 100%)",
  color: "#e8dfc8",
  overflow: "hidden",
};

const mapDeckStyle: React.CSSProperties = {
  position: "absolute",
  inset: 0,
  zIndex: 1,
  overflow: "hidden",
};

const mapFrameStyle: React.CSSProperties = {
  width: "100%",
  height: "100%",
  position: "relative",
  background: "#04080d",
  boxShadow: "inset 0 0 70px rgba(0,0,0,0.42)",
};

const brandPlateStyle: React.CSSProperties = {
  padding: "4px 14px 4px 0",
  borderRight: "1px solid rgba(193, 150, 84, 0.34)",
  display: "grid",
  alignContent: "center",
  color: "#f6ead0",
  textShadow: "0 1px 0 #000",
};

const brandKickerStyle: React.CSSProperties = {
  color: "#bfa36d",
  fontSize: 10,
  fontWeight: 800,
  textTransform: "uppercase",
  letterSpacing: 0.5,
};

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

const loadingStyle: React.CSSProperties = {
  height: "100%",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  color: "#c7b991",
};

const noticeStyle: React.CSSProperties = {
  border: "1px solid rgba(210, 165, 82, 0.35)",
  borderRadius: 4,
  padding: "5px 12px",
  background: "linear-gradient(90deg, transparent, rgba(22,18,14,0.92) 15%, rgba(22,18,14,0.92) 85%, transparent)",
  color: "#f2e7cb",
  fontSize: 11.5,
  fontWeight: 600,
  textAlign: "center",
  lineHeight: 1.3,
  boxShadow: "0 4px 10px rgba(0,0,0,0.35)",
  animation: "splinterNoticeFade 6s ease forwards",
  textShadow: "0 1px 2px rgba(0,0,0,0.9)",
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
