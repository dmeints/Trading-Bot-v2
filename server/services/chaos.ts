import { WebSocket } from 'ws';

interface ChaosConfig {
  staleQuotesEnabled: boolean;
  highLatencyEnabled: boolean;
  slippageBreachEnabled: boolean;
  manualKillEnabled: boolean;
}

class ChaosService {
  private config: ChaosConfig = {
    staleQuotesEnabled: false,
    highLatencyEnabled: false,
    slippageBreachEnabled: false,
    manualKillEnabled: false,
  };
  
  private wsClients: Set<WebSocket> = new Set();

  addWebSocketClient(ws: WebSocket) {
    this.wsClients.add(ws);
    ws.on('close', () => this.wsClients.delete(ws));
  }

  private broadcastBreaker(active: boolean, reason: string, details?: string) {
    const message = JSON.stringify({
      type: "breaker",
      active,
      reason,
      details: details || "",
    });
    
    this.wsClients.forEach(ws => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(message);
      }
    });
  }

  triggerStaleQuotes(details = "No quote for 5.2s") {
    if (this.config.staleQuotesEnabled) {
      this.broadcastBreaker(true, "stale_quotes", details);
    }
  }

  triggerHighLatency(details = "Submit latency > 500ms") {
    if (this.config.highLatencyEnabled) {
      this.broadcastBreaker(true, "high_latency", details);
    }
  }

  triggerSlippageBreach(details = "Slippage > 20bps") {
    if (this.config.slippageBreachEnabled) {
      this.broadcastBreaker(true, "slippage_breach", details);
    }
  }

  triggerManualKill(details = "Manual intervention") {
    if (this.config.manualKillEnabled) {
      this.broadcastBreaker(true, "manual_kill", details);
    }
  }

  clearBreaker() {
    this.broadcastBreaker(false, "unknown");
  }

  updateConfig(newConfig: Partial<ChaosConfig>) {
    this.config = { ...this.config, ...newConfig };
  }

  getConfig() {
    return { ...this.config };
  }
}

export const chaosService = new ChaosService();