export type GameEvent = {
  id: string;
  type: string;
  payload: Record<string, unknown>;
};

export function appendEvent(events: GameEvent[], event: GameEvent): GameEvent[] {
  return [...events, event];
}
