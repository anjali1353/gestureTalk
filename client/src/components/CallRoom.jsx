import React, { useState, useRef, useEffect, useCallback } from 'react';
import GestureGuide from './GestureGuide';
import { useLocalStream }    from '../hooks/useLocalStream';
import { usePeerConnection } from '../hooks/usePeerConnection';
import { useMediaPipe }      from '../hooks/useMediaPipe';
import { useVoice }          from '../hooks/useVoice';
import { useGestureLogger }  from '../hooks/useGestureLogger';
import { classifyGesture, GESTURES } from '../utils/gestures';
import socket from '../utils/socket';

const COOLDOWN = 2200;

export default function CallRoom({ code, role, onLeave }) {
  const isDeaf = role === 'deaf';

  const [detecting,       setDetecting]       = useState(false);
  const [voiceOn,         setVoiceOn]         = useState(true);
  const [detectedGesture, setDetectedGesture] = useState(null);
  const [confidence,      setConfidence]      = useState(0);
  const [outputWords,     setOutputWords]     = useState([]);
  const [latestIncoming,  setLatestIncoming]  = useState(null);
  const [replyText,       setReplyText]       = useState('');
  const [replyDisplay,    setReplyDisplay]    = useState('');
  const [peerLabel,       setPeerLabel]       = useState(isDeaf ? 'Hearing partner' : 'Deaf partner');
  const [callLog,         setCallLog]         = useState([]);
  const [peerStatus,      setPeerStatus]      = useState('waiting');

  const lastGRef = useRef(null);
  const lastTRef = useRef(0);
  const detectingRef = useRef(detecting);
  const voiceRef     = useRef(voiceOn);
  useEffect(() => { detectingRef.current = detecting; }, [detecting]);
  useEffect(() => { voiceRef.current     = voiceOn;   }, [voiceOn]);

  // video element refs
  const localVideoRef  = useRef(null);
  const remoteVideoRef = useRef(null);

  const { stream: localStream, error: streamError } = useLocalStream();
  const { remoteStream } = usePeerConnection({ code, role, localStream, onStatusChange: setPeerStatus });
  const { speak }        = useVoice();
  const { logGesture }   = useGestureLogger();

  // attach streams to video elements
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
      localVideoRef.current.play().catch(() => {});
    }
  }, [localStream]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
      remoteVideoRef.current.play().catch(() => {});
    }
  }, [remoteStream]);

  // gesture results from MediaPipe
  const handleResults = useCallback(({ hasHand, landmarks }) => {
    if (!hasHand || !landmarks) {
      setDetectedGesture(null); setConfidence(0); return;
    }
    const { gesture, confidence: conf } = classifyGesture(landmarks);
    if (!gesture) { setDetectedGesture(null); setConfidence(0); return; }

    setDetectedGesture(gesture);
    setConfidence(conf);

    if (!detectingRef.current) return;

    const now = Date.now();
    const isNew = gesture !== lastGRef.current || (now - lastTRef.current) > COOLDOWN;
    if (!isNew) return;

    lastGRef.current = gesture;
    lastTRef.current = now;

    setOutputWords(prev => [...prev, gesture].slice(-5));
    socket.emit('gesture:detected', { code, gesture, confidence: conf });
    setCallLog(prev => [
      { gesture, confidence: conf, timestamp: new Date().toISOString(), id: Date.now(), source: 'self' },
      ...prev
    ].slice(0, 100));
    logGesture(gesture, conf);
    if (voiceRef.current) speak(gesture);
  }, [code, speak, logGesture]);

  // MediaPipe — hidden video ref + canvas ref
  const { videoRef: mpVideoRef, canvasRef } = useMediaPipe({
    onResults: handleResults,
    enabled: detecting,
    stream: isDeaf ? localStream : null,
  });

  // socket events
  useEffect(() => {
    socket.on('gesture:incoming', entry => {
      setLatestIncoming(entry);
      setCallLog(prev => [{ ...entry, source: 'partner' }, ...prev].slice(0, 100));
      if (voiceRef.current && !isDeaf) speak(entry.gesture);
    });
    socket.on('reply:incoming', ({ text, timestamp }) => {
      setReplyDisplay(text);
      setCallLog(prev => [
        { gesture: `"${text}"`, confidence: 1, timestamp, id: Date.now(), source: 'reply' },
        ...prev
      ].slice(0, 100));
      setTimeout(() => setReplyDisplay(''), 5000);
    });
    socket.on('peer:joined', ({ role: r }) =>
      setPeerLabel(r === 'deaf' ? 'Deaf partner' : 'Hearing partner')
    );
    return () => {
      socket.off('gesture:incoming');
      socket.off('reply:incoming');
      socket.off('peer:joined');
    };
  }, [isDeaf, speak]);

  const sendReply = () => {
    if (!replyText.trim()) return;
    socket.emit('reply:send', { code, text: replyText.trim() });
    setCallLog(prev => [
      { gesture: `"${replyText.trim()}"`, confidence: 1, timestamp: new Date().toISOString(), id: Date.now(), source: 'self-reply' },
      ...prev
    ].slice(0, 100));
    setReplyText('');
  };

  const pct  = Math.round(confidence * 100);
  const meta = GESTURES.find(g => g.name === detectedGesture);

  if (streamError) return <div className="call-error">Camera error: {streamError}</div>;

  return (
    <div className="call-room">

      {/* ── HEADER ── */}
      <div className="call-header">
        <div className="logo">Gesture<span>Speak</span>
          <span className="room-pill">{code}</span>
        </div>
        <div className="call-header-center">
          <div className={`peer-status ${peerStatus}`}>
            <span className="peer-dot" />
            {peerStatus === 'connected'    ? `Connected with ${peerLabel}` :
             peerStatus === 'disconnected' ? `${peerLabel} left` :
             `Waiting for ${peerLabel}…`}
          </div>
        </div>
        <div className="call-header-right">
          {isDeaf && (
            <button className={`ctrl-btn ${detecting ? 'stop' : 'start'}`}
              onClick={() => setDetecting(d => !d)}>
              {detecting ? '⏹ Stop' : '▶ Detect'}
            </button>
          )}
          <button className={`ctrl-btn ${voiceOn ? 'active' : ''}`}
            onClick={() => setVoiceOn(v => !v)}>
            {voiceOn ? '🔊' : '🔇'}
          </button>
          <button className="ctrl-btn danger" onClick={onLeave}>Leave</button>
        </div>
      </div>

      {/* ── BODY ── */}
      <div className="call-body">

        {/* ── LEFT: stacked videos ── */}
        <div className="call-videos">

          {/* remote (top, big) */}
          <div className="call-video-tile call-remote">
            <video ref={remoteVideoRef} autoPlay playsInline
              style={{ width:'100%', height:'100%', objectFit:'cover', display:'block' }} />
            {!remoteStream && (
              <div className="video-placeholder"><span>Waiting for {peerLabel}…</span></div>
            )}
            <div className="video-label">{peerLabel}</div>

            {/* translation pop — hearing side */}
            {!isDeaf && latestIncoming && (
              <div className="tl-overlay">
                <span className="tl-emoji">{GESTURES.find(g => g.name === latestIncoming.gesture)?.emoji ?? '🤚'}</span>
                <span className="tl-word">{latestIncoming.gesture}</span>
                <span className="tl-conf">{Math.round(latestIncoming.confidence * 100)}%</span>
              </div>
            )}

            {/* reply pop — deaf side */}
            {isDeaf && replyDisplay && (
              <div className="reply-pop">{replyDisplay}</div>
            )}
          </div>

          {/* local (bottom, small) */}
          <div className="call-video-tile call-local">
            {/* visible preview */}
            <video ref={localVideoRef} autoPlay muted playsInline
              style={{ width:'100%', height:'100%', objectFit:'cover', display:'block', transform:'scaleX(-1)' }} />
            {/* hidden mediapipe feed */}
            <video ref={mpVideoRef} autoPlay muted playsInline
              style={{ position:'absolute', opacity:0, width:1, height:1, pointerEvents:'none' }} />
            {/* skeleton overlay */}
            <canvas ref={canvasRef}
              style={{ position:'absolute', inset:0, width:'100%', height:'100%', transform:'scaleX(-1)', pointerEvents:'none' }} />
            <div className="video-label">You ({role}){isDeaf && detecting ? ' 🔴' : ''}</div>
            {isDeaf && detectedGesture && detecting && (
              <div className="self-gesture-badge">{meta?.emoji} {detectedGesture} · {pct}%</div>
            )}
          </div>

          {/* reply bar — hearing only */}
          {!isDeaf && (
            <div className="reply-bar">
              <input className="reply-input" placeholder="Type reply… (Enter to send)"
                value={replyText} onChange={e => setReplyText(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && sendReply()} />
              <button className="btn btn-primary" onClick={sendReply}>Send</button>
            </div>
          )}
        </div>

        {/* ── MIDDLE: output + confidence (deaf only) ── */}
        {isDeaf && (
          <div className="call-output-col">

            {/* big detected word */}
            <div className="output-panel">
              <span className="panel-label">Translated output</span>
              <div className="output-text">
                {outputWords.length > 0 ? outputWords.join('  ·  ') : '—'}
              </div>
              <div className="conf-section">
                <div className="conf-header">
                  <span className="panel-label">Confidence</span>
                  <span style={{ fontFamily:'DM Mono, monospace', fontSize:'0.78rem', color:'var(--accent3)' }}>{pct}%</span>
                </div>
                <div className="conf-bar-bg">
                  <div className="conf-bar-fill" style={{ width:`${pct}%` }} />
                </div>
              </div>
              <div className="output-actions">
                <button className="btn btn-primary"
                  onClick={() => outputWords.length && speak(outputWords.join(', '), true)}>
                  🔊 Speak
                </button>
                <button className="btn" onClick={() => {
                  setOutputWords([]); setDetectedGesture(null); setConfidence(0);
                }}>Clear</button>
              </div>
            </div>

            {/* conversation log */}
            <div className="log-panel" style={{ flex:1, minHeight:0 }}>
              <div className="log-header">
                <span className="panel-label">Live conversation</span>
                <span className="count-badge">{callLog.length}</span>
              </div>
              <div className="log-list">
                {callLog.length === 0
                  ? <div className="log-empty">No gestures yet</div>
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
        )}

        {/* ── RIGHT: gesture guide ── */}
        <div className="call-sidebar">
          <GestureGuide active={detectedGesture} />
          {!isDeaf && (
            <div className="log-panel" style={{ flex:1, minHeight:0 }}>
              <div className="log-header">
                <span className="panel-label">Live conversation</span>
                <span className="count-badge">{callLog.length}</span>
              </div>
              <div className="log-list">
                {callLog.length === 0
                  ? <div className="log-empty">Gestures will appear here</div>
                  : callLog.map(e => (
                    <div key={e.id} className={`log-entry log-${e.source}`}>
                      <span className="log-time">{new Date(e.timestamp).toLocaleTimeString([], { hour:'2-digit', minute:'2-digit', second:'2-digit' })}</span>
                      <span className="log-word">{e.gesture}</span>
                    </div>
                  ))
                }
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}