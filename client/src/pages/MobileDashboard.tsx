import React, { useState, useEffect } from 'react';
import { App } from '@capacitor/app';

import BottomNavigation from '../components/mobile/Navigation/BottomNavigation';
import MobileHeader from '../components/mobile/Shared/MobileHeader';
import MobileChatsScreen from '../components/mobile/Chats/MobileChatsScreen';
import MobileConversationScreen from '../components/mobile/Chats/MobileConversationScreen';
import MobileChatDetailsScreen from '../components/mobile/Chats/MobileChatDetailsScreen';
import MobileFriendsScreen from '../components/mobile/Friends/MobileFriendsScreen';
import MobileQRScreen from '../components/mobile/Friends/MobileQRScreen';
import MobileCallsScreen from '../components/mobile/Chats/MobileCallsScreen';
import MobileCallOverlay from '../components/mobile/Chats/MobileCallOverlay';
import MobileSettingsScreen from '../components/mobile/Settings/MobileSettingsScreen';
import MobileSearchOverlay from '../components/mobile/Shared/MobileSearchOverlay';

interface MobileDashboardProps {
  user: any;
  logout: () => void;
  chats: any[];
  selectedChat: any;
  setSelectedChat: (chat: any) => void;
  messages: any[];
  typedMessage: string;
  setTypedMessage: (val: string) => void;
  handleSendMessage: (e: React.FormEvent) => void;
  replyingToMessage: any;
  setReplyingToMessage: (msg: any) => void;
  editingMessage: any;
  setEditingMessage: (msg: any) => void;
  handleFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
  isUploading: boolean;
  uploadProgress: number | null;
  typingUsers: Record<string, boolean>;
  activeTypingChatId: string | null;

  // Global search modal
  showSearchModal: boolean;
  setShowSearchModal: (show: boolean) => void;
  userSearchQuery: string;
  setUserSearchQuery: (val: string) => void;
  userSearchResults: any[];
  handleUserSearch: (e: React.FormEvent) => void;
  startDirectChat: (targetUser: any) => Promise<void>;

  // Friendship
  friends: any[];
  pendingIncomingRequests: any[];
  pendingOutgoingRequests: any[];
  blockedUsers: any[];
  handleAcceptFriendRequest: (requestId: string) => void;
  handleRejectFriendRequest: (requestId: string) => void;
  handleCancelFriendRequest: (requestId: string) => void;
  handleBlockUser: (blockedId: string) => void;
  handleUnblockUser: (blockedId: string) => void;
  handleSendFriendRequest: (receiverId: string) => void;
  
  whoCanSendFriendRequests: string;
  whoCanCallMe: string;
  whoCanSeeProfilePhoto: string;
  whoCanSeeLastSeen: string;
  updatePreference: (key: string, value: any) => Promise<void>;

  
  // Public friendship handlers for QR Code
  handleSendFriendRequestPublic: (publicId: string) => Promise<void>;
  handleBlockUserPublic: (publicId: string) => Promise<void>;
  handleCancelFriendRequestPublic: (requestId: string, publicId: string) => Promise<void>;
  handleAcceptFriendRequestPublic: (requestId: string, publicId: string) => Promise<void>;
  handleRejectFriendRequestPublic: (requestId: string, publicId: string) => Promise<void>;
  handleRemoveFriendPublic: (publicId: string) => Promise<void>;
  handleUnblockUserPublic: (publicId: string) => Promise<void>;
  openChatForUser: (targetUser: any) => void;

  // QR invite
  showFriendshipModal: boolean;
  setShowFriendshipModal: (show: boolean) => void;
  friendshipModalTab: 'friends' | 'pending' | 'blocked' | 'qr_invite';
  setFriendshipModalTab: (tab: 'friends' | 'pending' | 'blocked' | 'qr_invite') => void;
  qrCodeDataUrl: string;
  isScanningQR: boolean;
  scannedProfile: any;
  qrError: string;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  startCameraScan: () => Promise<void>;
  stopCameraScan: () => void;
  handleGalleryImport: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleShareInvite: () => void;

  // Calls
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
  callHistory: any[];
  startCall: (type: 'audio' | 'video', targetUser: any) => void;

  // Profile fields
  displayNameInput: string;
  setDisplayNameInput: (val: string) => void;
  usernameInput: string;
  setUsernameInput: (val: string) => void;
  bioInput: string;
  setBioInput: (val: string) => void;
  avatarUrlInput: string;
  setAvatarUrlInput: (val: string) => void;
  currentPasswordInput: string;
  setCurrentPasswordInput: (val: string) => void;
  newPasswordInput: string;
  setNewPasswordInput: (val: string) => void;
  confirmPasswordInput: string;
  setConfirmPasswordInput: (val: string) => void;
  isUploadingAvatar: boolean;
  setIsUploadingAvatar: (val: boolean) => void;
  saveProfile: (e: React.FormEvent) => Promise<void>;
  getAbsoluteUrl: (url: string) => string;

  // Sound settings
  enableRingtone: boolean;
  setEnableRingtone: (val: boolean) => void;
  enableCallertone: boolean;
  setEnableCallertone: (val: boolean) => void;
  enableMessageSounds: boolean;
  setEnableMessageSounds: (val: boolean) => void;
  soundVolume: number;
  setSoundVolume: (val: number) => void;

  // Group creation
  showCreateGroupModal: boolean;
  setShowCreateGroupModal: (show: boolean) => void;
  groupNameInput: string;
  setGroupNameInput: (val: string) => void;
  groupDescInput: string;
  setGroupDescInput: (val: string) => void;
  groupAvatarUrlInput: string;
  setGroupAvatarUrlInput: (val: string) => void;
  selectedMemberIds: string[];
  toggleSelectMember: (memberId: string) => void;
  groupMemberSearchQuery: string;
  setGroupMemberSearchQuery: (val: string) => void;
  groupMemberSearchResults: any[];
  handleGroupMemberSearch: (e: React.FormEvent) => void;
  handleCreateGroup: (e: React.FormEvent) => void;
}

export const MobileDashboard: React.FC<MobileDashboardProps> = (props) => {
  const [activeTab, setActiveTab] = useState<'chats' | 'friends' | 'calls' | 'settings'>('chats');
  const [showDetails, setShowDetails] = useState<boolean>(false);

  // Bind native Android hardware back button
  useEffect(() => {
    let backListener: any = null;

    const setupBackButton = async () => {
      try {
        backListener = await App.addListener('backButton', () => {
          if (showDetails) {
            setShowDetails(false);
          } else if (props.selectedChat) {
            props.setSelectedChat(null);
          } else if (props.showSearchModal) {
            props.setShowSearchModal(false);
          } else if (props.showFriendshipModal) {
            props.setShowFriendshipModal(false);
          } else if (props.showCreateGroupModal) {
            props.setShowCreateGroupModal(false);
          } else {
            App.exitApp();
          }
        });
      } catch (err) {
        // Ignored in desktop browser environments
      }
    };

    setupBackButton();

    return () => {
      if (backListener) {
        backListener.remove();
      }
    };
  }, [showDetails, props.selectedChat, props.showSearchModal, props.showFriendshipModal, props.showCreateGroupModal]);

  // Unread badge tallies
  const unreadChatsCount = props.chats.reduce((acc, c) => acc + (c.unreadCount || 0), 0);
  const pendingRequestsCount = props.pendingIncomingRequests.length;
  
  // Calculate missed calls count
  const missedCallsCount = props.callHistory.filter(
    log => log.callerId !== props.user?.id && log.status === 'MISSED'
  ).length;

  const renderActiveTabScreen = () => {
    switch (activeTab) {
      case 'chats':
        return (
          <MobileChatsScreen
            chats={props.chats}
            selectedChat={props.selectedChat}
            setSelectedChat={props.setSelectedChat}
            typingUsers={props.typingUsers}
            activeTypingChatId={props.activeTypingChatId}
            onCreateGroupClick={() => props.setShowCreateGroupModal(true)}
            onSearchUserClick={() => props.setShowSearchModal(true)}
          />
        );
      case 'friends':
        return (
          <MobileFriendsScreen
            friends={props.friends}
            pendingIncomingRequests={props.pendingIncomingRequests}
            pendingOutgoingRequests={props.pendingOutgoingRequests}
            blockedUsers={props.blockedUsers}
            handleAcceptFriendRequest={props.handleAcceptFriendRequest}
            handleRejectFriendRequest={props.handleRejectFriendRequest}
            handleCancelFriendRequest={props.handleCancelFriendRequest}
            handleBlockUser={props.handleBlockUser}
            handleUnblockUser={props.handleUnblockUser}
            onQRClick={() => {
              props.setFriendshipModalTab('qr_invite');
              props.setShowFriendshipModal(true);
            }}
            onStartChat={async (targetUser) => {
              await props.startDirectChat(targetUser);
              setActiveTab('chats');
            }}
          />
        );
      case 'calls':
        return (
          <MobileCallsScreen
            callHistory={props.callHistory}
            user={props.user}
            startCall={props.startCall}
            openChatForUser={props.openChatForUser}
            setActiveTab={setActiveTab}
          />
        );
      case 'settings':
        return (
          <MobileSettingsScreen
            user={props.user}
            logout={props.logout}
            getAbsoluteUrl={props.getAbsoluteUrl}
            displayNameInput={props.displayNameInput}
            setDisplayNameInput={props.setDisplayNameInput}
            usernameInput={props.usernameInput}
            setUsernameInput={props.setUsernameInput}
            bioInput={props.bioInput}
            setBioInput={props.setBioInput}
            avatarUrlInput={props.avatarUrlInput}
            setAvatarUrlInput={props.setAvatarUrlInput}
            isUploadingAvatar={props.isUploadingAvatar}
            setIsUploadingAvatar={props.setIsUploadingAvatar}
            saveProfile={props.saveProfile}
            currentPasswordInput={props.currentPasswordInput}
            setCurrentPasswordInput={props.setCurrentPasswordInput}
            newPasswordInput={props.newPasswordInput}
            setNewPasswordInput={props.setNewPasswordInput}
            confirmPasswordInput={props.confirmPasswordInput}
            setConfirmPasswordInput={props.setConfirmPasswordInput}
            whoCanSendFriendRequests={props.whoCanSendFriendRequests}
            whoCanCallMe={props.whoCanCallMe}
            whoCanSeeProfilePhoto={props.whoCanSeeProfilePhoto}
            whoCanSeeLastSeen={props.whoCanSeeLastSeen}
            updatePreference={props.updatePreference}
            enableRingtone={props.enableRingtone}
            setEnableRingtone={props.setEnableRingtone}
            enableCallertone={props.enableCallertone}
            setEnableCallertone={props.setEnableCallertone}
            enableMessageSounds={props.enableMessageSounds}
            setEnableMessageSounds={props.setEnableMessageSounds}
            soundVolume={props.soundVolume}
            setSoundVolume={props.setSoundVolume}
          />
        );
    }
  };

  const getHeaderTitle = () => {
    switch (activeTab) {
      case 'chats': return 'Velvet Chat';
      case 'friends': return 'Contacts';
      case 'calls': return 'Calls';
      case 'settings': return 'Settings';
    }
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-dark-bg text-dark-text relative overflow-hidden select-none">
      {/* 1. Show Fullscreen Conversation if selected chat is active */}
      {props.selectedChat ? (
        showDetails ? (
          <MobileChatDetailsScreen
            chat={props.selectedChat}
            messages={props.messages}
            currentUser={props.user}
            onBackClick={() => setShowDetails(false)}
            onBlockUser={props.handleBlockUser}
            onUnblockUser={props.handleUnblockUser}
            blockedUsers={props.blockedUsers}
            onRemoveFriend={async (_friendId) => {
              await props.handleRemoveFriendPublic(props.selectedChat.otherMember?.publicId || '');
              setShowDetails(false);
              props.setSelectedChat(null);
            }}
          />
        ) : (
          <MobileConversationScreen
            selectedChat={props.selectedChat}
            messages={props.messages}
            typedMessage={props.typedMessage}
            setTypedMessage={props.setTypedMessage}
            handleSendMessage={props.handleSendMessage}
            onBackClick={() => props.setSelectedChat(null)}
            onHeaderClick={() => setShowDetails(true)}
            onVoiceCall={() => props.startCall('audio', props.selectedChat.otherMember)}
            onVideoCall={() => props.startCall('video', props.selectedChat.otherMember)}
            replyingToMessage={props.replyingToMessage}
            setReplyingToMessage={props.setReplyingToMessage}
            editingMessage={props.editingMessage}
            setEditingMessage={props.setEditingMessage}
            handleFileUpload={props.handleFileUpload}
            isUploading={props.isUploading}
            uploadProgress={props.uploadProgress}
            currentUser={props.user}
            typingUsers={props.typingUsers}
          />
        )
      ) : (
        /* 2. Render Main Application (Tabs) */
        <>
          <MobileHeader title={getHeaderTitle()} />
          <div className="flex-1 overflow-hidden relative">
            {renderActiveTabScreen()}
          </div>
          <BottomNavigation
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            unreadChatsCount={unreadChatsCount}
            pendingRequestsCount={pendingRequestsCount}
            missedCallsCount={missedCallsCount}
          />
        </>
      )}

      {/* 3. Global Overlays */}
      {/* Voice/Video calling HUD */}
      {props.callState !== 'idle' && (
        <MobileCallOverlay
          callState={props.callState}
          callPeer={props.callPeer}
          callType={props.callType}
          callDuration={props.callDuration}
          isMuted={props.isMuted}
          isVideoEnabled={props.isVideoEnabled}
          isSpeakerphone={props.isSpeakerphone}
          connectionQuality={props.connectionQuality}
          showFallbackPrompt={props.showFallbackPrompt}
          audioOutputs={props.audioOutputs}
          selectedAudioOutput={props.selectedAudioOutput}
          audioRouteError={props.audioRouteError}
          liveDiagnostics={props.liveDiagnostics}
          localVideoRef={props.localVideoRef}
          remoteVideoRef={props.remoteVideoRef}
          remoteAudioRef={props.remoteAudioRef}
          acceptCall={props.acceptCall}
          rejectCall={props.rejectCall}
          endCall={props.endCall}
          toggleMute={props.toggleMute}
          toggleCamera={props.toggleCamera}
          switchToAudioOnly={props.switchToAudioOnly}
          toggleSpeakerphone={props.toggleSpeakerphone}
          fetchAudioOutputs={props.fetchAudioOutputs}
          handleSelectAudioRoute={props.handleSelectAudioRoute}
          formatCallDuration={props.formatCallDuration}
        />
      )}

      {/* Directory search lookup overlay */}
      {props.showSearchModal && (
        <MobileSearchOverlay
          isOpen={props.showSearchModal}
          onClose={() => props.setShowSearchModal(false)}
          userSearchQuery={props.userSearchQuery}
          setUserSearchQuery={props.setUserSearchQuery}
          userSearchResults={props.userSearchResults}
          handleUserSearch={props.handleUserSearch}
          handleStartChatWithUser={async (targetUser: any) => {
            props.setShowSearchModal(false);
            await props.startDirectChat(targetUser);
            setActiveTab('chats');
          }}
          handleSendFriendRequest={props.handleSendFriendRequest}
        />
      )}


      {/* QR scanner / Profile reader overlay */}
      {props.showFriendshipModal && props.friendshipModalTab === 'qr_invite' && (
        <MobileQRScreen
          user={props.user}
          qrCodeDataUrl={props.qrCodeDataUrl}
          isScanningQR={props.isScanningQR}
          scannedProfile={props.scannedProfile}
          qrError={props.qrError}
          videoRef={props.videoRef}
          canvasRef={props.canvasRef}
          startCameraScan={props.startCameraScan}
          stopCameraScan={props.stopCameraScan}
          handleGalleryImport={props.handleGalleryImport}
          handleShareInvite={props.handleShareInvite}
          handleSendFriendRequestPublic={props.handleSendFriendRequestPublic}
          handleBlockUserPublic={props.handleBlockUserPublic}
          handleCancelFriendRequestPublic={props.handleCancelFriendRequestPublic}
          handleAcceptFriendRequestPublic={props.handleAcceptFriendRequestPublic}
          handleRejectFriendRequestPublic={props.handleRejectFriendRequestPublic}
          handleRemoveFriendPublic={props.handleRemoveFriendPublic}
          handleUnblockUserPublic={props.handleUnblockUserPublic}
          onClose={() => {
            props.setShowFriendshipModal(false);
            props.setFriendshipModalTab('friends');
          }}
          chats={props.chats}
          friends={props.friends}
          setSelectedChat={props.setSelectedChat}
          setActiveTab={setActiveTab}
        />
      )}

      {/* Group Creation Modal */}
      {props.showCreateGroupModal && (
        <div className="fixed inset-0 bg-black/80 z-40 flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-dark-surface border border-white/5 rounded-3xl p-5 shadow-2xl flex flex-col space-y-4 animate-scale-up">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-sm text-white">Create Group Chat</h3>
              <button onClick={() => props.setShowCreateGroupModal(false)} className="text-dark-muted hover:text-white">
                <X size={16} />
              </button>
            </div>
            <form onSubmit={props.handleCreateGroup} className="space-y-3.5">
              <div className="space-y-1">
                <label className="text-[10px] text-dark-muted uppercase font-bold tracking-wider">Group Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Design Team"
                  className="w-full px-4 py-2.5 rounded-xl bg-dark-bg border border-white/5 text-xs text-white focus:outline-none focus:border-brand-500/50"
                  value={props.groupNameInput}
                  onChange={(e) => props.setGroupNameInput(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-dark-muted uppercase font-bold tracking-wider">Description</label>
                <input
                  type="text"
                  placeholder="Group chat description..."
                  className="w-full px-4 py-2.5 rounded-xl bg-dark-bg border border-white/5 text-xs text-white focus:outline-none focus:border-brand-500/50"
                  value={props.groupDescInput}
                  onChange={(e) => props.setGroupDescInput(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-dark-muted uppercase font-bold tracking-wider">Avatar Url</label>
                <input
                  type="text"
                  placeholder="https://example.com/avatar.jpg"
                  className="w-full px-4 py-2.5 rounded-xl bg-dark-bg border border-white/5 text-xs text-white focus:outline-none"
                  value={props.groupAvatarUrlInput}
                  onChange={(e) => props.setGroupAvatarUrlInput(e.target.value)}
                />
              </div>
              <div className="space-y-1 text-left">
                <label className="text-[10px] text-dark-muted uppercase font-bold tracking-wider block">Add Contacts</label>
                <div className="max-h-[120px] overflow-y-auto space-y-1.5 mt-1 pr-1">
                  {props.friends.map((f) => {
                    const isSelected = props.selectedMemberIds.includes(f.id);
                    return (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => props.toggleSelectMember(f.id)}
                        className={`w-full p-2 rounded-xl flex items-center justify-between text-left text-xs font-semibold ${
                          isSelected ? 'bg-brand-500/15 border border-brand-500/20 text-brand-400' : 'bg-dark-bg border border-transparent text-white'
                        }`}
                      >
                        <span>{f.profile?.displayName || f.username}</span>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          readOnly
                          className="w-3.5 h-3.5 accent-brand-500 cursor-pointer pointer-events-none"
                        />
                      </button>
                    );
                  })}
                  {props.friends.length === 0 && (
                    <span className="text-[10px] text-dark-muted italic block py-2">No contacts available to add.</span>
                  )}
                </div>
              </div>
              <button
                type="submit"
                className="w-full py-3 rounded-xl bg-brand-500 hover:bg-brand-600 text-white font-bold text-xs shadow-lg transition-colors min-h-[44px]"
              >
                Create Group
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

// Helper SVG X icon
const X = ({ size }: { size: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
);
