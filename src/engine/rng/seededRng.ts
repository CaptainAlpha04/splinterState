export type RngState = {
  seed: number;
};

export function createRng(seed: number): RngState {
  const normalized = Math.abs(Math.floor(seed)) % 2147483647;
  return { seed: normalized === 0 ? 1 : normalized };
}

export function createEntropySeed(): number {
  const cryptoValue = typeof globalThis.crypto !== "undefined"
    ? globalThis.crypto.getRandomValues(new Uint32Array(1))[0]
    : 0;
  const performanceValue = typeof globalThis.performance !== "undefined"
    ? Math.floor(globalThis.performance.now() * 1000)
    : 0;
  return (Date.now() ^ cryptoValue ^ performanceValue) >>> 0;
}

export function nextInt(state: RngState, min: number, max: number): number {
  if (max < min) {
    throw new Error(`Invalid RNG range: ${min}..${max}`);
  }

  state.seed = (state.seed * 48271) % 2147483647;
  const unit = state.seed / 2147483647;
  return Math.floor(unit * (max - min + 1)) + min;
}
