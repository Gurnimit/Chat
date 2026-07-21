import React from 'react';
import { MessageSquare, Users, Phone, Settings as SettingsIcon } from 'lucide-react';

interface BottomNavigationProps {
  activeTab: 'chats' | 'friends' | 'calls' | 'settings';
  setActiveTab: (tab: 'chats' | 'friends' | 'calls' | 'settings') => void;
  unreadChatsCount?: number;
  pendingRequestsCount?: number;
  missedCallsCount?: number;
}

export const BottomNavigation: React.FC<BottomNavigationProps> = ({
  activeTab,
  setActiveTab,
  unreadChatsCount = 0,
  pendingRequestsCount = 0,
  missedCallsCount = 0
}) => {
  return (
    <div className="fixed bottom-0 left-0 right-0 h-16 bg-dark-surface/90 backdrop-blur-lg border-t border-dark-border flex items-center justify-around z-30 select-none pb-safe">
      {/* Chats Tab */}
      <button
        onClick={() => setActiveTab('chats')}
        className={`flex flex-col items-center justify-center flex-1 h-full relative transition-colors ${
          activeTab === 'chats' ? 'text-brand-400' : 'text-dark-muted hover:text-white'
        }`}
      >
        <div className="relative">
          <MessageSquare size={20} />
          {unreadChatsCount > 0 && (
            <span className="absolute -top-1.5 -right-2 bg-brand-500 text-white text-[9px] font-bold h-4 min-w-[16px] px-1 rounded-full flex items-center justify-center border border-dark-surface">
              {unreadChatsCount}
            </span>
          )}
        </div>
        <span className="text-[10px] font-semibold mt-1">Chats</span>
      </button>

      {/* Friends Tab */}
      <button
        onClick={() => setActiveTab('friends')}
        className={`flex flex-col items-center justify-center flex-1 h-full relative transition-colors ${
          activeTab === 'friends' ? 'text-brand-400' : 'text-dark-muted hover:text-white'
        }`}
      >
        <div className="relative">
          <Users size={20} />
          {pendingRequestsCount > 0 && (
            <span className="absolute -top-1.5 -right-2 bg-brand-500 text-white text-[9px] font-bold h-4 min-w-[16px] px-1 rounded-full flex items-center justify-center border border-dark-surface">
              {pendingRequestsCount}
            </span>
          )}
        </div>
        <span className="text-[10px] font-semibold mt-1">Friends</span>
      </button>

      {/* Calls Tab */}
      <button
        onClick={() => setActiveTab('calls')}
        className={`flex flex-col items-center justify-center flex-1 h-full relative transition-colors ${
          activeTab === 'calls' ? 'text-brand-400' : 'text-dark-muted hover:text-white'
        }`}
      >
        <div className="relative">
          <Phone size={20} />
          {missedCallsCount > 0 && (
            <span className="absolute -top-1.5 -right-2 bg-red-500 text-white text-[9px] font-bold h-4 min-w-[16px] px-1 rounded-full flex items-center justify-center border border-dark-surface">
              {missedCallsCount}
            </span>
          )}
        </div>
        <span className="text-[10px] font-semibold mt-1">Calls</span>
      </button>

      {/* Settings Tab */}
      <button
        onClick={() => setActiveTab('settings')}
        className={`flex flex-col items-center justify-center flex-1 h-full transition-colors ${
          activeTab === 'settings' ? 'text-brand-400' : 'text-dark-muted hover:text-white'
        }`}
      >
        <SettingsIcon size={20} />
        <span className="text-[10px] font-semibold mt-1">Settings</span>
      </button>
    </div>
  );
};

export default BottomNavigation;
