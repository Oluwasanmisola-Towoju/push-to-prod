import { useEffect, useRef, useCallback, useState } from "react";

// fallback to current hostname ensures it works dynamically on local LANs
const WS_SCHEME = window.location.protocol === 'https:' ? 'wss' : 'ws'
const WS_BASE = import.meta.env.VITE_WS_URL || `${WS_SCHEME}://${window.location.hostname}:8000`
const RECONNECT_BASE_MS = 1000
const RECONNECT_MAX_MS = 16000
const PING_INTERVAL_MS = 15000

export const ConnectionStatus = {
    CONNECTING: 'connecting',
    CONNECTED: 'connected',
    DISCONNECTED: 'disconnected',
    RECONNECTING: 'reconnecting'
}

export function useWebSocket(endpoint = 'ws/player', onMessage) {
    const wsRef = useRef(null);
    const reconnectAttemptRef = useRef(0);
    const reconnectTimerRef = useRef(null);
    const pingTimerRef = useRef(null);
    const shouldReconnectRef = useRef(true);
    const onMessageRef = useRef(onMessage);
    const [status, setStatus] = useState(ConnectionStatus.DISCONNECTED)

    // keep callback ref fresh without causing reconnects
    useEffect(() => { onMessageRef.current = onMessage }, [onMessage]);

    const connect = useCallback(() => {
        // don't open a seconnd socket if one is already open/connecting
        if (wsRef.current?.readyState === WebSocket.OPEN ||
            wsRef.current?.readyState === WebSocket.CONNECTING
        ) return

        setStatus(ConnectionStatus.CONNECTING);
        const ws = new WebSocket(`${WS_BASE}${endpoint}`);
        wsRef.current = ws

        ws.onopen = () => {
            reconnectAttemptRef.current = 0;
            setStatus(ConnectionStatus.CONNECTED);
            console.debug('[WS] connected', `${WS_BASE}${endpoint}`);

            // start keep-alive ping
            pingTimerRef.current = setInterval(() => {
                if (ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify({ type: 'PING' }));
                }
            }, PING_INTERVAL_MS)
        }

        ws.onmessage = (event) => {
            try {
                const payload = JSON.parse(event.data);
                onMessageRef.current?.(payload);
            }
            catch {
                console.warn('[WS] Failed to parse message:', event.data)
            }
        }

        ws.onclose = () => {
            clearInterval(pingTimerRef.current);
            if (!shouldReconnectRef.current) return;

            setStatus(ConnectionStatus.RECONNECTING);
            const delay = Math.min(
                RECONNECT_BASE_MS * 2 ** reconnectAttemptRef.current,
                RECONNECT_MAX_MS
            );
            reconnectAttemptRef.current++;
            console.log(`[WS] Reconnecting in ${delay}ms (attempt ${reconnectAttemptRef.current})`);
            reconnectTimerRef.current = setTimeout(connect, delay);
        }

        ws.onerror = (err) => {
            if (!shouldReconnectRef.current) return;
            console.warn('[WS] Error:', err);
            ws.close()
        }
    }, [endpoint]); // re run if the endpoint changes

    const send = useCallback((payload) => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify(payload));
            return true
        }
        console.warn('[WS] send failed, socket is not open', payload, wsRef.current?.readyState)
        return false
    }, []);

    const disconnect = useCallback(() => {
        shouldReconnectRef.current = false;
        clearTimeout(reconnectTimerRef.current);
        clearInterval(pingTimerRef.current);
        wsRef.current?.close();
        wsRef.current = null;
        setStatus(ConnectionStatus.DISCONNECTED);
    }, []);

    useEffect(() => {
        shouldReconnectRef.current = true;
        connect();
        return () => {
            disconnect();
        }
    }, [connect, disconnect])

    return { send, status }
}