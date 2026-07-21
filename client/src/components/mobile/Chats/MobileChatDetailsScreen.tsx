import React, { useMemo } from 'react';
import { ArrowLeft, FileText, Ban, Trash2, ShieldAlert } from 'lucide-react';
import { Chat, Message, User as UserType } from '../../../types';
import Avatar from '../Shared/Avatar';

interface MobileChatDetailsScreenProps {
  chat: Chat;
  messages: Message[];
  currentUser: UserType | null;
  onBackClick: () => void;
  onBlockUser: (id: string) => void;
  onUnblockUser: (id: string) => void;
  blockedUsers: UserType[];
  onRemoveFriend?: (id: string) => void;
  // Group actions
  onRemoveMember?: (id: string) => void;
  onTransferOwnership?: (id: string) => void;
  isOwner?: boolean;
}

export const MobileChatDetailsScreen: React.FC<MobileChatDetailsScreenProps> = ({
  chat,
  messages,
  currentUser,
  onBackClick,
  onBlockUser,
  onUnblockUser,
  blockedUsers,
  onRemoveFriend,
  onRemoveMember,
  onTransferOwnership,
  isOwner = false
}) => {
  const isGroup = chat.type === 'GROUP';

  const chatName = isGroup
    ? chat.groupName || 'Group Chat'
    : (chat.otherMember?.profile?.displayName || chat.otherMember?.username || 'Private Chat');

  const chatAvatar = isGroup
    ? chat.groupAvatarUrl
    : chat.otherMember?.profile?.avatarUrl;

  const publicId = isGroup
    ? `GROUP-${chat.id.substring(0, 8)}`
    : chat.otherMember?.publicId || 'N/A';

  const bio = isGroup
    ? chat.groupDescription || 'No description provided.'
    : chat.otherMember?.profile?.bio || 'No bio provided.';

  // Extract shared files from messages
  const sharedFiles = useMemo(() => {
    return messages.flatMap(m => m.attachments || []);
  }, [messages]);

  const isBlocked = useMemo(() => {
    if (isGroup || !chat.otherMember) return false;
    return blockedUsers.some(u => u.id === chat.otherMember!.id);
  }, [chat.otherMember, blockedUsers, isGroup]);

  return (
    <div className="fixed inset-0 bg-dark-bg z-45 flex flex-col select-none overflow-y-auto pb-8">
      
      {/* Top Header */}
      <div className="h-16 bg-dark-surface border-b border-dark-border flex items-center px-4 sticky top-0 z-20 shrink-0">
        <button 
          onClick={onBackClick}
          className="p-2 -ml-2 text-dark-muted hover:text-white transition-colors"
        >
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-base font-bold text-white ml-2">Info</h1>
      </div>

      {/* Hero Header profile */}
      <div className="flex flex-col items-center py-8 px-4 bg-dark-surface/30 border-b border-dark-border">
        <Avatar 
          src={chatAvatar}
          username={isGroup ? chatName : chat.otherMember?.username || '?'}
          size="xl"
          className="mb-4"
        />
        <h2 className="text-xl font-bold text-white leading-tight text-center">{chatName}</h2>
        <p className="text-xs text-brand-400 font-semibold mt-1">ID: {publicId}</p>
      </div>

      {/* Description section */}
      <div className="p-4 border-b border-dark-border">
        <h3 className="text-xs font-semibold text-dark-muted uppercase tracking-wider text-left mb-2">About / Description</h3>
        <p className="text-sm text-zinc-300 leading-relaxed text-left whitespace-pre-wrap">{bio}</p>
      </div>

      {/* Group members list if Group */}
      {isGroup && (
        <div className="p-4 border-b border-dark-border">
          <h3 className="text-xs font-semibold text-dark-muted uppercase tracking-wider text-left mb-3">Group Members</h3>
          <div className="space-y-3">
            {chat.members?.map((member) => {
              const memberUser = member.user;
              if (!memberUser) return null;
              
              const mName = memberUser.profile?.displayName || memberUser.username;
              const mAvatar = memberUser.profile?.avatarUrl;
              const isMe = memberUser.id === currentUser?.id;
              
              return (
                <div key={member.id} className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <Avatar 
                      src={mAvatar} 
                      username={memberUser.username} 
                      size="sm" 
                    />
                    <div className="text-left">
                      <p className="text-xs font-bold text-white leading-tight">
                        {mName} {isMe && '(You)'}
                      </p>
                      <p className="text-[9px] text-dark-muted uppercase font-bold mt-0.5">
                        {member.role}
                      </p>
                    </div>
                  </div>

                  {/* Group admin commands if isOwner */}
                  {isOwner && !isMe && (
                    <div className="flex items-center space-x-1">
                      <button
                        onClick={() => onTransferOwnership?.(memberUser.id)}
                        className="text-[10px] bg-brand-500/10 border border-brand-500/20 text-brand-400 font-bold px-2 py-1 rounded-lg hover:bg-brand-500 hover:text-white transition-all shrink-0"
                        title="Make Owner"
                      >
                        Owner
                      </button>
                      <button
                        onClick={() => onRemoveMember?.(memberUser.id)}
                        className="text-[10px] bg-red-500/10 border border-red-500/20 text-red-400 font-bold px-2 py-1 rounded-lg hover:bg-red-500 hover:text-white transition-all shrink-0"
                        title="Remove Member"
                      >
                        Kick
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Shared Files section */}
      <div className="p-4 border-b border-dark-border">
        <h3 className="text-xs font-semibold text-dark-muted uppercase tracking-wider text-left mb-3">Shared Files ({sharedFiles.length})</h3>
        {sharedFiles.length === 0 ? (
          <p className="text-xs text-dark-muted text-left italic">No files shared yet</p>
        ) : (
          <div className="space-y-2">
            {sharedFiles.map((file) => (
              <div 
                key={file.id} 
                className="p-3 rounded-2xl bg-dark-surface/40 hover:bg-dark-surface/75 border border-white/5 flex items-center justify-between transition-colors text-left"
              >
                <div className="flex items-center space-x-2.5 min-w-0">
                  <FileText size={18} className="text-dark-muted shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-white truncate max-w-[200px]">{file.fileName}</p>
                    <p className="text-[10px] text-dark-muted mt-0.5">{Math.round(file.fileSize / 1024)} KB</p>
                  </div>
                </div>
                <a 
                  href={file.fileUrl} 
                  target="_blank" 
                  rel="noreferrer" 
                  className="text-xs font-bold text-brand-400 hover:text-brand-300 ml-2"
                >
                  Download
                </a>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Privacy and actions section */}
      <div className="p-4 space-y-2">
        <h3 className="text-xs font-semibold text-dark-muted uppercase tracking-wider text-left mb-2">Privacy & Actions</h3>
        
        {/* Block/Unblock actions for Direct chats */}
        {!isGroup && chat.otherMember && (
          <button
            onClick={() => isBlocked ? onUnblockUser(chat.otherMember!.id) : onBlockUser(chat.otherMember!.id)}
            className="w-full p-3.5 rounded-2xl bg-red-500/10 border border-red-500/20 hover:bg-red-500 hover:text-white text-red-400 font-semibold text-xs transition-all flex items-center justify-center space-x-2"
          >
            <Ban size={14} />
            <span>{isBlocked ? 'Unblock User' : 'Block User'}</span>
          </button>
        )}

        {/* Remove friend action */}
        {!isGroup && chat.otherMember && onRemoveFriend && (
          <button
            onClick={() => onRemoveFriend(chat.otherMember!.id)}
            className="w-full p-3.5 rounded-2xl bg-white/5 hover:bg-red-500/10 text-dark-text hover:text-red-400 font-semibold text-xs transition-all border border-white/10 flex items-center justify-center space-x-2"
          >
            <Trash2 size={14} />
            <span>Remove Friend</span>
          </button>
        )}

        <button
          onClick={() => alert('Reporting submitted. Thank you for keeping Velvet Chat safe.')}
          className="w-full p-3.5 rounded-2xl bg-white/5 hover:bg-white/10 text-dark-muted hover:text-white font-semibold text-xs transition-all border border-white/5 flex items-center justify-center space-x-2"
        >
          <ShieldAlert size={14} />
          <span>Report Abuse</span>
        </button>
      </div>

    </div>
  );
};

export default MobileChatDetailsScreen;
