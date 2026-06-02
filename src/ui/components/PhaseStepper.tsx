import { useGameStore } from "../../store/gameStore";

const phases = [
  { id: "PickScope", label: "Campaign Scale" },
  { id: "PickFavorite", label: "Campaign Favorite" },
  { id: "EventHorizon", label: "Event Horizon" },
  { id: "WarSelection", label: "War Selection" },
  { id: "Betting", label: "Betting" },
  { id: "CombatResult", label: "Combat Result" },
];

export default function PhaseStepper() {
  const currentPhase = useGameStore(state => state.stage);

  return (
    <section>
      <h3 style={{ marginTop: 0 }}>Round Phases</h3>
      <ol style={{ paddingLeft: 20, margin: 0 }}>
        {phases.map((phase, index) => {
          const isActive = currentPhase === phase.id;
          return (
            <li 
              key={phase.id} 
              style={{ 
                marginBottom: 6,
                fontWeight: isActive ? "bold" : "normal",
                color: isActive ? "#22c55e" : "#94a3b8" 
              }}
            >
              {index + 1}. {phase.label}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
