import React, { useEffect } from 'react';
import { Search, X, UserPlus, ArrowLeft } from 'lucide-react';
import Avatar from '../Shared/Avatar';

interface MobileSearchOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  userSearchQuery: string;
  setUserSearchQuery: (query: string) => void;
  handleUserSearch: (e: React.FormEvent) => void;
  userSearchResults: any[];
  handleSendFriendRequest: (receiverId: string) => void;
  handleStartChatWithUser: (user: any) => void;
  isSearching?: boolean;
}

export const MobileSearchOverlay: React.FC<MobileSearchOverlayProps> = ({
  isOpen,
  onClose,
  userSearchQuery,
  setUserSearchQuery,
  handleUserSearch,
  userSearchResults,
  handleSendFriendRequest,
  handleStartChatWithUser,
  isSearching = false
}) => {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-dark-bg z-50 flex flex-col animate-fade-in select-none">
      {/* Search Header */}
      <div className="h-16 bg-dark-surface border-b border-dark-border flex items-center px-4 shrink-0">
        <button
          onClick={onClose}
          className="p-2 -ml-2 text-dark-muted hover:text-white transition-colors"
        >
          <ArrowLeft size={20} />
        </button>
        <form onSubmit={handleUserSearch} className="flex-1 ml-2 relative">
          <input
            type="text"
            placeholder="Search users by name or tag..."
            className="w-full bg-black/40 border border-white/10 rounded-xl py-2 pl-4 pr-10 text-sm text-white focus:outline-none focus:border-brand-500 transition-colors"
            value={userSearchQuery}
            onChange={(e) => setUserSearchQuery(e.target.value)}
            autoFocus
          />
          {userSearchQuery && (
            <button
              type="button"
              onClick={() => setUserSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-dark-muted hover:text-white"
            >
              <X size={16} />
            </button>
          )}
        </form>
      </div>

      {/* Results List */}
      <div className="flex-1 overflow-y-auto p-4 scrollbar-thin">
        {isSearching ? (
          <div className="flex flex-col items-center justify-center py-12 space-y-3">
            <div className="w-8 h-8 border-2 border-brand-500/20 border-t-brand-500 rounded-full animate-spin"></div>
            <p className="text-xs text-dark-muted">Searching global database...</p>
          </div>
        ) : userSearchResults.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Search size={40} className="text-dark-muted/40 mb-3" />
            <p className="text-sm font-semibold text-white">No users found</p>
            <p className="text-xs text-dark-muted max-w-[200px] mt-1">
              Search by their profile username or display name tags.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {userSearchResults.map((user) => (
              <div
                key={user.id}
                className="p-3 bg-dark-surface/40 hover:bg-dark-surface/80 border border-white/5 rounded-2xl flex items-center justify-between transition-colors cursor-pointer"
                onClick={() => handleStartChatWithUser(user)}
              >
                <div className="flex items-center space-x-3 min-w-0">
                  <Avatar
                    src={user.profile?.avatarUrl}
                    username={user.username}
                    isOnline={user.profile?.isOnline}
                    size="md"
                  />
                  <div className="text-left min-w-0">
                    <p className="text-sm font-bold text-white leading-tight truncate">
                      {user.profile?.displayName || user.username}
                    </p>
                    <p className="text-xs text-dark-muted truncate mt-0.5">
                      @{user.username}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSendFriendRequest(user.id);
                  }}
                  className="p-2.5 rounded-xl bg-brand-500/10 hover:bg-brand-500 text-brand-400 hover:text-white transition-all border border-brand-500/20 flex items-center justify-center shrink-0 min-h-[44px] min-w-[44px]"
                  title="Send Friend Request"
                >
                  <UserPlus size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default MobileSearchOverlay;
