import { create } from "zustand";

type BreakerReason = "stale_quotes"|"high_latency"|"slippage_breach"|"manual_kill"|"unknown";

type SystemState = {
  breakerActive: boolean; 
  reason?: BreakerReason; 
  since?: number; 
  details?: string;
  setBreaker: (on: boolean, reason?: BreakerReason, details?: string) => void;
  clearBreaker: () => void;
};

export const useSystemStore = create<SystemState>((set) => ({
  breakerActive: false,
  setBreaker: (on, reason, details) => set({ 
    breakerActive: on, 
    reason, 
    details, 
    since: on ? Date.now() : undefined 
  }),
  clearBreaker: () => set({ 
    breakerActive: false, 
    reason: undefined, 
    details: undefined, 
    since: undefined 
  }),
}));