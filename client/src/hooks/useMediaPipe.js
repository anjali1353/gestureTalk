import { useEffect, useRef } from 'react';

export function useMediaPipe({ onResults, enabled, stream }) {
  const videoRef     = useRef(null);
  const canvasRef    = useRef(null);
  const onResultsRef = useRef(onResults);
  const enabledRef   = useRef(enabled);

  // Keep latest callbacks in refs — never re-trigger the init effect
  useEffect(() => { onResultsRef.current = onResults; }, [onResults]);
  useEffect(() => { enabledRef.current   = enabled;   }, [enabled]);

  useEffect(() => {
    if (!stream) return;

    let destroyed = false;
    let animId    = null;
    let hands     = null;

    (async () => {
      // ── 1. point hidden video at the live stream ──────────────────────────
      const vid = videoRef.current;
      if (!vid) return;
      vid.srcObject   = stream;
      vid.muted       = true;
      vid.playsInline = true;
      try { await vid.play(); } catch (_) {}

      // wait up to 5 s for real frame data
      for (let i = 0; i < 50 && vid.videoWidth === 0; i++) {
        await new Promise(r => setTimeout(r, 100));
      }
      if (destroyed || vid.videoWidth === 0) return;

      // ── 2. load + configure MediaPipe ────────────────────────────────────
      const { Hands, HAND_CONNECTIONS }       = await import('@mediapipe/hands');
      const { drawConnectors, drawLandmarks } = await import('@mediapipe/drawing_utils');

      hands = new Hands({
        locateFile: f => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${f}`,
      });
      hands.setOptions({
        maxNumHands: 1,
        modelComplexity: 0,
        minDetectionConfidence: 0.5,
        minTrackingConfidence:  0.5,
      });

      // ── 3. results callback ───────────────────────────────────────────────
      hands.onResults(results => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        canvas.width  = vid.videoWidth;
        canvas.height = vid.videoHeight;
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const hasHand = results.multiHandLandmarks?.length > 0;
        if (hasHand) {
          const lm = results.multiHandLandmarks[0];
          drawConnectors(ctx, lm, HAND_CONNECTIONS,
            { color: 'rgba(99,179,237,0.85)', lineWidth: 2 });
          drawLandmarks(ctx, lm,
            { color: '#63b3ed', lineWidth: 1, radius: 4 });
        }
        // always fire — CallRoom decides what to do based on `detecting` state
        onResultsRef.current({
          hasHand,
          landmarks: hasHand ? results.multiHandLandmarks[0] : null,
        });
      });

      await hands.initialize();
      if (destroyed) return;

      // ── 4. drive with requestAnimationFrame ──────────────────────────────
      const tick = async () => {
        if (destroyed) return;
        if (vid.readyState >= 2 && vid.videoWidth > 0) {
          try { await hands.send({ image: vid }); } catch (_) {}
        }
        animId = requestAnimationFrame(tick);
      };
      tick();
    })();

    return () => {
      destroyed = true;
      if (animId) cancelAnimationFrame(animId);
      hands?.close?.();
    };
  }, [stream]); // ← only re-init when stream object changes

  return { videoRef, canvasRef };
}