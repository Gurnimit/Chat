import React, { useState, useMemo } from 'react';
import { Phone, Video, MessageSquare, Clock, ArrowUpRight, ArrowDownLeft } from 'lucide-react';

interface MobileCallsScreenProps {
  callHistory: any[];
  user: any;
  startCall: (type: 'audio' | 'video', targetUser: any) => void;
  openChatForUser: (targetUser: any) => void;
  setActiveTab: (tab: 'chats' | 'friends' | 'calls' | 'settings') => void;
}

export const MobileCallsScreen: React.FC<MobileCallsScreenProps> = ({
  callHistory,
  user,
  startCall,
  openChatForUser,
  setActiveTab
}) => {
  const [tab, setTab] = useState<'all' | 'incoming' | 'outgoing' | 'missed'>('all');

  const filteredLogs = useMemo(() => {
    return callHistory.filter((log) => {
      const isOutgoing = log.callerId === user?.id;
      if (tab === 'incoming') return !isOutgoing;
      if (tab === 'outgoing') return isOutgoing;
      if (tab === 'missed') return log.status === 'MISSED';
      return true;
    });
  }, [callHistory, tab, user?.id]);

  return (
    <div className="flex-1 flex flex-col h-full bg-dark-bg select-none">
      {/* Tabs */}
      <div className="flex border-b border-dark-border bg-dark-surface/30 shrink-0">
        {(['all', 'incoming', 'outgoing', 'missed'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-3 text-[11px] font-bold uppercase tracking-wider transition-all relative ${
              tab === t ? 'text-brand-400' : 'text-dark-muted hover:text-white'
            }`}
          >
            <span>{t}</span>
            {tab === t && (
              <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-brand-500" />
            )}
          </button>
        ))}
      </div>

      {/* Logs Area */}
      <div className="flex-1 overflow-y-auto px-4 py-4 pb-20 scrollbar-thin">
        {filteredLogs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Clock size={44} className="text-dark-muted/20 mb-3" />
            <p className="text-sm font-semibold text-white">No call history</p>
            <p className="text-xs text-dark-muted mt-1 max-w-[200px]">
              Calls made or received will show up here.
            </p>
          </div>
        ) : (
          <div className="space-y-2.5 animate-fade-in">
            {filteredLogs.map((log) => {
              const isOutgoing = log.callerId === user?.id;
              const partner = isOutgoing ? log.receiver : log.caller;
              if (!partner) return null;

              const displayName = partner.profile?.displayName || partner.username;
              const avatar = partner.profile?.avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${partner.username}`;
              const formattedDate = new Date(log.startedAt).toLocaleString([], {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              });

              // Format duration
              const mins = Math.floor(log.durationSeconds / 60);
              const secs = log.durationSeconds % 60;
              const durationStr = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;

              return (
                <div
                  key={log.id}
                  className="p-3.5 bg-dark-surface/30 border border-white/5 rounded-2xl flex items-center justify-between transition-all"
                >
                  <div className="flex items-center space-x-3.5 min-w-0 text-left">
                    <div className="w-10 h-10 rounded-xl overflow-hidden border border-white/10 flex-shrink-0">
                      <img src={avatar} alt="avatar" className="w-full h-full object-cover" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-xs text-white truncate leading-none">
                          {displayName}
                        </span>
                        <span className={`text-[8px] font-extrabold uppercase tracking-wider px-1.5 py-0.5 rounded leading-none flex items-center space-x-0.5 ${
                          isOutgoing ? 'text-blue-400 bg-blue-500/10' : 'text-purple-400 bg-purple-500/10'
                        }`}>
                          {isOutgoing ? (
                            <>
                              <ArrowUpRight size={8} />
                              <span>Out</span>
                            </>
                          ) : (
                            <>
                              <ArrowDownLeft size={8} />
                              <span>In</span>
                            </>
                          )}
                        </span>
                      </div>
                      <div className="text-[10px] text-dark-muted mt-1.5 flex items-center space-x-1.5 flex-wrap">
                        {log.callType === 'VIDEO' ? <Video size={10} /> : <Phone size={10} />}
                        <span>{formattedDate}</span>
                        <span>•</span>
                        <span className={`font-bold ${
                          log.status === 'COMPLETED' ? 'text-emerald-400' :
                          log.status === 'MISSED' ? 'text-red-400' :
                          log.status === 'REJECTED' ? 'text-amber-400' : 'text-dark-muted'
                        }`}>{log.status}</span>
                        {log.status === 'COMPLETED' && (
                          <>
                            <span>•</span>
                            <span>{durationStr}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center space-x-2 shrink-0">
                    <button
                      onClick={() => {
                        startCall(log.callType.toLowerCase() as 'audio' | 'video', partner);
                      }}
                      className="p-2.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-white min-h-[40px] min-w-[40px] flex items-center justify-center transition-all shadow-md hover:shadow-brand-500/10"
                      title="Redial"
                    >
                      {log.callType === 'VIDEO' ? <Video size={14} /> : <Phone size={14} />}
                    </button>
                    <button
                      onClick={() => {
                        openChatForUser(partner);
                        setActiveTab('chats');
                      }}
                      className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 text-dark-muted hover:text-white min-h-[40px] min-w-[40px] flex items-center justify-center transition-all"
                      title="Open Conversation"
                    >
                      <MessageSquare size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default MobileCallsScreen;
