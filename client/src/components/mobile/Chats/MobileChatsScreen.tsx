import React, { useState, useMemo } from 'react';
import { Search, Pin, BellOff, Trash2, Archive, MessageSquare, Plus, Bell } from 'lucide-react';
import { Chat } from '../../../types';
import Avatar from '../Shared/Avatar';
import MobileBottomSheet from '../Shared/MobileBottomSheet';
import MobileFloatingButton from '../Shared/MobileFloatingButton';

interface MobileChatsScreenProps {
  chats: Chat[];
  selectedChat: Chat | null;
  setSelectedChat: (chat: Chat | null) => void;
  typingUsers: Record<string, boolean>;
  activeTypingChatId: string | null;
  onCreateGroupClick: () => void;
  onSearchUserClick: () => void;
}

export const MobileChatsScreen: React.FC<MobileChatsScreenProps> = ({
  chats,
  selectedChat,
  setSelectedChat,
  typingUsers,
  activeTypingChatId,
  onCreateGroupClick: _onCreateGroupClick,
  onSearchUserClick
}) => {
  const [localSearch, setLocalSearch] = useState<string>('');
  const [longPressedChat, setLongPressedChat] = useState<Chat | null>(null);
  
  // Local state for pinned, muted, and archived chats
  const [pinnedChats, setPinnedChats] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('velvet_pinned_chats');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [mutedChats, setMutedChats] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('velvet_muted_chats');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [archivedChats, setArchivedChats] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('velvet_archived_chats');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const togglePin = (chatId: string) => {
    const next = pinnedChats.includes(chatId)
      ? pinnedChats.filter(id => id !== chatId)
      : [...pinnedChats, chatId];
    setPinnedChats(next);
    localStorage.setItem('velvet_pinned_chats', JSON.stringify(next));
    setLongPressedChat(null);
  };

  const toggleMute = (chatId: string) => {
    const next = mutedChats.includes(chatId)
      ? mutedChats.filter(id => id !== chatId)
      : [...mutedChats, chatId];
    setMutedChats(next);
    localStorage.setItem('velvet_muted_chats', JSON.stringify(next));
    setLongPressedChat(null);
  };

  const toggleArchive = (chatId: string) => {
    const next = archivedChats.includes(chatId)
      ? archivedChats.filter(id => id !== chatId)
      : [...archivedChats, chatId];
    setArchivedChats(next);
    localStorage.setItem('velvet_archived_chats', JSON.stringify(next));
    setLongPressedChat(null);
  };

  const handleDeleteChatPlaceholder = (_chatId: string) => {
    // Note: Local filter out placeholder for demonstration
    alert('Archive or Pin features are fully client-side. Real database delete requires deleting the matching records.');
    setLongPressedChat(null);
  };

  // Filter and sort chats
  const processedChats = useMemo(() => {
    return chats
      .filter(chat => {
        const name = chat.type === 'GROUP' 
          ? chat.groupName 
          : (chat.otherMember?.profile?.displayName || chat.otherMember?.username || '');
        const matchQuery = (name || '').toLowerCase().includes(localSearch.toLowerCase());
        
        // Hide archived from main list unless searched
        const isArchived = archivedChats.includes(chat.id);
        return matchQuery && (!isArchived || localSearch !== '');
      })
      .sort((a, b) => {
        // Pinned chats first
        const aPinned = pinnedChats.includes(a.id) ? 1 : 0;
        const bPinned = pinnedChats.includes(b.id) ? 1 : 0;
        if (aPinned !== bPinned) return bPinned - aPinned;

        // Otherwise sort by last message date
        const aDate = a.lastMessage ? new Date(a.lastMessage.createdAt).getTime() : new Date(a.updatedAt).getTime();
        const bDate = b.lastMessage ? new Date(b.lastMessage.createdAt).getTime() : new Date(b.updatedAt).getTime();
        return bDate - aDate;
      });
  }, [chats, localSearch, pinnedChats, archivedChats]);

  // Touch Long press logic
  let pressTimer: any = null;

  const handleTouchStart = (chat: Chat) => {
    pressTimer = setTimeout(() => {
      setLongPressedChat(chat);
    }, 600); // 600ms hold
  };

  const handleTouchEnd = () => {
    if (pressTimer) clearTimeout(pressTimer);
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-dark-bg relative select-none">
      {/* Top Search Bar */}
      <div className="p-4 shrink-0">
        <div className="relative">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-dark-muted" />
          <input
            type="text"
            placeholder="Search chats or groups..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-dark-surface border border-white/5 text-sm text-white focus:outline-none focus:border-brand-500/50 focus:bg-dark-surface/80 transition-all"
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Chats List */}
      <div className="flex-1 overflow-y-auto px-4 pb-24 scrollbar-thin">
        {processedChats.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <MessageSquare size={44} className="text-dark-muted/30 mb-3" />
            <p className="text-sm font-semibold text-white">No active chats</p>
            <p className="text-xs text-dark-muted mt-1 max-w-[200px]">
              Tap the button in the bottom right corner to find friends.
            </p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {processedChats.map((chat) => {
              const chatName = chat.type === 'GROUP'
                ? chat.groupName || 'Group Chat'
                : (chat.otherMember?.profile?.displayName || chat.otherMember?.username || 'Private Chat');
              
              const chatAvatar = chat.type === 'GROUP'
                ? chat.groupAvatarUrl
                : chat.otherMember?.profile?.avatarUrl;

              const isMuted = mutedChats.includes(chat.id);
              const isPinned = pinnedChats.includes(chat.id);
              
              // Typing indicators
              const chatTypingUsers = Object.keys(typingUsers).filter(
                uId => typingUsers[uId] && activeTypingChatId === chat.id
              );
              const isTyping = chatTypingUsers.length > 0;

              // Format date
              let timeText = '';
              if (chat.lastMessage) {
                const msgDate = new Date(chat.lastMessage.createdAt);
                timeText = msgDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
              }

              return (
                <div
                  key={chat.id}
                  onTouchStart={() => handleTouchStart(chat)}
                  onTouchEnd={handleTouchEnd}
                  onMouseDown={() => {
                    pressTimer = setTimeout(() => setLongPressedChat(chat), 600);
                  }}
                  onMouseUp={() => {
                    if (pressTimer) clearTimeout(pressTimer);
                  }}
                  onClick={() => {
                    if (!longPressedChat) {
                      setSelectedChat(chat);
                    }
                  }}
                  className={`p-3.5 rounded-2xl flex items-center justify-between transition-all cursor-pointer border ${
                    selectedChat?.id === chat.id
                      ? 'bg-brand-500/10 border-brand-500/20'
                      : 'bg-dark-surface/30 hover:bg-dark-surface/60 border-white/5'
                  }`}
                >
                  <div className="flex items-center space-x-3.5 min-w-0">
                    <Avatar
                      src={chatAvatar}
                      username={chat.type === 'GROUP' ? chatName : chat.otherMember?.username || '?'}
                      isOnline={chat.type === 'DIRECT' ? chat.otherMember?.profile?.isOnline : false}
                      size="md"
                    />
                    <div className="text-left min-w-0">
                      <div className="flex items-center space-x-1.5">
                        <span className="text-sm font-bold text-white leading-tight truncate max-w-[150px]">
                          {chatName}
                        </span>
                        {isPinned && <Pin size={10} className="text-brand-400 rotate-45 shrink-0" />}
                        {isMuted && <BellOff size={10} className="text-dark-muted shrink-0" />}
                      </div>
                      
                      {isTyping ? (
                        <p className="text-xs text-brand-400 font-semibold mt-1">typing...</p>
                      ) : chat.lastMessage ? (
                        <p className="text-xs text-dark-muted truncate mt-1 max-w-[190px]">
                          {chat.lastMessage.isDeleted ? (
                            <span className="italic">This message was deleted</span>
                          ) : (
                            chat.lastMessage.content
                          )}
                        </p>
                      ) : (
                        <p className="text-xs text-dark-muted/60 italic mt-1">No messages yet</p>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col items-end justify-between shrink-0 space-y-1.5">
                    <span className="text-[10px] font-medium text-dark-muted">
                      {timeText}
                    </span>
                    {chat.unreadCount > 0 && (
                      <span className="bg-brand-500 text-white text-[9px] font-bold h-4 min-w-[16px] px-1 rounded-full flex items-center justify-center">
                        {chat.unreadCount}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Floating Action Button */}
      <MobileFloatingButton
        onClick={onSearchUserClick}
        icon={<Plus size={24} />}
        title="New Message"
      />

      {/* Long Press Options Bottom Sheet */}
      <MobileBottomSheet
        isOpen={longPressedChat !== null}
        onClose={() => setLongPressedChat(null)}
        title={longPressedChat ? (longPressedChat.type === 'GROUP' ? longPressedChat.groupName || 'Group Chat' : longPressedChat.otherMember?.profile?.displayName || longPressedChat.otherMember?.username) : ''}
      >
        {longPressedChat && (
          <div className="space-y-1">
            <button
              onClick={() => togglePin(longPressedChat.id)}
              className="w-full p-3.5 rounded-xl hover:bg-white/5 flex items-center space-x-3 text-left font-semibold text-white transition-colors"
            >
              <Pin size={18} className="text-dark-muted rotate-45" />
              <span>{pinnedChats.includes(longPressedChat.id) ? 'Unpin chat' : 'Pin chat'}</span>
            </button>
            
            <button
              onClick={() => toggleMute(longPressedChat.id)}
              className="w-full p-3.5 rounded-xl hover:bg-white/5 flex items-center space-x-3 text-left font-semibold text-white transition-colors"
            >
              {mutedChats.includes(longPressedChat.id) ? (
                <>
                  <Bell size={18} className="text-dark-muted" />
                  <span>Unmute notifications</span>
                </>
              ) : (
                <>
                  <BellOff size={18} className="text-dark-muted" />
                  <span>Mute notifications</span>
                </>
              )}
            </button>

            <button
              onClick={() => toggleArchive(longPressedChat.id)}
              className="w-full p-3.5 rounded-xl hover:bg-white/5 flex items-center space-x-3 text-left font-semibold text-white transition-colors"
            >
              <Archive size={18} className="text-dark-muted" />
              <span>{archivedChats.includes(longPressedChat.id) ? 'Unarchive chat' : 'Archive chat'}</span>
            </button>

            <div className="h-[1px] bg-white/5 my-2" />

            <button
              onClick={() => handleDeleteChatPlaceholder(longPressedChat.id)}
              className="w-full p-3.5 rounded-xl hover:bg-red-500/10 flex items-center space-x-3 text-left font-semibold text-red-400 transition-colors"
            >
              <Trash2 size={18} className="text-red-400" />
              <span>Delete conversation</span>
            </button>
          </div>
        )}
      </MobileBottomSheet>
    </div>
  );
};

export default MobileChatsScreen;
