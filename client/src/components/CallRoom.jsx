import React, { useState, useCallback, useRef, useEffect } from 'react';
import VideoTile           from './VideoTile';
import TranslationOverlay  from './TranslationOverlay';
import ConversationLog     from './ConversationLog';
import GestureGuide        from './GestureGuide';
import { useLocalStream }      from '../hooks/useLocalStream';
import { usePeerConnection }   from '../hooks/usePeerConnection';
import { useMediaPipe }        from '../hooks/useMediaPipe';
import { useVoice }            from '../hooks/useVoice';
import { useGestureLogger }    from '../hooks/useGestureLogger';
import { classifyGesture }     from '../utils/gestures';
import socket from '../utils/socket';

const SPEAK_COOLDOWN = 2200;

export default function CallRoom({ code, role, onLeave }) {
  const isDeaf    = role === 'deaf';

  // ── STATE ──────────────────────────────────────────────────────────────────
  const [detecting,       setDetecting]       = useState(false);
  const [voiceOn,         setVoiceOn]         = useState(true);
  const [detectedGesture, setDetectedGesture] = useState(null);
  const [confidence,      setConfidence]      = useState(0);
  const [latestIncoming,  setLatestIncoming]  = useState(null);
  const [replyText,       setReplyText]       = useState('');
  const [replyDisplay,    setReplyDisplay]    = useState('');
  const [peerLabel,       setPeerLabel]       = useState(isDeaf ? 'Hearing partner' : 'Deaf partner');
  const [callLog,         setCallLog]         = useState([]);

  const lastGestureRef = useRef(null);
  const lastTimeRef    = useRef(0);

  // ── STREAMS + WEBRTC ───────────────────────────────────────────────────────
  const { stream: localStream, error: streamError } = useLocalStream();
  const { remoteStream, peerStatus } = usePeerConnection({ code, role, localStream });

  // ── MEDIAPIPE (deaf only) ──────────────────────────────────────────────────
  const { speak } = useVoice();
  const { logGesture } = useGestureLogger();

  const handleResults = useCallback(({ hasHand, landmarks }) => {
    if (!hasHand || !landmarks || !detecting) {
      setDetectedGesture(null); setConfidence(0); return;
    }
    const { gesture, confidence: conf } = classifyGesture(landmarks);
    if (!gesture) { setDetectedGesture(null); setConfidence(0); return; }

    setDetectedGesture(gesture);
    setConfidence(conf);

    const now = Date.now();
    const isNew = gesture !== lastGestureRef.current || (now - lastTimeRef.current) > SPEAK_COOLDOWN;
    if (isNew) {
      lastGestureRef.current = gesture;
      lastTimeRef.current    = now;

      // Emit to server → relay to hearing partner
      socket.emit('gesture:detected', { code, gesture, confidence: conf });

      // Own log entry
      const entry = { gesture, confidence: conf, timestamp: new Date().toISOString(), id: Date.now(), source: 'self' };
      setCallLog(prev => [entry, ...prev].slice(0, 100));
      logGesture(gesture, conf);
    }
  }, [detecting, code, logGesture]);

  const { videoRef, canvasRef } = useMediaPipe({
    onResults: handleResults,
    enabled: detecting && isDeaf,
  });

  // ── SOCKET LISTENERS ───────────────────────────────────────────────────────
  useEffect(() => {
    // Hearing side: receive gesture from deaf partner
    socket.on('gesture:incoming', (entry) => {
      setLatestIncoming(entry);
      setCallLog(prev => [{ ...entry, source: 'partner' }, ...prev].slice(0, 100));
    });

    // Deaf side: receive typed reply from hearing partner
    socket.on('reply:incoming', ({ text, timestamp }) => {
      setReplyDisplay(text);
      setCallLog(prev => [{ gesture: `"${text}"`, confidence: 1, timestamp, id: Date.now(), source: 'reply' }, ...prev].slice(0, 100));
      setTimeout(() => setReplyDisplay(''), 6000);
    });

    socket.on('peer:joined', ({ role: r }) => {
      setPeerLabel(r === 'deaf' ? 'Deaf partner' : 'Hearing partner');
    });

    return () => {
      socket.off('gesture:incoming');
      socket.off('reply:incoming');
      socket.off('peer:joined');
    };
  }, []);

  // ── REPLY (hearing → deaf) ─────────────────────────────────────────────────
  const sendReply = () => {
    if (!replyText.trim()) return;
    socket.emit('reply:send', { code, text: replyText.trim() });
    setCallLog(prev => [{
      gesture: `"${replyText.trim()}"`, confidence: 1,
      timestamp: new Date().toISOString(), id: Date.now(), source: 'self-reply'
    }, ...prev].slice(0, 100));
    setReplyText('');
  };

  // ── RENDER ─────────────────────────────────────────────────────────────────
  if (streamError) return (
    <div className="call-error">Camera error: {streamError}. Please allow camera access and reload.</div>
  );

  return (
    <div className="call-room">

      {/* Header */}
      <div className="call-header">
        <div className="logo">Gesture<span>Speak</span>
          <span className="room-pill">{code}</span>
        </div>
        <div className="call-header-center">
          <div className={`peer-status ${peerStatus}`}>
            <span className="peer-dot" />
            {peerStatus === 'connected'     ? `Connected with ${peerLabel}` :
             peerStatus === 'disconnected'  ? `${peerLabel} left` :
             `Waiting for ${peerLabel}…`}
          </div>
        </div>
        <div className="call-header-right">
          {isDeaf && (
            <button
              className={`ctrl-btn ${detecting ? 'stop' : 'start'}`}
              onClick={() => setDetecting(d => !d)}
            >
              {detecting ? '⏹ Stop' : '▶ Detect'}
            </button>
          )}
          <button
            className={`ctrl-btn ${voiceOn ? 'active' : ''}`}
            onClick={() => setVoiceOn(v => !v)}
          >
            {voiceOn ? '🔊' : '🔇'}
          </button>
          <button className="ctrl-btn danger" onClick={onLeave}>Leave</button>
        </div>
      </div>

      {/* Main grid */}
      <div className="call-grid">

        {/* Left: videos */}
        <div className="videos-col">

          {/* Remote video (big) */}
          <VideoTile stream={remoteStream} label={peerLabel}>
            {/* Hearing side: show translation overlay on top of deaf person's video */}
            {!isDeaf && latestIncoming && (
              <TranslationOverlay
                latestGesture={latestIncoming}
                voiceOn={voiceOn}
              />
            )}
            {/* Deaf side: show reply from hearing person */}
            {isDeaf && replyDisplay && (
              <div className="reply-overlay">{replyDisplay}</div>
            )}
          </VideoTile>

          {/* Local video (small, deaf has canvas overlay) */}
          <div className="local-video-wrap">
            {isDeaf ? (
              <div className="video-tile small">
                <video ref={videoRef} autoPlay muted playsInline style={{ transform: 'scaleX(-1)' }} />
                <canvas ref={canvasRef} className="canvas-el" />
                <div className="video-label">You (deaf)</div>
                {detectedGesture && detecting && (
                  <div className="self-gesture-badge">{detectedGesture} · {Math.round(confidence * 100)}%</div>
                )}
              </div>
            ) : (
              <VideoTile stream={localStream} label="You (hearing)" muted mirror />
            )}
          </div>

          {/* Hearing: type reply */}
          {!isDeaf && (
            <div className="reply-bar">
              <input
                className="reply-input"
                placeholder="Type a reply… (Enter to send)"
                value={replyText}
                onChange={e => setReplyText(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && sendReply()}
              />
              <button className="btn btn-primary" onClick={sendReply}>Send</button>
            </div>
          )}
        </div>

        {/* Right: guide + log */}
        <div className="call-sidebar">
          {isDeaf && <GestureGuide active={detectedGesture} />}
          <div className="call-log-panel">
            <div className="log-header">
              <span className="panel-label">Live conversation</span>
              <span className="count-badge">{callLog.length}</span>
            </div>
            <div className="log-list">
              {callLog.length === 0
                ? <div className="log-empty">Conversation will appear here</div>
                : callLog.map(e => (
                  <div key={e.id} className={`log-entry log-${e.source}`}>
                    <span className="log-time">{new Date(e.timestamp).toLocaleTimeString([], { hour:'2-digit', minute:'2-digit', second:'2-digit' })}</span>
                    <span className="log-word">{e.gesture}</span>
                    {e.source !== 'reply' && e.source !== 'self-reply' && (
                      <span className="log-conf">{Math.round(e.confidence * 100)}%</span>
                    )}
                  </div>
                ))
              }
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
