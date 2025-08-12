/**
 * Enhanced WebSocket Hook with Reconnection Logic
 * 
 * Provides automatic reconnection with exponential backoff
 * for robust real-time communication
 */

import { useEffect, useRef, useState } from 'react';

interface UseWebSocketOptions {
  url?: string;
  protocols?: string | string[];
  maxReconnectAttempts?: number;
  initialReconnectDelay?: number;
  maxReconnectDelay?: number;
  onOpen?: (event: Event) => void;
  onMessage?: (message: any) => void;
  onError?: (event: Event) => void;
  onClose?: (event: CloseEvent) => void;
  onConnect?: () => void;
}

export function useWebSocket({
  url = `${window.location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.host}/ws`,
  protocols,
  maxReconnectAttempts = 5,
  initialReconnectDelay = 1000,
  maxReconnectDelay = 30000,
  onOpen,
  onMessage,
  onError,
  onClose,
  onConnect,
}: UseWebSocketOptions) {
  const [readyState, setReadyState] = useState<number>(WebSocket.CONNECTING);
  const [reconnectAttempt, setReconnectAttempt] = useState(0);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const shouldReconnectRef = useRef(true);

  const connect = () => {
    try {
      const ws = new WebSocket(url, protocols);
      wsRef.current = ws;

      ws.onopen = (event) => {
        setReadyState(WebSocket.OPEN);
        setReconnectAttempt(0);
        onOpen?.(event);
        onConnect?.(event);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          onMessage?.(data);
        } catch (error) {
          onMessage?.(event);
        }
      };

      ws.onerror = (event) => {
        console.error('WebSocket connection error:', event);
        setReadyState(WebSocket.CLOSED);
        onError?.(event);
      };

      ws.onclose = (event) => {
        setReadyState(WebSocket.CLOSED);
        onClose?.(event);

        // Attempt reconnection if not manually closed and under attempt limit
        if (
          shouldReconnectRef.current &&
          !event.wasClean &&
          reconnectAttempt < maxReconnectAttempts
        ) {
          const delay = Math.min(
            initialReconnectDelay * Math.pow(2, reconnectAttempt),
            maxReconnectDelay
          );

          console.log(`WebSocket reconnecting in ${delay}ms (attempt ${reconnectAttempt + 1}/${maxReconnectAttempts})`);

          reconnectTimeoutRef.current = setTimeout(() => {
            setReconnectAttempt(prev => prev + 1);
            setReadyState(WebSocket.CONNECTING);
            connect();
          }, delay);
        }
      };
    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
      setReadyState(WebSocket.CLOSED);
    }
  };

  const disconnect = () => {
    shouldReconnectRef.current = false;

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (wsRef.current) {
      wsRef.current.close(1000, 'Manual disconnect');
      wsRef.current = null;
    }
  };

  const sendMessage = (message: string | object | ArrayBufferLike | Blob | ArrayBufferView) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      const messageToSend = typeof message === 'object' && !(message instanceof ArrayBuffer) && !(message instanceof Blob) 
        ? JSON.stringify(message) 
        : message;
      wsRef.current.send(messageToSend);
      return true;
    }
    return false;
  };

  useEffect(() => {
    shouldReconnectRef.current = true;
    connect();

    return () => {
      disconnect();
    };
  }, [url]);

  return {
    readyState,
    sendMessage,
    disconnect,
    reconnectAttempt,
    isConnecting: readyState === WebSocket.CONNECTING,
    isOpen: readyState === WebSocket.OPEN,
    isClosing: readyState === WebSocket.CLOSING,
    isClosed: readyState === WebSocket.CLOSED,
    isConnected: readyState === WebSocket.OPEN,
    connectionStatus: readyState === WebSocket.OPEN ? 'connected' : 
                   readyState === WebSocket.CONNECTING ? 'connecting' : 
                   readyState === WebSocket.CLOSING ? 'closing' : 'disconnected',
  };
}