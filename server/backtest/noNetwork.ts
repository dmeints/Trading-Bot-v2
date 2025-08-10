export function disallowNetwork() {
  const thrower = () => { throw new Error("Network call during backtest"); };
  // @ts-ignore
  globalThis.fetch = thrower;
  // Optionally block other clients here
}