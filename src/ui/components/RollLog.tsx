import { useGameStore } from "../../store/gameStore";

export default function RollLog() {
  const logs = useGameStore(state => state.logs);

  return (
    <section style={{ display: "grid", gap: 8 }}>
      <h3 style={{ margin: 0, color: "#f3e7cf", fontSize: 16 }}>War Chronicle</h3>
      <div style={{
        border: "1px solid rgba(184,139,74,0.32)",
        borderRadius: 3,
        padding: 12,
        background: "linear-gradient(180deg, rgba(24,29,36,0.9), rgba(7,10,15,0.96))",
        minHeight: 120,
        maxHeight: 190,
        overflowY: "auto",
        fontSize: "0.875rem",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)"
      }}>
        {logs.length === 0 ? (
          <p style={{ margin: 0, color: "#9ca889" }}>
            Rolls and outcomes will stream here.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {logs.slice().reverse().map((log, i) => (
              <div key={i} style={{ color: i === 0 ? "#f3e7cf" : "#98a3b2" }}>
                {log}
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
