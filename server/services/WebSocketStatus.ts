
import { logger } from '../utils/logger';

interface WSStatus {
  connected: boolean;
  backlogSize: number;
  lastBeatAt: Date | null;
  reconnectCount: number;
  droppedMessages: number;
  maxBacklogSize: number;
}

export class WebSocketStatus {
  private static instance: WebSocketStatus;
  private status: WSStatus;
  private messageQueue: any[] = [];
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private readonly maxQueueSize = 1000;

  public static getInstance(): WebSocketStatus {
    if (!WebSocketStatus.instance) {
      WebSocketStatus.instance = new WebSocketStatus();
    }
    return WebSocketStatus.instance;
  }

  constructor() {
    this.status = {
      connected: false,
      backlogSize: 0,
      lastBeatAt: null,
      reconnectCount: 0,
      droppedMessages: 0,
      maxBacklogSize: this.maxQueueSize
    };
  }

  connect(): void {
    this.status.connected = true;
    this.status.lastBeatAt = new Date();
    this.startHeartbeat();
    logger.info('[WebSocket] Connected');
  }

  disconnect(): void {
    this.status.connected = false;
    this.stopHeartbeat();
    logger.info('[WebSocket] Disconnected');
  }

  reconnect(): void {
    this.status.reconnectCount++;
    this.status.lastBeatAt = new Date();
    logger.info(`[WebSocket] Reconnected (count: ${this.status.reconnectCount})`);
  }

  addMessage(message: any): boolean {
    if (this.messageQueue.length >= this.maxQueueSize) {
      // Drop oldest message when queue is full
      this.messageQueue.shift();
      this.status.droppedMessages++;
      logger.warn('[WebSocket] Dropped message due to backlog limit');
    }

    this.messageQueue.push({
      ...message,
      timestamp: new Date()
    });

    this.status.backlogSize = this.messageQueue.length;
    return true;
  }

  processMessages(batchSize: number = 10): any[] {
    const batch = this.messageQueue.splice(0, batchSize);
    this.status.backlogSize = this.messageQueue.length;
    return batch;
  }

  heartbeat(): void {
    this.status.lastBeatAt = new Date();
  }

  private startHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    this.heartbeatInterval = setInterval(() => {
      this.heartbeat();
    }, 30000); // 30 second heartbeat
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  getStatus(): WSStatus {
    return { ...this.status };
  }

  clearQueue(): void {
    this.messageQueue = [];
    this.status.backlogSize = 0;
    logger.info('[WebSocket] Queue cleared');
  }
}
