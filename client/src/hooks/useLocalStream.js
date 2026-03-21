import { useState, useEffect } from 'react';

export function useLocalStream() {
  const [stream, setStream]   = useState(null);
  const [error,  setError]    = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let s;
    navigator.mediaDevices
      .getUserMedia({ video: { width: 640, height: 480, facingMode: 'user' }, audio: true })
      .then((mediaStream) => {
        s = mediaStream;
        setStream(mediaStream);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));

    return () => s?.getTracks().forEach(t => t.stop());
  }, []);

  return { stream, error, loading };
}
