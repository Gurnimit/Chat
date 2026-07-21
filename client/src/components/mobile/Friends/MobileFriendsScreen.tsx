import React, { useState, useMemo } from 'react';
import { Search, UserCheck, UserX, Ban, QrCode, MessageSquare } from 'lucide-react';
import { User as UserType } from '../../../types';
import Avatar from '../Shared/Avatar';

interface MobileFriendsScreenProps {
  friends: UserType[];
  pendingIncomingRequests: any[];
  pendingOutgoingRequests: any[];
  blockedUsers: UserType[];
  handleAcceptFriendRequest: (requestId: string) => void;
  handleRejectFriendRequest: (requestId: string) => void;
  handleCancelFriendRequest: (requestId: string) => void;
  handleBlockUser: (blockedId: string) => void;
  handleUnblockUser: (blockedId: string) => void;
  onQRClick: () => void;
  onStartChat: (user: any) => void;
}

export const MobileFriendsScreen: React.FC<MobileFriendsScreenProps> = ({
  friends,
  pendingIncomingRequests,
  pendingOutgoingRequests,
  blockedUsers,
  handleAcceptFriendRequest,
  handleRejectFriendRequest,
  handleCancelFriendRequest,
  handleBlockUser: _handleBlockUser,
  handleUnblockUser,
  onQRClick,
  onStartChat
}) => {
  const [subTab, setSubTab] = useState<'friends' | 'requests' | 'blocked'>('friends');
  const [search, setSearch] = useState<string>('');

  const filteredFriends = useMemo(() => {
    return friends.filter(f => {
      const name = f.profile?.displayName || f.username;
      return (name || '').toLowerCase().includes(search.toLowerCase());
    });
  }, [friends, search]);

  const filteredRequests = useMemo(() => {
    // Merge incoming & outgoing for display
    const incoming = pendingIncomingRequests.map(r => ({ ...r, direction: 'incoming' }));
    const outgoing = pendingOutgoingRequests.map(r => ({ ...r, direction: 'outgoing' }));
    const all = [...incoming, ...outgoing];
    
    return all.filter(r => {
      const targetUser = r.direction === 'incoming' ? r.sender : r.receiver;
      if (!targetUser) return false;
      const name = targetUser.profile?.displayName || targetUser.username;
      return (name || '').toLowerCase().includes(search.toLowerCase());
    });
  }, [pendingIncomingRequests, pendingOutgoingRequests, search]);

  const filteredBlocked = useMemo(() => {
    return blockedUsers.filter(b => {
      const name = b.profile?.displayName || b.username;
      return (name || '').toLowerCase().includes(search.toLowerCase());
    });
  }, [blockedUsers, search]);

  return (
    <div className="flex-1 flex flex-col h-full bg-dark-bg select-none">
      
      {/* Sub-Tabs selector header */}
      <div className="flex border-b border-dark-border bg-dark-surface/30">
        <button
          onClick={() => setSubTab('friends')}
          className={`flex-1 py-3 text-xs font-bold transition-all relative ${
            subTab === 'friends' ? 'text-brand-400' : 'text-dark-muted hover:text-white'
          }`}
        >
          <span>Friends ({friends.length})</span>
          {subTab === 'friends' && (
            <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-brand-500" />
          )}
        </button>
        <button
          onClick={() => setSubTab('requests')}
          className={`flex-1 py-3 text-xs font-bold transition-all relative ${
            subTab === 'requests' ? 'text-brand-400' : 'text-dark-muted hover:text-white'
          }`}
        >
          <span>Requests ({pendingIncomingRequests.length + pendingOutgoingRequests.length})</span>
          {subTab === 'requests' && (
            <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-brand-500" />
          )}
        </button>
        <button
          onClick={() => setSubTab('blocked')}
          className={`flex-1 py-3 text-xs font-bold transition-all relative ${
            subTab === 'blocked' ? 'text-brand-400' : 'text-dark-muted hover:text-white'
          }`}
        >
          <span>Blocked ({blockedUsers.length})</span>
          {subTab === 'blocked' && (
            <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-brand-500" />
          )}
        </button>
      </div>

      {/* Top Search bar */}
      <div className="p-4 flex items-center space-x-2 shrink-0">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-dark-muted" />
          <input
            type="text"
            placeholder={`Search ${subTab}...`}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-dark-surface border border-white/5 text-sm text-white focus:outline-none focus:border-brand-500/50 transition-all animate-fade-in"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <button
          onClick={onQRClick}
          className="p-2.5 rounded-xl bg-brand-500/10 hover:bg-brand-500 text-brand-400 hover:text-white border border-brand-500/20 transition-all shrink-0 min-h-[44px] min-w-[44px] flex items-center justify-center"
          title="QR Code Settings"
        >
          <QrCode size={18} />
        </button>
      </div>

      {/* Scrollable list container */}
      <div className="flex-1 overflow-y-auto px-4 pb-20 scrollbar-thin">
        
        {/* Friends View */}
        {subTab === 'friends' && (
          filteredFriends.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <MessageSquare size={44} className="text-dark-muted/20 mb-3" />
              <p className="text-sm font-semibold text-white">No friends found</p>
              <p className="text-xs text-dark-muted mt-1 max-w-[200px]">
                Add friends using QR Code or search users globally.
              </p>
            </div>
          ) : (
            <div className="space-y-1.5 animate-fade-in">
              {filteredFriends.map((friend) => (
                <div
                  key={friend.id}
                  onClick={() => onStartChat(friend)}
                  className="p-3 bg-dark-surface/30 hover:bg-dark-surface/60 border border-white/5 rounded-2xl flex items-center justify-between transition-all cursor-pointer"
                >
                  <div className="flex items-center space-x-3 text-left min-w-0">
                    <Avatar
                      src={friend.profile?.avatarUrl}
                      username={friend.username}
                      isOnline={friend.profile?.isOnline}
                      size="sm"
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-white leading-tight truncate">
                        {friend.profile?.displayName || friend.username}
                      </p>
                      <p className="text-[10px] text-dark-muted truncate mt-0.5">
                        @{friend.username}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onStartChat(friend);
                    }}
                    className="p-2.5 rounded-xl bg-white/5 hover:bg-brand-500 text-dark-muted hover:text-white transition-all shrink-0 min-w-[40px] min-h-[40px] flex items-center justify-center"
                  >
                    <MessageSquare size={16} />
                  </button>
                </div>
              ))}
            </div>
          )
        )}

        {/* Requests View */}
        {subTab === 'requests' && (
          filteredRequests.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <UserCheck size={44} className="text-dark-muted/20 mb-3" />
              <p className="text-sm font-semibold text-white">No pending requests</p>
            </div>
          ) : (
            <div className="space-y-1.5 animate-fade-in">
              {filteredRequests.map((req) => {
                const targetUser = req.direction === 'incoming' ? req.sender : req.receiver;
                if (!targetUser) return null;
                const name = targetUser.profile?.displayName || targetUser.username;
                const avatar = targetUser.profile?.avatarUrl;

                return (
                  <div
                    key={req.id}
                    className="p-3.5 bg-dark-surface/30 border border-white/5 rounded-2xl flex items-center justify-between"
                  >
                    <div className="flex items-center space-x-3 text-left min-w-0">
                      <Avatar src={avatar} username={targetUser.username} size="sm" />
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-white leading-tight truncate">{name}</p>
                        <p className="text-[10px] text-dark-muted font-semibold mt-0.5">
                          {req.direction === 'incoming' ? 'Incoming request' : 'Outgoing pending'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-1 shrink-0">
                      {req.direction === 'incoming' ? (
                        <>
                          <button
                            onClick={() => handleAcceptFriendRequest(req.id)}
                            className="p-2.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500 text-emerald-400 hover:text-white transition-all border border-emerald-500/20 shrink-0 min-h-[40px] min-w-[40px] flex items-center justify-center"
                            title="Accept"
                          >
                            <UserCheck size={14} />
                          </button>
                          <button
                            onClick={() => handleRejectFriendRequest(req.id)}
                            className="p-2.5 rounded-xl bg-red-500/10 hover:bg-red-500 text-red-400 hover:text-white transition-all border border-red-500/20 shrink-0 min-h-[40px] min-w-[40px] flex items-center justify-center"
                            title="Decline"
                          >
                            <UserX size={14} />
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => handleCancelFriendRequest(req.id)}
                          className="text-[10px] font-bold text-dark-muted hover:text-white bg-white/5 px-2.5 py-1.5 rounded-lg border border-white/10 transition-colors"
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )
        )}

        {/* Blocked View */}
        {subTab === 'blocked' && (
          filteredBlocked.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <Ban size={44} className="text-dark-muted/20 mb-3" />
              <p className="text-sm font-semibold text-white">No blocked users</p>
            </div>
          ) : (
            <div className="space-y-1.5 animate-fade-in">
              {filteredBlocked.map((blocked) => (
                <div
                  key={blocked.id}
                  className="p-3 bg-dark-surface/30 border border-white/5 rounded-2xl flex items-center justify-between"
                >
                  <div className="flex items-center space-x-3 text-left min-w-0">
                    <Avatar src={blocked.profile?.avatarUrl} username={blocked.username} size="sm" />
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-white leading-tight truncate">
                        {blocked.profile?.displayName || blocked.username}
                      </p>
                      <p className="text-[10px] text-dark-muted truncate mt-0.5">@{blocked.username}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleUnblockUser(blocked.id)}
                    className="text-[10px] font-bold text-brand-400 hover:text-white bg-brand-500/10 hover:bg-brand-500 px-2.5 py-1.5 rounded-lg border border-brand-500/20 transition-all shrink-0"
                  >
                    Unblock
                  </button>
                </div>
              ))}
            </div>
          )
        )}

      </div>

    </div>
  );
};

export default MobileFriendsScreen;
