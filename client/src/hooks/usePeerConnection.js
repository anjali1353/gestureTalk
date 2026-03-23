import { useEffect, useRef, useCallback, useState } from 'react';
import socket from '../utils/socket';

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

export function usePeerConnection({ code, role, localStream, onStatusChange }) {
  const pcRef             = useRef(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [peerStatus, setPeerStatus]     = useState('waiting');

  const createPC = useCallback(() => {
    // Close any existing connection first
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }

    const pc = new RTCPeerConnection(ICE_SERVERS);

    pc.onicecandidate = ({ candidate }) => {
      if (candidate) socket.emit('rtc:ice', { code, candidate });
    };

    pc.ontrack = (e) => {
      setRemoteStream(e.streams[0]);
      setPeerStatus('connected'); onStatusChange?.('connected');
    };

    pc.onconnectionstatechange = () => {
      if (['disconnected','failed','closed'].includes(pc.connectionState)) {
        setPeerStatus('disconnected'); onStatusChange?.('disconnected');
      }
    };

    if (localStream) {
      localStream.getTracks().forEach(t => pc.addTrack(t, localStream));
    }

    pcRef.current = pc;
    return pc;
  }, [code, localStream]);

  useEffect(() => {
    if (!code || !localStream) return;

    const onPeerJoined = async ({ role: joinedRole }) => {
      // Deaf user always creates the offer
      if (role === 'deaf') {
        const pc = createPC();
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.emit('rtc:offer', { code, offer });
      }
    };

    const onOffer = async ({ offer }) => {
      const pc = createPC();
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit('rtc:answer', { code, answer });
    };

    const onAnswer = async ({ answer }) => {
      await pcRef.current?.setRemoteDescription(new RTCSessionDescription(answer));
    };

    const onIce = async ({ candidate }) => {
      try { await pcRef.current?.addIceCandidate(new RTCIceCandidate(candidate)); }
      catch (_) {}
    };

    const onPeerLeft = () => {
      setPeerStatus('disconnected'); onStatusChange?.('disconnected');
      setRemoteStream(null);
    };

    socket.on('peer:joined', onPeerJoined);
    socket.on('rtc:offer',   onOffer);
    socket.on('rtc:answer',  onAnswer);
    socket.on('rtc:ice',     onIce);
    socket.on('peer:left',   onPeerLeft);

    // Fire room:ready so server re-sends peer:joined if partner already connected
    socket.emit('room:ready', { code, role });

    return () => {
      socket.off('peer:joined', onPeerJoined);
      socket.off('rtc:offer',   onOffer);
      socket.off('rtc:answer',  onAnswer);
      socket.off('rtc:ice',     onIce);
      socket.off('peer:left',   onPeerLeft);
      pcRef.current?.close();
    };
  }, [code, role, localStream, createPC]);

  return { remoteStream, peerStatus };
}