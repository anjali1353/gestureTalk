import React, { useEffect, useRef } from 'react';

export default function VideoTile({ stream, label, muted = false, mirror = false, children }) {
  const videoRef = useRef(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <div className="video-tile">
      {stream ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={muted}
          style={{ transform: mirror ? 'scaleX(-1)' : 'none' }}
        />
      ) : (
        <div className="video-placeholder">
          <span>Waiting for {label}…</span>
        </div>
      )}
      <div className="video-label">{label}</div>
      {children}
    </div>
  );
}
