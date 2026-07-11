import { useEffect, useRef, useCallback, useState } from "react";

const WS_SCHEME = window.location.protocol === 'https:' ? 'wss' : 'ws'
const WS_BASE = import.meta.env.VITE_WS_URL || `${WS_SCHEME}://${window.location.hostname}:8000`

export const HostConnectionStatus = {
    CONNECTING: 'connecting',
    CONNECTED: 'connected',
    DISCONNECTED: 'disconnected'
}

export function useHostSocket(onMessage) {
    const wsRef = useRef(null);
    const onMessageRef = useRef(onMessage);
    const pingRef = useRef(null);
    const reconnectTimerRef = useRef(null);
    const shouldReconnectRef = useRef(true);
    const [status, setStatus] = useState(HostConnectionStatus.DISCONNECTED);

    useEffect(() => { onMessageRef.current = onMessage }, [onMessage]);

    useEffect(() => {
        shouldReconnectRef.current = true;

        const connect = () => {
            if (wsRef.current?.readyState === WebSocket.OPEN ||
                wsRef.current?.readyState === WebSocket.CONNECTING
            ) return;

            setStatus(HostConnectionStatus.CONNECTING);
            const ws = new WebSocket(`${WS_BASE}/ws/host`);
            wsRef.current = ws;

            ws.onopen = () => {
                setStatus(HostConnectionStatus.CONNECTED);
                console.debug('[HOST WS] connected', `${WS_BASE}/ws/host`);
                pingRef.current = setInterval(() => {
                    if (ws.readyState === WebSocket.OPEN) {
                        ws.send(JSON.stringify({ type: 'PING' }));
                    }
                }, 15000);
            }

            ws.onmessage = (e) => {
                try {
                    const payload = JSON.parse(e.data);
                    if (payload.type === 'GAME_STATE') {
                        console.debug('[HOST WS] received GAME_STATE', payload.tick, payload.players?.length);
                    }
                    onMessageRef.current?.(payload);
                }
                catch {
                    console.warn('[HOST WS] Parse Error', e.data);
                }
            }

            ws.onclose = () => {
                clearInterval(pingRef.current);
                if (!shouldReconnectRef.current) {
                    setStatus(HostConnectionStatus.DISCONNECTED);
                    return;
                }
                setStatus(HostConnectionStatus.DISCONNECTED);
                reconnectTimerRef.current = setTimeout(connect, 1000);
            }

            ws.onerror = (e) => {
                console.warn('[HOST WS] Error', e);
                ws.close();
            }
        }

        connect();

        return () => {
            shouldReconnectRef.current = false;
            clearInterval(pingRef.current);
            clearTimeout(reconnectTimerRef.current);
            wsRef.current?.close();
        }
    }, []);

    const send = useCallback((payload) => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify(payload));
            return true;
        }
        console.warn('[HOST WS] send failed, socket is not open', payload, wsRef.current?.readyState);
        return false;
    }, []);

    return { send, status }
}