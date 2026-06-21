import { useEffect, useRef, useCallback, useState } from "react";

const WS_BASE = import.meta.env.VITE_WS_URL || `ws://${window.location.hostname}:8000`

export const HostConnectionStatus = {
    CONNECTING: 'connecting',
    CONNECTED: 'connected',
    DISCONNECTED: 'disconnected'
}

export function useHostSocket(onMessage) {
    const wsRef = useRef(null);
    const onMessageRef = useRef(onMessage);
    const pingRef = useRef(null);
    const [status, setStatus] = useState(HostConnectionStatus.DISCONNECTED);

    useEffect(() => { onMessageRef.current = onMessage }, [onMessage]);

    useEffect(() => {
        const ws = new WebSocket(`${WS_BASE}/ws/host`);
        wsRef.current = ws;
        setStatus(HostConnectionStatus.CONNECTING);

        ws.onopen = () => {
            setStatus(HostConnectionStatus.CONNECTED);
            pingRef.current = setInterval(() => {
                if (ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify({ type: 'PING' }))
                }
            }, 15000);
        }

        ws.onmessage = (e) => {
            try {
                const payload = JSON.parse(e.data);
                onMessageRef.current?.(payload);
            }
            catch {
                console.warn('[HOST WS] Parse Error', e.data);
            }
        }

        ws.onclose = () => {
            clearInterval(pingRef.current);
            setStatus(HostConnectionStatus.DISCONNECTED);
        }        

        ws.onerror = (e) => {
            console.warn('[HOST WS] Error', e);
            ws.close();
        }

        return () => {
            clearInterval(pingRef.current);
            ws.close();
        }
    }, []);

    const send = useCallback((payload) => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify(payload));
            return true;
        }
        return false;
    }, []);

    return { send, status }
}