import { LIVE_NETWORK, PRACTICE_NETWORK, getNetwork, isNetworkName, setRuntimeNetwork } from '@bond/core';

const KEY = 'bond-network';

/** Call once before rendering: applies a visitor's saved "Practice on testnet" choice. */
export function initNetworkChoice(): void {
  try {
    const v = localStorage.getItem(KEY);
    if (isNetworkName(v)) setRuntimeNetwork(v);
  } catch {
    /* storage blocked: stay on the build's default network */
  }
}

/** Switch between the live network and the practice network. Reloads so every cache starts clean. */
export function togglePracticeNetwork(): void {
  const next = getNetwork().name === PRACTICE_NETWORK ? LIVE_NETWORK : PRACTICE_NETWORK;
  try {
    localStorage.setItem(KEY, next);
  } catch {
    /* ignore */
  }
  location.reload();
}

export const onPracticeNetwork = (): boolean => getNetwork().name === PRACTICE_NETWORK;
