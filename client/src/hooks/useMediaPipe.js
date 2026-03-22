import { useEffect, useRef } from 'react';

export function useMediaPipe({ onResults, enabled, stream }) {
  const videoRef    = useRef(null);
  const canvasRef   = useRef(null);
  const handsRef    = useRef(null);
  const rafRef      = useRef(null);
  const onResultsRef = useRef(onResults);
  const enabledRef  = useRef(enabled);

  // Keep refs in sync without triggering re-init
  useEffect(() => { onResultsRef.current = onResults; }, [onResults]);
  useEffect(() => { enabledRef.current = enabled; },    [enabled]);

  // Init MediaPipe once when stream arrives
  useEffect(() => {
    if (!stream) return;

    let hands = null;
    let stopped = false;

    async function init() {
      // Attach stream to hidden video
      const video = videoRef.current;
      if (!video) return;
      video.srcObject = stream;
      video.muted = true;

      await new Promise((res) => {
        video.onloadedmetadata = res;
        video.play().catch(() => {});
      });

      if (stopped) return;

      const { Hands, HAND_CONNECTIONS }        = await import('@mediapipe/hands');
      const { drawConnectors, drawLandmarks }  = await import('@mediapipe/drawing_utils');

      hands = new Hands({
        locateFile: (f) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${f}`,
      });

      hands.setOptions({
        maxNumHands: 1,
        modelComplexity: 0,              // 0 = faster, good enough for 8 gestures
        minDetectionConfidence: 0.6,
        minTrackingConfidence: 0.5,
      });

      hands.onResults((results) => {
        const canvas = canvasRef.current;
        if (!canvas || !video) return;

        const ctx = canvas.getContext('2d');
        canvas.width  = video.videoWidth  || 640;
        canvas.height = video.videoHeight || 480;
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const hasHand = results.multiHandLandmarks?.length > 0;

        if (hasHand) {
          const lm = results.multiHandLandmarks[0];
          drawConnectors(ctx, lm, HAND_CONNECTIONS, { color: 'rgba(99,179,237,0.7)', lineWidth: 2 });
          drawLandmarks(ctx, lm,  { color: '#63b3ed', lineWidth: 1, radius: 3 });
        }

        onResultsRef.current({
          hasHand,
          landmarks: hasHand ? results.multiHandLandmarks[0] : null,
        });
      });

      handsRef.current = hands;

      // Manual rAF loop — avoids Camera utility conflicting with existing stream
      async function loop() {
        if (stopped) return;
        if (hands && video.readyState >= 2) {
          await hands.send({ image: video }).catch(() => {});
        }
        rafRef.current = requestAnimationFrame(loop);
      }
      loop();
    }

    init();

    return () => {
      stopped = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      hands?.close?.();
      handsRef.current = null;
    };
  }, [stream]); // only re-init when stream changes

  return { videoRef, canvasRef };
}