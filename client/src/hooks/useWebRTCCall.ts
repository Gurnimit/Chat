import { useState, useEffect, useRef } from 'react';
import { useAuth, api } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { User as UserType } from '../types';
import { App } from '@capacitor/app';

export const useWebRTCCall = () => {
  const { user: _user } = useAuth();
  const { socket } = useSocket();

  const [callState, _setCallState] = useState<'idle' | 'incoming' | 'outgoing' | 'active'>('idle');
  const [callPeer, setCallPeer] = useState<UserType | null>(null);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [callDuration, setCallDuration] = useState<number>(0);
  const [callType, setCallType] = useState<'audio' | 'video'>('audio');
  const [isVideoEnabled, setIsVideoEnabled] = useState<boolean>(true);
  const [isFullscreenVideo, setIsFullscreenVideo] = useState<boolean>(false);
  const [connectionQuality, setConnectionQuality] = useState<'good' | 'fair' | 'poor' | 'very_poor' | 'unknown'>('unknown');
  const [showFallbackPrompt, setShowFallbackPrompt] = useState<boolean>(false);

  // WebRTC Refs
  const localStreamRef = useRef<MediaStream | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);

  const callTimerIntervalRef = useRef<any>(null);
  const incomingOfferRef = useRef<any>(null);
  const callStateRef = useRef<'idle' | 'incoming' | 'outgoing' | 'active'>('idle');
  const queuedIceCandidatesRef = useRef<any[]>([]);
  const callTypeRef = useRef<'audio' | 'video'>('audio');
  const callPeerRef = useRef<UserType | null>(null);

  const qualityIntervalRef = useRef<any>(null);
  const lastQualityCheckRef = useRef<{ packetsLost: number; packetsReceived: number } | null>(null);
  const isTogglingCameraRef = useRef<boolean>(false);
  const iceRestartAttemptsRef = useRef<number>(0);
  const callStartTimeRef = useRef<number | null>(null);
  const callTimeoutRef = useRef<any>(null);

  const sendDiagnosticLog = async (level: 'info' | 'warn' | 'error', message: string, details?: any) => {
    try {
      const redactKeys = ['sdp', 'candidate', 'password', 'token', 'refreshToken', 'accessToken', 'cookie', 'authorization', 'credentials', 'credential', 'pwd', 'ufrag'];
      const cleanDetails = details ? JSON.parse(JSON.stringify(details, (key, value) => {
        if (redactKeys.includes(key.toLowerCase()) || (typeof value === 'string' && value.toLowerCase().startsWith('bearer '))) {
          return '[REDACTED]';
        }
        return value;
      })) : undefined;

      await api.post('/diagnostics/log', {
        level,
        message,
        details: cleanDetails
      });
    } catch (e) {
      console.error('[WebRTC Diagnostics] Failed to send log to server:', e);
    }
  };

  const [iceConfig, setIceConfig] = useState<RTCConfiguration>({
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' }
    ]
  });
  const [turnConfigured, setTurnConfigured] = useState<boolean>(false);

  const setCallState = (state: 'idle' | 'incoming' | 'outgoing' | 'active') => {
    callStateRef.current = state;
    _setCallState(state);
  };

  const setCallTypeSynced = (type: 'audio' | 'video') => {
    callTypeRef.current = type;
    setCallType(type);
  };

  // Shared audio references to prevent duplicates and memory leaks
  const ringtoneRef = useRef<HTMLAudioElement | null>(null);
  const callertoneRef = useRef<HTMLAudioElement | null>(null);
  const notificationSoundRef = useRef<HTMLAudioElement | null>(null);

  // Persistent Settings
  const [enableRingtone, setEnableRingtone] = useState<boolean>(() => {
    const saved = localStorage.getItem('velvet_enable_ringtone');
    return saved !== null ? saved === 'true' : true;
  });
  const [enableCallertone, setEnableCallertone] = useState<boolean>(() => {
    const saved = localStorage.getItem('velvet_enable_callertone');
    return saved !== null ? saved === 'true' : true;
  });
  const [enableMessageSounds, setEnableMessageSounds] = useState<boolean>(() => {
    const saved = localStorage.getItem('velvet_enable_message_sounds');
    return saved !== null ? saved === 'true' : true;
  });
  const [soundVolume, setSoundVolume] = useState<number>(() => {
    const saved = localStorage.getItem('velvet_sound_volume');
    return saved !== null ? parseFloat(saved) : 0.5;
  });

  // Sync settings to localStorage
  useEffect(() => {
    localStorage.setItem('velvet_enable_ringtone', String(enableRingtone));
  }, [enableRingtone]);

  useEffect(() => {
    localStorage.setItem('velvet_enable_callertone', String(enableCallertone));
  }, [enableCallertone]);

  useEffect(() => {
    localStorage.setItem('velvet_enable_message_sounds', String(enableMessageSounds));
  }, [enableMessageSounds]);

  useEffect(() => {
    localStorage.setItem('velvet_sound_volume', String(soundVolume));
  }, [soundVolume]);

  // Sync volume to audio instances in real time
  useEffect(() => {
    if (ringtoneRef.current) ringtoneRef.current.volume = soundVolume;
    if (callertoneRef.current) callertoneRef.current.volume = soundVolume;
    if (notificationSoundRef.current) notificationSoundRef.current.volume = soundVolume;
  }, [soundVolume]);

  // Unlock Audio on first interaction
  useEffect(() => {
    const unlock = () => {
      try {
        if (!ringtoneRef.current) {
          ringtoneRef.current = new Audio('/sounds/ringtone.mp3');
          ringtoneRef.current.loop = true;
        }
        if (!callertoneRef.current) {
          callertoneRef.current = new Audio('/sounds/callertone.mp3');
          callertoneRef.current.loop = true;
        }
        if (!notificationSoundRef.current) {
          notificationSoundRef.current = new Audio('/sounds/messagetone.mp3');
        }

        // Silent/brief play & pause cycle to authorize/unlock them
        ringtoneRef.current.volume = soundVolume;
        callertoneRef.current.volume = soundVolume;
        notificationSoundRef.current.volume = soundVolume;

        const p1 = ringtoneRef.current.play().then(() => ringtoneRef.current?.pause()).catch(() => {});
        const p2 = callertoneRef.current.play().then(() => callertoneRef.current?.pause()).catch(() => {});
        const p3 = notificationSoundRef.current.play().then(() => notificationSoundRef.current?.pause()).catch(() => {});

        Promise.all([p1, p2, p3]).then(() => {
        });

        document.removeEventListener('click', unlock);
        document.removeEventListener('keydown', unlock);
      } catch (e) {
        console.warn('[Audio Unlock] Failed to unlock audio context:', e);
      }
    };

    document.addEventListener('click', unlock);
    document.addEventListener('keydown', unlock);

    return () => {
      document.removeEventListener('click', unlock);
      document.removeEventListener('keydown', unlock);
    };
  }, [soundVolume]);

  const playRingtone = () => {
    if (!enableRingtone) return;
    try {
      if (!ringtoneRef.current) {
        ringtoneRef.current = new Audio('/sounds/ringtone.mp3');
        ringtoneRef.current.loop = true;
      }
      ringtoneRef.current.volume = soundVolume;
      ringtoneRef.current.currentTime = 0;
      ringtoneRef.current.play().catch(err => {
        console.warn('[Audio] Autoplay blocked or failed for ringtone:', err.message);
      });
    } catch (e) {
      console.error('[Audio] Error playing ringtone:', e);
    }
  };

  const stopRingtone = () => {
    if (ringtoneRef.current) {
      try {
        ringtoneRef.current.pause();
        ringtoneRef.current.currentTime = 0;
      } catch (e) {
        console.error('[Audio] Error stopping ringtone:', e);
      }
    }
  };

  const playCallertone = () => {
    if (!enableCallertone) return;
    try {
      if (!callertoneRef.current) {
        callertoneRef.current = new Audio('/sounds/callertone.mp3');
        callertoneRef.current.loop = true;
      }
      callertoneRef.current.volume = soundVolume;
      callertoneRef.current.currentTime = 0;
      callertoneRef.current.play().catch(err => {
        console.warn('[Audio] Autoplay blocked or failed for callertone:', err.message);
      });
    } catch (e) {
      console.error('[Audio] Error playing callertone:', e);
    }
  };

  const stopCallertone = () => {
    if (callertoneRef.current) {
      try {
        callertoneRef.current.pause();
        callertoneRef.current.currentTime = 0;
      } catch (e) {
        console.error('[Audio] Error stopping callertone:', e);
      }
    }
  };

  const playNotificationSound = () => {
    if (!enableMessageSounds) return;
    try {
      if (!notificationSoundRef.current) {
        notificationSoundRef.current = new Audio('/sounds/messagetone.mp3');
      }
      notificationSoundRef.current.volume = soundVolume;
      notificationSoundRef.current.currentTime = 0;
      notificationSoundRef.current.play().catch(err => {
        console.warn('[Audio] Autoplay blocked for notification sound:', err.message);
      });
    } catch (e) {
      console.error('[Audio] Error playing notification sound:', e);
    }
  };

  useEffect(() => {
    if (callState === 'incoming') {
      stopCallertone();
      playRingtone();
    } else if (callState === 'outgoing') {
      stopRingtone();
      playCallertone();
    } else {
      stopRingtone();
      stopCallertone();
    }

    return () => {
      stopRingtone();
      stopCallertone();
    };
  }, [callState]);

  // Sync peer ref so our unmount/unload callbacks can access it
  useEffect(() => {
    callPeerRef.current = callPeer;
  }, [callPeer]);

  // Fetch ICE configs on load
  useEffect(() => {
    const fetchIceConfig = async () => {
      try {
        const response = await api.get('/chats/ice-config');
        if (response.data && response.data.iceServers) {
          setIceConfig({ iceServers: response.data.iceServers });
          setTurnConfigured(response.data.turnConfigured);
          if (!response.data.turnConfigured && import.meta.env.DEV) {
            console.warn('[WebRTC] Warning: TURN server is not configured. Falling back to STUN-only mode.');
          }
        }
      } catch (err) {
        console.error('Failed to fetch WebRTC ICE configurations, using fallback STUN servers:', err);
      }
    };
    fetchIceConfig();
  }, []);

  const cleanupCall = () => {
    stopRingtone();
    stopCallertone();
    if (qualityIntervalRef.current) {
      clearInterval(qualityIntervalRef.current);
      qualityIntervalRef.current = null;
    }
    lastQualityCheckRef.current = null;

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        track.stop();
        console.log(`[WebRTC] Stopped local track: ${track.kind}`);
      });
      localStreamRef.current = null;
    }
    if (peerConnectionRef.current) {
      peerConnectionRef.current.onicecandidate = null;
      peerConnectionRef.current.ontrack = null;
      peerConnectionRef.current.onconnectionstatechange = null;
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    if (callTimerIntervalRef.current) {
      clearInterval(callTimerIntervalRef.current);
      callTimerIntervalRef.current = null;
    }
    if (callTimeoutRef.current) {
      clearTimeout(callTimeoutRef.current);
      callTimeoutRef.current = null;
    }

    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }

    // Clear global testing accessors
    if (typeof window !== 'undefined') {
      (window as any).localStreamVal = null;
      (window as any).peerConnectionVal = null;
    }

    setCallState('idle');
    setCallPeer(null);
    setCallDuration(0);
    setIsMuted(false);
    setIsVideoEnabled(true);
    setIsFullscreenVideo(false);
    setConnectionQuality('unknown');
    setShowFallbackPrompt(false);
    queuedIceCandidatesRef.current = [];
    iceRestartAttemptsRef.current = 0;
    callStartTimeRef.current = null;
  };

  const startCallTimer = () => {
    setCallDuration(0);
    if (callTimerIntervalRef.current) clearInterval(callTimerIntervalRef.current);
    callTimerIntervalRef.current = setInterval(() => {
      setCallDuration(prev => prev + 1);
    }, 1000);
  };

  const formatCallDuration = (sec: number) => {
    const minutes = Math.floor(sec / 60);
    const seconds = sec % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const processQueuedCandidates = async () => {
    if (peerConnectionRef.current && peerConnectionRef.current.remoteDescription) {
      const candidates = [...queuedIceCandidatesRef.current];
      queuedIceCandidatesRef.current = [];
      for (const candidate of candidates) {
        try {
          await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (e) {
          console.error('Error adding queued ICE candidate:', e);
        }
      }
    }
  };

  const setupConnectionMonitoring = (pc: RTCPeerConnection, targetUserId: string) => {
    callStartTimeRef.current = Date.now();
    
    pc.onconnectionstatechange = async () => {
      
      if (pc.connectionState === 'connected') {
        const setupDuration = Date.now() - (callStartTimeRef.current || Date.now());
        startCallTimer();
        startQualityMonitor();
        
        try {
          const stats = await pc.getStats();
          let selectedPair: any = null;
          stats.forEach((report) => {
            if (report.type === 'candidate-pair' && report.state === 'succeeded') {
              selectedPair = report;
            }
          });
          
          let localCandidateType = 'unknown';
          let remoteCandidateType = 'unknown';
          let turnUsed = false;
          
          if (selectedPair) {
            const localCandidate = stats.get(selectedPair.localCandidateId);
            const remoteCandidate = stats.get(selectedPair.remoteCandidateId);
            if (localCandidate) localCandidateType = localCandidate.candidateType;
            if (remoteCandidate) remoteCandidateType = remoteCandidate.candidateType;
            if (localCandidateType === 'relay' || remoteCandidateType === 'relay') {
              turnUsed = true;
            }
          }
          
          sendDiagnosticLog('info', 'WebRTC call connected successfully', {
            setupDurationMs: setupDuration,
            localCandidateType,
            remoteCandidateType,
            turnUsed,
            callType: callTypeRef.current
          });
        } catch (err) {
          console.error('Error fetching quality statistics on connect:', err);
        }
      }
      
      if (pc.connectionState === 'failed') {
        if (iceRestartAttemptsRef.current < 3) {
          iceRestartAttemptsRef.current += 1;
          console.warn(`[WebRTC] ICE connection failed. Attempting ICE restart (${iceRestartAttemptsRef.current}/3)...`);
          sendDiagnosticLog('warn', `ICE connection failed. Attempting ICE restart (${iceRestartAttemptsRef.current}/3)...`);
          try {
            if (pc.restartIce) {
              // Modern API: triggers ICE restart automatically, new candidates will flow via onicecandidate
              pc.restartIce();
            } else {
              // Fallback for older browsers: manually create an ICE restart offer
              // NOTE: Use dedicated 'ice_restart' event — NOT 'call_user' which would
              // create a new CallLog and trigger a duplicate incoming_call on the recipient
              const offer = await pc.createOffer({ iceRestart: true });
              await pc.setLocalDescription(offer);
              socket?.emit('ice_restart', { toUserId: targetUserId, offer });
            }
          } catch (err) {
            console.error('[WebRTC] ICE restart failed:', err);
            sendDiagnosticLog('error', 'ICE restart initiation failed', { error: String(err) });
          }
        } else {
          console.error('[WebRTC] ICE restart failed after 3 attempts. Tearing down.');
          sendDiagnosticLog('error', 'ICE restart failed after 3 attempts. Tearing down.');
          cleanupCall();
        }
      }
      
      if (pc.connectionState === 'disconnected' || pc.connectionState === 'closed') {
        cleanupCall();
      }
    };
  };

  const startCall = async (type: 'audio' | 'video', peer: UserType) => {
    if (!socket) return;
    setCallPeer(peer);
    setCallState('outgoing');
    setCallTypeSynced(type);
    setIsVideoEnabled(true);
    setConnectionQuality('unknown');
    setShowFallbackPrompt(false);

    callTimeoutRef.current = setTimeout(() => {
      if (callStateRef.current === 'outgoing') {
        console.warn('[WebRTC] Outgoing call timed out unanswered.');
        socket.emit('end_call', { toUserId: peer.id, missed: true });
        cleanupCall();
        alert('Call unanswered (Timed out).');
      }
    }, 30000);

    try {
      const constraints = {
        audio: true,
        video: type === 'video' ? { width: 640, height: 480, frameRate: 15 } : false
      };

      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia(constraints);
      } catch (err: any) {
        if (type === 'video') {
          console.warn('[WebRTC] Camera permission denied or not found. Falling back to audio-only call.');
          alert('Camera permission denied or camera not found. Falling back to audio-only call.');
          try {
            stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
            setCallTypeSynced('audio');
          } catch (audioErr) {
            console.error('Failed to get audio stream on fallback:', audioErr);
            alert('Could not start call. Please check microphone/camera permissions.');
            cleanupCall();
            return;
          }
        } else {
          console.error('Failed to get audio stream:', err);
          alert('Could not start call. Please check microphone permissions.');
          cleanupCall();
          return;
        }
      }

      localStreamRef.current = stream;

      // Expose to window for testing verification
      if (typeof window !== 'undefined') {
        (window as any).localStreamVal = stream;
      }

      // Bind local video source
      if (callTypeRef.current === 'video' && localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      const pc = new RTCPeerConnection(iceConfig);
      peerConnectionRef.current = pc;
      if (typeof window !== 'undefined') {
        (window as any).peerConnectionVal = pc;
      }

      stream.getTracks().forEach(track => pc.addTrack(track, stream));

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          socket.emit('ice_candidate', { toUserId: peer.id, candidate: event.candidate });
        }
      };

      pc.ontrack = (event) => {
        if (remoteVideoRef.current && event.streams[0]) {
          remoteVideoRef.current.srcObject = event.streams[0];
        }
        if (remoteAudioRef.current && event.streams[0] && event.track.kind === 'audio') {
          remoteAudioRef.current.srcObject = event.streams[0];
        }
      };

      setupConnectionMonitoring(pc, peer.id);


      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socket.emit('call_user', { toUserId: peer.id, offer, callType: callTypeRef.current });

    } catch (err) {
      console.error(`Failed to start call:`, err);
      alert('Could not start call. Please check microphone/camera permissions.');
      cleanupCall();
    }
  };

  const acceptCall = async () => {
    if (!socket || !callPeer) return;
    if (!incomingOfferRef.current) {
      console.error('[WebRTC] acceptCall called but no incoming offer stored. Cannot establish peer connection.');
      alert('Could not accept the call: call offer was missing or expired.');
      cleanupCall();
      return;
    }

    const type = callTypeRef.current;

    try {
      const constraints = {
        audio: true,
        video: type === 'video' ? { width: 640, height: 480, frameRate: 15 } : false
      };

      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia(constraints);
      } catch (err: any) {
        if (type === 'video') {
          console.warn('[WebRTC] Camera permission denied or not found. Accepting as audio-only call.');
          alert('Camera permission denied or camera not found. Accepting as audio-only call.');
          try {
            stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
            setCallTypeSynced('audio');
            // Inform peer that we are answering as audio only
            socket.emit('switch_to_audio', { toUserId: callPeer.id });
          } catch (audioErr) {
            console.error('Failed to get audio stream on accept fallback:', audioErr);
            cleanupCall();
            return;
          }
        } else {
          console.error('Failed to get audio stream on accept:', err);
          cleanupCall();
          return;
        }
      }

      localStreamRef.current = stream;

      // Expose to window for testing verification
      if (typeof window !== 'undefined') {
        (window as any).localStreamVal = stream;
      }

      // Bind local video source
      if (callTypeRef.current === 'video' && localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      const pc = new RTCPeerConnection(iceConfig);
      peerConnectionRef.current = pc;
      if (typeof window !== 'undefined') {
        (window as any).peerConnectionVal = pc;
      }

      stream.getTracks().forEach(track => pc.addTrack(track, stream));

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          socket.emit('ice_candidate', { toUserId: callPeer.id, candidate: event.candidate });
        }
      };

      pc.ontrack = (event) => {
        if (remoteVideoRef.current && event.streams[0]) {
          remoteVideoRef.current.srcObject = event.streams[0];
        }
        if (remoteAudioRef.current && event.streams[0] && event.track.kind === 'audio') {
          remoteAudioRef.current.srcObject = event.streams[0];
        }
      };

      setupConnectionMonitoring(pc, callPeer.id);


      await pc.setRemoteDescription(new RTCSessionDescription(incomingOfferRef.current));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      socket.emit('accept_call', { toUserId: callPeer.id, answer });
      incomingOfferRef.current = null;
      await processQueuedCandidates();

      // Only transition to 'active' after peer connection signaling is in-flight
      setCallState('active');
      startCallTimer();

    } catch (err) {
      console.error('Failed to accept call:', err);
      cleanupCall();
    }
  };

  const rejectCall = () => {
    if (!socket || !callPeer) return;
    socket.emit('reject_call', { toUserId: callPeer.id });
    incomingOfferRef.current = null;
    cleanupCall();
  };

  const endCall = () => {
    if (!socket || !callPeer) return;
    const isMissed = callStateRef.current === 'outgoing';
    socket.emit('end_call', { toUserId: callPeer.id, missed: isMissed });
    cleanupCall();
  };

  const toggleMute = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
        console.log(`[WebRTC] Audio track enabled: ${audioTrack.enabled}`);
      }
    }
  };

  const toggleCamera = async () => {
    if (!localStreamRef.current || callTypeRef.current !== 'video') return;
    if (isTogglingCameraRef.current) return;
    isTogglingCameraRef.current = true;

    try {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        if (isVideoEnabled) {
          // Disable/stop local camera
          videoTrack.enabled = false;
          videoTrack.stop();
          setIsVideoEnabled(false);
          console.log('[WebRTC] Camera disabled. Video track stopped.');
        } else {
          // Re-enable camera by acquiring a new track
          console.log('[WebRTC] Re-enabling camera...');
          const newStream = await navigator.mediaDevices.getUserMedia({
            video: { width: 640, height: 480, frameRate: 15 }
          });
          const newVideoTrack = newStream.getVideoTracks()[0];
          
          localStreamRef.current.addTrack(newVideoTrack);
          setIsVideoEnabled(true);

          if (localVideoRef.current) {
            localVideoRef.current.srcObject = localStreamRef.current;
          }

          if (peerConnectionRef.current) {
            const senders = peerConnectionRef.current.getSenders();
            const videoSender = senders.find(s => s.track && s.track.kind === 'video');
            if (videoSender) {
              await videoSender.replaceTrack(newVideoTrack);
              console.log('[WebRTC] Video track replaced on peer connection.');
            }
          }
        }
      } else if (!isVideoEnabled) {
        // No video track present initially, acquire new video track
        console.log('[WebRTC] Camera track missing, requesting new one...');
        const newStream = await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 480, frameRate: 15 }
        });
        const newVideoTrack = newStream.getVideoTracks()[0];
        localStreamRef.current.addTrack(newVideoTrack);
        setIsVideoEnabled(true);

        if (localVideoRef.current) {
          localVideoRef.current.srcObject = localStreamRef.current;
        }

        if (peerConnectionRef.current) {
          const senders = peerConnectionRef.current.getSenders();
          const videoSender = senders.find(s => s.track && s.track.kind === 'video');
          if (videoSender) {
            await videoSender.replaceTrack(newVideoTrack);
          } else {
            peerConnectionRef.current.addTrack(newVideoTrack, localStreamRef.current);
          }
        }
      }
    } catch (err) {
      console.error('[WebRTC] Failed to toggle camera:', err);
      alert('Could not start camera. Please check permissions.');
    } finally {
      isTogglingCameraRef.current = false;
    }
  };

  const switchToAudioOnly = () => {
    if (!socket || !callPeer) return;
    
    if (localStreamRef.current) {
      localStreamRef.current.getVideoTracks().forEach(track => {
        track.enabled = false;
        track.stop();
        localStreamRef.current?.removeTrack(track);
      });
    }

    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }

    setCallTypeSynced('audio');
    setIsVideoEnabled(false);
    setShowFallbackPrompt(false);

    socket.emit('switch_to_audio', { toUserId: callPeer.id });
    console.log('[WebRTC] Switched call to audio-only mode.');
  };

  const startQualityMonitor = () => {
    if (qualityIntervalRef.current) clearInterval(qualityIntervalRef.current);
    
    qualityIntervalRef.current = setInterval(async () => {
      const pc = peerConnectionRef.current;
      if (!pc || pc.connectionState !== 'connected') return;

      try {
        const stats = await pc.getStats();
        let rtt = 0;
        let packetsLost = 0;
        let packetsReceived = 0;
        let packetLossRate = 0;

        stats.forEach((report) => {
          if (report.type === 'candidate-pair' && report.state === 'succeeded') {
            if (typeof report.currentRoundTripTime === 'number') {
              rtt = report.currentRoundTripTime * 1000;
            }
          }
          if (report.type === 'inbound-rtp' && report.kind === 'video') {
            packetsLost = report.packetsLost || 0;
            packetsReceived = report.packetsReceived || 0;
          }
        });

        if (lastQualityCheckRef.current) {
          const deltaLost = Math.max(0, packetsLost - lastQualityCheckRef.current.packetsLost);
          const deltaReceived = Math.max(0, packetsReceived - lastQualityCheckRef.current.packetsReceived);
          const totalPackets = deltaLost + deltaReceived;
          if (totalPackets > 0) {
            packetLossRate = (deltaLost / totalPackets) * 100;
          }
        }
        lastQualityCheckRef.current = { packetsLost, packetsReceived };

        console.log(`[WebRTC Stats] RTT: ${rtt.toFixed(0)}ms, Packet Loss Rate: ${packetLossRate.toFixed(1)}%`);

        // Conservative quality thresholds
        if (rtt > 1000 || packetLossRate > 25) {
          setConnectionQuality('very_poor');
          // Automatically fallback to audio only
          console.warn('[WebRTC Quality] RTT > 1000ms or Packet Loss > 25%. Falling back to audio-only.');
          switchToAudioOnly();
          setShowFallbackPrompt(true);
        } else if (rtt > 500 || packetLossRate > 10) {
          setConnectionQuality('poor');
          // Scale down encoding parameters
          const senders = pc.getSenders();
          const videoSender = senders.find(s => s.track && s.track.kind === 'video');
          if (videoSender) {
            const params = videoSender.getParameters();
            if (params.encodings && params.encodings[0]) {
              let updated = false;
              if (params.encodings[0].scaleResolutionDownBy !== 2.0) {
                params.encodings[0].scaleResolutionDownBy = 2.0;
                updated = true;
              }
              if (params.encodings[0].maxFramerate !== 10) {
                params.encodings[0].maxFramerate = 10;
                updated = true;
              }
              if (updated) {
                await videoSender.setParameters(params);
                console.log('[WebRTC Quality] Downscaled resolution and frame rate due to POOR connection quality.');
              }
            }
          }
        } else if (rtt > 250 || packetLossRate > 5) {
          setConnectionQuality('fair');
          // Moderate scale down
          const senders = pc.getSenders();
          const videoSender = senders.find(s => s.track && s.track.kind === 'video');
          if (videoSender) {
            const params = videoSender.getParameters();
            if (params.encodings && params.encodings[0]) {
              let updated = false;
              if (params.encodings[0].scaleResolutionDownBy !== 1.5) {
                params.encodings[0].scaleResolutionDownBy = 1.5;
                updated = true;
              }
              if (params.encodings[0].maxFramerate !== 12) {
                params.encodings[0].maxFramerate = 12;
                updated = true;
              }
              if (updated) {
                await videoSender.setParameters(params);
                console.log('[WebRTC Quality] Downscaled video settings slightly due to FAIR connection quality.');
              }
            }
          }
        } else {
          setConnectionQuality('good');
          // Restore standard params
          const senders = pc.getSenders();
          const videoSender = senders.find(s => s.track && s.track.kind === 'video');
          if (videoSender) {
            const params = videoSender.getParameters();
            if (params.encodings && params.encodings[0]) {
              let updated = false;
              if (params.encodings[0].scaleResolutionDownBy !== 1.0) {
                params.encodings[0].scaleResolutionDownBy = 1.0;
                updated = true;
              }
              if (params.encodings[0].maxFramerate !== 15) {
                params.encodings[0].maxFramerate = 15;
                updated = true;
              }
              if (updated) {
                await videoSender.setParameters(params);
              }
            }
          }
        }
      } catch (err) {
        console.error('Error fetching quality statistics:', err);
      }
    }, 4000);
  };

  // Handle Socket Events inside Hook
  useEffect(() => {
    if (!socket) return;

    const onIncomingCall = (data: { caller: UserType; offer: any; callType?: 'audio' | 'video' }) => {
      console.log(`[INCOMING_CALL_RECEIVED] from userId=${data.caller.id} username=${data.caller.username} callType=${data.callType} offerPresent=${!!data.offer}`);
      if (callStateRef.current !== 'idle') {
        console.log(`[INCOMING_CALL_RECEIVED] Auto-rejected: already in call state=${callStateRef.current}`);
        socket.emit('reject_call', { toUserId: data.caller.id });
        return;
      }
      setCallPeer(data.caller);
      setCallState('incoming');
      setCallTypeSynced(data.callType || 'audio');
      setIsVideoEnabled(true);
      incomingOfferRef.current = data.offer;

      if (callTimeoutRef.current) clearTimeout(callTimeoutRef.current);
      callTimeoutRef.current = setTimeout(() => {
        if (callStateRef.current === 'incoming') {
          console.warn('[WebRTC] Incoming call timed out unanswered.');
          cleanupCall();
        }
      }, 30000);
    };

    const onSwitchedToAudio = () => {
      console.log('[WebRTC] Peer switched to audio-only. Disposing local camera tracks.');
      if (localStreamRef.current) {
        localStreamRef.current.getVideoTracks().forEach(track => {
          track.enabled = false;
          track.stop();
          localStreamRef.current?.removeTrack(track);
        });
      }
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = null;
      }
      setCallTypeSynced('audio');
      setIsVideoEnabled(false);
      setShowFallbackPrompt(false);
    };

    const onSwitchedToVideo = async () => {
      console.log('[WebRTC] Peer switched to video. Attempting to enable local camera.');
      if (callTypeRef.current === 'video' && localStreamRef.current) {
        // Already in video mode, nothing to do
        return;
      }
      try {
        const newStream = await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 480, frameRate: 15 }
        });
        const newVideoTrack = newStream.getVideoTracks()[0];
        if (localStreamRef.current) {
          localStreamRef.current.addTrack(newVideoTrack);
        }
        if (peerConnectionRef.current) {
          const senders = peerConnectionRef.current.getSenders();
          const videoSender = senders.find(s => s.track && s.track.kind === 'video');
          if (videoSender) {
            await videoSender.replaceTrack(newVideoTrack);
          } else {
            peerConnectionRef.current.addTrack(newVideoTrack, localStreamRef.current!);
          }
        }
        if (localVideoRef.current && localStreamRef.current) {
          localVideoRef.current.srcObject = localStreamRef.current;
        }
        setCallTypeSynced('video');
        setIsVideoEnabled(true);
      } catch (err) {
        console.warn('[WebRTC] Could not enable camera in response to peer video switch:', err);
      }
    };

    const onCallAccepted = async (data: { fromUserId: string; answer: any }) => {
      if (peerConnectionRef.current) {
        try {
          await peerConnectionRef.current.setRemoteDescription(
            new RTCSessionDescription(data.answer)
          );
          setCallState('active');
          if (callTimeoutRef.current) {
            clearTimeout(callTimeoutRef.current);
            callTimeoutRef.current = null;
          }
          startCallTimer();
          await processQueuedCandidates();
        } catch (e) {
          console.error('Failed to complete answer description:', e);
          cleanupCall();
        }
      }
    };

    const onCallRejected = () => {
      alert('Call rejected or busy.');
      cleanupCall();
    };

    const onIceCandidate = async (data: { fromUserId: string; candidate: any }) => {
      const pc = peerConnectionRef.current;
      if (data.candidate) {
        const candidateType = data.candidate.type || 
          (data.candidate.candidate.includes('typ host') ? 'host' : 
           data.candidate.candidate.includes('typ srflx') ? 'srflx' : 
           data.candidate.candidate.includes('typ relay') ? 'relay' : 'unknown');
        console.log(`[ICE_RECEIVED] Remote candidate from userId=${data.fromUserId}: type=${candidateType}, candidate=${data.candidate.candidate}`);
      }
      if (pc && pc.remoteDescription) {
        try {
          await pc.addIceCandidate(
            new RTCIceCandidate(data.candidate)
          );
          console.log(`[ICE_RECEIVED] Added ICE candidate to peer connection. iceState=${pc.iceConnectionState}`);
        } catch (e) {
          console.error('Error adding ICE candidate:', e);
        }
      } else {
        console.log(`[ICE_RECEIVED] Queued ICE candidate (remoteDescription not set yet). Queue size=${queuedIceCandidatesRef.current.length + 1}`);
        queuedIceCandidatesRef.current.push(data.candidate);
      }
    };

    const onCallEnded = () => {
      cleanupCall();
    };

    // Handle ICE restart offer from peer (relayed via ice_restart server event)
    const onCallRestarted = async (data: { fromUserId: string; offer: any }) => {
      console.log(`[ICE_RECEIVED] ICE restart offer received from userId=${data.fromUserId}`);
      const pc = peerConnectionRef.current;
      if (!pc || !socket || !callPeerRef.current) return;
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit('accept_call', { toUserId: callPeerRef.current.id, answer });
        console.log(`[ICE_RECEIVED] ICE restart answer sent to userId=${callPeerRef.current.id}`);
      } catch (e) {
        console.error('[ICE] Failed to handle ICE restart offer:', e);
      }
    };

    socket.on('incoming_call', onIncomingCall);
    socket.on('switched_to_audio', onSwitchedToAudio);
    socket.on('switched_to_video', onSwitchedToVideo);
    socket.on('call_accepted', onCallAccepted);
    socket.on('call_rejected', onCallRejected);
    socket.on('ice_candidate', onIceCandidate);
    socket.on('call_ended', onCallEnded);
    socket.on('call_restarted', onCallRestarted);

    return () => {
      socket.off('incoming_call', onIncomingCall);
      socket.off('switched_to_audio', onSwitchedToAudio);
      socket.off('switched_to_video', onSwitchedToVideo);
      socket.off('call_accepted', onCallAccepted);
      socket.off('call_rejected', onCallRejected);
      socket.off('ice_candidate', onIceCandidate);
      socket.off('call_ended', onCallEnded);
      socket.off('call_restarted', onCallRestarted);
    };
  }, [socket]);

  // Tab/Page Refresh, Close, Navigation cleanups
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (callStateRef.current !== 'idle' && callPeerRef.current && socket) {
        socket.emit('end_call', { toUserId: callPeerRef.current.id });
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      if (callStateRef.current !== 'idle' && callPeerRef.current && socket) {
        socket.emit('end_call', { toUserId: callPeerRef.current.id });
      }
      cleanupCall();
    };
  }, [socket]);

  // Listen to backgrounding transitions to cleanly fail active calls
  useEffect(() => {
    if (!window.hasOwnProperty('Capacitor')) return;
    const capacitor = (window as any).Capacitor;
    if (!capacitor.isNativePlatform()) return;

    const subscriptionPromise = App.addListener('appStateChange', ({ isActive }) => {
      console.log(`[WebRTC Background Audit] App active status changed: ${isActive}`);
      if (!isActive) {
        if (callStateRef.current !== 'idle' && callPeerRef.current && socket) {
          console.warn('[WebRTC Background Audit] Active call aborted due to application backgrounding.');
          
          socket.emit('end_call', { 
            toUserId: callPeerRef.current.id,
            reason: 'backgrounded'
          });

          sendDiagnosticLog('warn', 'Call aborted: Application minimized/backgrounded', {
            targetUserId: callPeerRef.current.id,
            callState: callStateRef.current
          });

          cleanupCall();
          alert('Call ended because the application went to the background.');
        }
      }
    });

    return () => {
      subscriptionPromise.then(handle => handle.remove());
    };
  }, [socket]);

  // Audio routing and speakerphone controls
  const [audioOutputs, setAudioOutputs] = useState<MediaDeviceInfo[]>([]);
  const [selectedAudioOutput, setSelectedAudioOutput] = useState<string>('default');
  const [isSpeakerphone, setIsSpeakerphone] = useState<boolean>(false);
  const [audioRouteError, setAudioRouteError] = useState<string | null>(null);

  // Diagnostics and recovery states
  const [diagnosticsLog, setDiagnosticsLog] = useState<string[]>([]);
  const [liveDiagnostics, setLiveDiagnostics] = useState<any>(null);

  const addDiagLog = (msg: string) => {
    setDiagnosticsLog(prev => [
      `[${new Date().toLocaleTimeString()}] ${msg}`,
      ...prev.slice(0, 49) // Keep last 50 logs
    ]);
  };

  const fetchAudioOutputs = async () => {
    try {
      const isSinkSupported = 'setSinkId' in document.createElement('audio');
      if (!isSinkSupported) {
        setAudioRouteError('Audio routing is not supported in this browser (requires setSinkId support).');
        setAudioOutputs([]);
        return;
      }

      if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
        setAudioRouteError('Media device enumeration is not supported by your browser.');
        setAudioOutputs([]);
        return;
      }

      const devices = await navigator.mediaDevices.enumerateDevices();
      const outputs = devices.filter(device => device.kind === 'audiooutput');
      
      if (outputs.length === 0) {
        setAudioRouteError('No active audio output devices found (permission or connection needed).');
      } else {
        setAudioRouteError(null);
      }
      setAudioOutputs(outputs);
    } catch (e: any) {
      console.warn('Could not enumerate audio outputs:', e);
      setAudioRouteError(`Failed to detect devices: ${e.message}`);
      setAudioOutputs([]);
    }
  };

  useEffect(() => {
    if (callState === 'active') {
      fetchAudioOutputs();
    }
  }, [callState]);

  const handleSelectAudioRoute = async (deviceId: string) => {
    try {
      const audioEl = remoteAudioRef.current;
      if (!audioEl) {
        throw new Error('Remote audio playback element is not mounted');
      }
      
      if (!(audioEl as any).setSinkId) {
        throw new Error('setSinkId is not supported in this browser environment');
      }

      await (audioEl as any).setSinkId(deviceId);
      setSelectedAudioOutput(deviceId);
      
      const device = audioOutputs.find(d => d.deviceId === deviceId);
      if (device) {
        setIsSpeakerphone(device.label.toLowerCase().includes('speaker'));
      }
      setAudioRouteError(null);
      console.log(`[Audio Route] Audio output switched to device: ${deviceId}`);
      sendDiagnosticLog('info', 'Audio output route switched', { deviceId, deviceLabel: device?.label });
    } catch (err: any) {
      console.error('[Audio Route] Failed to set audio route:', err);
      setAudioRouteError(`Routing failed: ${err.message}`);
      sendDiagnosticLog('error', 'Audio route selection failed', { error: err.message, deviceId });
    }
  };

  const toggleSpeakerphone = async () => {
    try {
      const isSinkSupported = 'setSinkId' in document.createElement('audio');
      if (!isSinkSupported) {
        setAudioRouteError('Speakerphone toggle requires setSinkId support.');
        setIsSpeakerphone(!isSpeakerphone); // Fallback state toggle
        return;
      }

      const speakerDevice = audioOutputs.find(d => d.label.toLowerCase().includes('speaker') || d.label.toLowerCase().includes('hands-free'));
      const defaultDevice = audioOutputs.find(d => !d.label.toLowerCase().includes('speaker') && !d.label.toLowerCase().includes('hands-free') && d.deviceId !== 'default') || { deviceId: 'default' };
      
      const targetDeviceId = isSpeakerphone ? defaultDevice.deviceId : (speakerDevice?.deviceId || 'default');
      
      const audioEl = remoteAudioRef.current;
      if (audioEl && (audioEl as any).setSinkId) {
        await (audioEl as any).setSinkId(targetDeviceId);
        setIsSpeakerphone(!isSpeakerphone);
        setSelectedAudioOutput(targetDeviceId);
        setAudioRouteError(null);
        console.log(`[Speakerphone] Toggled speakerphone to: ${!isSpeakerphone}`);
        sendDiagnosticLog('info', 'Speakerphone toggled', { active: !isSpeakerphone, targetDeviceId });
      } else {
        throw new Error('setSinkId API missing on active audio element');
      }
    } catch (err: any) {
      console.error('[Speakerphone] Failed to toggle speakerphone:', err);
      setAudioRouteError(`Speakerphone toggle failed: ${err.message}`);
    }
  };

  // Video black-screen diagnostics & recovery loop
  useEffect(() => {
    if (callState !== 'active' || callType !== 'video') return;

    const recoveryInterval = setInterval(() => {
      // 1. Audit Local Video Preview
      const localVideo = localVideoRef.current;
      if (localVideo && localStreamRef.current) {
        const videoTracks = localStreamRef.current.getVideoTracks();
        if (videoTracks.length > 0) {
          const track = videoTracks[0];
          
          // Check track health
          if (track.readyState === 'ended' || !track.enabled) {
            addDiagLog('Local video track ended or disabled. Re-requesting track.');
            toggleCamera();
          } else if (track.muted) {
            addDiagLog('Local video track hardware-muted by device.');
          }

          // Check if video element is stalled or paused
          if (localVideo.paused) {
            addDiagLog('Local video preview paused unexpectedly. Retrying play().');
            localVideo.play().catch(err => {
              console.warn('[Video Recovery] Failed to play local video:', err.message);
            });
          }

          // Reattach srcObject if it has loaded but readyState is HAVE_NOTHING (stalled UI element)
          if (localVideo.srcObject && localVideo.readyState === 0) {
            addDiagLog('Local video element stalled with HAVE_NOTHING. Reattaching stream.');
            const currentStream = localVideo.srcObject;
            localVideo.srcObject = null;
            localVideo.srcObject = currentStream;
            localVideo.play().catch(() => {});
          }
        } else {
          addDiagLog('Diagnostic Alert: Local stream has no video tracks.');
        }
      }

      // 2. Audit Remote Video View
      const remoteVideo = remoteVideoRef.current;
      if (remoteVideo && remoteVideo.srcObject) {
        const remoteStream = remoteVideo.srcObject as MediaStream;
        const videoTracks = remoteStream.getVideoTracks();
        if (videoTracks.length > 0) {
          const track = videoTracks[0];

          if (track.readyState === 'ended' || !track.enabled) {
            addDiagLog('Remote video track is ended or disabled by peer.');
          }

          if (remoteVideo.paused) {
            addDiagLog('Remote video view paused unexpectedly. Retrying play().');
            remoteVideo.play().catch(err => {
              console.warn('[Video Recovery] Failed to play remote video:', err.message);
            });
          }

          if (remoteVideo.srcObject && remoteVideo.readyState === 0) {
            addDiagLog('Remote video element stalled with HAVE_NOTHING. Reattaching stream.');
            const currentStream = remoteVideo.srcObject;
            remoteVideo.srcObject = null;
            remoteVideo.srcObject = currentStream;
            remoteVideo.play().catch(() => {});
          }
        } else {
          addDiagLog('Diagnostic Alert: Remote stream has no video tracks.');
        }
      }
    }, 4000);

    return () => {
      clearInterval(recoveryInterval);
    };
  }, [callState, callType, isVideoEnabled]);

  // Read WebRTC stats and compile diagnostics info
  const getDetailedDiagnostics = async () => {
    const pc = peerConnectionRef.current;
    let selectedCandidateType = 'none';
    let isTurnUsed = false;
    let localCandidateDetails = '';
    let remoteCandidateDetails = '';

    if (pc) {
      try {
        const stats = await pc.getStats();
        let selectedPair: any = null;
        stats.forEach((report) => {
          if (report.type === 'candidate-pair' && report.state === 'succeeded') {
            selectedPair = report;
          }
        });

        if (selectedPair) {
          const localCandidate = stats.get(selectedPair.localCandidateId);
          const remoteCandidate = stats.get(selectedPair.remoteCandidateId);
          if (localCandidate) {
            selectedCandidateType = localCandidate.candidateType || 'unknown';
            localCandidateDetails = `${localCandidate.ip}:${localCandidate.port} (${localCandidate.protocol})`;
          }
          if (remoteCandidate) {
            remoteCandidateDetails = `${remoteCandidate.ip}:${remoteCandidate.port} (${remoteCandidate.protocol})`;
          }
          if (selectedCandidateType === 'relay') {
            isTurnUsed = true;
          }
        }
      } catch (e) {
        console.warn('Could not read WebRTC candidate stats:', e);
      }
    }

    const localStream = localStreamRef.current;
    const localVideoTracks = localStream ? localStream.getVideoTracks() : [];
    const localAudioTracks = localStream ? localStream.getAudioTracks() : [];

    const remoteVideoEl = remoteVideoRef.current;
    const remoteStream = remoteVideoEl ? (remoteVideoEl.srcObject as MediaStream) : null;
    const remoteVideoTracks = remoteStream ? remoteStream.getVideoTracks() : [];
    const remoteAudioTracks = remoteStream ? remoteStream.getAudioTracks() : [];

    return {
      localStreamStatus: localStream ? `Active (${localStream.id})` : 'No Local Stream',
      remoteStreamStatus: remoteStream ? `Active (${remoteStream.id})` : 'No Remote Stream',
      localVideoTracksCount: localVideoTracks.length,
      localAudioTracksCount: localAudioTracks.length,
      remoteVideoTracksCount: remoteVideoTracks.length,
      remoteAudioTracksCount: remoteAudioTracks.length,
      iceState: pc ? pc.iceConnectionState : 'none',
      connectionState: pc ? pc.connectionState : 'none',
      selectedCandidateType,
      isTurnUsed,
      localCandidateDetails,
      remoteCandidateDetails,
      audioRoute: selectedAudioOutput,
    };
  };

  useEffect(() => {
    if (callState !== 'active') {
      setLiveDiagnostics(null);
      return;
    }

    const interval = setInterval(async () => {
      const diag = await getDetailedDiagnostics();
      setLiveDiagnostics(diag);
    }, 2500);

    return () => clearInterval(interval);
  }, [callState, selectedAudioOutput]);

  return {
    callState,
    callPeer,
    isMuted,
    callDuration,
    callType,
    isVideoEnabled,
    isFullscreenVideo,
    connectionQuality,
    showFallbackPrompt,
    localVideoRef,
    remoteVideoRef,
    remoteAudioRef,
    setIsFullscreenVideo,
    setShowFallbackPrompt,
    startCall,
    acceptCall,
    rejectCall,
    endCall,
    toggleMute,
    toggleCamera,
    switchToAudioOnly,
    formatCallDuration,
    turnConfigured,
    audioOutputs,
    selectedAudioOutput,
    isSpeakerphone,
    handleSelectAudioRoute,
    toggleSpeakerphone,
    fetchAudioOutputs,
    // Addendum Exports
    enableRingtone,
    setEnableRingtone,
    enableCallertone,
    setEnableCallertone,
    enableMessageSounds,
    setEnableMessageSounds,
    soundVolume,
    setSoundVolume,
    audioRouteError,
    liveDiagnostics,
    diagnosticsLog,
    playNotificationSound
  };
};
