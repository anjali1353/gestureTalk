import React, { useEffect, useRef } from 'react';

export default function VideoTile({ stream, label, muted = false, mirror = false, children }) {
  const videoRef = useRef(null);

  useEffect(() => {
    if (!videoRef.current || !stream) return;
    videoRef.current.srcObject = stream;
    // Force play — critical for remote streams on some browsers
    videoRef.current.play().catch(() => {});
  }, [stream]);

  return (
    <div className="video-tile">
      {/* Always render video element — hide it when no stream so it's ready instantly */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={muted}
        style={{
          transform: mirror ? 'scaleX(-1)' : 'none',
          display: stream ? 'block' : 'none',
          width: '100%',
          height: '100%',
          objectFit: 'cover',
        }}
      />
      {!stream && (
        <div className="video-placeholder">
          <span>Waiting for {label}…</span>
        </div>
      )}
      <div className="video-label">{label}</div>
      {children}
    </div>
  );
}