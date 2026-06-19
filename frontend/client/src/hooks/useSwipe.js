import { useEffect, useRef } from 'react';
import { ACTIONS } from '../utils/inputNormalizer';

// Minimum pixel distance required to register as a deliberate swipe rather than a tap
const MIN_SWIPE_DISTANCE = 40;

export function useSwipe(onAction, enabled = true) {
    // Store coordinates in a ref to prevent unnecessary re-renders during the swipe
    const touchStartRef = useRef({ x: null, y: null });

    useEffect(() => {
        if (!enabled) return;

        const handleTouchStart = (e) => {
            // Ignore multi-touch gestures lie pinch to zoom
            if (e.touches.length !== 1) return;

            touchStartRef.current = {
                x: e.touches[0].clientX,
                y: e.touches[0].clientY
            };
        };

        const handleTouchMove = (e) => {
            // Prevent default browser behaviors like scrolling or pull-to-refresh.
            // This ensures the mobile screen acts strictly as a static game controller.
            if (e.touches.length === 1) {
                e.preventDefault();
            }
        };

        const handleTouchEnd = (e) => {
            const { x: startX, y: startY } = touchStartRef.current;

            if (startX === null || startY === null) return;

            // touchend uses changedTouches instead of touches
            const endX = e.changedTouches[0].clientX;
            const endY = e.changedTouches[0].clientY;

            const dx = endX - startX;
            const dy = endY - startY;
            const absDx = Math.abs(dx);
            const absDy = Math.abs(dy);

            // Clear the coordinates for the next swipe
            touchStartRef.current = { x: null, y: null };

            // Enforce dead zone so as to abort if the swipe was too short
            if (Math.max(absDx, absDy) < MIN_SWIPE_DISTANCE) {
                return;
            }

            // Determine dominant axis to prevent diagonal ambiguity
            let action = ACTIONS.IDLE;
            if (absDx > absDy) {
                // Horizontal swipe means right is positive
                action = dx > 0 ? ACTIONS.MOVE_RIGHT : ACTIONS.MOVE_LEFT;
            } else {
                // Vertical swipe (Browser Y-axis: Down is positive)
                action = dy > 0 ? ACTIONS.MOVE_DOWN : ACTIONS.MOVE_UP;
            }

            onAction(action);
        };

        // Attach listeners globally. 
        // { passive: false } is mandatory for touchmove to allow e.preventDefault()
        document.addEventListener('touchstart', handleTouchStart, { passive: false });
        document.addEventListener('touchmove', handleTouchMove, { passive: false });
        document.addEventListener('touchend', handleTouchEnd, { passive: false });

        return () => {
            document.removeEventListener('touchstart', handleTouchStart);
            document.removeEventListener('touchmove', handleTouchMove);
            document.removeEventListener('touchend', handleTouchEnd);
        };
    }, [onAction, enabled]);
}