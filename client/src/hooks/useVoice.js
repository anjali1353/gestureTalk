import { useCallback, useRef } from 'react';

export function useVoice() {
  const lastSpokenRef = useRef(null);
  const lastTimeRef   = useRef(0);
  const COOLDOWN      = 2200; // ms

  const speak = useCallback((text, force = false) => {
    if (!('speechSynthesis' in window)) return;
    const now = Date.now();
    if (!force && text === lastSpokenRef.current && now - lastTimeRef.current < COOLDOWN) return;

    window.speechSynthesis.cancel();
    const utt      = new SpeechSynthesisUtterance(text);
    utt.rate       = 0.92;
    utt.pitch      = 1.0;
    utt.volume     = 1.0;

    lastSpokenRef.current = text;
    lastTimeRef.current   = now;
    window.speechSynthesis.speak(utt);
  }, []);

  const cancel = useCallback(() => {
    window.speechSynthesis?.cancel();
  }, []);

  return { speak, cancel };
}
