import { useCallback } from 'react';

export function useGestureLogger() {
  const logGesture = useCallback(async (gesture, confidence) => {
    try {
      await fetch('/api/logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gesture,
          confidence,
          timestamp: new Date().toISOString(),
        }),
      });
    } catch (err) {
      console.warn('Log failed (server offline?):', err.message);
    }
  }, []);

  const clearLogs = useCallback(async () => {
    try {
      await fetch('/api/logs', { method: 'DELETE' });
    } catch (err) {
      console.warn('Clear failed:', err.message);
    }
  }, []);

  return { logGesture, clearLogs };
}
