"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export default function HomePage() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return (
    <main style={containerStyle}>
      {/* Decorative Grid Overlay */}
      <div style={gridOverlayStyle} />

      {/* Hero Section */}
      <header style={heroHeaderStyle}>
        <div style={logoWrapperStyle}>
          <svg
            width={isMobile ? 48 : 64}
            height={isMobile ? 48 : 64}
            viewBox="0 0 64 64"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            style={{ filter: "drop-shadow(0 0 10px rgba(207, 167, 95, 0.6))" }}
          >
            <path d="M12 24C16 12 28 8 32 18C36 8 48 12 52 24C44 26 36 28 32 38C28 28 20 26 12 24Z" fill="url(#heroPhoenixGrad)" />
            <path d="M32 38C30 46 24 52 16 56C24 52 28 48 32 44C36 48 40 52 48 56C40 52 34 46 32 38Z" fill="#a97b35" />
            <path d="M32 14C31 16 30 18 30 20C30 24 32 26 32 28C32 26 34 24 34 20C34 18 33 16 32 14Z" fill="#ffe9b7" />
            <path d="M32 8C31.5 10 32.5 11 32 12C31.5 11 31 10 32 8Z" fill="#ffe9b7" />
            <defs>
              <linearGradient id="heroPhoenixGrad" x1="12" y1="24" x2="52" y2="24" gradientUnits="userSpaceOnUse">
                <stop offset="0" stopColor="#a97b35" />
                <stop offset="0.5" stopColor="#ffe9b7" />
                <stop offset="1" stopColor="#a97b35" />
              </linearGradient>
            </defs>
          </svg>
          <h1 style={titleStyle}>Splinter States</h1>
        </div>
        <p style={taglineStyle}>
          A Seeded Grand Strategy Simulation & Tactical Betting Campaign.
        </p>
        <Link href="/game" style={ctaButtonStyle} className="cta-hover">
          Enter the War Room
        </Link>
      </header>

      {/* Feature Section */}
      <section style={sectionStyle}>
        <h2 style={sectionTitleStyle}>Strategic Features</h2>
        <div style={isMobile ? stackedGridStyle : grid3ColStyle}>
          <div style={panelStyle}>
            <span style={featureIconStyle}>🌍</span>
            <h3 style={featureTitleStyle}>Unified Story Mode</h3>
            <p style={featureCopyStyle}>
              Anchor your campaign on a regional favorite, then scale your conquest "as is" to continental supremacy, and finally global dominance.
            </p>
          </div>
          <div style={panelStyle}>
            <span style={featureIconStyle}>🎯</span>
            <h3 style={featureTitleStyle}>Initiative Wheel</h3>
            <p style={featureCopyStyle}>
              Combat turns are dictated by dynamic probability curves driven by government structures, custom modifiers, and religious faith.
            </p>
          </div>
          <div style={panelStyle}>
            <span style={featureIconStyle}>☢️</span>
            <h3 style={featureTitleStyle}>Zero Directive Outcomes</h3>
            <p style={featureCopyStyle}>
              Deploy tactical nuclear strikes, establish army camps to gain permanent initiative, and build interceptor screens to block enemy advance.
            </p>
          </div>
        </div>
      </section>

      {/* Intelligence Briefings & Screenshots Section */}
      <section style={sectionStyle}>
        <h2 style={sectionTitleStyle}>Intelligence Briefing</h2>
        <p style={leadBriefStyle}>
          A visual layout of the simulation deck interfaces. Update these slots with actual game screenshots.
        </p>

        <div style={isMobile ? stackedGridStyle : grid2ColStyle}>
          {/* Screenshot 1 */}
          <div style={screenshotSlotStyle}>
            <div style={imagePlaceholderStyle}>
              <span style={{ fontSize: 48 }}>🗺️</span>
              <span style={placeholderLabelStyle}>Screenshot Required: Parchment Canvas Map</span>
              <p style={placeholderDescStyle}>
                Shows the high-performance HTML5 {"<canvas>"} world map with desaturated colors, contiguous mainland centered labels, and active conflict lines.
              </p>
            </div>
            <div style={screenshotFooterStyle}>
              <strong>TACTICAL MAP VIEW</strong>
              <span>1920x1080 Resolution</span>
            </div>
          </div>

          {/* Screenshot 2 */}
          <div style={screenshotSlotStyle}>
            <div style={imagePlaceholderStyle}>
              <span style={{ fontSize: 48 }}>🛡️</span>
              <span style={placeholderLabelStyle}>Screenshot Required: War Room Setup</span>
              <p style={placeholderDescStyle}>
                Capture the Start Scene featuring the scale picker overlay showing the interactive hover cards for World, Continent, Region, and Story Mode.
              </p>
            </div>
            <div style={screenshotFooterStyle}>
              <strong>SETUP SCENE</strong>
              <span>1920x1080 Resolution</span>
            </div>
          </div>

          {/* Screenshot 3 */}
          <div style={screenshotSlotStyle}>
            <div style={imagePlaceholderStyle}>
              <span style={{ fontSize: 48 }}>🃏</span>
              <span style={placeholderLabelStyle}>Screenshot Required: Pokémon TCG Dossier</span>
              <p style={placeholderDescStyle}>
                Capture the country stats card in its expanded Pokémon-card form, highlighting the Gov/Faith illustration frame and moves panels.
              </p>
            </div>
            <div style={screenshotFooterStyle}>
              <strong>TCG COUNTRY DOSSIER</strong>
              <span>1920x1080 Resolution</span>
            </div>
          </div>

          {/* Screenshot 4 */}
          <div style={screenshotSlotStyle}>
            <div style={imagePlaceholderStyle}>
              <span style={{ fontSize: 48 }}>⚔️</span>
              <span style={placeholderLabelStyle}>Screenshot Required: Live Battle Deck</span>
              <p style={placeholderDescStyle}>
                Shows the Battle Room combat widget in the middle of active turns, displaying betting sliders, dice animations, and the Zero Directive outcome strip.
              </p>
            </div>
            <div style={screenshotFooterStyle}>
              <strong>BATTLE ROOM WIDGET</strong>
              <span>1920x1080 Resolution</span>
            </div>
          </div>
        </div>
      </section>

      {/* Global CSS for Animations */}
      <style jsx global>{`
        .cta-hover {
          transition: all 0.2s ease-in-out;
        }
        .cta-hover:hover {
          transform: translateY(-2px);
          border-color: #f8d37e !important;
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.2), 0 0 20px rgba(207,167,95,0.4) !important;
          background: linear-gradient(180deg, #cfa24b, #6b4c1b) !important;
        }
      `}</style>
    </main>
  );
}

// Styling definitions (aligning with grand strategy parchment aesthetics)
const containerStyle: React.CSSProperties = {
  position: "relative",
  minHeight: "100vh",
  width: "100%",
  padding: "48px 24px",
  boxSizing: "border-box",
  background:
    "radial-gradient(circle at 50% -20%, rgba(173,126,49,0.18), transparent 45%), linear-gradient(180deg, #16120c 0%, #080c12 50%, #030407 100%)",
  color: "#e8dfc8",
  fontFamily: "'Inter', system-ui, sans-serif",
  overflowX: "hidden",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: 64,
};

const gridOverlayStyle: React.CSSProperties = {
  position: "absolute",
  inset: 0,
  backgroundImage:
    "repeating-linear-gradient(45deg, rgba(255,255,255,0.015) 0 1px, transparent 1px 12px)",
  pointerEvents: "none",
  zIndex: 1,
};

const heroHeaderStyle: React.CSSProperties = {
  position: "relative",
  zIndex: 2,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  textAlign: "center",
  gap: 18,
  maxWidth: 800,
  marginTop: 32,
};

const logoWrapperStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 16,
};

const titleStyle: React.CSSProperties = {
  fontSize: "clamp(32px, 5vw, 54px)",
  fontWeight: 900,
  margin: 0,
  fontFamily: "'Cinzel', 'Georgia', serif",
  textTransform: "uppercase",
  color: "#f6ead0",
  letterSpacing: 2,
  textShadow: "1px 1px 0px #bfa36d, 2px 2px 0px #9f8452, 3px 3px 0px #7f6538, 4px 4px 6px rgba(0,0,0,0.9)",
};

const taglineStyle: React.CSSProperties = {
  fontSize: "clamp(14px, 2.5vw, 18px)",
  color: "#cbd5e1",
  margin: "0 0 12px",
  maxWidth: 600,
  lineHeight: 1.5,
};

const ctaButtonStyle: React.CSSProperties = {
  display: "inline-block",
  textDecoration: "none",
  border: "1.5px solid #cfa24b",
  borderRadius: 4,
  background: "linear-gradient(180deg, #a97b35, #4d3518)",
  color: "#fff3d0",
  padding: "14px 32px",
  fontSize: 16,
  fontWeight: 800,
  textTransform: "uppercase",
  letterSpacing: 1.5,
  cursor: "pointer",
  textShadow: "0 1px 1px #1c1208",
  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.15), 0 4px 15px rgba(0,0,0,0.5)",
};

const sectionStyle: React.CSSProperties = {
  position: "relative",
  zIndex: 2,
  width: "100%",
  maxWidth: 1080,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: 24,
};

const sectionTitleStyle: React.CSSProperties = {
  fontSize: 24,
  fontWeight: 800,
  fontFamily: "'Cinzel', 'Georgia', serif",
  textTransform: "uppercase",
  color: "#cfa24b",
  letterSpacing: 1,
  margin: 0,
  borderBottom: "1.5px solid rgba(207, 167, 95, 0.3)",
  paddingBottom: 8,
  textAlign: "center",
  width: "100%",
  maxWidth: 400,
};

const grid3ColStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  gap: 20,
  width: "100%",
};

const grid2ColStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: 24,
  width: "100%",
};

const stackedGridStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 20,
  width: "100%",
};

const panelStyle: React.CSSProperties = {
  border: "1px solid rgba(211,166,88,0.3)",
  padding: 24,
  background: "linear-gradient(180deg, rgba(28,34,43,0.7), rgba(7,10,16,0.85))",
  boxShadow: "inset 0 0 20px rgba(211,166,88,0.03), 0 10px 25px rgba(0,0,0,0.35)",
  borderRadius: 6,
  display: "flex",
  flexDirection: "column",
  gap: 12,
  alignItems: "center",
  textAlign: "center",
};

const featureIconStyle: React.CSSProperties = {
  fontSize: 36,
  filter: "drop-shadow(0 2px 8px rgba(0,0,0,0.4))",
};

const featureTitleStyle: React.CSSProperties = {
  fontSize: 18,
  fontWeight: 800,
  color: "#fff5d6",
  margin: 0,
};

const featureCopyStyle: React.CSSProperties = {
  fontSize: 13,
  color: "#94a3b8",
  lineHeight: 1.45,
  margin: 0,
};

const leadBriefStyle: React.CSSProperties = {
  fontSize: 15,
  color: "#cbd5e1",
  textAlign: "center",
  margin: "0 0 8px",
  maxWidth: 600,
};

const screenshotSlotStyle: React.CSSProperties = {
  border: "2px solid rgba(210, 165, 82, 0.45)",
  borderRadius: 8,
  background: "rgba(10, 12, 16, 0.9)",
  overflow: "hidden",
  boxShadow: "0 12px 30px rgba(0,0,0,0.55)",
  display: "flex",
  flexDirection: "column",
};

const imagePlaceholderStyle: React.CSSProperties = {
  height: 240,
  background:
    "repeating-linear-gradient(-45deg, rgba(207,167,95,0.02) 0 2px, transparent 2px 16px), #11141a",
  borderBottom: "1.5px solid rgba(210, 165, 82, 0.35)",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  padding: 24,
  textAlign: "center",
  gap: 12,
  boxSizing: "border-box",
};

const placeholderLabelStyle: React.CSSProperties = {
  fontSize: 15,
  fontWeight: 700,
  color: "#fff5d6",
};

const placeholderDescStyle: React.CSSProperties = {
  fontSize: 11.5,
  color: "#94a3b8",
  margin: 0,
  lineHeight: 1.4,
  maxWidth: 320,
};

const screenshotFooterStyle: React.CSSProperties = {
  padding: "12px 18px",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  background: "linear-gradient(180deg, #181c24, #0d1015)",
  fontSize: 12,
};
