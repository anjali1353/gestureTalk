import React from 'react';

export default function CameraFeed({ videoRef, canvasRef, detectedGesture, confidence }) {
  const pct = Math.round(confidence * 100);

  return (
    <div className="camera-card">
      <div className="video-wrap">
        <video ref={videoRef} autoPlay muted playsInline className="video-el" />
        <canvas ref={canvasRef} className="canvas-el" />

        <div className="overlay-top">
          <div className={`gesture-badge ${detectedGesture ? 'active' : ''}`}>
            {detectedGesture ?? '—'}
          </div>
          <div className="conf-pill">
            <div className="conf-fill" style={{ width: `${pct}%` }} />
            <span className="conf-label">{pct}%</span>
          </div>
        </div>
      </div>
    </div>
  );
}
