import { useEffect, useRef } from "react";
import { ACTIONS } from "../../shared/inputNormalizer";

const DEAD_ZONE = 0.4;
const POLL_MS = 50 // 20 polls/sec to match server tick rate

export function useGamepad(onAction, enabled = true) { // polls the browser gamepad API at ~60 fps 
    const lastActionRef = useRef(null);
    const timerRef = useRef(null);

    useEffect(() => {
        if (!enabled) return

        const poll = () => {
            const gamepads = navigator.getGamepads?.() || [];
            const gp = Array.from(gamepads).find(Boolean);
            if (!gp) return // no gamepad found

            let action = 'IDLE' // default state

            // D-pad buttons for standard mapping
            // 12 (up), 13 (down), 14 (left), 15 (right)
            if (gp.buttons[12]?.pressed) action = ACTIONS.MOVE_UP
            else if (gp.buttons[13]?.pressed) action = ACTIONS.MOVE_DOWN
            else if (gp.buttons[14]?.pressed) action = ACTIONS.MOVE_LEFT
            else if (gp.buttons[15]?.pressed) action = ACTIONS.MOVE_RIGHT

            // left stick of gamepad
            // axes[0] (horizontal), axes[1] (vertical)
            else if (gp.axes[1] < -DEAD_ZONE) action = ACTIONS.MOVE_UP
            else if (gp.axes[1] > DEAD_ZONE) action = ACTIONS.MOVE_DOWN
            else if (gp.axes[0] < -DEAD_ZONE) action = ACTIONS.MOVE_LEFT
            else if (gp.axes[0] > DEAD_ZONE) action = ACTIONS.MOVE_RIGHT

            // only fire action on change to avoid flooding the server 
            if (action !== ACTIONS.IDLE && action !== lastActionRef.current) {
                lastActionRef.current = action;
                onAction(action);
            }
            else if (action === ACTIONS.IDLE) {
                lastActionRef.current = null
            }
        }

        timerRef.current = setInterval(poll, POLL_MS);
    
        return () => clearInterval(timerRef.current);
    }, [onAction, enabled]);
}