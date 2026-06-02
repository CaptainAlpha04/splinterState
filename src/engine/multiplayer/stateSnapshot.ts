export type GameSnapshot = {
  version: number;
  createdAt: string;
  payload: Record<string, unknown>;
};

export function createSnapshot(payload: Record<string, unknown>): GameSnapshot {
  return {
    version: 1,
    createdAt: new Date().toISOString(),
    payload,
  };
}
