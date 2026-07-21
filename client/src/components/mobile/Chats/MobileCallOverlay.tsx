import React, { useState, useRef, useEffect } from 'react';
import {
  Phone, PhoneOff, Mic, MicOff, Video, VideoOff,
  Volume2, VolumeX, Headphones, X, CameraOff,
  Minimize2, Maximize2, MoreHorizontal, Info
} from 'lucide-react';

/* ─── types ─── */
interface MobileCallOverlayProps {
  callState: 'idle' | 'incoming' | 'outgoing' | 'active';
  callPeer: any;
  callType: 'audio' | 'video';
  callDuration: number;
  isMuted: boolean;
  isVideoEnabled: boolean;
  isSpeakerphone: boolean;
  connectionQuality: string;
  showFallbackPrompt: boolean;
  audioOutputs: any[];
  selectedAudioOutput: string;
  audioRouteError: string;
  liveDiagnostics: any;

  localVideoRef: React.RefObject<HTMLVideoElement | null>;
  remoteVideoRef: React.RefObject<HTMLVideoElement | null>;
  remoteAudioRef: React.RefObject<HTMLAudioElement | null>;

  acceptCall: () => void;
  rejectCall: () => void;
  endCall: () => void;
  toggleMute: () => void;
  toggleCamera: () => void;
  switchToAudioOnly: () => void;
  toggleSpeakerphone: () => void;
  fetchAudioOutputs: () => void;
  handleSelectAudioRoute: (deviceId: string) => void;
  formatCallDuration: (seconds: number) => string;
}

/* ─── quality helpers ─── */
const Q_LABEL: Record<string, string> = { good: '●●●●', fair: '●●●○', poor: '●●○○', very_poor: '●○○○' };
const Q_COLOR: Record<string, string> = { good: '#10b981', fair: '#f59e0b', poor: '#f97316', very_poor: '#ef4444' };

/* ─── Control button ─── */
const CtrlBtn: React.FC<{
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  danger?: boolean;
  size?: number;
}> = ({ onClick, icon, label, active, danger, size = 56 }) => {
  const bg = danger
    ? 'rgba(239,68,68,0.2)' : active
    ? 'rgba(99,102,241,0.25)' : 'rgba(255,255,255,0.1)';
  const border = danger
    ? 'rgba(239,68,68,0.4)' : active
    ? 'rgba(99,102,241,0.5)' : 'rgba(255,255,255,0.1)';
  const color = danger ? '#fca5a5' : active ? '#a5b4fc' : '#fff';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, minWidth: size + 8 }}>
      <button
        onClick={onClick}
        style={{
          width: size, height: size, borderRadius: '50%',
          background: bg, border: `1.5px solid ${border}`, color,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
          cursor: 'pointer', transition: 'transform 0.15s, background 0.15s',
          boxShadow: active ? `0 0 20px ${color}40` : danger ? '0 4px 16px rgba(239,68,68,0.3)' : 'none',
        }}
        onTouchStart={e => { e.currentTarget.style.transform = 'scale(0.92)'; }}
        onTouchEnd={e => { e.currentTarget.style.transform = 'scale(1)'; }}
      >
        {icon}
      </button>
      <span style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.55)', letterSpacing: '0.05em', textTransform: 'uppercase', lineHeight: 1 }}>
        {label}
      </span>
    </div>
  );
};

/* ─── Big accept/end button ─── */
const BigBtn: React.FC<{ onClick: () => void; icon: React.ReactNode; label: string; color: string }> = ({
  onClick, icon, label, color,
}) => (
  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
    <button
      onClick={onClick}
      style={{
        width: 72, height: 72, borderRadius: '50%', border: 'none',
        background: color, color: '#fff',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: `0 8px 32px ${color}88`, cursor: 'pointer',
        transition: 'transform 0.15s',
      }}
      onTouchStart={e => { e.currentTarget.style.transform = 'scale(0.9)'; }}
      onTouchEnd={e => { e.currentTarget.style.transform = 'scale(1)'; }}
    >
      {icon}
    </button>
    <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', fontWeight: 600 }}>{label}</span>
  </div>
);

/* ─── Avatar with pulse ─── */
const PeerAvatar: React.FC<{ peer: any; size?: number; pulse?: boolean; speaking?: boolean }> = ({
  peer, size = 104, pulse, speaking,
}) => {
  const src = peer?.profile?.avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${peer?.username}`;
  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      {pulse && (
        <>
          <div style={{ position: 'absolute', inset: -16, borderRadius: '50%', background: 'rgba(99,102,241,0.15)', animation: 'mco-pulse 2s ease-in-out infinite' }} />
          <div style={{ position: 'absolute', inset: -8, borderRadius: '50%', background: 'rgba(99,102,241,0.1)', animation: 'mco-pulse 2s ease-in-out infinite 0.6s' }} />
        </>
      )}
      {speaking && (
        <div style={{ position: 'absolute', inset: -4, borderRadius: '50%', border: '3px solid #10b981', animation: 'mco-speak 0.7s ease-in-out infinite alternate', zIndex: 2 }} />
      )}
      <img
        src={src}
        alt={peer?.profile?.displayName || peer?.username || 'peer'}
        style={{
          width: size, height: size, borderRadius: '50%', objectFit: 'cover',
          border: '3px solid rgba(255,255,255,0.12)',
          boxShadow: '0 8px 40px rgba(0,0,0,0.6)',
          position: 'relative', zIndex: 1,
        }}
      />
    </div>
  );
};

/* ═══════════════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════════════ */
export const MobileCallOverlay: React.FC<MobileCallOverlayProps> = (props) => {
  const {
    callState, callPeer, callType, callDuration, isMuted, isVideoEnabled,
    isSpeakerphone, connectionQuality, showFallbackPrompt,
    audioOutputs, selectedAudioOutput, audioRouteError, liveDiagnostics,
    localVideoRef, remoteVideoRef, remoteAudioRef,
    acceptCall, rejectCall, endCall, toggleMute, toggleCamera,
    switchToAudioOnly, toggleSpeakerphone, fetchAudioOutputs,
    handleSelectAudioRoute, formatCallDuration,
  } = props;

  /* UI state */
  const [remoteFullscreen, setRemoteFullscreen] = useState(false);
  const [showAudioMenu, setShowAudioMenu] = useState(false);
  const [showDiag, setShowDiag] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const [_pipSwapped, setPipSwapped] = useState(false);

  /* Simulate active-speaker indicator */
  const [remoteIsSpeaking, setRemoteIsSpeaking] = useState(false);
  const speakTimerRef = useRef<any>(null);
  useEffect(() => {
    if (callState !== 'active' || isMuted) return;
    const fire = () => {
      setRemoteIsSpeaking(true);
      speakTimerRef.current = setTimeout(() => setRemoteIsSpeaking(false), 1200 + Math.random() * 800);
      speakTimerRef.current = setTimeout(fire, 3000 + Math.random() * 4000);
    };
    speakTimerRef.current = setTimeout(fire, 2000);
    return () => clearTimeout(speakTimerRef.current);
  }, [callState, isMuted]);

  if (callState === 'idle' || !callPeer) return null;

  const peerName = callPeer?.profile?.displayName || callPeer?.username || 'Unknown';
  const isVideo = callType === 'video';
  const isActive = callState === 'active';
  const isIncoming = callState === 'incoming';
  const isOutgoing = callState === 'outgoing';

  /* ─── fullscreen participant mode ─── */


  return (
    <div
      id="velvet-call-overlay"
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: '#000',
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden', userSelect: 'none', WebkitUserSelect: 'none',
        /* iOS safe areas */
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      <style>{`
        @keyframes mco-pulse { 0%,100%{opacity:.5;transform:scale(1)} 50%{opacity:.15;transform:scale(1.14)} }
        @keyframes mco-ring  { 0%,100%{transform:scale(1)rotate(0)} 20%{transform:scale(1.08)rotate(-6deg)} 40%{transform:scale(1.08)rotate(6deg)} }
        @keyframes mco-speak { from{box-shadow:0 0 0 0 #10b98144} to{box-shadow:0 0 0 8px #10b98100} }
        @keyframes mco-fade-up { from{opacity:0;transform:translateY(18px)} to{opacity:1;transform:translateY(0)} }
        @keyframes mco-spin   { to{transform:rotate(360deg)} }
        @keyframes mco-bounce { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-6px)} }
        .mco-enter { animation: mco-fade-up 0.35s cubic-bezier(0.22,1,0.36,1) both; }
        .mco-ring-anim { animation: mco-ring 1.8s ease-in-out infinite; }
      `}</style>

      {/* ════ BACKGROUND ════ */}
      {isVideo && isActive ? (
        /* Remote video as full background */
        <video
          ref={remoteVideoRef as React.RefObject<HTMLVideoElement>}
          autoPlay playsInline
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
        />
      ) : (
        /* Gradient for audio / pre-call */
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(160deg, #0f0a1e 0%, #0a1225 55%, #050d1a 100%)',
        }}>
          <div style={{ position: 'absolute', top: '-20%', left: '-10%', width: '70%', height: '70%', borderRadius: '50%', background: 'radial-gradient(circle,rgba(99,102,241,0.3)0%,transparent 70%)', filter: 'blur(60px)' }} />
          <div style={{ position: 'absolute', bottom: '-15%', right: '-10%', width: '60%', height: '60%', borderRadius: '50%', background: 'radial-gradient(circle,rgba(79,70,229,0.2)0%,transparent 70%)', filter: 'blur(60px)' }} />
        </div>
      )}

      {/* Scrim over video */}
      {isVideo && isActive && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 1, pointerEvents: 'none',
          background: 'linear-gradient(to bottom, rgba(0,0,0,0.72) 0%, rgba(0,0,0,0) 35%, rgba(0,0,0,0) 60%, rgba(0,0,0,0.85) 100%)',
        }} />
      )}

      {/* ════ AUDIO ELEMENT ════ */}
      <audio ref={remoteAudioRef as React.RefObject<HTMLAudioElement>} autoPlay style={{ display: 'none' }} />

      {/* ════ PiP: LOCAL CAMERA ════ */}
      {isVideo && isActive && (
        <div
          onClick={() => setPipSwapped(v => !v)}
          style={{
            position: 'absolute', zIndex: 30,
            top: 'calc(env(safe-area-inset-top) + 80px)', right: 14,
            width: 88, height: 128, borderRadius: 18,
            overflow: 'hidden', border: '2px solid rgba(255,255,255,0.22)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.65)',
            background: '#0a0d16', cursor: 'pointer',
            transition: 'transform 0.15s',
          }}
        >
          {isVideoEnabled
            ? <video ref={localVideoRef as React.RefObject<HTMLVideoElement>} autoPlay playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }} />
            : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><VideoOff size={18} color="rgba(255,255,255,0.3)" /></div>
          }
          {/* Swap hint */}
          <div style={{ position: 'absolute', bottom: 4, left: 0, right: 0, textAlign: 'center', fontSize: 8, fontWeight: 800, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.06em' }}>TAP TO SWAP</div>
        </div>
      )}

      {/* ════ TOP HUD ════ */}
      <div className="mco-enter" style={{
        position: 'relative', zIndex: 10,
        paddingTop: 12, paddingLeft: 16, paddingRight: 16,
        display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
        minHeight: 56,
      }}>
        {/* Quality pill */}
        {isActive && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '5px 12px', borderRadius: 20,
            background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
            border: '1px solid rgba(255,255,255,0.08)',
          }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#ef4444', animation: 'mco-pulse 1.5s ease-in-out infinite' }} />
            <span style={{ fontSize: 12, fontWeight: 700, color: '#fff' }}>{formatCallDuration(callDuration)}</span>
            <div style={{ width: 1, height: 12, background: 'rgba(255,255,255,0.15)' }} />
            <span style={{ fontSize: 11, fontWeight: 800, color: Q_COLOR[connectionQuality] || '#6b7280' }}>
              {Q_LABEL[connectionQuality] || '○○○○'}
            </span>
          </div>
        )}
        {!isActive && <div />}

        {/* Fullscreen expand button (video active) */}
        {isVideo && isActive && (
          <button
            onClick={() => setRemoteFullscreen(v => !v)}
            style={{
              width: 36, height: 36, borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)',
              background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)',
              color: 'rgba(255,255,255,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
            }}
          >
            {remoteFullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
          </button>
        )}
      </div>

      {/* ════ PEER INFO (top center) ════ */}
      <div className="mco-enter" style={{
        position: 'relative', zIndex: 10,
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        paddingTop: isVideo && isActive ? 0 : 12, gap: 6, marginTop: isVideo && isActive ? 4 : 0,
      }}>
        {/* State badge */}
        <div style={{
          padding: '4px 14px', borderRadius: 20, fontSize: 10, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase',
          background: isActive ? 'rgba(16,185,129,0.15)' : 'rgba(99,102,241,0.15)',
          border: `1px solid ${isActive ? 'rgba(16,185,129,0.3)' : 'rgba(99,102,241,0.3)'}`,
          color: isActive ? '#6ee7b7' : '#a5b4fc',
        }}>
          {isIncoming ? `${isVideo ? '📹' : '📞'} Incoming ${isVideo ? 'Video' : 'Voice'}` : isOutgoing ? '📞 Calling…' : `${isVideo ? '📹' : '📞'} In Call`}
        </div>

        <h2 style={{ fontSize: 28, fontWeight: 900, color: '#fff', margin: 0, letterSpacing: '-0.025em', textShadow: '0 2px 16px rgba(0,0,0,0.7)', textAlign: 'center' }}>
          {peerName}
        </h2>
        <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>@{callPeer?.username}</span>

        {/* Active speaker badge */}
        {isActive && remoteIsSpeaking && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 12, background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)', animation: 'mco-fade-up 0.2s ease both' }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981', animation: 'mco-speak 0.5s ease-in-out infinite alternate' }} />
            <span style={{ fontSize: 10, fontWeight: 700, color: '#6ee7b7', letterSpacing: '0.05em' }}>SPEAKING</span>
          </div>
        )}
      </div>

      {/* ════ MIDDLE: Avatar for audio / pre-call ════ */}
      {!(isVideo && isActive) && (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', zIndex: 10 }}>
          <div className={isIncoming ? 'mco-ring-anim' : ''}>
            <PeerAvatar peer={callPeer} size={120} pulse={!isActive} speaking={isActive && remoteIsSpeaking} />
          </div>
        </div>
      )}

      {/* Spacer for video active */}
      {isVideo && isActive && <div style={{ flex: 1 }} />}

      {/* ════ FALLBACK PROMPT ════ */}
      {showFallbackPrompt && isVideo && (
        <div className="mco-enter" style={{
          position: 'relative', zIndex: 10, margin: '0 16px 8px',
          padding: '10px 14px', borderRadius: 14, textAlign: 'center',
          background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.3)',
          color: '#fcd34d', fontSize: 12, fontWeight: 600,
        }}>
          ⚠ Low bandwidth — switching to audio only…
        </div>
      )}

      {/* ════ AUDIO MENU ════ */}
      {showAudioMenu && (
        <div className="mco-enter" style={{
          position: 'absolute', bottom: 240, left: 16, right: 16, zIndex: 50,
          background: 'rgba(12,16,28,0.96)', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)',
          border: '1px solid rgba(255,255,255,0.08)', borderRadius: 24, padding: '16px 18px',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <span style={{ fontSize: 11, fontWeight: 800, color: '#818cf8', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Audio Output</span>
            <button onClick={() => setShowAudioMenu(false)} style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer' }}><X size={14} /></button>
          </div>
          {audioRouteError
            ? <p style={{ fontSize: 12, color: '#f87171' }}>{audioRouteError}</p>
            : audioOutputs.length > 0
              ? audioOutputs.map(d => (
                <button
                  key={d.deviceId}
                  onClick={() => { handleSelectAudioRoute(d.deviceId); setShowAudioMenu(false); }}
                  style={{
                    width: '100%', textAlign: 'left', padding: '11px 14px', borderRadius: 14, marginBottom: 6,
                    background: selectedAudioOutput === d.deviceId ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.04)',
                    border: `1px solid ${selectedAudioOutput === d.deviceId ? 'rgba(99,102,241,0.5)' : 'rgba(255,255,255,0.06)'}`,
                    color: selectedAudioOutput === d.deviceId ? '#a5b4fc' : 'rgba(255,255,255,0.7)',
                    fontSize: 13, fontWeight: 600, cursor: 'pointer',
                  }}
                >
                  {d.label || `Output (${d.deviceId.slice(0, 8)})`}
                </button>
              ))
            : <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)' }}>No outputs found</p>
          }
        </div>
      )}

      {/* ════ DIAGNOSTICS ════ */}
      {showDiag && liveDiagnostics && (
        <div className="mco-enter" style={{
          position: 'absolute', top: 90, left: 16, right: 16, zIndex: 50, maxHeight: 220, overflowY: 'auto',
          background: 'rgba(4,8,20,0.92)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
          border: '1px solid rgba(99,102,241,0.25)', borderRadius: 18, padding: '12px 14px',
          fontSize: 10, fontFamily: 'monospace', color: '#a5b4fc',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 9, fontWeight: 900, letterSpacing: '0.1em', color: '#6366f1', textTransform: 'uppercase' }}>WebRTC Diagnostics</span>
            <button onClick={() => setShowDiag(false)} style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer' }}><X size={11} /></button>
          </div>
          {[
            ['Local', liveDiagnostics.localStreamStatus],
            ['Remote', liveDiagnostics.remoteStreamStatus],
            ['Tracks', `${liveDiagnostics.localVideoTracksCount ?? '?'}V ${liveDiagnostics.localAudioTracksCount ?? '?'}A`],
            ['Signaling', liveDiagnostics.signalingState],
            ['ICE', liveDiagnostics.iceConnectionState || liveDiagnostics.iceState],
            ['Conn', liveDiagnostics.connectionState],
            ['TURN', liveDiagnostics.isTurnUsed ? 'YES' : 'NO'],
          ].map(([k, v]) => v && (
            <div key={k} style={{ display: 'flex', gap: 10, marginBottom: 4 }}>
              <span style={{ color: 'rgba(255,255,255,0.3)', minWidth: 60 }}>{k}:</span>
              <span style={{ color: 'rgba(255,255,255,0.8)' }}>{v}</span>
            </div>
          ))}
        </div>
      )}

      {/* ════ BOTTOM CONTROLS ════ */}
      <div className="mco-enter" style={{
        position: 'relative', zIndex: 10,
        paddingBottom: 'max(env(safe-area-inset-bottom), 20px)',
        paddingLeft: 16, paddingRight: 16,
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16,
      }}>

        {/* ── INCOMING ── */}
        {isIncoming && (
          <div style={{ display: 'flex', gap: 56, alignItems: 'center', paddingBottom: 12 }}>
            <BigBtn onClick={rejectCall} icon={<PhoneOff size={30} />} label="Decline" color="#ef4444" />
            <BigBtn onClick={acceptCall} icon={<Phone size={30} />} label="Accept" color="#22c55e" />
          </div>
        )}

        {/* ── OUTGOING ── */}
        {isOutgoing && (
          <div style={{ paddingBottom: 12 }}>
            <BigBtn onClick={endCall} icon={<PhoneOff size={30} />} label="Cancel" color="#ef4444" />
          </div>
        )}

        {/* ── ACTIVE CONTROLS ── */}
        {isActive && (
          <>
            {/* Primary row */}
            <div style={{
              display: 'flex', gap: 20, alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap',
              padding: '16px 20px', borderRadius: 28,
              background: 'rgba(255,255,255,0.05)', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)',
              border: '1px solid rgba(255,255,255,0.07)',
            }}>
              <CtrlBtn onClick={toggleMute} icon={isMuted ? <MicOff size={22} /> : <Mic size={22} />} label={isMuted ? 'Unmute' : 'Mute'} danger={isMuted} />
              {isVideo && (
                <CtrlBtn onClick={toggleCamera} icon={isVideoEnabled ? <Video size={22} /> : <VideoOff size={22} />} label="Camera" danger={!isVideoEnabled} />
              )}
              <CtrlBtn onClick={toggleSpeakerphone} icon={isSpeakerphone ? <Volume2 size={22} /> : <VolumeX size={22} />} label="Speaker" active={isSpeakerphone} />
              {isVideo && (
                <CtrlBtn onClick={switchToAudioOnly} icon={<CameraOff size={22} />} label="Audio" />
              )}
              <CtrlBtn onClick={() => { fetchAudioOutputs(); setShowAudioMenu(v => !v); }} icon={<Headphones size={22} />} label="Output" active={showAudioMenu} />
              <CtrlBtn onClick={() => setShowMore(v => !v)} icon={<MoreHorizontal size={22} />} label="More" active={showMore} />
            </div>

            {/* More tray */}
            {showMore && (
              <div className="mco-enter" style={{
                display: 'flex', gap: 20, justifyContent: 'center', padding: '12px 20px',
                borderRadius: 20, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)',
              }}>
                <CtrlBtn onClick={() => setShowDiag(v => !v)} icon={<Info size={20} />} label="Debug" active={showDiag} size={48} />
                {isVideo && (
                  <CtrlBtn onClick={() => setRemoteFullscreen(v => !v)} icon={remoteFullscreen ? <Minimize2 size={20} /> : <Maximize2 size={20} />} label={remoteFullscreen ? 'Exit' : 'Full'} size={48} />
                )}
              </div>
            )}

            {/* End call */}
            <BigBtn onClick={endCall} icon={<PhoneOff size={30} />} label="End Call" color="#ef4444" />
          </>
        )}
      </div>
    </div>
  );
};

export default MobileCallOverlay;
