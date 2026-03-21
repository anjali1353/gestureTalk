import React, { useEffect, useState, useRef } from 'react';
import socket from '../utils/socket';

export default function ConversationLog({ onClear }) {
  const [entries, setEntries] = useState([]);
  const [connected, setConnected] = useState(false);
  const listRef = useRef(null);

  useEffect(() => {
    socket.on('connect',    () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));

    // Load history on connect
    socket.on('gesture:history', (history) => setEntries(history));

    // Stream new gestures in real time
    socket.on('gesture:new', (entry) => {
      setEntries(prev => [entry, ...prev].slice(0, 100));
    });

    socket.on('gesture:cleared', () => setEntries([]));

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('gesture:history');
      socket.off('gesture:new');
      socket.off('gesture:cleared');
    };
  }, []);

  const handleClear = () => {
    onClear?.();
  };

  return (
    <div className="log-panel">
      <div className="log-header">
        <span className="panel-label">Session Log</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
          <span className={`ws-dot ${connected ? 'on' : 'off'}`} title={connected ? 'Server connected' : 'Server offline'} />
          <span className="count-badge">{entries.length}</span>
          <button className="clear-btn" onClick={handleClear}>Clear</button>
        </div>
      </div>

      <div className="log-list" ref={listRef}>
        {entries.length === 0 ? (
          <div className="log-empty">No gestures yet — start detecting</div>
        ) : (
          entries.map(e => (
            <div key={e.id} className="log-entry">
              <span className="log-time">{new Date(e.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
              <span className="log-word">{e.gesture}</span>
              <span className="log-conf">{Math.round(e.confidence * 100)}%</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
