import React, { useState, useEffect } from 'react';
import { Camera, Upload, Share2, Copy, Check, ArrowLeft, Ban, UserCheck, UserPlus, UserX, MessageSquare } from 'lucide-react';
import { MobileHeader } from '../Shared/MobileHeader';

interface MobileQRScreenProps {
  user: any;
  qrCodeDataUrl: string;
  isScanningQR: boolean;
  scannedProfile: any | null;
  qrError: string;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  startCameraScan: () => Promise<void>;
  stopCameraScan: () => void;
  handleGalleryImport: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleShareInvite: () => void;
  
  // Public actions from parent
  handleSendFriendRequestPublic: (publicId: string) => Promise<void>;
  handleBlockUserPublic: (publicId: string) => Promise<void>;
  handleCancelFriendRequestPublic: (requestId: string, publicId: string) => Promise<void>;
  handleAcceptFriendRequestPublic: (requestId: string, publicId: string) => Promise<void>;
  handleRejectFriendRequestPublic: (requestId: string, publicId: string) => Promise<void>;
  handleRemoveFriendPublic: (publicId: string) => Promise<void>;
  handleUnblockUserPublic: (publicId: string) => Promise<void>;
  
  onClose: () => void;
  chats: any[];
  friends: any[];
  setSelectedChat: (chat: any) => void;
  setActiveTab: (tab: 'chats' | 'friends' | 'calls' | 'settings') => void;
}

export const MobileQRScreen: React.FC<MobileQRScreenProps> = ({
  user,
  qrCodeDataUrl,
  isScanningQR,
  scannedProfile,
  qrError,
  videoRef,
  canvasRef,
  startCameraScan,
  stopCameraScan,
  handleGalleryImport,
  handleShareInvite,
  handleSendFriendRequestPublic,
  handleBlockUserPublic,
  handleCancelFriendRequestPublic,
  handleAcceptFriendRequestPublic,
  handleRejectFriendRequestPublic,
  handleRemoveFriendPublic,
  handleUnblockUserPublic,
  onClose,
  chats,
  friends: _friends,
  setSelectedChat,
  setActiveTab
}) => {
  const [tab, setTab] = useState<'my_code' | 'scan'>('my_code');
  const [copied, setCopied] = useState<boolean>(false);
  const [actionLoading, setActionLoading] = useState<boolean>(false);

  // Stop camera on unmount or tab switch
  useEffect(() => {
    return () => {
      stopCameraScan();
    };
  }, []);

  useEffect(() => {
    if (tab === 'my_code') {
      stopCameraScan();
    } else {
      startCameraScan();
    }
  }, [tab]);

  const copyPublicId = () => {
    if (user?.publicId) {
      navigator.clipboard.writeText(user.publicId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleAction = async (fn: () => Promise<any>) => {
    setActionLoading(true);
    try {
      await fn();
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(false);
    }
  };

  const renderRelationshipButtons = () => {
    if (!scannedProfile) return null;
    const rel = scannedProfile.relationship;
    const publicId = scannedProfile.publicId;
    const reqId = scannedProfile.requestId;

    switch (rel) {
      case 'NONE':
        return (
          <div className="flex flex-col space-y-2 w-full pt-4 border-t border-white/5">
            <button
              onClick={() => handleAction(() => handleSendFriendRequestPublic(publicId))}
              disabled={actionLoading}
              className="w-full py-3 rounded-xl bg-brand-500 hover:bg-brand-600 text-white font-bold text-xs flex items-center justify-center space-x-2 transition-all min-h-[44px]"
            >
              <UserPlus size={16} />
              <span>Send Friend Request</span>
            </button>
            <button
              onClick={() => handleAction(() => handleBlockUserPublic(publicId))}
              disabled={actionLoading}
              className="w-full py-3 rounded-xl bg-white/5 hover:bg-red-500/10 text-dark-muted hover:text-red-400 font-semibold text-xs flex items-center justify-center space-x-2 border border-white/5 transition-all min-h-[44px]"
            >
              <Ban size={16} />
              <span>Block User</span>
            </button>
          </div>
        );
      case 'PENDING_SENT':
        return (
          <div className="w-full pt-4 border-t border-white/5">
            <button
              onClick={() => handleAction(() => handleCancelFriendRequestPublic(reqId, publicId))}
              disabled={actionLoading}
              className="w-full py-3 rounded-xl bg-white/5 hover:bg-red-500/10 text-dark-muted hover:text-red-400 font-semibold text-xs flex items-center justify-center space-x-2 border border-white/5 transition-all min-h-[44px]"
            >
              <UserX size={16} />
              <span>Cancel Friend Request</span>
            </button>
          </div>
        );
      case 'PENDING_RECEIVED':
        return (
          <div className="flex space-x-2 w-full pt-4 border-t border-white/5">
            <button
              onClick={() => handleAction(() => handleAcceptFriendRequestPublic(reqId, publicId))}
              disabled={actionLoading}
              className="flex-1 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs flex items-center justify-center space-x-2 transition-all min-h-[44px]"
            >
              <UserCheck size={16} />
              <span>Accept</span>
            </button>
            <button
              onClick={() => handleAction(() => handleRejectFriendRequestPublic(reqId, publicId))}
              disabled={actionLoading}
              className="flex-1 py-3 rounded-xl bg-white/5 hover:bg-red-500/10 text-dark-muted hover:text-red-400 font-semibold text-xs flex items-center justify-center space-x-2 border border-white/5 transition-all min-h-[44px]"
            >
              <UserX size={16} />
              <span>Decline</span>
            </button>
          </div>
        );
      case 'FRIENDS':
        return (
          <div className="flex flex-col space-y-2 w-full pt-4 border-t border-white/5">
            <button
              onClick={() => {
                const match = chats.find(c => c.type === 'DIRECT' && c.otherMember?.publicId === publicId);
                if (match) {
                  setSelectedChat(match);
                  onClose();
                  setActiveTab('chats');
                } else {
                  alert('Open conversation via Friends Tab or send a message.');
                }
              }}
              className="w-full py-3 rounded-xl bg-brand-500 hover:bg-brand-600 text-white font-bold text-xs flex items-center justify-center space-x-2 transition-all min-h-[44px]"
            >
              <MessageSquare size={16} />
              <span>Open Chat</span>
            </button>
            <button
              onClick={() => handleAction(() => handleRemoveFriendPublic(publicId))}
              disabled={actionLoading}
              className="w-full py-3 rounded-xl bg-white/5 hover:bg-red-500/10 text-dark-muted hover:text-red-400 font-semibold text-xs flex items-center justify-center space-x-2 border border-white/5 transition-all min-h-[44px]"
            >
              <UserX size={16} />
              <span>Remove Friend</span>
            </button>
          </div>
        );
      case 'BLOCKED':
        const isYouBlocked = scannedProfile.blockState === 'YOU_BLOCKED';
        return (
          <div className="w-full pt-4 border-t border-white/5">
            {isYouBlocked ? (
              <button
                onClick={() => handleAction(() => handleUnblockUserPublic(publicId))}
                disabled={actionLoading}
                className="w-full py-3 rounded-xl bg-brand-500/10 hover:bg-brand-500 text-brand-400 hover:text-white font-semibold text-xs flex items-center justify-center space-x-2 border border-brand-500/20 transition-all min-h-[44px]"
              >
                <UserCheck size={16} />
                <span>Unblock User</span>
              </button>
            ) : (
              <div className="w-full py-3 rounded-xl bg-red-500/5 border border-red-500/10 text-red-400 font-semibold text-xs text-center">
                User Blocked
              </div>
            )}
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 bg-dark-bg z-40 flex flex-col animate-fade-in select-none">
      <MobileHeader
        title="QR Code Invite"
        leftAction={
          <button onClick={onClose} className="p-2.5 rounded-xl hover:bg-white/5 text-dark-muted hover:text-white min-h-[44px] min-w-[44px] flex items-center justify-center">
            <ArrowLeft size={20} />
          </button>
        }
      />

      {/* Tabs */}
      <div className="flex border-b border-dark-border bg-dark-surface/30 shrink-0">
        <button
          onClick={() => setTab('my_code')}
          className={`flex-1 py-3.5 text-xs font-bold transition-all relative ${
            tab === 'my_code' ? 'text-brand-400' : 'text-dark-muted hover:text-white'
          }`}
        >
          <span>My QR Code</span>
          {tab === 'my_code' && (
            <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-brand-500" />
          )}
        </button>
        <button
          onClick={() => setTab('scan')}
          className={`flex-1 py-3.5 text-xs font-bold transition-all relative ${
            tab === 'scan' ? 'text-brand-400' : 'text-dark-muted hover:text-white'
          }`}
        >
          <span>Scan Code</span>
          {tab === 'scan' && (
            <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-brand-500" />
          )}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 flex flex-col items-center">
        {tab === 'my_code' ? (
          <div className="w-full max-w-sm flex flex-col items-center space-y-6 animate-fade-in">
            {/* Card Container */}
            <div className="w-full p-6 rounded-3xl bg-dark-surface/40 backdrop-blur-xl border border-white/5 flex flex-col items-center text-center shadow-2xl relative overflow-hidden">
              {/* Radial gradient background decoration */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-48 bg-brand-500/10 rounded-full blur-3xl pointer-events-none" />
              
              <div className="w-16 h-16 rounded-2xl overflow-hidden border border-white/10 shadow-lg mb-3">
                <img
                  src={user?.profile?.avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${user?.username}`}
                  alt="Profile"
                  className="w-full h-full object-cover"
                />
              </div>
              <h2 className="text-base font-bold text-white leading-tight">
                {user?.profile?.displayName || user?.username}
              </h2>
              <p className="text-xs text-dark-muted mt-0.5">@{user?.username}</p>

              {/* QR Image */}
              <div className="my-6 p-4 bg-white rounded-2xl shadow-inner relative group border border-white/5">
                {qrCodeDataUrl ? (
                  <img
                    src={qrCodeDataUrl}
                    alt="My QR Code"
                    className="w-48 h-48 block object-contain"
                  />
                ) : (
                  <div className="w-48 h-48 flex items-center justify-center text-dark-bg font-medium text-xs">
                    Generating QR Code...
                  </div>
                )}
              </div>

              {/* Public ID Box */}
              <div className="w-full bg-dark-bg/60 border border-white/5 rounded-2xl p-3 flex items-center justify-between">
                <div className="min-w-0 text-left">
                  <span className="text-[10px] text-dark-muted font-semibold block uppercase tracking-wider">Public ID</span>
                  <span className="text-xs font-mono font-bold text-brand-400 block truncate select-text">{user?.publicId}</span>
                </div>
                <button
                  onClick={copyPublicId}
                  className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-dark-muted hover:text-white transition-colors"
                >
                  {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                </button>
              </div>
            </div>

            {/* Actions */}
            <button
              onClick={handleShareInvite}
              className="w-full py-3.5 rounded-2xl bg-brand-500 hover:bg-brand-600 text-white font-bold text-xs flex items-center justify-center space-x-2 shadow-lg hover:shadow-brand-500/20 transition-all min-h-[44px]"
            >
              <Share2 size={16} />
              <span>Share Invite Link</span>
            </button>
          </div>
        ) : (
          <div className="w-full max-w-sm flex flex-col items-center space-y-6 animate-fade-in">
            {/* Camera Viewport / Scanning Screen */}
            <div className="w-full aspect-square rounded-3xl overflow-hidden bg-dark-surface/40 backdrop-blur-xl border border-white/5 relative shadow-2xl flex flex-col items-center justify-center">
              {isScanningQR ? (
                <>
                  <video
                    ref={videoRef as any}
                    className="w-full h-full object-cover"
                    playsInline
                    muted
                  />
                  {/* Laser scan line decoration */}
                  <div className="absolute left-0 right-0 h-0.5 bg-brand-500 shadow-[0_0_10px_#6366f1] top-1/2 -translate-y-1/2 animate-[pulse_1.5s_infinite]" />
                  <canvas ref={canvasRef as any} className="hidden" />
                </>
              ) : (
                <div className="flex flex-col items-center justify-center text-center p-6 space-y-3">
                  <div className="p-4 rounded-full bg-white/5 text-dark-muted">
                    <Camera size={32} />
                  </div>
                  <p className="text-xs text-dark-muted">Camera scanner is currently stopped.</p>
                  <button
                    onClick={startCameraScan}
                    className="px-4 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-xs font-bold transition-all min-h-[40px]"
                  >
                    Start Camera Scanner
                  </button>
                </div>
              )}

              {isScanningQR && (
                <button
                  onClick={stopCameraScan}
                  className="absolute bottom-4 px-4 py-2 rounded-xl bg-black/60 hover:bg-black/80 backdrop-blur-md text-white text-[10px] font-bold transition-all min-h-[36px]"
                >
                  Stop Scanner
                </button>
              )}
            </div>

            {/* Error Message */}
            {qrError && (
              <div className="w-full p-3.5 bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded-2xl text-center font-medium">
                {qrError}
              </div>
            )}

            {/* Import Button */}
            <label className="w-full py-3 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/5 text-dark-muted hover:text-white font-bold text-xs flex items-center justify-center space-x-2 transition-all cursor-pointer min-h-[44px]">
              <Upload size={16} />
              <span>Import QR from Gallery</span>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleGalleryImport}
              />
            </label>

            {/* Scanned Profile Preview */}
            {scannedProfile && (
              <div className="w-full p-5 rounded-3xl bg-dark-surface/40 backdrop-blur-xl border border-brand-500/20 flex flex-col items-center text-center space-y-3 animate-slide-up">
                <div className="w-14 h-14 rounded-2xl overflow-hidden border border-white/10">
                  <img
                    src={scannedProfile.avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${scannedProfile.username}`}
                    alt="Scanned Profile"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-white leading-tight">
                    {scannedProfile.displayName || scannedProfile.username}
                  </h4>
                  <p className="text-[10px] text-dark-muted mt-0.5">@{scannedProfile.username}</p>
                </div>
                {scannedProfile.bio && (
                  <p className="text-xs text-dark-muted italic leading-relaxed px-2">
                    "{scannedProfile.bio}"
                  </p>
                )}
                {renderRelationshipButtons()}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default MobileQRScreen;
