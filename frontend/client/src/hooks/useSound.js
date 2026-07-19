import { useRef, useCallback } from 'react';

export function useSound(enabled = true) {
    const ctxRef = useRef(null);

    const getCtx = () => {
        if (!ctxRef.current) {
            ctxRef.current = new (window.AudioContext || window.webkitAudioContext)();
        }
        // resume if suspended because browsers require user gesture first to start audio
        if (ctxRef.current.state === 'suspended') {
            ctxRef.current.resume();
        }
        return ctxRef.current;
    }

    const tone = useCallback((
        frequency = 440,
        duration = 0.12,
        type = 'sine',
        volume = 0.18,
        pitchEnd = null
    ) => {
        if (!enabled) return;
        try{
            const ctx = getCtx();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.type = type;
            osc.frequency.setValueAtTime(frequency, ctx.currentTime);
            if (pitchEnd !== null) {
                osc.frequency.exponentialRampToValueAtTime(pitchEnd, ctx.currentTime + duration);
            }

            gain.gain.setValueAtTime(volume, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

            osc.start(ctx.currentTime);
            osc.stop(ctx.currentTime + duration);
        }
        catch {
            // ignore errors, likely due to browser restrictions on audio context
        }
    }, [enabled])

    // Sound effects 

    // short blip when a directional button is tapped
    const playMove = useCallback(() => {
        tone(320, 0.07, 'square', 0.08, 380)
    }, [tone]);

    // chime when a player reaches PROD, and scores a point
    const playScore = useCallback(() => {
        tone(523, 0.10, 'sine', 0.15, 7.84)
        setTimeout(() => tone(784, 0.12, 'sine', 0.12, 1047), 90);
        setTimeout(() => tone(1047, 0.18, 'sine', 0.10, 1047), 190);
    }, [tone]);

    // buzz when a player dies
    const playDeath = useCallback(() => {
        tone(180, 0.08, 'sawtooth', 0.22, 80)
        setTimeout(() => tone(90, 0.18, 'sawtooth', 0.18, 40), 80);
    }, [tone]);

    // low rumble for game over 
    const playGameOver = useCallback(() => {
        tone(220, 0.15, 'sawtooth', 0.20, 110)
        setTimeout(() => tone(110, 0.25, 'sawtooth', 0.18, 55), 140);
        setTimeout(() => tone(55, 0.40, 'sawtooth', 0.15, 30), 300);
    }, [tone]);

    // click on join sound
    const playJoin = useCallback(() => {
        tone(440, 0.06, 'sine', 0.12, 660)
    }, [tone]);

    return { playMove, playScore, playDeath, playGameOver, playJoin };
}