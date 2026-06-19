import { useEffect } from "react";
import { ACTIONS } from "../../shared/inputNormalizer";

// listens for WASD or Arrow keys presses and fires an onAction callback

// normalized to the same action strings as gamepad inputs
const KEY_MAP = {
    ArrowUp: ACTIONS.MOVE_UP, w: ACTIONS.MOVE_UP, W: ACTIONS.MOVE_UP,
    ArrowDown: ACTIONS.MOVE_DOWN, s: ACTIONS.MOVE_DOWN, S: ACTIONS.MOVE_DOWN,
    ArrowLeft: ACTIONS.MOVE_LEFT, a: ACTIONS.MOVE_LEFT, A: ACTIONS.MOVE_LEFT,
    ArrowRight: ACTIONS.MOVE_RIGHT, d: ACTIONS.MOVE_RIGHT, D: ACTIONS.MOVE_RIGHT
}

export function useKeyboard(onAction, enabled = true) {
    useEffect(() => {
        if (!enabled) return 

        const handleKeyDown = (e) => {

            if (e.repeat) return;

            const action = KEY_MAP[e.key]
            if (action) {
                e.preventDefault();
                onAction(action);
            }
        }

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onAction, enabled]);
}