import { useCallback, useRef } from "react";

/** Short two-tone chime used for new orders and guest requests. */
export function useChime() {
  const ctxRef = useRef<AudioContext | null>(null);

  return useCallback((variant: "order" | "request" = "order") => {
    try {
      const Ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      if (!ctxRef.current) ctxRef.current = new Ctor();
      const ctx = ctxRef.current;
      void ctx.resume();
      const now = ctx.currentTime;
      const notes = variant === "order" ? [880, 1174.7] : [660, 990];
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.0001, now + i * 0.18);
        gain.gain.exponentialRampToValueAtTime(0.25, now + i * 0.18 + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.18 + 0.32);
        osc.connect(gain).connect(ctx.destination);
        osc.start(now + i * 0.18);
        osc.stop(now + i * 0.18 + 0.35);
      });
    } catch {
      /* audio is a nice-to-have */
    }
  }, []);
}
