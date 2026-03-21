import React, { useEffect, useRef } from 'react';
import { GESTURES } from '../utils/gestures';
import { useVoice } from '../hooks/useVoice';

export default function TranslationOverlay({ latestGesture, voiceOn }) {
  const { speak } = useVoice();
  const prevRef   = useRef(null);

  useEffect(() => {
    if (!latestGesture || latestGesture.id === prevRef.current) return;
    prevRef.current = latestGesture.id;
    if (voiceOn) speak(latestGesture.gesture, true);
  }, [latestGesture, voiceOn, speak]);

  if (!latestGesture) return null;

  const meta = GESTURES.find(g => g.name === latestGesture.gesture);
  const conf = Math.round(latestGesture.confidence * 100);

  return (
    <div className="translation-overlay">
      <div className="tl-emoji">{meta?.emoji ?? '🤚'}</div>
      <div className="tl-word">{latestGesture.gesture}</div>
      <div className="tl-conf">{conf}% confidence</div>
    </div>
  );
}
