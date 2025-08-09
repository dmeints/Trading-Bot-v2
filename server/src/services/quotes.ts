let lastMsgTs = 0;
export function mark(){ lastMsgTs = Date.now(); }
export function lastAgeMs(){ return lastMsgTs? (Date.now()-lastMsgTs) : Number.MAX_SAFE_INTEGER; }
export function isHealthy(){ return lastAgeMs() < 5_000; }
