import React from 'react';
import { GESTURES } from '../utils/gestures';

export default function GestureGuide({ active }) {
  return (
    <div className="guide-panel">
      <div className="log-header">
        <span className="panel-label">Gesture Reference</span>
        <span className="count-badge">{GESTURES.length}</span>
      </div>
      <div className="guide-grid">
        {GESTURES.map(g => (
          <div key={g.name} className={`guide-card ${active === g.name ? 'guide-active' : ''}`}>
            <span className="guide-emoji">{g.emoji}</span>
            <span className="guide-name">{g.name}</span>
            <span className="guide-desc">{g.desc}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
