import type { SSEEvent, SSEEventType } from '@/types';

type SSECallback = (event: SSEEvent) => void;

class SSEClient {
  private eventSource: EventSource | null = null;
  private callbacks: Map<SSEEventType | 'all', Set<SSECallback>> = new Map();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;

  connect(url: string = '/api/events/stream') {
    if (this.eventSource) {
      this.disconnect();
    }

    this.eventSource = new EventSource(url);

    this.eventSource.onopen = () => {
      console.log('SSE connected');
      this.reconnectAttempts = 0;
    };

    this.eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as SSEEvent;
        this.emit(data);
      } catch (error) {
        console.error('Failed to parse SSE message:', error);
      }
    };

    this.eventSource.onerror = () => {
      console.error('SSE connection error');
      this.eventSource?.close();
      this.attemptReconnect(url);
    };

    // Handle specific event types
    const eventTypes: SSEEventType[] = [
      'auction_created',
      'bid_placed',
      'auction_closed',
      'trade_created',
      'trade_completed',
      'agent_decision',
    ];

    eventTypes.forEach((type) => {
      this.eventSource?.addEventListener(type, (event) => {
        try {
          const messageEvent = event as MessageEvent;
          const data: SSEEvent = {
            type,
            data: JSON.parse(messageEvent.data),
            timestamp: new Date().toISOString(),
          };
          this.emit(data);
        } catch (error) {
          console.error(`Failed to parse ${type} event:`, error);
        }
      });
    });
  }

  private attemptReconnect(url: string) {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
      console.log(`Attempting to reconnect in ${delay}ms (attempt ${this.reconnectAttempts})`);
      setTimeout(() => this.connect(url), delay);
    } else {
      console.error('Max reconnection attempts reached');
    }
  }

  disconnect() {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
  }

  subscribe(eventType: SSEEventType | 'all', callback: SSECallback): () => void {
    if (!this.callbacks.has(eventType)) {
      this.callbacks.set(eventType, new Set());
    }
    this.callbacks.get(eventType)!.add(callback);

    // Return unsubscribe function
    return () => {
      this.callbacks.get(eventType)?.delete(callback);
    };
  }

  private emit(event: SSEEvent) {
    // Emit to specific event type subscribers
    this.callbacks.get(event.type)?.forEach((callback) => callback(event));
    // Emit to 'all' subscribers
    this.callbacks.get('all')?.forEach((callback) => callback(event));
  }

  get isConnected(): boolean {
    return this.eventSource?.readyState === EventSource.OPEN;
  }
}

// Singleton instance
export const sseClient = new SSEClient();

// React hook for SSE
import { useEffect, useState, useCallback } from 'react';

export function useSSE<T = unknown>(eventType: SSEEventType | 'all' = 'all') {
  const [lastEvent, setLastEvent] = useState<SSEEvent | null>(null);
  const [events, setEvents] = useState<SSEEvent[]>([]);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    // Connect if not already connected
    if (!sseClient.isConnected) {
      sseClient.connect();
    }
    setIsConnected(sseClient.isConnected);

    const unsubscribe = sseClient.subscribe(eventType, (event) => {
      setLastEvent(event);
      setEvents((prev) => [event, ...prev].slice(0, 100)); // Keep last 100 events
    });

    // Check connection status periodically
    const interval = setInterval(() => {
      setIsConnected(sseClient.isConnected);
    }, 1000);

    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, [eventType]);

  const clearEvents = useCallback(() => {
    setEvents([]);
    setLastEvent(null);
  }, []);

  return {
    lastEvent: lastEvent as (SSEEvent & { data: T }) | null,
    events: events as (SSEEvent & { data: T })[],
    isConnected,
    clearEvents,
  };
}
