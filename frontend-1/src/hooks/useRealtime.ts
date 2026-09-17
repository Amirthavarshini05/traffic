import { useEffect, useRef, useState, useCallback } from 'react';
import { WS_URL } from '@/lib/constants';
import type { RealtimeEvent } from '@/types';

export type ConnectionState = 'connecting' | 'connected' | 'disconnected';

export function useRealtime(maxEvents: number = 50) {
  const [events, setEvents] = useState<RealtimeEvent[]>([]);
  const [connectionState, setConnectionState] = useState<ConnectionState>('connecting');
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seenEventIdsRef = useRef<Set<string>>(new Set());

  const connect = useCallback(() => {
    if (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) {
      return;
    }

    setConnectionState('connecting');

    try {
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        setConnectionState('connected');
        console.log('[WebSocket] Connected to', WS_URL);
      };

      ws.onmessage = (messageEvent) => {
        try {
          const raw = JSON.parse(messageEvent.data);
          if (!raw) return;

          // Unique event key for deduplication
          const eventKey = `${raw.event_type || 'EVT'}_${raw.trajectory_id || raw.event_id || raw.alert_id || ''}_${raw.timestamp || raw.started_at || Date.now()}`;
          if (seenEventIdsRef.current.has(eventKey)) {
            return;
          }
          seenEventIdsRef.current.add(eventKey);
          if (seenEventIdsRef.current.size > 200) {
            // Cap seen set to avoid memory leak
            const first = seenEventIdsRef.current.values().next().value;
            if (first) seenEventIdsRef.current.delete(first);
          }

          const parsedEvent: RealtimeEvent = {
            trajectory_id: raw.trajectory_id || raw.event_id || Date.now(),
            vehicle_id: String(raw.vehicle_id || 'UNKNOWN'),
            from_camera_id: raw.from_camera_id || raw.camera_id || 'CAM01',
            to_camera_id: raw.to_camera_id || raw.ending_camera_id || 'CAM06',
            start_event_id: raw.start_event_id || 0,
            end_event_id: raw.end_event_id || 0,
            event_type: raw.event_type || 'trajectory_event',
            timestamp: raw.timestamp || raw.started_at || new Date().toISOString(),
          };

          setEvents((prev) => [parsedEvent, ...prev].slice(0, maxEvents));

          // Dispatch event so active pages and context can react
          window.dispatchEvent(new CustomEvent('traffic-realtime-update', { detail: raw }));
        } catch (err) {
          console.warn('[WebSocket] Malformed message received:', err);
        }
      };

      ws.onerror = (err) => {
        console.warn('[WebSocket] Error on', WS_URL, err);
      };

      ws.onclose = () => {
        setConnectionState('disconnected');
        wsRef.current = null;
        // Auto-reconnect after 3 seconds
        if (!reconnectTimeoutRef.current) {
          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectTimeoutRef.current = null;
            connect();
          }, 3000);
        }
      };
    } catch (err) {
      console.warn('[WebSocket] Connection failed:', err);
      setConnectionState('disconnected');
      if (!reconnectTimeoutRef.current) {
        reconnectTimeoutRef.current = setTimeout(() => {
          reconnectTimeoutRef.current = null;
          connect();
        }, 5000);
      }
    }
  }, [maxEvents]);

  useEffect(() => {
    connect();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [connect]);

  return { events, connectionState };
}
