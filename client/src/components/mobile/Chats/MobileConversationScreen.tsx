import React, { useRef, useEffect, useMemo } from 'react';
import { ArrowLeft, Send, Paperclip, Phone, Video, X, Reply, CheckCheck } from 'lucide-react';
import { Chat, Message, User as UserType } from '../../../types';
import Avatar from '../Shared/Avatar';

interface MobileConversationScreenProps {
  selectedChat: Chat;
  messages: Message[];
  typedMessage: string;
  setTypedMessage: (val: string) => void;
  handleSendMessage: (e: React.FormEvent) => void;
  onBackClick: () => void;
  onHeaderClick: () => void;
  onVoiceCall: () => void;
  onVideoCall: () => void;
  replyingToMessage: Message | null;
  setReplyingToMessage: (msg: Message | null) => void;
  editingMessage: Message | null;
  setEditingMessage: (msg: Message | null) => void;
  handleFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
  isUploading: boolean;
  uploadProgress: number | null;
  currentUser: UserType | null;
  typingUsers: Record<string, boolean>;
}

// Memoized message item for performance
const MessageBubble = React.memo<{
  msg: Message;
  isMe: boolean;
  onReply: (msg: Message) => void;
  otherMemberName: string;
}>(({ msg, isMe, onReply, otherMemberName }) => {
  const timeText = new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const hasAttachment = msg.attachments && msg.attachments.length > 0;

  return (
    <div 
      className={`flex flex-col space-y-1 w-full max-w-[80%] ${isMe ? 'self-end items-end' : 'self-start items-start'}`}
    >
      {/* Sender name for group chats if not me */}
      {!isMe && (
        <span className="text-[10px] text-dark-muted font-bold ml-3 uppercase">
          {msg.sender?.profile?.displayName || msg.sender?.username || otherMemberName}
        </span>
      )}

      {/* Bubble Container */}
      <div 
        className={`px-3.5 py-2.5 rounded-2xl relative shadow-md transition-all group ${
          isMe 
            ? 'bg-brand-500 text-white rounded-tr-none' 
            : 'bg-dark-surface text-white rounded-tl-none'
        }`}
      >
        {/* Reply Preview inside bubble */}
        {msg.replyTo && (
          <div className="mb-2 p-2 bg-black/20 rounded-lg text-left border-l-2 border-brand-300 text-[11px] leading-tight text-white/80 max-w-full truncate">
            <p className="font-bold text-[9px] text-brand-300">
              {msg.replyTo.senderId === msg.senderId ? 'Self' : 'Reply'}
            </p>
            {msg.replyTo.content}
          </div>
        )}

        {/* Text Content */}
        {!msg.isDeleted ? (
          <p className="text-sm leading-relaxed text-left whitespace-pre-wrap break-words pr-8">
            {msg.content}
          </p>
        ) : (
          <p className="text-sm italic text-white/50 text-left pr-8">
            This message was deleted
          </p>
        )}

        {/* Attachments */}
        {hasAttachment && msg.attachments!.map((file) => (
          <div key={file.id} className="mt-2 p-2 bg-black/20 rounded-xl border border-white/5 flex items-center space-x-2 text-left">
            <div className="w-10 h-10 rounded-lg bg-brand-500/10 flex items-center justify-center shrink-0 border border-brand-500/20">
              <span className="text-[10px] font-bold text-brand-300">FILE</span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-white truncate">{file.fileName}</p>
              <p className="text-[10px] text-dark-muted">
                {Math.round(file.fileSize / 1024)} KB
              </p>
            </div>
            <a 
              href={file.fileUrl} 
              target="_blank" 
              rel="noreferrer" 
              className="text-[10px] text-brand-400 hover:text-brand-300 font-bold shrink-0 px-2.5 py-1.5 rounded-lg bg-white/5"
            >
              OPEN
            </a>
          </div>
        ))}

        {/* Bottom Metadata inside bubble */}
        <div className="absolute bottom-1 right-2 flex items-center space-x-1">
          <span className="text-[9px] text-white/60 font-semibold leading-none">
            {timeText}
          </span>
          {isMe && (
            <span className="text-white/60">
              <CheckCheck size={11} />
            </span>
          )}
        </div>

        {/* Slide-out quick action handle for replies */}
        <button
          onClick={() => onReply(msg)}
          className="absolute -left-10 top-1/2 -translate-y-1/2 p-2 bg-dark-surface/80 border border-white/10 text-dark-muted hover:text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity min-w-[32px] min-h-[32px] flex items-center justify-center"
          title="Reply"
        >
          <Reply size={12} />
        </button>
      </div>
    </div>
  );
});

export const MobileConversationScreen: React.FC<MobileConversationScreenProps> = ({
  selectedChat,
  messages,
  typedMessage,
  setTypedMessage,
  handleSendMessage,
  onBackClick,
  onHeaderClick,
  onVoiceCall,
  onVideoCall,
  replyingToMessage,
  setReplyingToMessage,
  editingMessage: _editingMessage,
  setEditingMessage: _setEditingMessage,
  handleFileUpload,
  isUploading,
  uploadProgress,
  currentUser,
  typingUsers
}) => {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  
  const chatName = selectedChat.type === 'GROUP'
    ? selectedChat.groupName || 'Group Chat'
    : (selectedChat.otherMember?.profile?.displayName || selectedChat.otherMember?.username || 'Private Chat');

  const chatAvatar = selectedChat.type === 'GROUP'
    ? selectedChat.groupAvatarUrl
    : selectedChat.otherMember?.profile?.avatarUrl;

  const isOnline = selectedChat.type === 'DIRECT' 
    ? selectedChat.otherMember?.profile?.isOnline 
    : false;

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Windowing virtualization slice to keep UI smooth with 10k messages
  const windowedMessages = useMemo(() => {
    const limit = 120;
    if (messages.length <= limit) return messages;
    return messages.slice(-limit);
  }, [messages]);

  // Typing indicators
  const chatTypingUsers = Object.keys(typingUsers).filter(
    uId => typingUsers[uId] && uId !== currentUser?.id
  );
  const isTyping = chatTypingUsers.length > 0;

  return (
    <div className="fixed inset-0 bg-dark-bg z-40 flex flex-col select-none">
      
      {/* Header bar */}
      <div className="h-16 bg-dark-surface border-b border-dark-border flex items-center justify-between px-4 shrink-0">
        <div className="flex items-center space-x-2.5 min-w-0 flex-1">
          <button 
            onClick={onBackClick}
            className="p-2 -ml-2 text-dark-muted hover:text-white transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <div 
            onClick={onHeaderClick}
            className="flex items-center space-x-2.5 min-w-0 flex-1 cursor-pointer"
          >
            <Avatar 
              src={chatAvatar}
              username={selectedChat.type === 'GROUP' ? chatName : selectedChat.otherMember?.username || '?'}
              isOnline={isOnline}
              size="sm"
            />
            <div className="text-left min-w-0">
              <h2 className="text-sm font-bold text-white leading-tight truncate">{chatName}</h2>
              <p className="text-[10px] text-brand-400 font-semibold mt-0.5">
                {isTyping ? 'typing...' : (isOnline ? 'Online' : 'Offline')}
              </p>
            </div>
          </div>
        </div>

        {/* Header call buttons */}
        {selectedChat.type === 'DIRECT' && (
          <div className="flex items-center space-x-2 shrink-0">
            <button 
              onClick={onVoiceCall}
              className="p-2.5 rounded-xl hover:bg-white/5 text-dark-muted hover:text-white transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
              title="Voice Call"
            >
              <Phone size={18} />
            </button>
            <button 
              onClick={onVideoCall}
              className="p-2.5 rounded-xl hover:bg-white/5 text-dark-muted hover:text-white transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
              title="Video Call"
            >
              <Video size={18} />
            </button>
          </div>
        )}
      </div>

      {/* Messages Thread Container */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 flex flex-col space-y-3.5 scrollbar-thin"
      >
        {windowedMessages.map((msg) => (
          <MessageBubble
            key={msg.id}
            msg={msg}
            isMe={msg.senderId === currentUser?.id}
            onReply={setReplyingToMessage}
            otherMemberName={selectedChat.otherMember?.username || ''}
          />
        ))}
        <div className="h-4" />
      </div>

      {/* Uploading progress overlay */}
      {isUploading && (
        <div className="px-4 py-2 bg-dark-surface/90 border-t border-dark-border flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-5 h-5 border-2 border-brand-500/20 border-t-brand-500 rounded-full animate-spin"></div>
            <span className="text-xs text-white">Uploading attachment...</span>
          </div>
          {uploadProgress !== null && (
            <span className="text-xs text-brand-400 font-bold">{uploadProgress}%</span>
          )}
        </div>
      )}

      {/* Reply metadata bar */}
      {replyingToMessage && (
        <div className="px-4 py-2 bg-dark-surface border-t border-dark-border flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-2 text-left min-w-0">
            <Reply size={14} className="text-brand-400 shrink-0" />
            <div className="text-xs text-white truncate pr-4">
              <span className="font-bold text-brand-400">Replying to: </span>
              {replyingToMessage.content}
            </div>
          </div>
          <button 
            onClick={() => setReplyingToMessage(null)}
            className="text-dark-muted hover:text-white"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Bottom Input Area */}
      <form 
        onSubmit={handleSendMessage}
        className="p-3 bg-dark-surface border-t border-dark-border flex items-center space-x-2 shrink-0 pb-safe"
      >
        <input 
          type="file" 
          ref={fileInputRef} 
          onChange={handleFileUpload} 
          className="hidden" 
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="p-2.5 rounded-xl hover:bg-white/5 text-dark-muted hover:text-white transition-colors shrink-0 min-h-[44px] min-w-[44px] flex items-center justify-center"
        >
          <Paperclip size={20} />
        </button>

        <input
          type="text"
          placeholder="Message..."
          className="flex-1 bg-black/40 border border-white/5 rounded-2xl py-3 px-4 text-sm text-white focus:outline-none focus:border-brand-500/30 transition-all placeholder-dark-muted min-h-[44px]"
          value={typedMessage}
          onChange={(e) => setTypedMessage(e.target.value)}
        />

        <button
          type="submit"
          disabled={!typedMessage.trim() && !isUploading}
          className="p-3 rounded-full bg-brand-500 hover:bg-brand-600 text-white flex items-center justify-center shadow-lg transition-transform hover:scale-105 active:scale-95 disabled:opacity-50 disabled:scale-100 shrink-0 min-h-[44px] min-w-[44px]"
        >
          <Send size={18} />
        </button>
      </form>
    </div>
  );
};

export default MobileConversationScreen;
