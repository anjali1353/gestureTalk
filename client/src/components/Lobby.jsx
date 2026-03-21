import React, { useState } from 'react';
import socket from '../utils/socket';

export default function Lobby({ onEnterRoom }) {
  const [mode,    setMode]    = useState(null);      // 'create' | 'join'
  const [role,    setRole]    = useState('deaf');
  const [code,    setCode]    = useState('');
  const [inputCode, setInputCode] = useState('');
  const [error,   setError]   = useState('');
  const [loading, setLoading] = useState(false);

  const handleCreate = () => {
    setLoading(true); setError('');
    socket.emit('room:create', { role }, ({ code: newCode, error: err }) => {
      setLoading(false);
      if (err) return setError(err);
      setCode(newCode);
      setMode('created');
    });
  };

  const handleJoin = () => {
    if (!inputCode.trim()) return setError('Enter a room code');
    setLoading(true); setError('');
    socket.emit('room:join', { code: inputCode.trim().toUpperCase(), role }, ({ ok, error: err }) => {
      setLoading(false);
      if (err) return setError(err);
      onEnterRoom({ code: inputCode.trim().toUpperCase(), role });
    });
  };

  const handleStartCall = () => {
    onEnterRoom({ code, role });
  };

  return (
    <div className="lobby">
      <div className="lobby-card">
        <div className="lobby-logo">Gesture<span>Speak</span></div>
        <div className="lobby-sub">Live Sign Language Video Call</div>

        {/* Role picker */}
        {mode !== 'created' && (
          <>
            <div className="lobby-section-label">I am the…</div>
            <div className="role-row">
              <button
                className={`role-btn ${role === 'deaf' ? 'active' : ''}`}
                onClick={() => setRole('deaf')}
              >
                🤟 Deaf / Mute
                <span>I will use sign language</span>
              </button>
              <button
                className={`role-btn ${role === 'hearing' ? 'active' : ''}`}
                onClick={() => setRole('hearing')}
              >
                👂 Hearing
                <span>I will receive translations</span>
              </button>
            </div>
          </>
        )}

        {/* Actions */}
        {!mode && (
          <div className="lobby-actions">
            <button className="btn btn-primary" onClick={handleCreate} disabled={loading}>
              {loading ? 'Creating…' : '+ Create Room'}
            </button>
            <div className="lobby-or">or</div>
            <button className="btn" onClick={() => setMode('join')}>
              Join Existing Room
            </button>
          </div>
        )}

        {/* Join form */}
        {mode === 'join' && (
          <div className="join-form">
            <input
              className="code-input"
              placeholder="Enter room code"
              value={inputCode}
              onChange={e => setInputCode(e.target.value.toUpperCase())}
              onKeyDown={e => e.key === 'Enter' && handleJoin()}
              maxLength={6}
              autoFocus
            />
            <button className="btn btn-primary" onClick={handleJoin} disabled={loading}>
              {loading ? 'Joining…' : 'Join →'}
            </button>
            <button className="btn" onClick={() => setMode(null)}>Back</button>
          </div>
        )}

        {/* Created — show code to share */}
        {mode === 'created' && (
          <div className="created-card">
            <div className="lobby-section-label">Share this code with your partner</div>
            <div className="room-code-display">{code}</div>
            <div className="code-hint">They open the app → Join Room → enter this code</div>
            <button className="btn" style={{ marginBottom: '0.5rem' }} onClick={() => {
              navigator.clipboard.writeText(code);
            }}>📋 Copy Code</button>
            <button className="btn btn-primary" onClick={handleStartCall}>
              I'm ready — Start Call →
            </button>
          </div>
        )}

        {error && <div className="lobby-error">{error}</div>}
      </div>
    </div>
  );
}
