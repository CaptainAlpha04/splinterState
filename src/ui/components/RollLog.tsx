import { useMemo } from "react";
import type React from "react";
import { useGameStore } from "../../store/gameStore";

type ChronicleEntry = {
  icon: string;
  title: string;
  body: string;
  tone: "war" | "capture" | "event" | "victory" | "danger" | "neutral";
};

export default function RollLog() {
  const logs = useGameStore(state => state.logs);

  const entries = useMemo(
    () => logs
      .filter(isCampaignHistory)
      .slice(-18)
      .reverse()
      .map(toChronicleEntry),
    [logs]
  );

  return (
    <section style={{ display: "grid", gap: 8 }}>
      <h3 style={{ margin: 0, color: "#f3e7cf", fontSize: 16 }}>Campaign History</h3>
      <div style={chroniclePanelStyle}>
        {entries.length === 0 ? (
          <p style={{ margin: 0, color: "#9ca889" }}>
            The first war report will be carved into the chronicle here.
          </p>
        ) : (
          <div style={{ display: "grid", gap: 8 }}>
            {entries.map((entry, index) => (
              <article key={`${entry.title}-${index}`} style={{ ...entryStyle, borderColor: toneColor(entry.tone) }}>
                <span style={{ ...iconStyle, background: toneBackground(entry.tone) }}>{entry.icon}</span>
                <div style={{ minWidth: 0 }}>
                  <strong style={{ color: index === 0 ? "#fff3cf" : "#e6dcc8" }}>{entry.title}</strong>
                  <p style={{ margin: "3px 0 0", color: "#9daab8", lineHeight: 1.35 }}>{entry.body}</p>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function isCampaignHistory(log: string) {
  return /War erupted|Civil war|won the war|captured|counter|nuke|fallout|broke away|ranked|payout|bet won|bet lost|proclaimed|event horizon|rebel|revolt/i.test(log);
}

function toChronicleEntry(log: string): ChronicleEntry {
  if (/nuke|fallout/i.test(log)) {
    return { icon: "☢️", title: "Fallout Strike", body: log, tone: "danger" };
  }
  if (/War erupted|Civil war/i.test(log)) {
    return { icon: "⚔️", title: "War Declared", body: log, tone: "war" };
  }
  if (/captured|counter/i.test(log)) {
    return { icon: "🧭", title: "Frontline Shift", body: log, tone: "capture" };
  }
  if (/won the war|ranked|payout|bet won/i.test(log)) {
    return { icon: "🏆", title: "Result", body: log, tone: "victory" };
  }
  if (/rebel|revolt|broke away/i.test(log)) {
    return { icon: "🔥", title: "Rebellion", body: log, tone: "danger" };
  }
  if (/proclaimed/i.test(log)) {
    return { icon: "👑", title: "New Realm", body: log, tone: "event" };
  }
  if (/event horizon/i.test(log)) {
    return { icon: "🌩️", title: "Event Horizon", body: log, tone: "event" };
  }
  return { icon: "📜", title: "Dispatch", body: log, tone: "neutral" };
}

function toneColor(tone: ChronicleEntry["tone"]) {
  switch (tone) {
    case "war": return "rgba(230, 150, 72, 0.48)";
    case "capture": return "rgba(92, 180, 205, 0.42)";
    case "event": return "rgba(185, 143, 236, 0.42)";
    case "victory": return "rgba(248, 211, 126, 0.58)";
    case "danger": return "rgba(239, 90, 78, 0.5)";
    default: return "rgba(184,139,74,0.28)";
  }
}

function toneBackground(tone: ChronicleEntry["tone"]) {
  switch (tone) {
    case "war": return "linear-gradient(180deg, #7c3e1b, #32140a)";
    case "capture": return "linear-gradient(180deg, #24687a, #102a34)";
    case "event": return "linear-gradient(180deg, #604085, #241a35)";
    case "victory": return "linear-gradient(180deg, #a77a2e, #3d260d)";
    case "danger": return "linear-gradient(180deg, #8f251d, #360d0a)";
    default: return "linear-gradient(180deg, #314052, #121923)";
  }
}

const chroniclePanelStyle: React.CSSProperties = {
  border: "1px solid rgba(184,139,74,0.32)",
  borderRadius: 0,
  padding: 10,
  background:
    "linear-gradient(135deg, rgba(248,211,126,0.08), transparent 40%), linear-gradient(180deg, rgba(24,20,16,0.94), rgba(7,10,15,0.98))",
  minHeight: 120,
  maxHeight: 240,
  overflowY: "auto",
  fontSize: "0.825rem",
  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05)",
};

const entryStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "36px minmax(0, 1fr)",
  gap: 9,
  alignItems: "start",
  padding: "8px 9px",
  border: "1px solid",
  background: "linear-gradient(180deg, rgba(19,25,34,0.88), rgba(8,11,16,0.94))",
  boxShadow: "inset 0 0 18px rgba(255,255,255,0.025)",
};

const iconStyle: React.CSSProperties = {
  width: 32,
  height: 32,
  display: "grid",
  placeItems: "center",
  border: "1px solid rgba(248,211,126,0.34)",
  boxShadow: "0 5px 12px rgba(0,0,0,0.26), inset 0 1px 0 rgba(255,255,255,0.12)",
};
