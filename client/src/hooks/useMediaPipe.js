import { useEffect, useRef } from 'react';

export function useMediaPipe({ onResults, enabled, stream }) {
  const videoRef     = useRef(null);
  const canvasRef    = useRef(null);
  const onResultsRef = useRef(onResults);
  const enabledRef   = useRef(enabled);

  useEffect(() => { onResultsRef.current = onResults; }, [onResults]);
  useEffect(() => { enabledRef.current   = enabled;   }, [enabled]);

  useEffect(() => {
    if (!stream) { console.log('[MP] no stream yet'); return; }

    let stopped  = false;
    let hands    = null;
    let rafId    = null;

    async function init() {
      const video = videoRef.current;
      const canvas = canvasRef.current;

      if (!video)  { console.error('[MP] videoRef not mounted');  return; }
      if (!canvas) { console.error('[MP] canvasRef not mounted'); return; }

      console.log('[MP] attaching stream to video...');
      video.srcObject = stream;
      video.muted     = true;
      video.playsInline = true;

      try {
        await video.play();
        console.log('[MP] video playing, w×h =', video.videoWidth, video.videoHeight);
      } catch(e) {
        console.error('[MP] video.play() failed:', e);
      }

      // Wait until we have real frame dimensions
      let waited = 0;
      while ((video.videoWidth === 0 || video.videoHeight === 0) && waited < 5000) {
        await new Promise(r => setTimeout(r, 100));
        waited += 100;
      }
      console.log('[MP] video ready, w×h =', video.videoWidth, video.videoHeight);

      if (stopped) return;

      console.log('[MP] loading MediaPipe...');
      const { Hands, HAND_CONNECTIONS }       = await import('@mediapipe/hands');
      const { drawConnectors, drawLandmarks } = await import('@mediapipe/drawing_utils');
      console.log('[MP] MediaPipe loaded');

      hands = new Hands({
        locateFile: (f) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${f}`,
      });

      hands.setOptions({
        maxNumHands: 1,
        modelComplexity: 0,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5,
      });

      hands.onResults((results) => {
        if (!canvas || !video) return;
        const ctx = canvas.getContext('2d');
        canvas.width  = video.videoWidth  || 640;
        canvas.height = video.videoHeight || 480;
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const hasHand = results.multiHandLandmarks?.length > 0;
        if (hasHand) {
          console.log('[MP] HAND DETECTED');
          const lm = results.multiHandLandmarks[0];
          drawConnectors(ctx, lm, HAND_CONNECTIONS, { color: 'rgba(99,179,237,0.9)', lineWidth: 3 });
          drawLandmarks(ctx, lm,  { color: '#ff4444', lineWidth: 2, radius: 5 });
        }

        onResultsRef.current({ hasHand, landmarks: hasHand ? results.multiHandLandmarks[0] : null });
      });

      console.log('[MP] initializing hands model...');
      await hands.initialize();
      console.log('[MP] hands model ready — starting loop');

      async function loop() {
        if (stopped) return;
        try {
          if (video.readyState >= 2 && video.videoWidth > 0) {
            await hands.send({ image: video });
          }
        } catch(e) {
          console.error('[MP] send error:', e);
        }
        rafId = requestAnimationFrame(loop);
      }

      loop();
    }

    init();

    return () => {
      console.log('[MP] cleanup');
      stopped = true;
      if (rafId) cancelAnimationFrame(rafId);
      hands?.close?.();
    };
  }, [stream]);

  return { videoRef, canvasRef };
}