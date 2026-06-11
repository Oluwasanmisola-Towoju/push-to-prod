import { useEffect,  useRef, useCallback, useState } from "react";

// fallback to current hostname ensures it works dynamically on local LANs
const WS_BASE = import.meta.env.VITE_WS_URL || `ws://${window.location.hostname}:8000`
const RECONNECT_BASE_MS = 1000
const RECONNECT_MAX_MS = 16000
const PING_INTERVAL_MS = 15000

export const ConnectionStatus = {
    CONNECTING: 'connecting',
    CONNECTED: 'connected',
    DISCONNECTED: 'disconnected',
    RECONNECTING: 'reconnecting'
}

export function useWebSocket(endpoint = '/ws/player', onMessage) {
    const wsRef = useRef(null);
    const reconnectAttemptRef = useRef(0);
    const reconnectTimerRef = useRef(null);
    const pingTimerRef = useRef(null);
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
            console.warn('[WS] Error:', err);
            ws.close()
        }
    }, [endpoint]); // re run if the endpoint changes

    const send = useCallback((payload) => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify(payload));
            return true
        }
        return false
    }, []);

    const disconnect = useCallback(() => {
        clearTimeout(reconnectTimerRef.current);
        clearInterval(pingTimerRef.current);
        wsRef.current?.close();
        setStatus(ConnectionStatus.DISCONNECTED);
    }, []);

    useEffect(() => {
        connect();
        return disconnect
    }, [connect, disconnect])

    return { send, status }
}