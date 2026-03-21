import { useEffect, useRef, useCallback } from 'react';

export function useMediaPipe({ onResults, enabled }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const handsRef = useRef(null);
  const cameraRef = useRef(null);

  const startCamera = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current) return;

    const { Hands, HAND_CONNECTIONS } = await import('@mediapipe/hands');
    const { Camera } = await import('@mediapipe/camera_utils');
    const { drawConnectors, drawLandmarks } = await import('@mediapipe/drawing_utils');

    const hands = new Hands({
      locateFile: (f) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${f}`,
    });

    hands.setOptions({
      maxNumHands: 1,
      modelComplexity: 1,
      minDetectionConfidence: 0.65,
      minTrackingConfidence: 0.55,
    });

    hands.onResults((results) => {
      const canvas = canvasRef.current;
      const video  = videoRef.current;
      if (!canvas || !video) return;

      const ctx = canvas.getContext('2d');
      canvas.width  = video.videoWidth  || 640;
      canvas.height = video.videoHeight || 480;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const hasHand = results.multiHandLandmarks?.length > 0;

      if (hasHand) {
        const lm = results.multiHandLandmarks[0];
        drawConnectors(ctx, lm, HAND_CONNECTIONS, { color: 'rgba(99,179,237,0.55)', lineWidth: 2 });
        drawLandmarks(ctx, lm, { color: '#63b3ed', lineWidth: 1, radius: 3 });
        if (enabled) onResults({ hasHand: true, landmarks: lm });
      } else {
        if (enabled) onResults({ hasHand: false, landmarks: null });
      }
    });

    handsRef.current = hands;

    const camera = new Camera(videoRef.current, {
      onFrame: async () => {
        if (handsRef.current) await handsRef.current.send({ image: videoRef.current });
      },
      width: 640,
      height: 480,
    });

    await camera.start();
    cameraRef.current = camera;
  }, [onResults, enabled]);

  useEffect(() => {
    startCamera();
    return () => {
      cameraRef.current?.stop?.();
    };
  }, [startCamera]);

  return { videoRef, canvasRef };
}
