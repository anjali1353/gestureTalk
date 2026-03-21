import React, { useState } from 'react';

export default function OutputPanel({ words, onSpeak, onClear, voiceOn, onVoiceToggle }) {
  const [copied, setCopied] = useState(false);

  const text = words.join('  ·  ') || '—';

  const handleCopy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <div className="output-panel">
      <span className="panel-label">Translated Output</span>
      <div className="output-text">{text}</div>
      <div className="output-actions">
        <button className="btn btn-primary" onClick={onSpeak}>🔊 Speak</button>
        <button className="btn" onClick={handleCopy}>{copied ? '✓ Copied' : '📋 Copy'}</button>
        <button className="btn" onClick={onClear}>Clear</button>
        <button className={`btn ${voiceOn ? 'btn-active' : ''}`} onClick={onVoiceToggle}>
          {voiceOn ? '🔊 Voice ON' : '🔇 Voice OFF'}
        </button>
      </div>
    </div>
  );
}
