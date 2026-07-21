import React from 'react';
import { Search, MessageSquare, Send, LogOut, Info, X, Plus, UserPlus, Clock, Bell, Phone, Video } from 'lucide-react';
import Avatar from '../components/mobile/Shared/Avatar';

interface TabletDashboardProps {
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

  // Search
  showSearchModal: boolean;
  setShowSearchModal: (show: boolean) => void;
  userSearchQuery: string;
  setUserSearchQuery: (val: string) => void;
  userSearchResults: any[];
  handleUserSearch: (e: React.FormEvent) => void;
  startDirectChat: (targetUser: any) => Promise<void>;

  // Sidebar controls
  showRightSidebar: boolean;
  setShowRightSidebar: (show: boolean) => void;
  showProfileModal: boolean;
  setShowProfileModal: (show: boolean) => void;
  showFriendshipModal: boolean;
  setShowFriendshipModal: (show: boolean) => void;
  showCallHistoryModal: boolean;
  setShowCallHistoryModal: (show: boolean) => void;
  showNotificationCenter: boolean;
  setShowNotificationCenter: (show: boolean) => void;

  // Friendship data
  friends: any[];
  pendingIncomingRequests: any[];
  pendingOutgoingRequests: any[];
  blockedUsers: any[];
  handleAcceptFriendRequest: (requestId: string) => void;
  handleRejectFriendRequest: (requestId: string) => void;
  handleCancelFriendRequest: (requestId: string) => void;
  handleBlockUser: (blockedId: string) => void;
  handleUnblockUser: (blockedId: string) => void;
  
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
  startCall: (type: 'audio' | 'video', targetUser: any) => void;

  // Helper
  getAbsoluteUrl: (url: string) => string;
  searchQuery: string; // local conversations search
  setSearchQuery: (val: string) => void;
}

export const TabletDashboard: React.FC<TabletDashboardProps> = (props) => {
  const isSelectedChatGroup = props.selectedChat?.type === 'GROUP';
  
  const selectedChatName = props.selectedChat 
    ? (isSelectedChatGroup ? props.selectedChat.groupName : (props.selectedChat.otherMember?.profile?.displayName || props.selectedChat.otherMember?.username))
    : '';

  const selectedChatAvatar = props.selectedChat
    ? (isSelectedChatGroup ? props.selectedChat.groupAvatarUrl : props.selectedChat.otherMember?.profile?.avatarUrl)
    : undefined;

  // Filter conversations in sidebar search
  const filteredChats = props.chats.filter(chat => {
    const name = chat.type === 'GROUP' 
      ? chat.groupName 
      : (chat.otherMember?.profile?.displayName || chat.otherMember?.username || '');
    return (name || '').toLowerCase().includes(props.searchQuery.toLowerCase());
  });

  return (
    <div className="flex h-screen w-screen bg-dark-bg text-dark-text relative overflow-hidden select-none">
      
      {/* Left Sidebar - 320px width (optimised for tablet viewports) */}
      <div className="w-[320px] flex-shrink-0 flex flex-col border-r border-dark-border bg-dark-surface/40 backdrop-blur-lg">
        {/* Header with profile */}
        <div className="p-4 border-b border-dark-border flex items-center justify-between">
          <div 
            onClick={() => props.setShowProfileModal(true)}
            className="flex items-center space-x-3 cursor-pointer group"
          >
            <Avatar 
              src={props.user?.profile?.avatarUrl} 
              username={props.user?.username} 
              size="sm"
            />
            <div className="text-left">
              <h3 className="font-bold text-xs text-white leading-tight truncate max-w-[100px]">
                {props.user?.profile?.displayName || props.user?.username}
              </h3>
              <span className="text-[9px] text-emerald-400 font-bold">Online</span>
            </div>
          </div>
          
          {/* Action Row */}
          <div className="flex items-center space-x-1">
            <button 
              onClick={() => props.setShowFriendshipModal(true)}
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-dark-muted hover:text-white transition-all min-h-[40px] min-w-[40px] flex items-center justify-center"
              title="Friends"
            >
              <UserPlus size={16} />
            </button>
            <button 
              onClick={() => props.setShowCallHistoryModal(true)}
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-dark-muted hover:text-white transition-all min-h-[40px] min-w-[40px] flex items-center justify-center"
              title="Calls"
            >
              <Clock size={16} />
            </button>
            <button 
              onClick={() => props.setShowNotificationCenter(true)}
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-dark-muted hover:text-white transition-all relative min-h-[40px] min-w-[40px] flex items-center justify-center"
              title="Notifications"
            >
              <Bell size={16} />
              {props.pendingIncomingRequests.length > 0 && (
                <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-brand-500 animate-pulse"></span>
              )}
            </button>
            <button 
              onClick={props.logout}
              className="p-2 rounded-xl bg-white/5 hover:bg-red-500/10 text-dark-muted hover:text-red-400 transition-all min-h-[40px] min-w-[40px] flex items-center justify-center"
              title="Logout"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="p-3 border-b border-dark-border">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-muted" />
            <input
              type="text"
              placeholder="Search conversations..."
              className="w-full pl-9 pr-3 py-2 rounded-xl bg-dark-bg border border-white/5 text-xs text-white focus:outline-none focus:border-brand-500/50"
              value={props.searchQuery}
              onChange={(e) => props.setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* Conversations List */}
        <div className="flex-1 overflow-y-auto p-2.5 space-y-1">
          {filteredChats.map((chat) => {
            const chatName = chat.type === 'GROUP' 
              ? chat.groupName 
              : (chat.otherMember?.profile?.displayName || chat.otherMember?.username);
            const chatAvatar = chat.type === 'GROUP' ? chat.groupAvatarUrl : chat.otherMember?.profile?.avatarUrl;
            const isSelected = props.selectedChat?.id === chat.id;

            return (
              <div
                key={chat.id}
                onClick={() => props.setSelectedChat(chat)}
                className={`p-3 rounded-2xl flex items-center justify-between cursor-pointer transition-all border ${
                  isSelected ? 'bg-brand-500/10 border-brand-500/20' : 'bg-transparent border-transparent hover:bg-white/5'
                }`}
              >
                <div className="flex items-center space-x-3 min-w-0">
                  <Avatar
                    src={chatAvatar}
                    username={chat.type === 'GROUP' ? chatName : chat.otherMember?.username}
                    isOnline={chat.type === 'DIRECT' ? chat.otherMember?.profile?.isOnline : false}
                    size="sm"
                  />
                  <div className="text-left min-w-0">
                    <p className="text-xs font-bold text-white truncate leading-tight">{chatName}</p>
                    <p className="text-[10px] text-dark-muted truncate mt-1">
                      {chat.lastMessage ? chat.lastMessage.content : 'No messages yet'}
                    </p>
                  </div>
                </div>
                {chat.unreadCount > 0 && (
                  <span className="bg-brand-500 text-white text-[9px] font-bold h-4 min-w-[16px] px-1 rounded-full flex items-center justify-center shrink-0">
                    {chat.unreadCount}
                  </span>
                )}
              </div>
            );
          })}
          {filteredChats.length === 0 && (
            <div className="text-center py-10 text-xs text-dark-muted">No chats found.</div>
          )}
        </div>

        {/* FAB Search Start Chat button */}
        <div className="p-3 shrink-0">
          <button
            onClick={() => props.setShowSearchModal(true)}
            className="w-full py-2.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-xs font-bold flex items-center justify-center space-x-2 shadow-lg min-h-[44px]"
          >
            <Plus size={16} />
            <span>New Direct Message</span>
          </button>
        </div>
      </div>

      {/* Right Content Area - Flexible Split Panel */}
      <div className="flex-1 flex overflow-hidden bg-dark-bg/60 relative">
        {props.selectedChat ? (
          <>
            {/* Conversation Window */}
            <div className="flex-1 flex flex-col h-full border-r border-dark-border overflow-hidden">
              {/* Header */}
              <div className="h-16 bg-dark-surface border-b border-dark-border flex items-center justify-between px-6 shrink-0">
                <div 
                  onClick={() => props.setShowRightSidebar(!props.showRightSidebar)}
                  className="flex items-center space-x-3 cursor-pointer min-w-0 flex-1 text-left"
                >
                  <Avatar
                    src={selectedChatAvatar}
                    username={props.selectedChat.type === 'GROUP' ? selectedChatName : props.selectedChat.otherMember?.username}
                    isOnline={props.selectedChat.type === 'DIRECT' ? props.selectedChat.otherMember?.profile?.isOnline : false}
                    size="sm"
                  />
                  <div className="min-w-0">
                    <h2 className="text-sm font-bold text-white leading-tight truncate">{selectedChatName}</h2>
                    <span className="text-[10px] text-brand-400 font-semibold">
                      {props.selectedChat.type === 'GROUP' ? 'Group Details' : (props.selectedChat.otherMember?.profile?.isOnline ? 'Online' : 'Offline')}
                    </span>
                  </div>
                </div>

                <div className="flex items-center space-x-2 shrink-0">
                  {props.selectedChat.type === 'DIRECT' && (
                    <>
                      <button
                        onClick={() => props.startCall('audio', props.selectedChat.otherMember)}
                        className="p-2.5 rounded-xl hover:bg-white/5 text-dark-muted hover:text-white transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                        title="Voice Call"
                      >
                        <Phone size={16} />
                      </button>
                      <button
                        onClick={() => props.startCall('video', props.selectedChat.otherMember)}
                        className="p-2.5 rounded-xl hover:bg-white/5 text-dark-muted hover:text-white transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                        title="Video Call"
                      >
                        <Video size={16} />
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => props.setShowRightSidebar(!props.showRightSidebar)}
                    className={`p-2.5 rounded-xl transition-all min-h-[44px] min-w-[44px] flex items-center justify-center ${
                      props.showRightSidebar ? 'bg-brand-500/10 text-brand-400' : 'hover:bg-white/5 text-dark-muted hover:text-white'
                    }`}
                    title="Toggle Info"
                  >
                    <Info size={16} />
                  </button>
                </div>
              </div>

              {/* Messages viewport */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4 scrollbar-thin">
                {props.messages.map((msg) => {
                  const isMe = msg.senderId === props.user?.id;
                  const timeText = new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                  return (
                    <div 
                      key={msg.id} 
                      className={`flex flex-col space-y-1 max-w-[70%] ${isMe ? 'self-end items-end ml-auto' : 'self-start items-start mr-auto'}`}
                    >
                      {!isMe && (
                        <span className="text-[9px] text-dark-muted font-bold ml-2.5 uppercase">
                          {msg.sender?.profile?.displayName || msg.sender?.username}
                        </span>
                      )}
                      <div className={`px-4 py-2.5 rounded-2xl relative shadow-md text-left ${
                        isMe ? 'bg-brand-500 text-white rounded-tr-none' : 'bg-dark-surface text-white rounded-tl-none'
                      }`}>
                        <p className="text-xs leading-relaxed break-words">{msg.content}</p>
                        <span className="text-[8px] text-white/50 block text-right mt-1.5 leading-none">
                          {timeText}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Input section */}
              <form 
                onSubmit={props.handleSendMessage}
                className="p-4 bg-dark-surface/40 border-t border-dark-border flex items-center space-x-2 shrink-0"
              >
                <input
                  type="text"
                  placeholder="Type a message..."
                  className="flex-1 bg-black/40 border border-white/5 rounded-xl py-3 px-4 text-xs text-white focus:outline-none focus:border-brand-500/30 transition-all placeholder-dark-muted min-h-[44px]"
                  value={props.typedMessage}
                  onChange={(e) => props.setTypedMessage(e.target.value)}
                />
                <button
                  type="submit"
                  disabled={!props.typedMessage.trim()}
                  className="p-3 rounded-xl bg-brand-500 hover:bg-brand-600 text-white flex items-center justify-center transition-transform hover:scale-105 active:scale-95 disabled:opacity-50 disabled:scale-100 shrink-0 min-h-[44px] min-w-[44px]"
                >
                  <Send size={16} />
                </button>
              </form>
            </div>

            {/* Collapsible details pane on the right (300px width) */}
            {props.showRightSidebar && (
              <div className="w-[300px] flex-shrink-0 flex flex-col bg-dark-surface/20 backdrop-blur-md border-l border-dark-border animate-fade-in z-10">
                <div className="p-4 border-b border-dark-border flex items-center justify-between">
                  <h4 className="font-bold text-xs text-white">Info</h4>
                  <button onClick={() => props.setShowRightSidebar(false)} className="text-dark-muted hover:text-white">
                    <X size={16} />
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto p-6 flex flex-col items-center text-center space-y-6">
                  <div className="w-20 h-20 rounded-2xl overflow-hidden border border-white/10 shadow-lg">
                    <img src={props.getAbsoluteUrl(selectedChatAvatar) || `https://api.dicebear.com/7.x/bottts/svg?seed=${selectedChatName}`} alt="avatar" className="w-full h-full object-cover" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-white">{selectedChatName}</h3>
                    {!isSelectedChatGroup && (
                      <p className="text-[10px] text-dark-muted mt-0.5">@{props.selectedChat.otherMember?.username}</p>
                    )}
                  </div>

                  <div className="w-full text-left pt-4 border-t border-white/5 space-y-4">
                    <div>
                      <span className="text-[9px] text-dark-muted uppercase font-bold tracking-wider block">Bio / Info</span>
                      <p className="text-xs text-zinc-300 mt-1 leading-relaxed">
                        {isSelectedChatGroup 
                          ? (props.selectedChat.groupDescription || 'No group description.')
                          : (props.selectedChat.otherMember?.profile?.bio || 'No bio status.')}
                      </p>
                    </div>

                    {!isSelectedChatGroup && props.selectedChat.otherMember && (
                      <button
                        onClick={() => props.handleBlockUser(props.selectedChat.otherMember.id)}
                        className="w-full py-2.5 rounded-xl bg-red-500/10 border border-red-500/20 hover:bg-red-500 hover:text-white text-red-400 font-semibold text-xs transition-all flex items-center justify-center space-x-1.5"
                      >
                        <span>Block Contact</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
            <MessageSquare size={48} className="text-dark-muted/20 mb-3" />
            <p className="text-sm font-semibold text-white">Select a conversation to start chatting</p>
            <p className="text-xs text-dark-muted mt-1">Or search user directory using the sidebar button.</p>
          </div>
        )}
      </div>

    </div>
  );
};

export default TabletDashboard;
