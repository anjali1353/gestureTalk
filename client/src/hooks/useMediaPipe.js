import { useEffect, useRef } from 'react';

export function useMediaPipe({ onResults, stream }) {
  const videoRef     = useRef(null);
  const canvasRef    = useRef(null);
  const onResultsRef = useRef(onResults);
  useEffect(() => { onResultsRef.current = onResults; }, [onResults]);

  useEffect(() => {
    if (!stream) return;

    let destroyed = false;
    let animId    = null;
    let hands     = null;

    async function init() {
      const vid    = videoRef.current;
      const canvas = canvasRef.current;
      if (!vid || !canvas) return;

      // attach stream
      vid.srcObject   = stream;
      vid.muted       = true;
      vid.playsInline = true;
      try { await vid.play(); } catch (_) {}

      // wait for real dimensions
      for (let i = 0; i < 50 && vid.videoWidth === 0; i++)
        await new Promise(r => setTimeout(r, 100));
      if (destroyed || vid.videoWidth === 0) return;

      // Load MediaPipe from CDN scripts (avoids npm version conflict)
      await loadScript('https://cdn.jsdelivr.net/npm/@mediapipe/drawing_utils/drawing_utils.js');
      await loadScript('https://cdn.jsdelivr.net/npm/@mediapipe/hands/hands.js');

      if (destroyed) return;

      // window.Hands is now available from the CDN script
      hands = new window.Hands({
        locateFile: f => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${f}`,
      });

      hands.setOptions({
        maxNumHands:            1,
        modelComplexity:        0,
        minDetectionConfidence: 0.5,
        minTrackingConfidence:  0.5,
      });

      hands.onResults(results => {
        if (!canvas || !vid) return;
        const ctx = canvas.getContext('2d');
        canvas.width  = vid.videoWidth;
        canvas.height = vid.videoHeight;
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const hasHand = results.multiHandLandmarks?.length > 0;
        if (hasHand) {
          const lm = results.multiHandLandmarks[0];
          window.drawConnectors(ctx, lm, window.HAND_CONNECTIONS,
            { color: 'rgba(99,179,237,0.85)', lineWidth: 2 });
          window.drawLandmarks(ctx, lm,
            { color: '#63b3ed', lineWidth: 1, radius: 4 });
        }
        onResultsRef.current({
          hasHand,
          landmarks: hasHand ? results.multiHandLandmarks[0] : null,
        });
      });

      await hands.initialize();
      if (destroyed) return;

      const tick = async () => {
        if (destroyed) return;
        if (vid.readyState >= 2 && vid.videoWidth > 0) {
          try { await hands.send({ image: vid }); } catch (_) {}
        }
        animId = requestAnimationFrame(tick);
      };
      tick();
    }

    init();

    return () => {
      destroyed = true;
      if (animId) cancelAnimationFrame(animId);
      hands?.close?.();
    };
  }, [stream]);

  return { videoRef, canvasRef };
}

// helper: load a script tag once
function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve();
    const s = document.createElement('script');
    s.src = src;
    s.crossOrigin = 'anonymous';
    s.onload  = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
  });
}