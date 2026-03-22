import { useEffect, useRef, useCallback } from 'react';

export function useMediaPipe({ onResults, enabled, stream }) {
  const videoRef  = useRef(null);
  const canvasRef = useRef(null);
  const handsRef  = useRef(null);
  const cameraRef = useRef(null);
  const startedRef = useRef(false);

  const startCamera = useCallback(async () => {
    if (startedRef.current) return;
    if (!videoRef.current || !stream) return;

    startedRef.current = true;

    // Attach stream to hidden video element so MediaPipe can read frames
    videoRef.current.srcObject = stream;
    await videoRef.current.play().catch(() => {});

    const { Hands, HAND_CONNECTIONS } = await import('@mediapipe/hands');
    const { Camera }                  = await import('@mediapipe/camera_utils');
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
      }

      // Always call onResults — enabled check happens in CallRoom
      onResults({ hasHand, landmarks: hasHand ? results.multiHandLandmarks[0] : null });
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
  }, [stream, onResults]);

  useEffect(() => {
    if (stream) startCamera();
    return () => {
      cameraRef.current?.stop?.();
      startedRef.current = false;
    };
  }, [stream, startCamera]);

  return { videoRef, canvasRef };
}