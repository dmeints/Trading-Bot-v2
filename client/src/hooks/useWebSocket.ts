/**
 * Enhanced WebSocket Hook with Reconnection Logic
 * 
 * Provides automatic reconnection with exponential backoff
 * for robust real-time communication
 */

import { useEffect, useRef, useState } from 'react';

interface UseWebSocketOptions {
  url: string;
  protocols?: string | string[];
  maxReconnectAttempts?: number;
  initialReconnectDelay?: number;
  maxReconnectDelay?: number;
  onOpen?: (event: Event) => void;
  onMessage?: (event: MessageEvent) => void;
  onError?: (event: Event) => void;
  onClose?: (event: CloseEvent) => void;
}

export function useWebSocket({
  url,
  protocols,
  maxReconnectAttempts = 5,
  initialReconnectDelay = 1000,
  maxReconnectDelay = 30000,
  onOpen,
  onMessage,
  onError,
  onClose,
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
      };

      ws.onmessage = (event) => {
        onMessage?.(event);
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

  const sendMessage = (message: string | ArrayBufferLike | Blob | ArrayBufferView) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(message);
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
  };
}