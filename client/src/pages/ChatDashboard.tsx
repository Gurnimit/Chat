import React, { useState, useEffect, useRef } from 'react';
import { 
  Search, MessageSquare, Send, Paperclip, LogOut, Check, CheckCheck, 
  Smile, Settings, Info, X, ChevronRight, FileText,
  Download, Edit, Trash2, Reply, Phone, PhoneOff, Mic, MicOff,
  Video, VideoOff, Maximize2, Minimize2, Users, UserPlus, UserCheck, Ban,
  Volume2, VolumeX, Headphones, Camera, Upload, Share2,
  Bell, BellOff, Clock
} from 'lucide-react';

import { useAuth, api, getBackendURL } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { useWebRTCCall } from '../hooks/useWebRTCCall';
import { Chat, Message, MessageStatus, User as UserType } from '../types';
import { MobileDashboard } from './MobileDashboard';
import { TabletDashboard } from './TabletDashboard';


import QRCode from 'qrcode';
import jsQR from 'jsqr';
import { Share } from '@capacitor/share';

import { App } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { PushNotifications } from '@capacitor/push-notifications';
const CATEGORY_LIMITS_CLIENT = {
  image: { max: 25 * 1024 * 1024, label: '25MB' },
  audio: { max: 100 * 1024 * 1024, label: '100MB' },
  document: { max: 100 * 1024 * 1024, label: '100MB' },
  archive: { max: 250 * 1024 * 1024, label: '250MB' },
  video: { max: 500 * 1024 * 1024, label: '500MB' }
};

const ALLOWED_TYPES_CLIENT = {
  image: [
    'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/bmp'
  ],
  video: [
    'video/mp4', 'video/mpeg', 'video/quicktime', 'video/webm', 'video/x-msvideo'
  ],
  audio: [
    'audio/mpeg', 'audio/ogg', 'audio/wav', 'audio/webm', 'audio/aac'
  ],
  document: [
    'application/pdf',
    'text/plain',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation'
  ],
  archive: [
    'application/zip', 'application/x-zip-compressed'
  ]
};

export const ChatDashboard: React.FC = () => {
  const { user, logout, updateProfile } = useAuth();
  const { socket, isConnected } = useSocket();

  // Active States
  const [chats, setChats] = useState<Chat[]>([]);
  const [selectedChat, setSelectedChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [typedMessage, setTypedMessage] = useState<string>('');

  // Viewport Width listener for responsive dashboard layout
  const [viewportWidth, setViewportWidth] = useState<number>(window.innerWidth);

  useEffect(() => {
    const handleResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);


  // Offline Message Queue
  const [offlineQueue, setOfflineQueue] = useState<any[]>(() => {
    try {
      const saved = localStorage.getItem('offline_message_queue');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Group Creation/Management States
  const [showCreateGroupModal, setShowCreateGroupModal] = useState<boolean>(false);
  const [groupNameInput, setGroupNameInput] = useState<string>('');
  const [groupDescInput, setGroupDescInput] = useState<string>('');
  const [groupAvatarUrlInput, setGroupAvatarUrlInput] = useState<string>('');
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [groupMemberSearchQuery, setGroupMemberSearchQuery] = useState<string>('');
  const [groupMemberSearchResults, setGroupMemberSearchResults] = useState<UserType[]>([]);
  
  // Searching & Selection Modals
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showSearchModal, setShowSearchModal] = useState<boolean>(false);
  const [userSearchQuery, setUserSearchQuery] = useState<string>('');
  const [userSearchResults, setUserSearchResults] = useState<UserType[]>([]);
  
  // UI Panels
  const [showRightSidebar, setShowRightSidebar] = useState<boolean>(true);
  const [showProfileModal, setShowProfileModal] = useState<boolean>(false);
  const [displayNameInput, setDisplayNameInput] = useState<string>(user?.profile?.displayName || '');
  const [bioInput, setBioInput] = useState<string>(user?.profile?.bio || '');
  const [avatarUrlInput, setAvatarUrlInput] = useState<string>(user?.profile?.avatarUrl || '');
  const [usernameInput, setUsernameInput] = useState<string>(user?.username || '');
  const [currentPassword, setCurrentPassword] = useState<string>('');
  const [newPassword, setNewPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [whoCanSendFriendRequests, setWhoCanSendFriendRequestsInput] = useState<string>('EVERYONE');
  const [whoCanCallMe, setWhoCanCallMeInput] = useState<string>('EVERYONE');
  const [whoCanSeeProfilePhoto, setWhoCanSeeProfilePhotoInput] = useState<string>('EVERYONE');
  const [whoCanSeeLastSeen, setWhoCanSeeLastSeenInput] = useState<string>('EVERYONE');
  const [isUploadingAvatar, setIsUploadingAvatar] = useState<boolean>(false);

  // Friendship States
  const [showFriendshipModal, setShowFriendshipModal] = useState<boolean>(false);
  const [friendshipModalTab, setFriendshipModalTab] = useState<'friends' | 'pending' | 'blocked' | 'qr_invite'>('friends');
  const [friends, setFriends] = useState<UserType[]>([]);
  const [pendingIncomingRequests, setPendingIncomingRequests] = useState<any[]>([]);
  const [pendingOutgoingRequests, setPendingOutgoingRequests] = useState<any[]>([]);
  const [blockedUsers, setBlockedUsers] = useState<UserType[]>([]);

  // QR Code & Deep Link States
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');
  const [isScanningQR, setIsScanningQR] = useState<boolean>(false);
  const [scannedProfile, setScannedProfile] = useState<any | null>(null);
  const [qrError, setQrError] = useState<string>('');
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [friendSearchQuery, setFriendSearchQuery] = useState<string>('');
  const [_friendSearchResults, setFriendSearchResults] = useState<UserType[]>([]);

  // Typing & Sockets Status
  const [typingUsers, setTypingUsers] = useState<Record<string, boolean>>({});
  const [activeTypingChatId, setActiveTypingChatId] = useState<string | null>(null);
  
  // Message interaction
  const [replyingToMessage, setReplyingToMessage] = useState<Message | null>(null);
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);
  const [showEmojiPickerForMessageId, setShowEmojiPickerForMessageId] = useState<string | null>(null);
  
  // File Upload State
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [uploadedFileMetadata, setUploadedFileMetadata] = useState<{
    fileUrl: string;
    fileName: string;
    fileSize: number;
    mimeType: string;
  } | null>(null);

  // Refs for scrolling
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatAreaRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<Record<string, any>>({});
  const isCurrentlyTypingRef = useRef<Record<string, boolean>>({});

  const {
    callState,
    callPeer,
    isMuted,
    callDuration,
    callType,
    isVideoEnabled,
    isFullscreenVideo,
    connectionQuality,
    showFallbackPrompt,
    localVideoRef,
    remoteVideoRef,
    remoteAudioRef,
    setIsFullscreenVideo,
    setShowFallbackPrompt: _setShowFallbackPrompt,
    startCall,
    acceptCall,
    rejectCall,
    endCall,
    toggleMute,
    toggleCamera,
    switchToAudioOnly,
    formatCallDuration,
    // Addendum Outputs
    audioOutputs,
    selectedAudioOutput,
    isSpeakerphone,
    handleSelectAudioRoute,
    toggleSpeakerphone,
    fetchAudioOutputs,
    enableRingtone,
    setEnableRingtone,
    enableCallertone,
    setEnableCallertone,
    enableMessageSounds,
    setEnableMessageSounds,
    soundVolume,
    setSoundVolume,
    audioRouteError,
    liveDiagnostics,
    diagnosticsLog,
    playNotificationSound
  } = useWebRTCCall();

  // Local calling UI menu toggles
  const [showAudioRouteMenu, setShowAudioRouteMenu] = useState<boolean>(false);
  const [showDiagnosticsHUD, setShowDiagnosticsHUD] = useState<boolean>(false);

  // Call History states
  const [showCallHistoryModal, setShowCallHistoryModal] = useState<boolean>(false);
  const [callHistory, setCallHistory] = useState<any[]>([]);
  const [callHistoryTab, setCallHistoryTab] = useState<'all' | 'incoming' | 'outgoing' | 'missed'>('all');

  // Notification Center states
  const [showNotificationCenter, setShowNotificationCenter] = useState<boolean>(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [notificationsPage, setNotificationsPage] = useState<number>(1);
  const [notificationsTotalPages, setNotificationsTotalPages] = useState<number>(1);
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState<number>(0);

  // Preference states
  const [prefMessages, setPrefMessages] = useState<boolean>(true);
  const [prefCalls, setPrefCalls] = useState<boolean>(true);
  const [prefFriendRequests, setPrefFriendRequests] = useState<boolean>(true);
  const [prefGroups, setPrefGroups] = useState<boolean>(true);
  const [prefSoundEffects, setPrefSoundEffects] = useState<boolean>(true);

  const prefSoundEffectsRef = useRef(prefSoundEffects);
  useEffect(() => {
    prefSoundEffectsRef.current = prefSoundEffects;
  }, [prefSoundEffects]);

  const fetchCallHistory = async () => {
    try {
      const response = await api.get('/calls/history');
      setCallHistory(response.data);
    } catch (err) {
      console.error('Failed to fetch call history:', err);
    }
  };

  useEffect(() => {
    if (showCallHistoryModal) {
      fetchCallHistory();
    }
  }, [showCallHistoryModal]);

  const fetchNotifications = async (page = 1, append = false) => {
    try {
      const response = await api.get(`/notifications?page=${page}&limit=10`);
      const { notifications: list, pagination } = response.data;
      if (append) {
        setNotifications(prev => {
          const existingIds = new Set(prev.map(n => n.id));
          const filteredList = list.filter((n: any) => !existingIds.has(n.id));
          return [...prev, ...filteredList];
        });
      } else {
        setNotifications(list);
      }
      setNotificationsPage(pagination.page);
      setNotificationsTotalPages(pagination.totalPages);
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
    }
  };

  const fetchUnreadCount = async () => {
    try {
      const response = await api.get('/notifications?page=1&limit=100');
      const list = response.data.notifications;
      const unread = list.filter((n: any) => !n.isRead).length;
      setUnreadNotificationsCount(unread);
    } catch (err) {
      console.error('Failed to get unread notification count:', err);
    }
  };

  const fetchPreferences = async () => {
    try {
      const response = await api.get('/notifications/preferences');
      const prefs = response.data;
      setPrefMessages(prefs.messages);
      setPrefCalls(prefs.calls);
      setPrefFriendRequests(prefs.friendRequests);
      setPrefGroups(prefs.groupNotifications);
      setPrefSoundEffects(prefs.soundEffects);
      setWhoCanSendFriendRequestsInput(prefs.whoCanSendFriendRequests || 'EVERYONE');
      setWhoCanCallMeInput(prefs.whoCanCallMe || 'EVERYONE');
      setWhoCanSeeProfilePhotoInput(prefs.whoCanSeeProfilePhoto || 'EVERYONE');
      setWhoCanSeeLastSeenInput(prefs.whoCanSeeLastSeen || 'EVERYONE');
      
      // Update WebRTC sound settings
      setEnableMessageSounds(prefs.soundEffects && prefs.messages);
      setEnableRingtone(prefs.soundEffects && prefs.calls);
      setEnableCallertone(prefs.soundEffects && prefs.calls);
    } catch (err) {
      console.error('Failed to fetch notification preferences:', err);
    }
  };

  const updatePreference = async (key: string, value: any) => {
    if (key === 'messages') setPrefMessages(value);
    else if (key === 'calls') setPrefCalls(value);
    else if (key === 'friendRequests') setPrefFriendRequests(value);
    else if (key === 'groupNotifications') setPrefGroups(value);
    else if (key === 'soundEffects') {
      setPrefSoundEffects(value);
      setEnableMessageSounds(value);
      setEnableRingtone(value);
      setEnableCallertone(value);
    } else if (key === 'whoCanSendFriendRequests') setWhoCanSendFriendRequestsInput(value);
    else if (key === 'whoCanCallMe') setWhoCanCallMeInput(value);
    else if (key === 'whoCanSeeProfilePhoto') setWhoCanSeeProfilePhotoInput(value);
    else if (key === 'whoCanSeeLastSeen') setWhoCanSeeLastSeenInput(value);

    try {
      await api.put('/notifications/preferences', {
        messages: key === 'messages' ? value : undefined,
        calls: key === 'calls' ? value : undefined,
        friendRequests: key === 'friendRequests' ? value : undefined,
        groupNotifications: key === 'groupNotifications' ? value : undefined,
        soundEffects: key === 'soundEffects' ? value : undefined,
        whoCanSendFriendRequests: key === 'whoCanSendFriendRequests' ? value : undefined,
        whoCanCallMe: key === 'whoCanCallMe' ? value : undefined,
        whoCanSeeProfilePhoto: key === 'whoCanSeeProfilePhoto' ? value : undefined,
        whoCanSeeLastSeen: key === 'whoCanSeeLastSeen' ? value : undefined,
      });
    } catch (err) {
      console.error('Failed to update preference on server:', err);
    }
  };

  const markNotificationRead = async (id: string) => {
    try {
      await api.put(`/notifications/${id}/read`);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
      setUnreadNotificationsCount(prev => Math.max(0, prev - 1));
    } catch (err) {
      console.error('Failed to mark notification read:', err);
    }
  };

  const markAllNotificationsRead = async () => {
    try {
      await api.put('/notifications/read-all');
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      setUnreadNotificationsCount(0);
    } catch (err) {
      console.error('Failed to mark all notifications read:', err);
    }
  };

  useEffect(() => {
    fetchPreferences();
    fetchUnreadCount();
    
    const interval = setInterval(fetchUnreadCount, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (showNotificationCenter) {
      fetchNotifications(1, false);
    }
  }, [showNotificationCenter]);

  const openChatForUser = async (targetUser: any) => {
    const existingChat = chats.find(c => c.type === 'DIRECT' && c.otherMember?.id === targetUser.id);
    if (existingChat) {
      setSelectedChat(existingChat);
      setShowCallHistoryModal(false);
    } else {
      const userPayload: UserType = {
        id: targetUser.id,
        username: targetUser.username,
        email: targetUser.email || '',
        publicId: targetUser.publicId,
        profile: targetUser.profile || null,
      };
      await startDirectChat(userPayload);
      setShowCallHistoryModal(false);
    }
  };

  // Helper to resolve absolute backend URLs for assets
  const getAbsoluteUrl = (url: string) => {
    if (!url) return '';
    if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) {
      return url;
    }
    const cleanUrl = url.startsWith('/') ? url.slice(1) : url;
    const backend = getBackendURL();
    const backendBase = backend.endsWith('/') ? backend : `${backend}/`;
    return `${backendBase}${cleanUrl}`;
  };

  // Helper to handle attachment downloads securely on Web & Capacitor
  const handleDownloadAttachment = async (e: React.MouseEvent, url: string) => {
    e.preventDefault();
    const absUrl = getAbsoluteUrl(url);
    if (window.hasOwnProperty('Capacitor') && (window as any).Capacitor.isNativePlatform()) {
      try {
        await Browser.open({ url: absUrl });
      } catch (err) {
        console.error('Failed to open link in system browser:', err);
        window.open(absUrl, '_system');
      }
    } else {
      const a = document.createElement('a');
      a.href = absUrl;
      a.download = '';
      a.target = '_blank';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  // Android Native Back Button Interception
  useEffect(() => {
    if (!window.hasOwnProperty('Capacitor')) return;
    const capacitor = (window as any).Capacitor;
    if (!capacitor.isNativePlatform()) return;

    const handleBackButton = async () => {
      // 1. If call is active, prompt confirmation
      if (callState !== 'idle') {
        const confirmHangup = window.confirm('Are you sure you want to end the active call?');
        if (confirmHangup) {
          if (callState === 'incoming') {
            rejectCall();
          } else {
            endCall();
          }
        }
        return;
      }

      // 2. Close active modals / overlays
      if (showProfileModal) {
        setShowProfileModal(false);
        return;
      }
      if (showSearchModal) {
        setShowSearchModal(false);
        return;
      }
      if (showFriendshipModal) {
        setShowFriendshipModal(false);
        return;
      }
      if (showEmojiPickerForMessageId) {
        setShowEmojiPickerForMessageId(null);
        return;
      }

      // 3. Clear message interaction states
      if (replyingToMessage) {
        setReplyingToMessage(null);
        return;
      }
      if (editingMessage) {
        setEditingMessage(null);
        setTypedMessage('');
        return;
      }
      if (uploadedFileMetadata) {
        setUploadedFileMetadata(null);
        return;
      }

      // 4. Back out of active chat conversation (mobile layout view)
      if (selectedChat) {
        setSelectedChat(null);
        return;
      }

      // 5. Safe exit confirmation to prevent accidental application shutdown
      const confirmExit = window.confirm('Exit Velvet Chat?');
      if (confirmExit) {
        App.exitApp();
      }
    };

    const listenerPromise = App.addListener('backButton', () => {
      handleBackButton();
    });

    return () => {
      listenerPromise.then(handle => handle.remove());
    };
  }, [
    callState,
    showProfileModal,
    showSearchModal,
    showEmojiPickerForMessageId,
    replyingToMessage,
    editingMessage,
    uploadedFileMetadata,
    selectedChat,
    rejectCall,
    endCall
  ]);

  // Device ID generation and lookup
  const deviceIdRef = useRef<string>('');
  useEffect(() => {
    let devId = localStorage.getItem('deviceId');
    if (!devId) {
      devId = 'dev-' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      localStorage.setItem('deviceId', devId);
    }
    deviceIdRef.current = devId;
  }, []);

  // Sync offline queue to localStorage
  useEffect(() => {
    localStorage.setItem('offline_message_queue', JSON.stringify(offlineQueue));
  }, [offlineQueue]);

  // Register Push Notifications
  useEffect(() => {
    if (!window.hasOwnProperty('Capacitor')) return;
    const capacitor = (window as any).Capacitor;
    if (!capacitor.isNativePlatform()) return;

    const registerPush = async () => {
      try {
        let perm = await PushNotifications.checkPermissions();
        if (perm.receive !== 'granted') {
          perm = await PushNotifications.requestPermissions();
        }
        if (perm.receive !== 'granted') {
          console.warn('Push notification permissions denied.');
          return;
        }

        // Configure Android Notification Channels
        try {
          await PushNotifications.createChannel({
            id: 'messages',
            name: 'Messages',
            description: 'Notification channel for incoming chat messages',
            importance: 4, // High importance
            visibility: 1,
            sound: 'default',
            vibration: true,
          });

          await PushNotifications.createChannel({
            id: 'calls',
            name: 'Calls',
            description: 'Notification channel for incoming VoIP calls',
            importance: 5, // Max importance
            visibility: 1,
            sound: 'default',
            vibration: true,
          });
          console.log('Android notification channels configured successfully.');
        } catch (chanErr) {
          console.error('Failed to create custom notification channels:', chanErr);
        }

        await PushNotifications.register();

        PushNotifications.addListener('registration', async (token) => {
          console.log('Push notification registration succeeded. Token:', token.value);
          try {
            await api.post('/auth/device-token', {
              token: token.value,
              deviceId: deviceIdRef.current || 'unknown-device',
              platform: capacitor.getPlatform() || 'android'
            });
          } catch (err) {
            console.error('Failed to register device token to server:', err);
          }
        });

        PushNotifications.addListener('registrationError', (err) => {
          console.error('Push registration error:', err.error);
        });

        PushNotifications.addListener('pushNotificationReceived', (notification) => {
          console.log('Push notification received:', notification);
        });

        PushNotifications.addListener('pushNotificationActionPerformed', async (action) => {
          console.log('Push action performed:', action);
          const data = action.notification?.data;
          if (!data) return;

          if ((data.type === 'message' || data.type === 'group_invite') && data.chatId) {
            try {
              const chatsRes = await api.get('/chats');
              const latestChats = chatsRes.data;
              setChats(latestChats);
              const matchedChat = latestChats.find((c: any) => c.id === data.chatId);
              if (matchedChat) {
                setSelectedChat(matchedChat);
              }
            } catch (err) {
              console.error('Failed to route notification tap:', err);
            }
          } else if (data.type === 'friend_request' || data.type === 'friend_accept') {
            setShowFriendshipModal(true);
            setFriendshipModalTab(data.type === 'friend_request' ? 'pending' : 'friends');
          } else if (data.type === 'call') {
            setSelectedChat(null);
          } else if (data.type === 'missed_call') {
            setSelectedChat(null);
            setShowCallHistoryModal(true);
          }
        });
      } catch (err) {
        console.error('Error during push registration setup:', err);
      }
    };

    registerPush();
  }, []);

  // 1. Fetch recent chats on load
  const fetchChats = async () => {
    try {
      const response = await api.get('/chats');
      setChats(response.data);
    } catch (e) {
      console.error('Failed to load chats:', e);
    }
  };

  useEffect(() => {
    fetchChats();
  }, []);

  // 2. Fetch messages when active chat changes
  useEffect(() => {
    if (!selectedChat) return;

    const fetchMessages = async () => {
      try {
        const response = await api.get(`/chats/${selectedChat.id}/messages`);
        setMessages(response.data);
        
        // Scroll to bottom
        setTimeout(scrollToBottom, 50);

        // Mark messages as read on server
        if (socket && selectedChat.unreadCount > 0) {
          socket.emit('mark_read', { chatId: selectedChat.id });
          // Locally reset unread count
          setChats(prevChats => 
            prevChats.map(c => c.id === selectedChat.id ? { ...c, unreadCount: 0 } : c)
          );
        }

        // Mark messages as delivered on server (Phase 6D)
        const unDeliveredMsgIds = response.data
          .filter((msg: any) => msg.senderId !== user!.id && (!msg.statuses || !msg.statuses.some((s: any) => s.userId === user!.id && s.deliveredAt)))
          .map((msg: any) => msg.id);
        
        if (socket && unDeliveredMsgIds.length > 0) {
          socket.emit('mark_delivered', { chatId: selectedChat.id, messageIds: unDeliveredMsgIds });
        }
      } catch (e) {
        console.error('Failed to load messages:', e);
      }
    };

    fetchMessages();
    setReplyingToMessage(null);
    setEditingMessage(null);
    setUploadedFileMetadata(null);
  }, [selectedChat, socket]);

  // Scroll to bottom helper
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // 3. Listen to Sockets
  useEffect(() => {
    if (!socket) return;

    // Listen for incoming messages
    socket.on('message_received', (data: { chatId: string; message: Message }) => {
      // If the incoming message belongs to currently active chat
      if (selectedChat && selectedChat.id === data.chatId) {
        setMessages(prev => {
          // Check if there is a pending message with the same clientMessageId or id
          const pendingIdx = prev.findIndex(m => 
            (m.clientMessageId && m.clientMessageId === data.message.clientMessageId) || 
            m.id === data.message.id
          );
          
          if (pendingIdx > -1) {
            const updated = [...prev];
            updated[pendingIdx] = data.message;
            return updated;
          } else {
            return [...prev, data.message];
          }
        });
        setTimeout(scrollToBottom, 50);

        // Instantly mark as read
        socket.emit('mark_read', { chatId: selectedChat.id, messageId: data.message.id });
        // Emit mark_delivered
        if (data.message.senderId !== user?.id) {
          socket.emit('mark_delivered', { chatId: selectedChat.id, messageIds: [data.message.id] });
        }
      }

      // Play notification sound for any live incoming message from another user
      if (data.message.senderId !== user?.id) {
        playNotificationSound();
      }

      // Clean from offline queue if present
      if (data.message.clientMessageId) {
        setOfflineQueue(prev => prev.filter(q => q.clientMessageId !== data.message.clientMessageId));
      }

      // Update sidebar chats list (fetch all chats if it's a new conversation thread)
      setChats(prevChats => {
        const chatExists = prevChats.some(chat => chat.id === data.chatId);
        if (!chatExists) {
          fetchChats();
          return prevChats;
        }

        return prevChats.map(chat => {
          if (chat.id === data.chatId) {
            return {
              ...chat,
              lastMessage: data.message,
              unreadCount: selectedChat?.id === data.chatId ? 0 : chat.unreadCount + 1,
            };
          }
          return chat;
        });
      });
    });

    // Listen for users online status changes
    socket.on('user_status', (data: { userId: string; isOnline: boolean; lastSeen?: string }) => {
      // Update profile status in recent chats
      setChats(prevChats =>
        prevChats.map(chat => {
          if (chat.otherMember && chat.otherMember.id === data.userId && chat.otherMember.profile) {
            return {
              ...chat,
              otherMember: {
                ...chat.otherMember,
                profile: {
                  ...chat.otherMember.profile,
                  isOnline: data.isOnline,
                  lastSeen: data.lastSeen || new Date().toISOString(),
                },
              },
            };
          }
          return chat;
        })
      );

      // If active chat belongs to this user, update active state too
      setSelectedChat(prev => {
        if (prev && prev.otherMember && prev.otherMember.id === data.userId && prev.otherMember.profile) {
          return {
            ...prev,
            otherMember: {
              ...prev.otherMember,
              profile: {
                ...prev.otherMember.profile,
                isOnline: data.isOnline,
                lastSeen: data.lastSeen || new Date().toISOString(),
              },
            },
          };
        }
        return prev;
      });
    });

    // Listen for batched presence updates (Battery & Performance Optimization)
    socket.on('presence_batch', (data: { updates: Array<{ userId: string; isOnline: boolean; lastSeen?: string }> }) => {
      const updatesMap = new Map(data.updates.map(u => [u.userId, u]));
      
      setChats(prevChats =>
        prevChats.map(chat => {
          if (chat.otherMember && updatesMap.has(chat.otherMember.id)) {
            const update = updatesMap.get(chat.otherMember.id)!;
            return {
              ...chat,
              otherMember: {
                ...chat.otherMember,
                profile: chat.otherMember.profile ? {
                  ...chat.otherMember.profile,
                  isOnline: update.isOnline,
                  lastSeen: update.lastSeen || new Date().toISOString(),
                } : null,
              },
            };
          }
          return chat;
        })
      );

      setSelectedChat(prev => {
        if (prev && prev.otherMember && updatesMap.has(prev.otherMember.id)) {
          const update = updatesMap.get(prev.otherMember.id)!;
          return {
            ...prev,
            otherMember: {
              ...prev.otherMember,
              profile: prev.otherMember.profile ? {
                ...prev.otherMember.profile,
                isOnline: update.isOnline,
                lastSeen: update.lastSeen || new Date().toISOString(),
              } : null,
            },
          };
        }
        return prev;
      });
    });

    // Listen for typing indicator
    socket.on('user_typing', (data: { chatId: string; userId: string; isTyping: boolean }) => {
      if (selectedChat && selectedChat.id === data.chatId) {
        setTypingUsers(prev => ({
          ...prev,
          [data.userId]: data.isTyping,
        }));
        setActiveTypingChatId(data.chatId);
      }
    });

    // Listen for read receipts
    socket.on('messages_read', (data: { chatId: string; userId: string; messageIds: string[] }) => {
      if (selectedChat && selectedChat.id === data.chatId) {
        setMessages(prev =>
          prev.map(msg => {
            if (data.messageIds.includes(msg.id)) {
              const readRecord = { id: Math.random().toString(), messageId: msg.id, userId: data.userId, readAt: new Date().toISOString() };
              return {
                ...msg,
                reads: msg.reads ? [...msg.reads, readRecord] : [readRecord],
              };
            }
            return msg;
          })
        );
      }
    });

    // Listen for delivery receipts
    socket.on('messages_delivered', (data: { chatId: string; userId: string; messageIds: string[]; deliveredAt: string }) => {
      if (selectedChat && selectedChat.id === data.chatId) {
        setMessages(prev =>
          prev.map(msg => {
            if (data.messageIds.includes(msg.id)) {
              const statusRecord: MessageStatus = { 
                id: Math.random().toString(), 
                messageId: msg.id, 
                userId: data.userId, 
                deliveredAt: data.deliveredAt, 
                readAt: null,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
              };
              return {
                ...msg,
                statuses: msg.statuses ? [...msg.statuses, statusRecord] : [statusRecord],
              };
            }
            return msg;
          })
        );
      }
    });

    // Listen for reactions updates (toggle reaction support)
    socket.on('message_reaction', (data: { chatId: string; messageId: string; userId: string; emoji: string; action: 'added' | 'removed'; reaction: any }) => {
      if (selectedChat && selectedChat.id === data.chatId) {
        setMessages(prev =>
          prev.map(msg => {
            if (msg.id === data.messageId) {
              let reactions = msg.reactions ? [...msg.reactions] : [];
              if (data.action === 'removed') {
                reactions = reactions.filter(r => !(r.userId === data.userId && r.emoji === data.emoji));
              } else {
                reactions = reactions.filter(r => !(r.userId === data.userId && r.emoji === data.emoji));
                reactions.push(data.reaction);
              }
              return { ...msg, reactions };
            }
            return msg;
          })
        );
      }
    });

    // Listen for message edits
    socket.on('message_edited', (data: { chatId: string; message: Message }) => {
      if (selectedChat && selectedChat.id === data.chatId) {
        setMessages(prev => prev.map(m => m.id === data.message.id ? data.message : m));
      }
    });

    // Listen for message deletions
    socket.on('message_deleted', (data: { chatId: string; message: Message }) => {
      if (selectedChat && selectedChat.id === data.chatId) {
        setMessages(prev => prev.map(m => m.id === data.message.id ? data.message : m));
      }
    });

    // Friendship Real-Time Listeners
    const onFriendRequestReceived = () => {
      fetchFriendshipData();
      playNotificationSound();
    };
    const onFriendRequestAccepted = () => {
      fetchFriendshipData();
      fetchChats();
      playNotificationSound();
    };
    const onFriendRequestRejected = () => {
      fetchFriendshipData();
    };
    const onFriendRequestCancelled = () => {
      fetchFriendshipData();
    };
    const onFriendRemoved = (data: { friendId: string }) => {
      fetchFriendshipData();
      fetchChats();
      setSelectedChat(prev => {
        if (prev && prev.type === 'DIRECT' && prev.otherMember?.id === data.friendId) {
          return null;
        }
        return prev;
      });
    };
    const onUserBlocked = (data: { blockedId: string }) => {
      fetchFriendshipData();
      fetchChats();
      setSelectedChat(prev => {
        if (prev && prev.type === 'DIRECT' && prev.otherMember?.id === data.blockedId) {
          return null;
        }
        return prev;
      });
    };
    const onBlockedByUser = (data: { blockerId: string }) => {
      fetchFriendshipData();
      fetchChats();
      setSelectedChat(prev => {
        if (prev && prev.type === 'DIRECT' && prev.otherMember?.id === data.blockerId) {
          return null;
        }
        return prev;
      });
    };
    const onFriendListChanged = () => {
      fetchFriendshipData();
      fetchChats();
    };

    const onGroupCreated = (_data: { chat: Chat }) => {
      fetchChats();
      playNotificationSound();
    };
    const onMemberJoined = (data: { chatId: string; members: any[]; newMemberIds: string[] }) => {
      if (data.newMemberIds.includes(user?.id || '')) {
        fetchChats();
        playNotificationSound();
      }
    };

    const onNotificationReceived = (notification: any) => {
      setNotifications(prev => {
        if (prev.some(n => n.id === notification.id)) return prev;
        return [notification, ...prev];
      });
      setUnreadNotificationsCount(prev => prev + 1);
      
      if (prefSoundEffectsRef.current) {
        playNotificationSound();
      }
    };

    socket.on('friend_request_received', onFriendRequestReceived);
    socket.on('friend_request_accepted', onFriendRequestAccepted);
    socket.on('friend_request_rejected', onFriendRequestRejected);
    socket.on('friend_request_cancelled', onFriendRequestCancelled);
    socket.on('friend_removed', onFriendRemoved);
    socket.on('user_blocked', onUserBlocked);
    socket.on('blocked_by_user', onBlockedByUser);
    socket.on('friend_list_changed', onFriendListChanged);
    socket.on('group_created', onGroupCreated);
    socket.on('member_joined', onMemberJoined);
    socket.on('notification_received', onNotificationReceived);

    return () => {
      socket.off('message_received');
      socket.off('user_status');
      socket.off('presence_batch');
      socket.off('user_typing');
      socket.off('messages_read');
      socket.off('messages_delivered');
      socket.off('message_reaction');
      socket.off('message_edited');
      socket.off('message_deleted');
      socket.off('friend_request_received', onFriendRequestReceived);
      socket.off('friend_request_accepted', onFriendRequestAccepted);
      socket.off('friend_request_rejected', onFriendRequestRejected);
      socket.off('friend_request_cancelled', onFriendRequestCancelled);
      socket.off('friend_removed', onFriendRemoved);
      socket.off('user_blocked', onUserBlocked);
      socket.off('blocked_by_user', onBlockedByUser);
      socket.off('friend_list_changed', onFriendListChanged);
      socket.off('group_created', onGroupCreated);
      socket.off('member_joined', onMemberJoined);
      socket.off('notification_received', onNotificationReceived);
    };
  }, [socket, selectedChat]);

  // 3.5 Process offline queue when socket reconnects
  useEffect(() => {
    if (socket && isConnected && offlineQueue.length > 0) {
      console.log(`[Socket] Reconnected. Processing offline queue of ${offlineQueue.length} messages...`);
      offlineQueue.forEach((msg) => {
        socket.emit('send_message', msg);
      });
      setOfflineQueue([]);
    }
  }, [socket, isConnected, offlineQueue]);

  // 4. Handle sending a message
  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedChat) return;
    if (!typedMessage.trim() && !uploadedFileMetadata) return;

    if (editingMessage) {
      if (!socket) return;
      // Edit Flow
      socket.emit('edit_message', {
        chatId: selectedChat.id,
        messageId: editingMessage.id,
        content: typedMessage,
      });
      setEditingMessage(null);
    } else {
      // Create/Send Flow
      const clientMessageId = 'client-' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      
      const messagePayload = {
        chatId: selectedChat.id,
        content: typedMessage,
        clientMessageId,
        replyToId: replyingToMessage?.id || undefined,
        attachments: uploadedFileMetadata ? [uploadedFileMetadata] : undefined,
      };

      const tempMsg: Message = {
        id: clientMessageId,
        chatId: selectedChat.id,
        senderId: user!.id,
        content: typedMessage,
        clientMessageId,
        isEdited: false,
        isDeleted: false,
        replyToId: replyingToMessage?.id || null,
        replyTo: replyingToMessage || null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        attachments: uploadedFileMetadata ? [{
          id: 'temp-att-' + Math.random().toString(),
          messageId: clientMessageId,
          fileUrl: uploadedFileMetadata.fileUrl,
          fileName: uploadedFileMetadata.fileName,
          fileSize: uploadedFileMetadata.fileSize,
          mimeType: uploadedFileMetadata.mimeType,
          createdAt: new Date().toISOString()
        }] : [],
        reactions: [],
        reads: [],
        statuses: [],
        isOfflinePending: true,
        sender: {
          id: user!.id,
          username: user!.username,
          profile: user!.profile
        }
      };

      // Append locally first
      setMessages(prev => [...prev, tempMsg]);
      setTimeout(scrollToBottom, 50);

      if (socket && isConnected) {
        socket.emit('send_message', messagePayload);
      } else {
        // Store in offline queue
        setOfflineQueue(prev => [...prev, messagePayload]);
      }
    }

    setTypedMessage('');
    setReplyingToMessage(null);
    setUploadedFileMetadata(null);
    
    // Stop typing indicator
    if (socket && isConnected && isCurrentlyTypingRef.current[selectedChat.id]) {
      isCurrentlyTypingRef.current[selectedChat.id] = false;
      socket.emit('typing', { chatId: selectedChat.id, isTyping: false });
    }
  };

  // 5. Handle typing indicators on keypress
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTypedMessage(e.target.value);

    if (!socket || !selectedChat) return;

    // Only emit 'typing' isTyping: true if we aren't already flagged as typing
    if (!isCurrentlyTypingRef.current[selectedChat.id]) {
      isCurrentlyTypingRef.current[selectedChat.id] = true;
      socket.emit('typing', { chatId: selectedChat.id, isTyping: true });
    }

    // Clear previous timeout and set a new one to turn off indicator after 2s
    if (typingTimeoutRef.current[selectedChat.id]) {
      clearTimeout(typingTimeoutRef.current[selectedChat.id]);
    }

    typingTimeoutRef.current[selectedChat.id] = setTimeout(() => {
      if (isCurrentlyTypingRef.current[selectedChat.id]) {
        isCurrentlyTypingRef.current[selectedChat.id] = false;
        socket.emit('typing', { chatId: selectedChat.id, isTyping: false });
      }
    }, 2000);
  };

  // 6. User search modal functions
  const handleUserSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userSearchQuery.trim()) return;

    try {
      const response = await api.get(`/users/search?q=${userSearchQuery}`);
      setUserSearchResults(response.data);
    } catch (e) {
      console.error('User search failed:', e);
    }
  };

  // Friendship API Handlers
  const fetchFriendshipData = async () => {
    try {
      const friendsRes = await api.get('/friends');
      setFriends(friendsRes.data);

      const requestsRes = await api.get('/friends/requests');
      setPendingIncomingRequests(requestsRes.data.incoming || []);
      setPendingOutgoingRequests(requestsRes.data.outgoing || []);

      const blockedRes = await api.get('/friends/blocked');
      setBlockedUsers(blockedRes.data || []);
    } catch (err) {
      console.error('Failed to fetch friendship data:', err);
    }
  };

  useEffect(() => {
    if (showFriendshipModal) {
      fetchFriendshipData();
    }
  }, [showFriendshipModal]);

  // Local QR Generation Hook
  useEffect(() => {
    if (user?.publicId) {
      const payload = JSON.stringify({
        type: 'friend',
        publicId: user.publicId,
        version: 1
      });
      QRCode.toDataURL(payload, { width: 256, margin: 2 })
        .then((url) => setQrCodeDataUrl(url))
        .catch((err) => console.error('Failed to generate local QR Code:', err));
    }
  }, [user?.publicId]);

  // Clean up scanner on modal close or tab switch
  useEffect(() => {
    if (!showFriendshipModal || friendshipModalTab !== 'qr_invite') {
      stopCameraScan();
      setScannedProfile(null);
      setQrError('');
    }
  }, [showFriendshipModal, friendshipModalTab]);

  // Deep Link Interception Hook (Web & Capacitor Native)
  useEffect(() => {
    let active = true;

    const checkWebPathname = async () => {
      const pathname = window.location.pathname;
      if (pathname.startsWith('/user/')) {
        const publicId = pathname.split('/user/')[1]?.trim();
        if (publicId && publicId.startsWith('VC-')) {
          window.history.replaceState({}, document.title, '/');
          setShowFriendshipModal(true);
          setFriendshipModalTab('qr_invite');
          if (active) {
            await fetchAndPreviewProfile(publicId);
          }
        }
      }
    };

    const setupCapacitorDeepLinks = async () => {
      try {
        App.addListener('appUrlOpen', async (data: any) => {
          const url = data.url;
          if (url && url.includes('://user/')) {
            const publicId = url.split('://user/')[1]?.trim();
            if (publicId && publicId.startsWith('VC-') && active) {
              setShowFriendshipModal(true);
              setFriendshipModalTab('qr_invite');
              await fetchAndPreviewProfile(publicId);
            }
          } else if (url && url.includes('velvet-chat.com/user/')) {
            const publicId = url.split('velvet-chat.com/user/')[1]?.trim();
            if (publicId && publicId.startsWith('VC-') && active) {
              setShowFriendshipModal(true);
              setFriendshipModalTab('qr_invite');
              await fetchAndPreviewProfile(publicId);
            }
          }
        });
      } catch (err) {
        // Run checkWebPathname since we are likely on Web
        checkWebPathname();
      }
    };

    setupCapacitorDeepLinks();

    return () => {
      active = false;
    };
  }, []);

  // Camera stream frame analyzer ticker
  useEffect(() => {
    let active = true;
    let animationFrameId: number;

    const tick = () => {
      if (!active || !isScanningQR) return;

      if (videoRef.current && videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA) {
        const canvas = canvasRef.current;
        if (canvas) {
          const ctx = canvas.getContext('2d');
          if (ctx) {
            canvas.width = videoRef.current.videoWidth;
            canvas.height = videoRef.current.videoHeight;
            ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const code = jsQR(imageData.data, imageData.width, imageData.height, {
              inversionAttempts: 'dontInvert',
            });
            if (code) {
              stopCameraScan();
              handleDecodedPayload(code.data);
              return;
            }
          }
        }
      }
      animationFrameId = requestAnimationFrame(tick);
    };

    if (isScanningQR) {
      animationFrameId = requestAnimationFrame(tick);
    }

    return () => {
      active = false;
      cancelAnimationFrame(animationFrameId);
    };
  }, [isScanningQR]);

  const startCameraScan = async () => {
    try {
      setQrError('');
      setScannedProfile(null);
      setIsScanningQR(true);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true');
        videoRef.current.play();
      }
    } catch (err: any) {
      console.error('Camera access failed:', err);
      setQrError('Could not open camera. Please check permissions.');
      setIsScanningQR(false);
    }
  };

  const stopCameraScan = () => {
    setIsScanningQR(false);
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
  };

  const handleDecodedPayload = async (data: string) => {
    try {
      const payload = JSON.parse(data);
      if (payload.type === 'friend' && payload.publicId) {
        await fetchAndPreviewProfile(payload.publicId);
      } else {
        setQrError('Invalid QR Code payload format.');
      }
    } catch (err) {
      // Fallback url check
      if (data.includes('/user/')) {
        const parts = data.split('/user/');
        const possibleId = parts[parts.length - 1].trim();
        if (possibleId.startsWith('VC-')) {
          await fetchAndPreviewProfile(possibleId);
          return;
        }
      }
      setQrError('Failed to parse QR Code data.');
    }
  };

  const handleGalleryImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setQrError('');
    setScannedProfile(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: 'dontInvert',
          });
          if (code) {
            handleDecodedPayload(code.data);
          } else {
            setQrError('No QR Code detected in this image.');
          }
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const fetchAndPreviewProfile = async (publicId: string) => {
    try {
      setQrError('');
      const response = await api.get(`/friends/public-profile/${publicId}`);
      setScannedProfile(response.data);
    } catch (err: any) {
      console.error('Failed to lookup public profile:', err);
      const errorMsg = err.response?.data?.error || 'Failed to find user profile.';
      setQrError(errorMsg);
      setScannedProfile(null);
    }
  };

  const handleShareInvite = async () => {
    const inviteUrl = `https://velvet-chat.com/user/${user?.publicId}`;
    try {
      const canShare = await Share.canShare();
      if (canShare.value) {
        await Share.share({
          title: 'Join me on Velvet Chat',
          text: `Add me as a friend on Velvet Chat using my public ID: ${user?.publicId}`,
          url: inviteUrl,
          dialogTitle: 'Share Invite Link'
        });
      } else {
        throw new Error('Native share not available');
      }
    } catch (err) {
      if (navigator.share) {
        try {
          await navigator.share({
            title: 'Join me on Velvet Chat',
            text: `Add me as a friend on Velvet Chat using my public ID: ${user?.publicId}`,
            url: inviteUrl,
          });
        } catch (shareErr: any) {
          if (shareErr.name !== 'AbortError') {
            navigator.clipboard.writeText(inviteUrl);
            alert('Invite link copied to clipboard!');
          }
        }
      } else {
        navigator.clipboard.writeText(inviteUrl);
        alert('Invite link copied to clipboard!');
      }
    }
  };

  const handleSendFriendRequestPublic = async (targetPublicId: string) => {
    try {
      await api.post('/friends/request', { receiverPublicId: targetPublicId });
      await fetchAndPreviewProfile(targetPublicId);
      fetchFriendshipData();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to send request.');
    }
  };

  const handleCancelFriendRequestPublic = async (requestId: string, targetPublicId: string) => {
    try {
      await api.delete(`/friends/request/${requestId}/cancel`);
      await fetchAndPreviewProfile(targetPublicId);
      fetchFriendshipData();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to cancel request.');
    }
  };

  const handleAcceptFriendRequestPublic = async (requestId: string, targetPublicId: string) => {
    try {
      await api.post(`/friends/request/${requestId}/accept`);
      await fetchAndPreviewProfile(targetPublicId);
      fetchFriendshipData();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to accept request.');
    }
  };

  const handleRejectFriendRequestPublic = async (requestId: string, targetPublicId: string) => {
    try {
      await api.post(`/friends/request/${requestId}/reject`);
      await fetchAndPreviewProfile(targetPublicId);
      fetchFriendshipData();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to reject request.');
    }
  };

  const handleRemoveFriendPublic = async (targetPublicId: string) => {
    try {
      const friendUser = friends.find(f => f.publicId === targetPublicId);
      if (friendUser) {
        await api.delete(`/friends/${friendUser.id}`);
        await fetchAndPreviewProfile(targetPublicId);
        fetchFriendshipData();
      }
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to remove friend.');
    }
  };

  const handleBlockUserPublic = async (targetPublicId: string) => {
    try {
      await api.post('/friends/block', { blockedPublicId: targetPublicId });
      await fetchAndPreviewProfile(targetPublicId);
      fetchFriendshipData();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to block user.');
    }
  };

  const handleUnblockUserPublic = async (targetPublicId: string) => {
    try {
      await api.delete(`/friends/block/${targetPublicId}`);
      await fetchAndPreviewProfile(targetPublicId);
      fetchFriendshipData();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to unblock user.');
    }
  };

  const handleSendFriendRequest = async (receiverId: string) => {
    try {
      await api.post('/friends/request', { receiverId });
      alert('Friend request sent!');
      await fetchFriendshipData();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to send friend request');
    }
  };

  const handleAcceptFriendRequest = async (requestId: string) => {
    try {
      await api.post(`/friends/request/${requestId}/accept`);
      await fetchFriendshipData();
      await fetchChats();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to accept friend request');
    }
  };

  const handleRejectFriendRequest = async (requestId: string) => {
    try {
      await api.post(`/friends/request/${requestId}/reject`);
      await fetchFriendshipData();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to reject friend request');
    }
  };

  const handleCancelFriendRequest = async (requestId: string) => {
    try {
      await api.delete(`/friends/request/${requestId}/cancel`);
      await fetchFriendshipData();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to cancel friend request');
    }
  };

  const handleRemoveFriend = async (friendId: string) => {
    if (!confirm('Are you sure you want to remove this friend? This will also end any conversation.')) return;
    try {
      await api.delete(`/friends/${friendId}`);
      await fetchFriendshipData();
      await fetchChats();
      if (selectedChat?.type === 'DIRECT' && selectedChat.otherMember?.id === friendId) {
        setSelectedChat(null);
      }
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to remove friend');
    }
  };

  const handleBlockUser = async (blockedId: string) => {
    if (!confirm('Are you sure you want to block this user? You will not be able to message or call each other.')) return;
    try {
      await api.post('/friends/block', { blockedId });
      await fetchFriendshipData();
      await fetchChats();
      if (selectedChat?.type === 'DIRECT' && selectedChat.otherMember?.id === blockedId) {
        setSelectedChat(null);
      }
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to block user');
    }
  };

  const handleUnblockUser = async (blockedId: string) => {
    try {
      await api.delete(`/friends/block/${blockedId}`);
      await fetchFriendshipData();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to unblock user');
    }
  };

  const startDirectChat = async (targetUser: UserType) => {
    try {
      const response = await api.post('/chats/direct', {
        otherUserId: targetUser.id,
      });

      const newChat: Chat = response.data;
      // Fetch latest chats and append
      await fetchChats();
      setSelectedChat(newChat);
      setShowSearchModal(false);
      setUserSearchQuery('');
      setUserSearchResults([]);
    } catch (e) {
      console.error('Failed to create/get direct chat:', e);
    }
  };

  // File Upload trigger
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    let category: keyof typeof CATEGORY_LIMITS_CLIENT | null = null;
    const mimeType = file.type;
    const fileExt = file.name.split('.').pop()?.toLowerCase();
    
    // Fallback for some extensions that might have empty/unsupported browser mimetype
    let resolvedMime = mimeType;
    if (!resolvedMime && fileExt) {
      if (fileExt === 'zip') resolvedMime = 'application/zip';
      else if (fileExt === 'pdf') resolvedMime = 'application/pdf';
      else if (fileExt === 'mp3') resolvedMime = 'audio/mpeg';
      else if (fileExt === 'mp4') resolvedMime = 'video/mp4';
      else if (fileExt === 'txt') resolvedMime = 'text/plain';
    }

    for (const [cat, types] of Object.entries(ALLOWED_TYPES_CLIENT)) {
      if (types.includes(resolvedMime)) {
        category = cat as keyof typeof CATEGORY_LIMITS_CLIENT;
        break;
      }
    }

    if (!category) {
      alert(`Invalid file type. Uploading executables (.exe, .bat, etc.), HTML, JavaScript, or SVGs is prohibited. Allowed types: Images, Videos, Audio, PDFs, Office documents, and ZIP archives.`);
      return;
    }

    const { max, label } = CATEGORY_LIMITS_CLIENT[category];
    if (file.size > max) {
      alert(`File size exceeds the limit. ${category.charAt(0).toUpperCase() + category.slice(1)} files are limited to ${label}.`);
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await api.post('/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (progressEvent) => {
          if (progressEvent.total) {
            const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            setUploadProgress(percentCompleted);
          }
        }
      });

      setUploadedFileMetadata({
        fileUrl: response.data.fileUrl,
        fileName: response.data.fileName,
        fileSize: response.data.fileSize,
        mimeType: response.data.mimeType,
      });
    } catch (err: any) {
      console.error('File upload failed:', err);
      const serverErr = err.response?.data?.error || 'File size exceeds allowed limits or upload failed.';
      alert(serverErr);
    } finally {
      setIsUploading(false);
      setUploadProgress(null);
    }
  };

  // Message Reactions trigger
  const sendReaction = (messageId: string, emoji: string) => {
    if (!socket || !selectedChat) return;
    socket.emit('react_message', {
      chatId: selectedChat.id,
      messageId,
      emoji,
    });
    setShowEmojiPickerForMessageId(null);
  };

  // Message Actions
  const startEditing = (msg: Message) => {
    setEditingMessage(msg);
    setTypedMessage(msg.content);
    setReplyingToMessage(null);
  };

  const deleteMessage = (messageId: string) => {
    if (!socket || !selectedChat) return;
    if (confirm('Are you sure you want to delete this message?')) {
      socket.emit('delete_message', {
        chatId: selectedChat.id,
        messageId,
      });
    }
  };

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // 1. Handle profile edits (displayName, bio, avatar, username)
      await updateProfile(displayNameInput, bioInput, avatarUrlInput, usernameInput);
      
      // 2. Handle password changes if any password field is filled
      if (currentPassword || newPassword || confirmPassword) {
        if (!currentPassword || !newPassword || !confirmPassword) {
          alert('To change your password, please fill in current, new, and confirm password fields.');
          return;
        }
        if (newPassword !== confirmPassword) {
          alert('New passwords do not match.');
          return;
        }
        if (newPassword.length < 6) {
          alert('New password must be at least 6 characters long.');
          return;
        }
        
        await api.post('/auth/change-password', {
          currentPassword,
          newPassword
        });
        alert('Password changed successfully.');
      }
      
      alert('Profile updated successfully.');
      setShowProfileModal(false);
    } catch (err: any) {
      console.error('Failed to update profile settings:', err);
      const errText = err.response?.data?.error || err.message || 'Failed to update profile settings.';
      alert(errText);
    }
  };

  // Group Chat Member Search & Actions
  const handleGroupMemberSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupMemberSearchQuery.trim()) return;

    try {
      const response = await api.get(`/users/search?q=${groupMemberSearchQuery}`);
      setGroupMemberSearchResults(response.data);
    } catch (e) {
      console.error('Group member search failed:', e);
    }
  };

  const toggleSelectMember = (memberId: string) => {
    setSelectedMemberIds(prev => 
      prev.includes(memberId) ? prev.filter(id => id !== memberId) : [...prev, memberId]
    );
  };

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupNameInput.trim()) return;

    try {
      const response = await api.post('/chats/group', {
        name: groupNameInput,
        description: groupDescInput,
        avatarUrl: groupAvatarUrlInput,
        memberIds: selectedMemberIds
      });

      const newChat: Chat = response.data;
      await fetchChats();
      setSelectedChat(newChat);
      setShowCreateGroupModal(false);
      setGroupNameInput('');
      setGroupDescInput('');
      setGroupAvatarUrlInput('');
      setSelectedMemberIds([]);
      setGroupMemberSearchQuery('');
      setGroupMemberSearchResults([]);
    } catch (e: any) {
      console.error('Create group failed:', e);
      alert(e.response?.data?.error || 'Failed to create group');
    }
  };

  const handleAddGroupMembers = async (memberIds: string[]) => {
    if (!selectedChat) return;
    try {
      await api.post(`/chats/group/${selectedChat.id}/members`, { memberIds });
      await fetchChats();
      // Reload active chat structure
      const chatsRes = await api.get('/chats');
      const updated = chatsRes.data.find((c: any) => c.id === selectedChat.id);
      if (updated) setSelectedChat(updated);
    } catch (e: any) {
      console.error('Add group members failed:', e);
      alert(e.response?.data?.error || 'Failed to add members');
    }
  };

  const handleRemoveGroupMember = async (targetUserId: string) => {
    if (!selectedChat) return;
    try {
      await api.delete(`/chats/group/${selectedChat.id}/members/${targetUserId}`);
      await fetchChats();
      // Reload active chat structure
      const chatsRes = await api.get('/chats');
      const updated = chatsRes.data.find((c: any) => c.id === selectedChat.id);
      if (updated) {
        setSelectedChat(updated);
      } else {
        setSelectedChat(null);
      }
    } catch (e: any) {
      console.error('Remove group member failed:', e);
      alert(e.response?.data?.error || 'Failed to remove member');
    }
  };

  const handleTransferGroupOwnership = async (newOwnerId: string) => {
    if (!selectedChat) return;
    try {
      await api.post(`/chats/group/${selectedChat.id}/transfer-owner`, { newOwnerId });
      await fetchChats();
      // Reload active chat structure
      const chatsRes = await api.get('/chats');
      const updated = chatsRes.data.find((c: any) => c.id === selectedChat.id);
      if (updated) setSelectedChat(updated);
    } catch (e: any) {
      console.error('Transfer group ownership failed:', e);
      alert(e.response?.data?.error || 'Failed to transfer ownership');
    }
  };

  // Filtering list in sidebar
  const filteredChats = chats.filter(chat => {
    const name = chat.type === 'GROUP' 
      ? chat.groupName 
      : (chat.otherMember?.profile?.displayName || chat.otherMember?.username || '');
    return (name || '').toLowerCase().includes(searchQuery.toLowerCase());
  });

  // Check if anyone is currently typing in the selected chat (supports group chats)
  const typingUsersInChat = Object.keys(typingUsers).filter(uId => 
    typingUsers[uId] && uId !== user?.id && activeTypingChatId === selectedChat?.id
  );
  const otherUserTyping = typingUsersInChat.length > 0;

  if (viewportWidth < 768) {
    return (
      <MobileDashboard
        user={user}
        logout={logout}
        chats={chats}
        selectedChat={selectedChat}
        setSelectedChat={setSelectedChat}
        messages={messages}
        typedMessage={typedMessage}
        setTypedMessage={setTypedMessage}
        handleSendMessage={handleSendMessage}
        replyingToMessage={replyingToMessage}
        setReplyingToMessage={setReplyingToMessage}
        editingMessage={editingMessage}
        setEditingMessage={setEditingMessage}
        handleFileUpload={handleFileUpload}
        isUploading={isUploading}
        uploadProgress={uploadProgress}
        typingUsers={typingUsers}
        activeTypingChatId={activeTypingChatId}
        showSearchModal={showSearchModal}
        setShowSearchModal={setShowSearchModal}
        userSearchQuery={userSearchQuery}
        setUserSearchQuery={setUserSearchQuery}
        userSearchResults={userSearchResults}
        handleUserSearch={handleUserSearch}
        startDirectChat={startDirectChat}
        friends={friends}
        pendingIncomingRequests={pendingIncomingRequests}
        pendingOutgoingRequests={pendingOutgoingRequests}
        blockedUsers={blockedUsers}
        handleAcceptFriendRequest={handleAcceptFriendRequest}
        handleRejectFriendRequest={handleRejectFriendRequest}
        handleCancelFriendRequest={handleCancelFriendRequest}
        handleBlockUser={handleBlockUser}
        handleUnblockUser={handleUnblockUser}
        handleSendFriendRequest={handleSendFriendRequest}
        whoCanSendFriendRequests={whoCanSendFriendRequests}
        whoCanCallMe={whoCanCallMe}
        whoCanSeeProfilePhoto={whoCanSeeProfilePhoto}
        whoCanSeeLastSeen={whoCanSeeLastSeen}
        updatePreference={updatePreference}
        handleSendFriendRequestPublic={handleSendFriendRequestPublic}
        handleBlockUserPublic={handleBlockUserPublic}
        handleCancelFriendRequestPublic={handleCancelFriendRequestPublic}
        handleAcceptFriendRequestPublic={handleAcceptFriendRequestPublic}
        handleRejectFriendRequestPublic={handleRejectFriendRequestPublic}
        handleRemoveFriendPublic={handleRemoveFriendPublic}
        handleUnblockUserPublic={handleUnblockUserPublic}
        openChatForUser={openChatForUser}
        showFriendshipModal={showFriendshipModal}
        setShowFriendshipModal={setShowFriendshipModal}
        friendshipModalTab={friendshipModalTab}
        setFriendshipModalTab={setFriendshipModalTab}
        qrCodeDataUrl={qrCodeDataUrl}
        isScanningQR={isScanningQR}
        scannedProfile={scannedProfile}
        qrError={qrError}
        videoRef={videoRef}
        canvasRef={canvasRef}
        startCameraScan={startCameraScan}
        stopCameraScan={stopCameraScan}
        handleGalleryImport={handleGalleryImport}
        handleShareInvite={handleShareInvite}
        callState={callState}
        callPeer={callPeer}
        callType={callType}
        callDuration={callDuration}
        isMuted={isMuted}
        isVideoEnabled={isVideoEnabled}
        isSpeakerphone={isSpeakerphone}
        connectionQuality={connectionQuality}
        showFallbackPrompt={showFallbackPrompt}
        audioOutputs={audioOutputs}
        selectedAudioOutput={selectedAudioOutput}
        audioRouteError={audioRouteError || ''}
        liveDiagnostics={liveDiagnostics}
        localVideoRef={localVideoRef}
        remoteVideoRef={remoteVideoRef}
        remoteAudioRef={remoteAudioRef}
        acceptCall={acceptCall}
        rejectCall={rejectCall}
        endCall={endCall}
        toggleMute={toggleMute}
        toggleCamera={toggleCamera}
        switchToAudioOnly={switchToAudioOnly}
        toggleSpeakerphone={toggleSpeakerphone}
        fetchAudioOutputs={fetchAudioOutputs}
        handleSelectAudioRoute={handleSelectAudioRoute}
        formatCallDuration={formatCallDuration}
        callHistory={callHistory}
        startCall={startCall}
        displayNameInput={displayNameInput}
        setDisplayNameInput={setDisplayNameInput}
        usernameInput={usernameInput}
        setUsernameInput={setUsernameInput}
        bioInput={bioInput}
        setBioInput={setBioInput}
        avatarUrlInput={avatarUrlInput}
        setAvatarUrlInput={setAvatarUrlInput}
        currentPasswordInput={currentPassword}
        setCurrentPasswordInput={setCurrentPassword}
        newPasswordInput={newPassword}
        setNewPasswordInput={setNewPassword}
        confirmPasswordInput={confirmPassword}
        setConfirmPasswordInput={setConfirmPassword}
        isUploadingAvatar={isUploadingAvatar}
        setIsUploadingAvatar={setIsUploadingAvatar}
        saveProfile={saveProfile}
        getAbsoluteUrl={getAbsoluteUrl}
        enableRingtone={enableRingtone}
        setEnableRingtone={setEnableRingtone}
        enableCallertone={enableCallertone}
        setEnableCallertone={setEnableCallertone}
        enableMessageSounds={enableMessageSounds}
        setEnableMessageSounds={setEnableMessageSounds}
        soundVolume={soundVolume}
        setSoundVolume={setSoundVolume}
        showCreateGroupModal={showCreateGroupModal}
        setShowCreateGroupModal={setShowCreateGroupModal}
        groupNameInput={groupNameInput}
        setGroupNameInput={setGroupNameInput}
        groupDescInput={groupDescInput}
        setGroupDescInput={setGroupDescInput}
        groupAvatarUrlInput={groupAvatarUrlInput}
        setGroupAvatarUrlInput={setGroupAvatarUrlInput}
        selectedMemberIds={selectedMemberIds}
        toggleSelectMember={toggleSelectMember}
        groupMemberSearchQuery={groupMemberSearchQuery}
        setGroupMemberSearchQuery={setGroupMemberSearchQuery}
        groupMemberSearchResults={groupMemberSearchResults}
        handleGroupMemberSearch={handleGroupMemberSearch}
        handleCreateGroup={handleCreateGroup}
      />
    );
  }

  if (viewportWidth < 1024) {
    return (
      <TabletDashboard
        user={user}
        logout={logout}
        chats={chats}
        selectedChat={selectedChat}
        setSelectedChat={setSelectedChat}
        messages={messages}
        typedMessage={typedMessage}
        setTypedMessage={setTypedMessage}
        handleSendMessage={handleSendMessage}
        replyingToMessage={replyingToMessage}
        setReplyingToMessage={setReplyingToMessage}
        editingMessage={editingMessage}
        setEditingMessage={setEditingMessage}
        handleFileUpload={handleFileUpload}
        isUploading={isUploading}
        uploadProgress={uploadProgress}
        typingUsers={typingUsers}
        activeTypingChatId={activeTypingChatId}
        showSearchModal={showSearchModal}
        setShowSearchModal={setShowSearchModal}
        userSearchQuery={userSearchQuery}
        setUserSearchQuery={setUserSearchQuery}
        userSearchResults={userSearchResults}
        handleUserSearch={handleUserSearch}
        startDirectChat={startDirectChat}
        showRightSidebar={showRightSidebar}
        setShowRightSidebar={setShowRightSidebar}
        showProfileModal={showProfileModal}
        setShowProfileModal={setShowProfileModal}
        showFriendshipModal={showFriendshipModal}
        setShowFriendshipModal={setShowFriendshipModal}
        showCallHistoryModal={showCallHistoryModal}
        setShowCallHistoryModal={setShowCallHistoryModal}
        showNotificationCenter={showNotificationCenter}
        setShowNotificationCenter={setShowNotificationCenter}
        friends={friends}
        pendingIncomingRequests={pendingIncomingRequests}
        pendingOutgoingRequests={pendingOutgoingRequests}
        blockedUsers={blockedUsers}
        handleAcceptFriendRequest={handleAcceptFriendRequest}
        handleRejectFriendRequest={handleRejectFriendRequest}
        handleCancelFriendRequest={handleCancelFriendRequest}
        handleBlockUser={handleBlockUser}
        handleUnblockUser={handleUnblockUser}
        callState={callState}
        callPeer={callPeer}
        callType={callType}
        callDuration={callDuration}
        isMuted={isMuted}
        isVideoEnabled={isVideoEnabled}
        isSpeakerphone={isSpeakerphone}
        connectionQuality={connectionQuality}
        showFallbackPrompt={showFallbackPrompt}
        audioOutputs={audioOutputs}
        selectedAudioOutput={selectedAudioOutput}
        audioRouteError={audioRouteError || ''}
        liveDiagnostics={liveDiagnostics}
        localVideoRef={localVideoRef}
        remoteVideoRef={remoteVideoRef}
        remoteAudioRef={remoteAudioRef}
        acceptCall={acceptCall}
        rejectCall={rejectCall}
        endCall={endCall}
        toggleMute={toggleMute}
        toggleCamera={toggleCamera}
        switchToAudioOnly={switchToAudioOnly}
        toggleSpeakerphone={toggleSpeakerphone}
        fetchAudioOutputs={fetchAudioOutputs}
        handleSelectAudioRoute={handleSelectAudioRoute}
        formatCallDuration={formatCallDuration}
        startCall={startCall}
        getAbsoluteUrl={getAbsoluteUrl}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
      />
    );
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-dark-bg text-dark-text relative">

      {/* Socket Disconnection Banner */}
      {!isConnected && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-yellow-500/90 text-yellow-900 text-xs font-semibold text-center py-1.5 px-4">
          Reconnecting...
        </div>
      )}

      {/* 1. Left Sidebar */}
      <div className={`w-full md:w-[360px] lg:w-[400px] flex-shrink-0 flex flex-col border-r border-dark-border bg-dark-surface/65 backdrop-blur-md z-10 ${
        selectedChat ? 'hidden md:flex' : 'flex'
      }`}>
        
        {/* Sidebar Header */}
        <div className="p-4 border-b border-dark-border flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div 
              onClick={() => {
                setDisplayNameInput(user?.profile?.displayName || '');
                setBioInput(user?.profile?.bio || '');
                setAvatarUrlInput(user?.profile?.avatarUrl || '');
                setUsernameInput(user?.username || '');
                setCurrentPassword('');
                setNewPassword('');
                setConfirmPassword('');
                setShowProfileModal(true);
              }}
              className="w-10 h-10 rounded-xl overflow-hidden cursor-pointer relative group border border-white/10 hover:border-brand-500 transition-colors"
            >
              <img 
                src={user?.profile?.avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${user?.username}`} 
                alt="Profile" 
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                <Settings size={14} className="text-white" />
              </div>
            </div>
            <div>
              <h3 className="font-bold text-sm text-white leading-tight">
                {user?.profile?.displayName || user?.username}
              </h3>
              <p className="text-[11px] text-brand-400 font-semibold flex items-center space-x-1 mt-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                <span>{isConnected ? 'Active Network' : 'Disconnected'}</span>
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-1.5 flex-wrap">
            <button 
              onClick={() => setShowCreateGroupModal(true)}
              className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 text-dark-text transition-all min-h-[44px] min-w-[44px] flex items-center justify-center"
              title="Create Group Chat"
            >
              <Users size={18} />
            </button>
            <button 
              onClick={() => setShowFriendshipModal(true)}
              className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 text-dark-text transition-all relative min-h-[44px] min-w-[44px] flex items-center justify-center"
              title="Friendship Management"
            >
              <UserPlus size={18} />
              {(pendingIncomingRequests.length > 0) && (
                <span className="absolute top-1 right-1 w-2.5 h-2.5 rounded-full bg-brand-500 border border-dark-bg animate-pulse"></span>
              )}
            </button>
            <button 
              onClick={() => setShowCallHistoryModal(true)}
              className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 text-dark-text transition-all min-h-[44px] min-w-[44px] flex items-center justify-center"
              title="Call History"
            >
              <Clock size={18} />
            </button>
            <button 
              onClick={() => setShowNotificationCenter(true)}
              className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 text-dark-text transition-all relative min-h-[44px] min-w-[44px] flex items-center justify-center"
              title="Notification Center"
            >
              <Bell size={18} />
              {unreadNotificationsCount > 0 && (
                <span className="absolute top-1 right-1 px-1.5 py-0.5 rounded-full bg-brand-500 text-white text-[8px] font-bold animate-pulse leading-none">
                  {unreadNotificationsCount}
                </span>
              )}
            </button>
            <button 
              onClick={() => setShowSearchModal(true)}
              className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 text-dark-text transition-all min-h-[44px] min-w-[44px] flex items-center justify-center"
              title="Start New Chat"
            >
              <MessageSquare size={18} />
            </button>
            <button 
              onClick={logout}
              className="p-2.5 rounded-xl bg-white/5 hover:bg-red-500/10 border border-white/5 text-dark-muted hover:text-red-400 transition-all min-h-[44px] min-w-[44px] flex items-center justify-center"
              title="Sign Out"
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>

        {/* Sidebar Search */}
        <div className="p-4">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-muted" />
            <input
              type="text"
              placeholder="Search conversations..."
              className="w-full pl-9 pr-4 py-2.5 rounded-xl glass-input text-xs"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* Conversations List */}
        <div className="flex-1 overflow-y-auto px-2 space-y-1 pb-4">
          {filteredChats.length > 0 ? (
            filteredChats.map((chat) => {
              const otherMember = chat.otherMember;
              const displayName = chat.type === 'GROUP' 
                ? chat.groupName 
                : (otherMember?.profile?.displayName || otherMember?.username || 'Unknown User');
              const avatar = chat.type === 'GROUP'
                ? (chat.groupAvatarUrl || `https://api.dicebear.com/7.x/identicon/svg?seed=${chat.groupName}`)
                : (otherMember?.profile?.avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${otherMember?.username}`);
              const isSelected = selectedChat?.id === chat.id;

              return (
                <div
                  key={chat.id}
                  onClick={() => setSelectedChat(chat)}
                  className={`flex items-center justify-between p-3 rounded-2xl cursor-pointer transition-all ${
                    isSelected 
                      ? 'bg-brand-500/15 border border-brand-500/30' 
                      : 'hover:bg-white/5 border border-transparent'
                  }`}
                >
                  <div className="flex items-center space-x-3 min-w-0">
                    <div className="w-11 h-11 rounded-xl overflow-hidden flex-shrink-0 relative border border-white/5">
                      <img 
                        src={avatar} 
                        alt="Avatar"
                        className="w-full h-full object-cover" 
                      />
                      {chat.type !== 'GROUP' && otherMember?.profile?.isOnline && (
                        <span className="absolute bottom-[-1px] right-[-1px] w-3 h-3 rounded-full border-2 border-dark-surface status-dot-online"></span>
                      )}
                    </div>
                    
                    <div className="min-w-0">
                      <h4 className="font-bold text-sm text-white truncate leading-tight mb-1">
                        {displayName}
                      </h4>
                      <p className="text-[11px] text-dark-muted truncate pr-2">
                        {otherUserTyping && activeTypingChatId === chat.id ? (
                          <span className="text-brand-400 font-semibold">typing...</span>
                        ) : chat.lastMessage ? (
                          chat.lastMessage.isDeleted 
                            ? <span className="italic">This message was deleted</span>
                            : chat.lastMessage.content || 'Sent attachment'
                        ) : (
                          'No messages yet'
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col items-end flex-shrink-0 space-y-2">
                    <span className="text-[10px] text-dark-muted font-medium">
                      {chat.lastMessage ? new Date(chat.lastMessage.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : ''}
                    </span>
                    <div className="flex items-center space-x-1.5">
                      {/* Read Receipt checks */}
                      {chat.lastMessage && chat.lastMessage.senderId === user?.id && (
                        chat.lastMessage.reads && chat.lastMessage.reads.length > 0 ? (
                          <CheckCheck size={14} className="text-brand-400" />
                        ) : (
                          <Check size={14} className="text-dark-muted" />
                        )
                      )}
                      
                      {chat.unreadCount > 0 && (
                        <span className="px-2 py-0.5 rounded-full bg-brand-500 text-[10px] text-white font-bold animate-pulse">
                          {chat.unreadCount}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="h-48 flex flex-col items-center justify-center text-center p-4">
              <MessageSquare className="text-white/10 mb-2" size={32} />
              <p className="text-xs text-dark-muted">No active conversations found.</p>
            </div>
          )}
        </div>
      </div>

      {/* 2. Center Chat Panel */}
      <div className={`flex-1 flex flex-col bg-dark-bg min-w-0 z-0 h-full relative ${
        selectedChat ? 'flex' : 'hidden md:flex'
      }`}>
        {selectedChat ? (
          <>
            {/* Chat Area Header */}
            <div className="p-4 border-b border-dark-border flex items-center justify-between glass-panel-light z-10">
              <div className="flex items-center space-x-3 min-w-0">
                {/* Back Button for mobile navigation */}
                <button
                  onClick={() => setSelectedChat(null)}
                  className="md:hidden p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 text-dark-muted hover:text-white mr-1 flex items-center justify-center"
                  title="Back to conversations list"
                >
                  <ChevronRight size={18} className="rotate-180" />
                </button>

                <div className="w-10 h-10 rounded-xl overflow-hidden flex-shrink-0 relative border border-white/5">
                  <img 
                    src={selectedChat.type === 'GROUP'
                      ? (selectedChat.groupAvatarUrl || `https://api.dicebear.com/7.x/identicon/svg?seed=${selectedChat.groupName}`)
                      : (selectedChat.otherMember?.profile?.avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${selectedChat.otherMember?.username}`)} 
                    alt="Avatar" 
                    className="w-full h-full object-cover"
                  />
                  {selectedChat.type !== 'GROUP' && selectedChat.otherMember?.profile?.isOnline && (
                    <span className="absolute bottom-[-1px] right-[-1px] w-3 h-3 rounded-full border-2 border-dark-bg status-dot-online"></span>
                  )}
                </div>
                <div className="min-w-0">
                  <h3 className="font-bold text-sm text-white truncate">
                    {selectedChat.type === 'GROUP'
                      ? selectedChat.groupName
                      : (selectedChat.otherMember?.profile?.displayName || selectedChat.otherMember?.username)}
                  </h3>
                  <p className="text-[10px] text-dark-muted mt-0.5">
                    {otherUserTyping ? (
                      <span className="text-brand-400 font-semibold flex items-center space-x-1">
                        <span>
                          {typingUsersInChat.length === 1 
                            ? 'Someone is typing' 
                            : 'Multiple people are typing'}
                        </span>
                        <span className="flex space-x-0.5">
                          <span className="w-1 h-1 rounded-full bg-brand-400 typing-dot"></span>
                          <span className="w-1 h-1 rounded-full bg-brand-400 typing-dot"></span>
                          <span className="w-1 h-1 rounded-full bg-brand-400 typing-dot"></span>
                        </span>
                      </span>
                    ) : selectedChat.type === 'GROUP' ? (
                      `${selectedChat.members?.length || 0} members`
                    ) : selectedChat.otherMember?.profile?.isOnline ? (
                      <span className="text-emerald-400 font-semibold">Online</span>
                    ) : (
                      selectedChat.otherMember?.profile?.lastSeen 
                        ? `Offline • Last seen ${new Date(selectedChat.otherMember.profile.lastSeen).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`
                        : 'Offline'
                    )}
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <button 
                  onClick={() => startCall('audio', selectedChat.otherMember!)}
                  className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 text-dark-muted hover:text-white transition-all animate-fade-in"
                  title="Start Voice Call"
                >
                  <Phone size={18} />
                </button>
                <button 
                  onClick={() => startCall('video', selectedChat.otherMember!)}
                  className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 text-dark-muted hover:text-white transition-all animate-fade-in"
                  title="Start Video Call"
                >
                  <Video size={18} />
                </button>
                <button 
                  onClick={() => setShowRightSidebar(!showRightSidebar)}
                  className={`p-2 rounded-xl border transition-all ${
                    showRightSidebar 
                      ? 'bg-brand-500/10 border-brand-500/30 text-brand-400' 
                      : 'bg-white/5 border-white/5 text-dark-muted hover:text-white'
                  }`}
                  title="Toggle Contact Details"
                >
                  <Info size={18} />
                </button>
              </div>
            </div>

            {/* Chat Messages Log */}
            <div 
              ref={chatAreaRef}
              className="flex-1 overflow-y-auto p-4 space-y-6"
            >
              {messages.map((msg, index) => {
                const isMe = msg.senderId === user?.id;
                const showSenderHeader = index === 0 || messages[index - 1].senderId !== msg.senderId;

                return (
                  <div 
                    key={msg.id}
                    className={`flex flex-col group relative ${isMe ? 'items-end' : 'items-start'}`}
                  >
                    {/* Hover Reaction/Reply Bar */}
                    <div className={`absolute top-[-20px] z-10 hidden group-hover:flex items-center space-x-1.5 p-1 rounded-lg bg-dark-surface/90 border border-white/10 shadow-lg ${
                      isMe ? 'right-2' : 'left-2'
                    }`}>
                      <button 
                        onClick={() => setShowEmojiPickerForMessageId(showEmojiPickerForMessageId === msg.id ? null : msg.id)}
                        className="p-1 hover:bg-white/5 rounded text-dark-muted hover:text-white"
                        title="React"
                      >
                        <Smile size={14} />
                      </button>
                      <button 
                        onClick={() => setReplyingToMessage(msg)}
                        className="p-1 hover:bg-white/5 rounded text-dark-muted hover:text-white"
                        title="Reply"
                      >
                        <Reply size={14} />
                      </button>
                      {isMe && !msg.isDeleted && (
                        <>
                          <button 
                            onClick={() => startEditing(msg)}
                            className="p-1 hover:bg-white/5 rounded text-dark-muted hover:text-white"
                            title="Edit"
                          >
                            <Edit size={14} />
                          </button>
                          <button 
                            onClick={() => deleteMessage(msg.id)}
                            className="p-1 hover:bg-red-500/10 rounded text-dark-muted hover:text-red-400"
                            title="Delete"
                          >
                            <Trash2 size={14} />
                          </button>
                        </>
                      )}
                    </div>

                    {/* Emoji Reaction Drawer Popup */}
                    {showEmojiPickerForMessageId === msg.id && (
                      <div className={`absolute top-[-45px] z-20 flex items-center space-x-1 p-1.5 rounded-full bg-dark-surface border border-brand-500/30 shadow-2xl ${
                        isMe ? 'right-2' : 'left-2'
                      }`}>
                        {['👍', '❤️', '😂', '😮', '😢', '🙏'].map(emoji => (
                          <button 
                            key={emoji}
                            onClick={() => sendReaction(msg.id, emoji)}
                            className="w-7 h-7 flex items-center justify-center hover:scale-125 transition-transform text-sm"
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Reply references card */}
                    {msg.replyTo && (
                      <div className={`w-fit max-w-[80%] px-3 py-1.5 mb-1 text-xs rounded-xl bg-white/5 border-l-2 border-brand-500 text-dark-muted ${
                        isMe ? 'mr-1' : 'ml-1'
                      }`}>
                        <p className="font-semibold text-[10px] text-brand-400">
                          Replying to {msg.replyTo.senderId === user?.id ? 'yourself' : 'partner'}
                        </p>
                        <p className="truncate">{msg.replyTo.content}</p>
                      </div>
                    )}

                    {/* Chat Bubble Container */}
                    <div className="flex items-end space-x-2 max-w-[80%]">
                      {/* Avatar for partner (only show when sender changes) */}
                      {!isMe && showSenderHeader && (
                        <div className="w-7 h-7 rounded-lg overflow-hidden border border-white/5 flex-shrink-0 self-start mt-0.5">
                          <img 
                            src={msg.sender?.profile?.avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${msg.sender?.username}`} 
                            alt="avatar" 
                            className="w-full h-full object-cover"
                          />
                        </div>
                      )}
                      
                      {/* Empty block to pad spaces when avatar is hidden */}
                      {!isMe && !showSenderHeader && <div className="w-7 flex-shrink-0"></div>}

                      {/* Bubble content */}
                      <div className={`p-3.5 rounded-2xl flex flex-col relative border ${
                        isMe 
                          ? 'bg-brand-500/10 border-brand-500/20 rounded-tr-none text-white' 
                          : 'bg-dark-surface/90 border-dark-border rounded-tl-none text-dark-text'
                      }`}>
                        {/* Text Content */}
                        <p className="text-xs leading-relaxed break-words whitespace-pre-wrap">
                          {msg.content}
                        </p>

                        {/* Rendering Attachments */}
                        {msg.attachments && msg.attachments.map(att => {
                          const isImage = att.mimeType.startsWith('image/');
                          const isVideo = att.mimeType.startsWith('video/');

                          return (
                            <div key={att.id} className="mt-3 rounded-xl overflow-hidden border border-white/5">
                              {isImage ? (
                                <a 
                                  href={getAbsoluteUrl(att.fileUrl)} 
                                  onClick={(e) => handleDownloadAttachment(e, att.fileUrl)}
                                  target="_blank" 
                                  rel="noreferrer"
                                >
                                  <img 
                                    src={getAbsoluteUrl(att.fileUrl)} 
                                    alt={att.fileName} 
                                    className="max-h-60 max-w-full object-contain cursor-zoom-in" 
                                  />
                                </a>
                              ) : isVideo ? (
                                <video controls className="max-h-60 max-w-full">
                                  <source src={getAbsoluteUrl(att.fileUrl)} type={att.mimeType} />
                                </video>
                              ) : (
                                <div className="flex items-center space-x-3 p-3 bg-white/5 text-xs">
                                  <FileText className="text-brand-400 flex-shrink-0" size={24} />
                                  <div className="min-w-0 flex-1">
                                    <p className="font-semibold truncate text-white">{att.fileName}</p>
                                    <p className="text-[10px] text-dark-muted">
                                      {(att.fileSize / 1024 / 1024).toFixed(2)} MB
                                    </p>
                                  </div>
                                  <a 
                                    href={getAbsoluteUrl(att.fileUrl)} 
                                    onClick={(e) => handleDownloadAttachment(e, att.fileUrl)}
                                    className="p-2 bg-brand-500/20 hover:bg-brand-500/30 text-brand-400 hover:text-white rounded-lg transition-all"
                                  >
                                    <Download size={14} />
                                  </a>
                                </div>
                              )}
                            </div>
                          );
                        })}

                        {/* Bubble Timestamp and metadata */}
                        <div className="flex items-center justify-end space-x-1.5 mt-2 self-end text-[9px] text-dark-muted font-medium select-none">
                          {msg.isEdited && <span>edited •</span>}
                          <span>
                            {new Date(msg.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                          </span>
                          
                          {/* Receipt check ticks */}
                          {isMe && (
                            msg.isOfflinePending ? (
                              <span className="text-[10px] text-dark-muted animate-pulse">⏳</span>
                            ) : msg.reads && msg.reads.length > 0 ? (
                              <CheckCheck size={12} className="text-brand-400" />
                            ) : msg.statuses && msg.statuses.some(s => s.deliveredAt) ? (
                              <CheckCheck size={12} className="text-dark-muted" />
                            ) : (
                              <Check size={12} className="text-dark-muted" />
                            )
                          )}
                        </div>

                        {/* Floating reactions list on bottom right */}
                        {msg.reactions && msg.reactions.length > 0 && (
                          <div className={`absolute bottom-[-10px] flex items-center space-x-0.5 px-1.5 py-0.5 rounded-full bg-dark-surface border border-white/5 shadow-md ${
                            isMe ? 'left-2' : 'right-2'
                          }`}>
                            {msg.reactions.map(react => (
                              <span key={react.id} className="text-[10px]" title={react.user?.username}>
                                {react.emoji}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Replying indicator panel */}
            {replyingToMessage && (
              <div className="px-4 py-2 border-t border-dark-border bg-white/5 flex items-center justify-between text-xs text-dark-muted animate-slide-up">
                <div className="flex items-center space-x-2 border-l-2 border-brand-500 pl-3">
                  <Reply size={14} className="text-brand-400" />
                  <div className="truncate">
                    <p className="font-semibold text-[10px] text-brand-400">
                      Replying to {replyingToMessage.senderId === user?.id ? 'yourself' : 'partner'}
                    </p>
                    <p className="truncate text-white">{replyingToMessage.content}</p>
                  </div>
                </div>
                <button 
                  onClick={() => setReplyingToMessage(null)}
                  className="p-1 rounded-full bg-white/5 hover:bg-white/10"
                >
                  <X size={14} />
                </button>
              </div>
            )}

            {/* Editing indicator panel */}
            {editingMessage && (
              <div className="px-4 py-2 border-t border-dark-border bg-white/5 flex items-center justify-between text-xs text-dark-muted animate-slide-up">
                <div className="flex items-center space-x-2 border-l-2 border-amber-500 pl-3">
                  <Edit size={14} className="text-amber-400" />
                  <div className="truncate">
                    <p className="font-semibold text-[10px] text-amber-400">Editing Message</p>
                    <p className="truncate text-white">{editingMessage.content}</p>
                  </div>
                </div>
                <button 
                  onClick={() => {
                    setEditingMessage(null);
                    setTypedMessage('');
                  }}
                  className="p-1 rounded-full bg-white/5 hover:bg-white/10"
                >
                  <X size={14} />
                </button>
              </div>
            )}

            {/* Upload progress indicator */}
            {isUploading && uploadProgress !== null && (
              <div className="px-4 py-2.5 border-t border-dark-border bg-brand-500/5 text-xs text-brand-300 animate-slide-up">
                <div className="flex justify-between items-center mb-1.5">
                  <span className="font-semibold flex items-center space-x-1.5">
                    <span className="w-2 h-2 rounded-full bg-brand-400 animate-pulse"></span>
                    <span>Uploading attachment...</span>
                  </span>
                  <span className="font-mono text-[10px]">{uploadProgress}%</span>
                </div>
                <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-brand-500 rounded-full transition-all duration-300 ease-out" 
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            )}

            {/* Uploaded File status box */}
            {uploadedFileMetadata && (
              <div className="px-4 py-2 border-t border-dark-border bg-brand-500/10 flex items-center justify-between text-xs text-brand-300 animate-slide-up">
                <div className="flex items-center space-x-2 pl-1">
                  <Paperclip size={14} />
                  <span className="font-semibold truncate">{uploadedFileMetadata.fileName}</span>
                  <span className="text-[10px] text-dark-muted">
                    ({(uploadedFileMetadata.fileSize / 1024 / 1024).toFixed(2)} MB)
                  </span>
                </div>
                <button 
                  onClick={() => setUploadedFileMetadata(null)}
                  className="p-1 rounded-full bg-white/5 hover:bg-white/10 text-brand-400 hover:text-white"
                >
                  <X size={14} />
                </button>
              </div>
            )}

            {/* Input Send Area Footer */}
            <div className="p-4 border-t border-dark-border glass-panel-light z-10">
              <form onSubmit={handleSendMessage} className="flex items-center space-x-3">
                {/* File Attachment Button */}
                <div className="relative">
                  <input
                    type="file"
                    id="attachment-file"
                    className="hidden"
                    onChange={handleFileUpload}
                    disabled={isUploading}
                  />
                  <label 
                    htmlFor="attachment-file"
                    className={`p-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 text-dark-muted hover:text-white flex items-center justify-center cursor-pointer transition-all ${
                      isUploading ? 'opacity-50 cursor-wait' : ''
                    }`}
                    title="Attach File"
                  >
                    <Paperclip size={18} />
                  </label>
                </div>

                {/* Message input */}
                <input
                  type="text"
                  placeholder={editingMessage ? "Update message content..." : "Compose encrypted message..."}
                  className="flex-1 px-4 py-3 rounded-xl glass-input text-xs"
                  value={typedMessage}
                  onChange={handleInputChange}
                />

                {/* Send action Button */}
                <button
                  type="submit"
                  disabled={isUploading}
                  className="p-3.5 rounded-xl glass-button-primary text-white flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Send size={16} />
                </button>
              </form>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-6 bg-dark-bg">
            <div className="p-6 bg-brand-500/10 rounded-full border border-brand-500/20 mb-4 animate-pulse-slow">
              <MessageSquare size={44} className="text-brand-400" />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Welcome to Velvet Messenger</h2>
            <p className="text-sm text-dark-muted max-w-sm">
              Connect securely with friends. Search a profile or username using the write message button on the left sidebar to initialize a chat.
            </p>
          </div>
        )}
      </div>

      {/* 3. Right Sidebar: Details Panel */}
      {selectedChat && showRightSidebar && (
        <div className="w-full md:w-[360px] lg:w-[320px] flex-shrink-0 flex flex-col border-l border-dark-border bg-dark-surface/95 backdrop-blur-md z-20 animate-fade-in absolute inset-y-0 right-0 lg:relative lg:bg-dark-surface/65">
          <div className="p-4 border-b border-dark-border flex items-center justify-between">
            <h4 className="font-bold text-sm text-white">Contact Info</h4>
            <button 
              onClick={() => setShowRightSidebar(false)}
              className="p-1 rounded-lg hover:bg-white/5 text-dark-muted hover:text-white"
            >
              <X size={16} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-6 flex flex-col items-center text-center space-y-6">
            {/* Large Avatar */}
            <div className="w-24 h-24 rounded-3xl overflow-hidden border-2 border-brand-500/30 p-1 relative shadow-xl">
              <img 
                src={selectedChat.type === 'GROUP'
                  ? (selectedChat.groupAvatarUrl || `https://api.dicebear.com/7.x/identicon/svg?seed=${selectedChat.groupName}`)
                  : (selectedChat.otherMember?.profile?.avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${selectedChat.otherMember?.username}`)} 
                alt="Avatar" 
                className="w-full h-full object-cover rounded-2xl"
              />
            </div>

            {/* Profile Info */}
            <div className="space-y-1">
              <h3 className="font-bold text-lg text-white">
                {selectedChat.type === 'GROUP'
                  ? selectedChat.groupName
                  : (selectedChat.otherMember?.profile?.displayName || selectedChat.otherMember?.username)}
              </h3>
              {selectedChat.type !== 'GROUP' && (
                <p className="text-xs text-brand-400 font-semibold">
                  @{selectedChat.otherMember?.username}
                </p>
              )}
              {selectedChat.type === 'GROUP' && selectedChat.groupDescription && (
                <p className="text-xs text-dark-muted leading-relaxed">
                  {selectedChat.groupDescription}
                </p>
              )}
            </div>

            {selectedChat.type === 'GROUP' ? (
              // Group Chat details and members
              <div className="w-full text-left space-y-4 pt-4 border-t border-white/5">
                <span className="text-[10px] font-bold text-dark-muted uppercase tracking-wider block">
                  Group Members ({selectedChat.members?.length || 0})
                </span>
                
                {/* Admin Actions: Add Members */}
                {(() => {
                  const myMembership = selectedChat.members?.find((m: any) => m.userId === user?.id);
                  const isPowerUser = myMembership?.role === 'OWNER' || myMembership?.role === 'ADMIN';
                  return isPowerUser && (
                    <div className="space-y-2 pb-2 border-b border-white/5">
                      <div className="flex space-x-1">
                        <input
                          type="text"
                          placeholder="Search users..."
                          className="flex-1 px-2 py-1.5 rounded-lg bg-white/5 border border-white/10 text-[11px] focus:outline-none focus:border-brand-500 text-white"
                          value={groupMemberSearchQuery}
                          onChange={(e) => setGroupMemberSearchQuery(e.target.value)}
                        />
                        <button
                          onClick={async () => {
                            if (!groupMemberSearchQuery.trim()) return;
                            try {
                              const res = await api.get(`/users/search?q=${groupMemberSearchQuery}`);
                              if (res.data.length > 0) {
                                setGroupMemberSearchResults(res.data);
                              } else {
                                alert('No users found');
                              }
                            } catch (e) {
                              console.error(e);
                            }
                          }}
                          className="px-2.5 py-1.5 rounded-lg bg-brand-500 hover:bg-brand-400 text-white font-semibold text-[10px]"
                        >
                          Find
                        </button>
                      </div>
                      
                      {groupMemberSearchResults.length > 0 && (
                        <div className="max-h-32 overflow-y-auto space-y-1 bg-dark-bg/60 p-2 rounded-lg border border-white/5">
                          {groupMemberSearchResults.map((u) => (
                            <div key={u.id} className="flex justify-between items-center text-[10px]">
                              <span className="truncate">{u.profile?.displayName || u.username}</span>
                              <button
                                onClick={() => {
                                  handleAddGroupMembers([u.id]);
                                  setGroupMemberSearchResults(prev => prev.filter(item => item.id !== u.id));
                                }}
                                className="px-1.5 py-0.5 rounded bg-emerald-500/20 hover:bg-emerald-500 text-emerald-400 hover:text-white transition-all font-bold"
                              >
                                Add
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* Members list */}
                <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
                  {selectedChat.members?.map((member: any) => {
                    const myMembership = selectedChat.members?.find((m: any) => m.userId === user?.id);
                    const isOwner = myMembership?.role === 'OWNER';
                    const isAdmin = myMembership?.role === 'ADMIN';
                    const targetIsMe = member.userId === user?.id;

                    return (
                      <div key={member.id} className="flex items-center justify-between text-xs bg-white/5 p-2 rounded-xl border border-white/5">
                        <div className="flex items-center space-x-2 min-w-0">
                          <img 
                            src={member.user?.profile?.avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${member.user?.username}`} 
                            alt="Avatar" 
                            className="w-6 h-6 rounded-lg object-cover"
                          />
                          <div className="min-w-0">
                            <p className="font-bold text-white truncate text-[11px] leading-tight">
                              {member.user?.profile?.displayName || member.user?.username}
                            </p>
                            <p className="text-[9px] text-brand-400 font-semibold">{member.role}</p>
                          </div>
                        </div>
                        
                        {/* Member Management Actions */}
                        {!targetIsMe && (
                          <div className="flex space-x-1.5 flex-shrink-0">
                            {isOwner && member.role !== 'OWNER' && (
                              <button
                                onClick={() => handleTransferGroupOwnership(member.userId)}
                                className="px-1.5 py-0.5 rounded bg-amber-500/20 hover:bg-amber-500 text-amber-400 hover:text-white transition-all text-[8px] font-bold"
                                title="Transfer Ownership"
                              >
                                Owner
                              </button>
                            )}
                            {((isOwner && member.role !== 'OWNER') || (isAdmin && member.role === 'MEMBER')) && (
                              <button
                                onClick={() => handleRemoveGroupMember(member.userId)}
                                className="px-1.5 py-0.5 rounded bg-red-500/20 hover:bg-red-500 text-red-400 hover:text-white transition-all text-[8px] font-bold"
                                title="Remove Member"
                              >
                                Kick
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Leave Group Button */}
                <button
                  onClick={() => {
                    const myMembership = selectedChat.members?.find((m: any) => m.userId === user?.id);
                    if (myMembership?.role === 'OWNER') {
                      alert('OWNER cannot leave the group. Transfer ownership first or delete the group.');
                      return;
                    }
                    if (confirm('Are you sure you want to leave this group chat?')) {
                      handleRemoveGroupMember(user!.id);
                    }
                  }}
                  className="w-full py-2.5 rounded-xl border border-red-500/20 hover:border-red-500/50 bg-red-500/10 text-red-400 hover:text-red-300 text-xs font-semibold mt-2 transition-all"
                >
                  Leave Group Chat
                </button>
              </div>
            ) : (
              // Direct Chat Bio Card
              <div className="w-full p-4 rounded-2xl bg-white/5 border border-white/5 text-left space-y-1">
                <span className="text-[10px] font-bold text-dark-muted uppercase tracking-wider">Bio</span>
                <p className="text-xs text-dark-text leading-relaxed">
                  {selectedChat.otherMember?.profile?.bio || 'No status update provided.'}
                </p>
              </div>
            )}

            {/* Shared Media Tabs details */}
            <div className="w-full text-left space-y-4 pt-4 border-t border-white/5">
              <span className="text-[10px] font-bold text-dark-muted uppercase tracking-wider block">
                Shared Attachments ({messages.filter(m => m.attachments && m.attachments.length > 0).length})
              </span>
              
              <div className="grid grid-cols-3 gap-2">
                {messages
                  .filter(m => m.attachments && m.attachments.length > 0)
                  .flatMap(m => m.attachments || [])
                  .slice(0, 6)
                  .map(att => {
                    const isImg = att.mimeType.startsWith('image/');
                    return (
                      <a 
                        key={att.id} 
                        href={getAbsoluteUrl(att.fileUrl)} 
                        onClick={(e) => handleDownloadAttachment(e, att.fileUrl)}
                        target="_blank" 
                        rel="noreferrer"
                        className="aspect-square rounded-xl bg-white/5 border border-white/5 overflow-hidden flex items-center justify-center hover:opacity-80 transition-opacity"
                        title={att.fileName}
                      >
                        {isImg ? (
                          <img src={getAbsoluteUrl(att.fileUrl)} alt="media" loading="lazy" className="w-full h-full object-cover" />
                        ) : (
                          <FileText size={18} className="text-brand-400" />
                        )}
                      </a>
                    );
                  })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Profile Settings Modal */}
      {showProfileModal && (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md max-h-[90vh] overflow-y-auto scrollbar-thin glass-panel rounded-3xl p-6 shadow-2xl animate-scale-up">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-bold text-white">Account & Privacy Settings</h3>
              <button 
                onClick={() => setShowProfileModal(false)}
                className="p-1 rounded-lg hover:bg-white/5 text-dark-muted hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={saveProfile} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-dark-muted uppercase block">Display Name</label>
                <input
                  type="text"
                  required
                  className="w-full px-4 py-2.5 rounded-xl glass-input text-xs"
                  value={displayNameInput}
                  onChange={(e) => setDisplayNameInput(e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-dark-muted uppercase block">Username</label>
                <input
                  type="text"
                  required
                  className="w-full px-4 py-2.5 rounded-xl glass-input text-xs"
                  value={usernameInput}
                  onChange={(e) => setUsernameInput(e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-dark-muted uppercase block">Bio Status</label>
                <input
                  type="text"
                  maxLength={255}
                  className="w-full px-4 py-2.5 rounded-xl glass-input text-xs"
                  value={bioInput}
                  onChange={(e) => setBioInput(e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-dark-muted uppercase block">Profile Image</label>
                <div className="flex items-center space-x-3">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      setIsUploadingAvatar(true);
                      const formData = new FormData();
                      formData.append('file', file);
                      try {
                        const response = await api.post('/upload', formData, {
                          headers: { 'Content-Type': 'multipart/form-data' }
                        });
                        setAvatarUrlInput(response.data.fileUrl);
                        alert('Photo uploaded successfully! Click save to apply changes.');
                      } catch (err: any) {
                        alert('Upload failed: ' + (err.response?.data?.error || err.message));
                      } finally {
                        setIsUploadingAvatar(false);
                      }
                    }}
                    className="hidden"
                    id="avatar-upload-file"
                  />
                  <label
                    htmlFor="avatar-upload-file"
                    className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-xs font-semibold hover:bg-white/10 cursor-pointer flex items-center space-x-2 text-white"
                  >
                    <Upload size={14} />
                    <span>{isUploadingAvatar ? 'Uploading...' : 'Choose Image File'}</span>
                  </label>
                  {avatarUrlInput && (
                    <div className="w-8 h-8 rounded-lg overflow-hidden border border-white/10">
                      <img src={getAbsoluteUrl(avatarUrlInput)} className="w-full h-full object-cover" />
                    </div>
                  )}
                </div>
                <div className="mt-1">
                  <label className="text-[10px] text-dark-muted">Or enter URL manually:</label>
                  <input
                    type="text"
                    className="w-full px-4 py-1.5 rounded-lg glass-input text-[10px] mt-0.5"
                    value={avatarUrlInput}
                    onChange={(e) => setAvatarUrlInput(e.target.value)}
                  />
                </div>
              </div>

              <div className="h-[1px] bg-white/10 my-4"></div>
              <h4 className="text-xs font-bold text-white mb-3 flex items-center space-x-2">
                <Ban size={16} className="text-brand-400" />
                <span>Change Password</span>
              </h4>
              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-dark-muted block">Current Password</label>
                  <input
                    type="password"
                    className="w-full px-4 py-2.5 rounded-xl glass-input text-xs"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Enter current password"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-dark-muted block">New Password</label>
                  <input
                    type="password"
                    className="w-full px-4 py-2.5 rounded-xl glass-input text-xs"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter new password (min 6 chars)"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-dark-muted block">Confirm New Password</label>
                  <input
                    type="password"
                    className="w-full px-4 py-2.5 rounded-xl glass-input text-xs"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm new password"
                  />
                </div>
              </div>

              <div className="h-[1px] bg-white/10 my-4"></div>
              <h4 className="text-xs font-bold text-white mb-3 flex items-center space-x-2">
                <Settings size={16} className="text-brand-400" />
                <span>Privacy Controls</span>
              </h4>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-dark-muted font-semibold">Who can send friend requests</span>
                  <select
                    value={whoCanSendFriendRequests}
                    onChange={(e) => updatePreference('whoCanSendFriendRequests', e.target.value)}
                    className="bg-dark-bg border border-white/10 rounded-xl px-2 py-1 text-[11px] text-white focus:outline-none"
                  >
                    <option value="EVERYONE">Everyone</option>
                    <option value="FRIENDS">Mutual Friends</option>
                    <option value="NOONE">No one</option>
                  </select>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-dark-muted font-semibold">Who can call me</span>
                  <select
                    value={whoCanCallMe}
                    onChange={(e) => updatePreference('whoCanCallMe', e.target.value)}
                    className="bg-dark-bg border border-white/10 rounded-xl px-2 py-1 text-[11px] text-white focus:outline-none"
                  >
                    <option value="EVERYONE">Everyone</option>
                    <option value="FRIENDS">Friends</option>
                    <option value="NOONE">No one</option>
                  </select>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-dark-muted font-semibold">Who can see profile photo</span>
                  <select
                    value={whoCanSeeProfilePhoto}
                    onChange={(e) => updatePreference('whoCanSeeProfilePhoto', e.target.value)}
                    className="bg-dark-bg border border-white/10 rounded-xl px-2 py-1 text-[11px] text-white focus:outline-none"
                  >
                    <option value="EVERYONE">Everyone</option>
                    <option value="FRIENDS">Friends</option>
                    <option value="NOONE">No one</option>
                  </select>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-dark-muted font-semibold">Who can see last seen</span>
                  <select
                    value={whoCanSeeLastSeen}
                    onChange={(e) => updatePreference('whoCanSeeLastSeen', e.target.value)}
                    className="bg-dark-bg border border-white/10 rounded-xl px-2 py-1 text-[11px] text-white focus:outline-none"
                  >
                    <option value="EVERYONE">Everyone</option>
                    <option value="FRIENDS">Friends</option>
                    <option value="NOONE">No one</option>
                  </select>
                </div>
              </div>

              <div className="h-[1px] bg-white/10 my-4"></div>
              <h4 className="text-xs font-bold text-white mb-3 flex items-center space-x-2">
                <Volume2 size={16} className="text-brand-400" />
                <span>Audio & Sounds Configuration</span>
              </h4>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-dark-muted font-semibold">Volume Level ({(soundVolume * 100).toFixed(0)}%)</span>
                  <input 
                    type="range" 
                    min="0" 
                    max="1" 
                    step="0.05" 
                    value={soundVolume} 
                    onChange={(e) => setSoundVolume(parseFloat(e.target.value))}
                    className="w-32 accent-brand-500" 
                  />
                </div>

                <label className="flex items-center justify-between cursor-pointer select-none">
                  <span className="text-[11px] text-dark-muted font-semibold">Enable Ringtone</span>
                  <input 
                    type="checkbox" 
                    checked={enableRingtone} 
                    onChange={(e) => setEnableRingtone(e.target.checked)} 
                    className="w-4 h-4 rounded accent-brand-500 bg-white/5 border-white/10" 
                  />
                </label>

                <label className="flex items-center justify-between cursor-pointer select-none">
                  <span className="text-[11px] text-dark-muted font-semibold">Enable Caller Tone</span>
                  <input 
                    type="checkbox" 
                    checked={enableCallertone} 
                    onChange={(e) => setEnableCallertone(e.target.checked)} 
                    className="w-4 h-4 rounded accent-brand-500 bg-white/5 border-white/10" 
                  />
                </label>

                <label className="flex items-center justify-between cursor-pointer select-none">
                  <span className="text-[11px] text-dark-muted font-semibold">Enable notification sounds</span>
                  <input 
                    type="checkbox" 
                    checked={enableMessageSounds} 
                    onChange={(e) => setEnableMessageSounds(e.target.checked)} 
                    className="w-4 h-4 rounded accent-brand-500 bg-white/5 border-white/10" 
                  />
                </label>
              </div>

              <div className="h-[1px] bg-white/10 my-4"></div>
              <h4 className="text-xs font-bold text-white mb-3 flex items-center space-x-2">
                <Bell size={16} className="text-brand-400" />
                <span>Notification Preferences</span>
              </h4>

              <div className="space-y-3">
                <label className="flex items-center justify-between cursor-pointer select-none">
                  <span className="text-[11px] text-dark-muted font-semibold">Message Notifications</span>
                  <input 
                    type="checkbox" 
                    checked={prefMessages} 
                    onChange={(e) => updatePreference('messages', e.target.checked)} 
                    className="w-4 h-4 rounded accent-brand-500 bg-white/5 border-white/10" 
                  />
                </label>

                <label className="flex items-center justify-between cursor-pointer select-none">
                  <span className="text-[11px] text-dark-muted font-semibold">Call Notifications</span>
                  <input 
                    type="checkbox" 
                    checked={prefCalls} 
                    onChange={(e) => updatePreference('calls', e.target.checked)} 
                    className="w-4 h-4 rounded accent-brand-500 bg-white/5 border-white/10" 
                  />
                </label>

                <label className="flex items-center justify-between cursor-pointer select-none">
                  <span className="text-[11px] text-dark-muted font-semibold">Friend Requests</span>
                  <input 
                    type="checkbox" 
                    checked={prefFriendRequests} 
                    onChange={(e) => updatePreference('friendRequests', e.target.checked)} 
                    className="w-4 h-4 rounded accent-brand-500 bg-white/5 border-white/10" 
                  />
                </label>

                <label className="flex items-center justify-between cursor-pointer select-none">
                  <span className="text-[11px] text-dark-muted font-semibold">Group Notifications</span>
                  <input 
                    type="checkbox" 
                    checked={prefGroups} 
                    onChange={(e) => updatePreference('groupNotifications', e.target.checked)} 
                    className="w-4 h-4 rounded accent-brand-500 bg-white/5 border-white/10" 
                  />
                </label>

                <label className="flex items-center justify-between cursor-pointer select-none">
                  <span className="text-[11px] text-dark-muted font-semibold">Sound Effects</span>
                  <input 
                    type="checkbox" 
                    checked={prefSoundEffects} 
                    onChange={(e) => updatePreference('soundEffects', e.target.checked)} 
                    className="w-4 h-4 rounded accent-brand-500 bg-white/5 border-white/10" 
                  />
                </label>
              </div>

              <div className="h-[1px] bg-white/10 my-4"></div>

              <button
                type="submit"
                className="w-full py-3 rounded-xl glass-button-primary text-white font-semibold text-xs mt-2"
              >
                Save Profile & Settings
              </button>
            </form>
          </div>
        </div>
      )}

      {/* User Search & New Chat Modal */}
      {showSearchModal && (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md max-h-[90vh] overflow-y-auto scrollbar-thin glass-panel rounded-3xl p-6 shadow-2xl animate-scale-up">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-bold text-white flex items-center space-x-2">
                <MessageSquare size={18} className="text-brand-400" />
                <span>Initialize Conversations</span>
              </h3>
              <button 
                onClick={() => {
                  setShowSearchModal(false);
                  setUserSearchQuery('');
                  setUserSearchResults([]);
                }}
                className="p-1 rounded-lg hover:bg-white/5 text-dark-muted hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleUserSearch} className="flex items-center space-x-2 mb-6">
              <input
                type="text"
                required
                placeholder="Search by username or email..."
                className="flex-1 px-4 py-2.5 rounded-xl glass-input text-xs"
                value={userSearchQuery}
                onChange={(e) => setUserSearchQuery(e.target.value)}
              />
              <button
                type="submit"
                className="px-4 py-2.5 rounded-xl glass-button-primary text-white font-semibold text-xs flex items-center space-x-1"
              >
                <Search size={14} />
                <span>Find</span>
              </button>
            </form>

            {/* Results Grid List */}
            <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
              {userSearchResults.length > 0 ? (
                userSearchResults.map((searchedUser) => (
                  <div
                    key={searchedUser.id}
                    onClick={() => startDirectChat(searchedUser)}
                    className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5 hover:border-brand-500/40 cursor-pointer transition-all group"
                  >
                    <div className="flex items-center space-x-3 min-w-0">
                      <div className="w-9 h-9 rounded-lg overflow-hidden border border-white/5 flex-shrink-0">
                        <img 
                          src={searchedUser.profile?.avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${searchedUser.username}`} 
                          alt="avatar" 
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-bold text-xs text-white truncate leading-tight">
                          {searchedUser.profile?.displayName || searchedUser.username}
                        </h4>
                        <p className="text-[10px] text-dark-muted mt-0.5 truncate">
                          @{searchedUser.username}
                        </p>
                      </div>
                    </div>
                    <ChevronRight size={14} className="text-dark-muted group-hover:text-brand-400 group-hover:translate-x-1 transition-all" />
                  </div>
                ))
              ) : (
                <p className="text-center text-xs text-dark-muted py-6">
                  {userSearchQuery ? 'No accounts matched your criteria.' : 'Query username or email to lookup profiles.'}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Create Group Chat Modal */}
      {showCreateGroupModal && (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md max-h-[90vh] overflow-y-auto scrollbar-thin glass-panel rounded-3xl p-6 shadow-2xl animate-scale-up">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-bold text-white flex items-center space-x-2">
                <Users size={18} className="text-brand-400" />
                <span>Create Group Chat</span>
              </h3>
              <button 
                type="button"
                onClick={() => {
                  setShowCreateGroupModal(false);
                  setGroupNameInput('');
                  setGroupDescInput('');
                  setGroupAvatarUrlInput('');
                  setSelectedMemberIds([]);
                  setGroupMemberSearchQuery('');
                  setGroupMemberSearchResults([]);
                }}
                className="p-1 rounded-lg hover:bg-white/5 text-dark-muted hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateGroup} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-dark-muted uppercase block">Group Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Project Collaborators"
                  className="w-full px-4 py-2.5 rounded-xl glass-input text-xs"
                  value={groupNameInput}
                  onChange={(e) => setGroupNameInput(e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-dark-muted uppercase block">Description</label>
                <input
                  type="text"
                  placeholder="e.g. Coordination on Phase 6 tasks"
                  className="w-full px-4 py-2.5 rounded-xl glass-input text-xs"
                  value={groupDescInput}
                  onChange={(e) => setGroupDescInput(e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-dark-muted uppercase block">Group Avatar URL</label>
                <input
                  type="text"
                  placeholder="e.g. URL to image"
                  className="w-full px-4 py-2.5 rounded-xl glass-input text-xs"
                  value={groupAvatarUrlInput}
                  onChange={(e) => setGroupAvatarUrlInput(e.target.value)}
                />
              </div>

              {/* Members Selection Section */}
              <div className="space-y-2 pt-2">
                <label className="text-xs font-semibold text-dark-muted uppercase block">Select Members ({selectedMemberIds.length})</label>
                
                <div className="flex space-x-1">
                  <input
                    type="text"
                    placeholder="Search users by username..."
                    className="flex-1 px-3 py-2 rounded-xl glass-input text-xs"
                    value={groupMemberSearchQuery}
                    onChange={(e) => setGroupMemberSearchQuery(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={async (e) => {
                      e.preventDefault();
                      if (!groupMemberSearchQuery.trim()) return;
                      try {
                        const response = await api.get(`/users/search?q=${groupMemberSearchQuery}`);
                        setGroupMemberSearchResults(response.data);
                      } catch (err) {
                        console.error(err);
                      }
                    }}
                    className="px-3 py-2 rounded-xl glass-button-primary text-white text-[11px] font-semibold"
                  >
                    Search
                  </button>
                </div>

                {/* Search Results */}
                {groupMemberSearchResults.length > 0 && (
                  <div className="max-h-36 overflow-y-auto space-y-1 bg-white/5 p-2 rounded-xl border border-white/5">
                    {groupMemberSearchResults.map((searchedUser) => {
                      const isSelected = selectedMemberIds.includes(searchedUser.id);
                      return (
                        <div 
                          key={searchedUser.id}
                          onClick={() => toggleSelectMember(searchedUser.id)}
                          className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-all ${
                            isSelected ? 'bg-brand-500/20 text-white' : 'hover:bg-white/5 text-dark-muted'
                          }`}
                        >
                          <span className="text-xs">{searchedUser.profile?.displayName || searchedUser.username}</span>
                          <span className="text-[10px] font-bold">{isSelected ? '✓ Selected' : '+ Add'}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <button
                type="submit"
                className="w-full py-3 rounded-xl glass-button-primary text-white font-semibold text-xs mt-4"
              >
                Create Group Chat
              </button>
            </form>
          </div>
        </div>
      )}
      {/* Friendship Management Modal */}
      {showFriendshipModal && (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-2xl max-h-[90vh] h-[550px] glass-panel rounded-3xl p-6 shadow-2xl animate-scale-up flex flex-col">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-bold text-white flex items-center space-x-2">
                <UserCheck size={20} className="text-brand-400" />
                <span>Friendship Management</span>
              </h3>
              <button 
                onClick={() => {
                  setShowFriendshipModal(false);
                  setFriendSearchQuery('');
                  setFriendSearchResults([]);
                }}
                className="p-1 rounded-lg hover:bg-white/5 text-dark-muted hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex space-x-1 border-b border-white/5 mb-4 pb-1 overflow-x-auto min-h-[44px]">
              <button 
                onClick={() => setFriendshipModalTab('friends')}
                className={`px-4 py-2 text-xs font-semibold rounded-t-xl transition-all min-h-[44px] ${
                  friendshipModalTab === 'friends' 
                    ? 'border-b-2 border-brand-500 text-brand-400 bg-white/5' 
                    : 'text-dark-muted hover:text-white'
                }`}
              >
                Friends ({friends.length})
              </button>
              <button 
                onClick={() => setFriendshipModalTab('pending')}
                className={`px-4 py-2 text-xs font-semibold rounded-t-xl transition-all relative min-h-[44px] ${
                  friendshipModalTab === 'pending' 
                    ? 'border-b-2 border-brand-500 text-brand-400 bg-white/5' 
                    : 'text-dark-muted hover:text-white'
                }`}
              >
                Requests
                {(pendingIncomingRequests.length > 0) && (
                  <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-brand-500 text-white text-[9px] font-bold">
                    {pendingIncomingRequests.length}
                  </span>
                )}
              </button>
              <button 
                onClick={() => setFriendshipModalTab('blocked')}
                className={`px-4 py-2 text-xs font-semibold rounded-t-xl transition-all min-h-[44px] ${
                  friendshipModalTab === 'blocked' 
                    ? 'border-b-2 border-brand-500 text-brand-400 bg-white/5' 
                    : 'text-dark-muted hover:text-white'
                }`}
              >
                Blocked ({blockedUsers.length})
              </button>
              <button 
                onClick={() => setFriendshipModalTab('qr_invite')}
                className={`px-4 py-2 text-xs font-semibold rounded-t-xl transition-all min-h-[44px] ${
                  friendshipModalTab === 'qr_invite' 
                    ? 'border-b-2 border-brand-500 text-brand-400 bg-white/5' 
                    : 'text-dark-muted hover:text-white'
                }`}
              >
                QR & Invite
              </button>
            </div>

            {/* Tab contents */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {friendshipModalTab === 'friends' && (
                <>
                  {friends.length > 0 ? (
                    friends.map((f) => (
                      <div key={f.id} className="flex items-center justify-between p-3 rounded-2xl bg-white/5 border border-white/5 hover:border-brand-500/20 transition-all">
                        <div className="flex items-center space-x-3 min-w-0">
                          <div className="w-10 h-10 rounded-xl overflow-hidden border border-white/5 relative">
                            <img 
                              src={f.profile?.avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${f.username}`} 
                              alt="Avatar" 
                              className="w-full h-full object-cover"
                            />
                            <span className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-dark-bg ${f.profile?.isOnline ? 'bg-emerald-500' : 'bg-zinc-500'}`} />
                          </div>
                          <div className="min-w-0">
                            <h4 className="font-bold text-xs text-white truncate">{f.profile?.displayName || f.username}</h4>
                            <p className="text-[10px] text-dark-muted truncate">@{f.username}</p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <button 
                            onClick={() => {
                              startDirectChat(f);
                              setShowFriendshipModal(false);
                            }}
                            className="px-3 py-2 rounded-xl bg-brand-500/10 hover:bg-brand-500/20 text-brand-400 text-[11px] font-semibold transition-all min-h-[44px]"
                          >
                            Message
                          </button>
                          <button 
                            onClick={() => handleRemoveFriend(f.id)}
                            className="px-3 py-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 text-[11px] font-semibold transition-all min-h-[44px]"
                          >
                            Remove
                          </button>
                          <button 
                            onClick={() => handleBlockUser(f.id)}
                            className="p-3 rounded-xl bg-white/5 hover:bg-white/10 text-dark-muted hover:text-white transition-all min-h-[44px]"
                            title="Block User"
                          >
                            <Ban size={14} />
                          </button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-center text-xs text-dark-muted py-12">No friends added yet. Go to QR & Invite tab to scan or search friends.</p>
                  )}
                </>
              )}

              {friendshipModalTab === 'pending' && (
                <div className="space-y-4">
                  <div>
                    <span className="text-[10px] font-bold text-dark-muted uppercase tracking-wider block mb-2 pl-1">
                      Incoming Requests ({pendingIncomingRequests.length})
                    </span>
                    {pendingIncomingRequests.length > 0 ? (
                      pendingIncomingRequests.map((req) => (
                        <div key={req.id} className="flex items-center justify-between p-3 rounded-2xl bg-white/5 border border-white/5 mb-2">
                          <div className="flex items-center space-x-3 min-w-0">
                            <div className="w-9 h-9 rounded-xl overflow-hidden border border-white/5 flex-shrink-0">
                              <img 
                                src={req.sender.profile?.avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${req.sender.username}`} 
                                alt="avatar" 
                                className="w-full h-full object-cover"
                              />
                            </div>
                            <div className="min-w-0">
                              <h4 className="font-bold text-xs text-white truncate">{req.sender.profile?.displayName || req.sender.username}</h4>
                              <p className="text-[10px] text-dark-muted truncate">@{req.sender.username}</p>
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            <button 
                              onClick={() => handleAcceptFriendRequest(req.id)}
                              className="px-3 py-2 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-[11px] font-semibold transition-all min-h-[44px]"
                            >
                              Accept
                            </button>
                            <button 
                              onClick={() => handleRejectFriendRequest(req.id)}
                              className="px-3 py-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 text-[11px] font-semibold transition-all min-h-[44px]"
                            >
                              Decline
                            </button>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-dark-muted py-2 italic pl-1">No incoming requests.</p>
                    )}
                  </div>

                  <div className="pt-2 border-t border-white/5">
                    <span className="text-[10px] font-bold text-dark-muted uppercase tracking-wider block mb-2 pl-1">
                      Outgoing Requests ({pendingOutgoingRequests.length})
                    </span>
                    {pendingOutgoingRequests.length > 0 ? (
                      pendingOutgoingRequests.map((req) => (
                        <div key={req.id} className="flex items-center justify-between p-3 rounded-2xl bg-white/5 border border-white/5 mb-2">
                          <div className="flex items-center space-x-3 min-w-0">
                            <div className="w-9 h-9 rounded-xl overflow-hidden border border-white/5 flex-shrink-0">
                              <img 
                                src={req.receiver.profile?.avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${req.receiver.username}`} 
                                alt="avatar" 
                                className="w-full h-full object-cover"
                              />
                            </div>
                            <div className="min-w-0">
                              <h4 className="font-bold text-xs text-white truncate">{req.receiver.profile?.displayName || req.receiver.username}</h4>
                              <p className="text-[10px] text-dark-muted truncate">@{req.receiver.username}</p>
                            </div>
                          </div>
                          <button 
                            onClick={() => handleCancelFriendRequest(req.id)}
                            className="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-dark-muted hover:text-white text-[11px] font-semibold transition-all min-h-[44px]"
                          >
                            Cancel Request
                          </button>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-dark-muted py-2 italic pl-1">No outgoing requests.</p>
                    )}
                  </div>
                </div>
              )}

              {friendshipModalTab === 'blocked' && (
                <>
                  {blockedUsers.length > 0 ? (
                    blockedUsers.map((b) => (
                      <div key={b.id} className="flex items-center justify-between p-3 rounded-2xl bg-white/5 border border-white/5 hover:border-brand-500/20 transition-all">
                        <div className="flex items-center space-x-3 min-w-0">
                          <div className="w-9 h-9 rounded-xl overflow-hidden border border-white/5 flex-shrink-0">
                            <img 
                              src={b.profile?.avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${b.username}`} 
                              alt="avatar" 
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <div className="min-w-0">
                            <h4 className="font-bold text-xs text-white truncate">{b.profile?.displayName || b.username}</h4>
                            <p className="text-[10px] text-dark-muted truncate">@{b.username}</p>
                          </div>
                        </div>
                        <button 
                          onClick={() => handleUnblockUser(b.id)}
                          className="px-3 py-2 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-[11px] font-semibold transition-all min-h-[44px]"
                        >
                          Unblock
                        </button>
                      </div>
                    ))
                  ) : (
                    <p className="text-center text-xs text-dark-muted py-12">No users blocked.</p>
                  )}
                </>
              )}

              {friendshipModalTab === 'qr_invite' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-1">
                  {/* Left Column: My QR code */}
                  <div className="glass-panel p-5 rounded-2xl border border-white/5 flex flex-col items-center justify-center space-y-4 text-center">
                    <span className="text-[10px] font-bold text-dark-muted uppercase tracking-wider block">
                      My QR Invite
                    </span>
                    {qrCodeDataUrl ? (
                      <img 
                        src={qrCodeDataUrl} 
                        alt="My QR Code" 
                        className="w-44 h-44 rounded-xl border-4 border-white shadow-lg bg-white" 
                      />
                    ) : (
                      <div className="w-44 h-44 rounded-xl border border-white/10 flex items-center justify-center text-xs text-dark-muted">
                        Generating QR...
                      </div>
                    )}
                    <div className="space-y-1">
                      <div className="text-[10px] text-dark-muted uppercase font-bold">Public Friend ID</div>
                      <div className="px-3 py-1.5 rounded-lg bg-white/5 text-xs text-white font-mono border border-white/5 tracking-wider select-all">
                        {user?.publicId || 'VC-????????'}
                      </div>
                    </div>
                    
                    <button
                      onClick={handleShareInvite}
                      className="px-4 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-white font-semibold text-xs flex items-center space-x-1.5 transition-all min-h-[44px]"
                    >
                      <Share2 size={14} />
                      <span>Share Invite Link</span>
                    </button>
                  </div>

                  {/* Right Column: Scan / Import & Search */}
                  <div className="space-y-4">
                    {/* Search */}
                    <div className="space-y-2">
                      <span className="text-[10px] font-bold text-dark-muted uppercase tracking-wider block">
                        Search Friend
                      </span>
                      <form 
                        onSubmit={async (e) => {
                          e.preventDefault();
                          if (!friendSearchQuery.trim()) return;
                          await fetchAndPreviewProfile(friendSearchQuery.trim());
                        }} 
                        className="flex items-center space-x-2"
                      >
                        <input
                          type="text"
                          required
                          placeholder="Search Public ID (VC-...) or username"
                          className="flex-1 px-4 py-2.5 rounded-xl glass-input text-xs"
                          value={friendSearchQuery}
                          onChange={(e) => setFriendSearchQuery(e.target.value)}
                        />
                        <button
                          type="submit"
                          className="p-3 rounded-xl bg-brand-500 hover:bg-brand-600 text-white font-semibold text-xs transition-all min-h-[44px]"
                          title="Search Profile"
                        >
                          <Search size={14} />
                        </button>
                      </form>
                    </div>

                    {/* QR Code Actions */}
                    <div className="space-y-2 pt-2 border-t border-white/5">
                      <span className="text-[10px] font-bold text-dark-muted uppercase tracking-wider block">
                        Scan QR Code
                      </span>
                      <div className="flex space-x-2">
                        <button
                          onClick={isScanningQR ? stopCameraScan : startCameraScan}
                          className={`flex-1 px-3 py-2.5 rounded-xl text-xs font-semibold flex items-center justify-center space-x-1.5 transition-all min-h-[44px] ${
                            isScanningQR 
                              ? 'bg-red-500/10 hover:bg-red-500/20 text-red-400' 
                              : 'bg-white/5 hover:bg-white/10 text-white'
                          }`}
                        >
                          <Camera size={14} />
                          <span>{isScanningQR ? 'Stop Camera' : 'Scan via Camera'}</span>
                        </button>
                        
                        <button
                          onClick={() => document.getElementById('gallery-qr-input')?.click()}
                          className="flex-1 px-3 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white text-xs font-semibold flex items-center justify-center space-x-1.5 transition-all min-h-[44px]"
                        >
                          <Upload size={14} />
                          <span>Gallery Import</span>
                        </button>
                        <input 
                          type="file" 
                          id="gallery-qr-input" 
                          accept="image/*" 
                          className="hidden" 
                          onChange={handleGalleryImport} 
                        />
                      </div>
                    </div>

                    {/* Scanner stream display */}
                    {isScanningQR && (
                      <div className="relative w-full max-h-48 rounded-xl overflow-hidden border border-brand-500/30 bg-black flex items-center justify-center animate-fade-in">
                        <video 
                          ref={videoRef} 
                          className="w-full h-full max-h-48 object-cover" 
                          playsInline 
                        />
                        <canvas 
                          ref={canvasRef} 
                          className="hidden" 
                        />
                        <div className="absolute inset-0 border-2 border-dashed border-brand-500/50 pointer-events-none animate-pulse m-6 rounded-lg" />
                      </div>
                    )}

                    {qrError && (
                      <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-medium">
                        {qrError}
                      </div>
                    )}

                    {/* Profile Preview Card Overlay */}
                    {scannedProfile && (
                      <div className="p-4 rounded-xl bg-white/5 border border-brand-500/30 space-y-3 animate-scale-up">
                        <div className="flex items-center space-x-3">
                          <div className="w-12 h-12 rounded-xl overflow-hidden border border-white/10 flex-shrink-0">
                            <img 
                              src={scannedProfile.avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${scannedProfile.username}`} 
                              alt="avatar" 
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <div className="min-w-0 flex-1">
                            <h4 className="font-bold text-xs text-white truncate">{scannedProfile.displayName || scannedProfile.username}</h4>
                            <p className="text-[10px] text-dark-muted truncate">@{scannedProfile.username}</p>
                            <p className="text-[9px] text-brand-400 mt-1 uppercase tracking-wider font-bold">
                              Status: {scannedProfile.relationship.replace('_', ' ')}
                            </p>
                          </div>
                        </div>
                        {scannedProfile.bio && (
                          <p className="text-[11px] text-dark-muted italic pl-1.5 border-l border-white/10">{scannedProfile.bio}</p>
                        )}
                        
                        <div className="flex items-center justify-end space-x-2 pt-2 border-t border-white/5 min-h-[44px]">
                          {scannedProfile.relationship === 'NONE' && (
                            <>
                              <button
                                onClick={() => handleSendFriendRequestPublic(scannedProfile.publicId)}
                                className="px-3 py-2 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-xs font-semibold min-h-[44px] transition-all"
                              >
                                Add Friend
                              </button>
                              <button
                                onClick={() => handleBlockUserPublic(scannedProfile.publicId)}
                                className="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-red-400 text-xs font-semibold min-h-[44px] transition-all"
                              >
                                Block
                              </button>
                            </>
                          )}
                          {scannedProfile.relationship === 'PENDING_SENT' && (
                            <button
                              onClick={() => handleCancelFriendRequestPublic(scannedProfile.requestId, scannedProfile.publicId)}
                              className="px-3 py-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-semibold min-h-[44px] transition-all"
                            >
                              Cancel Request
                            </button>
                          )}
                          {scannedProfile.relationship === 'PENDING_RECEIVED' && (
                            <div className="flex items-center space-x-2">
                              <button
                                onClick={() => handleAcceptFriendRequestPublic(scannedProfile.requestId, scannedProfile.publicId)}
                                className="px-3 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-semibold min-h-[44px] transition-all"
                              >
                                Accept Request
                              </button>
                              <button
                                onClick={() => handleRejectFriendRequestPublic(scannedProfile.requestId, scannedProfile.publicId)}
                                className="px-3 py-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-semibold min-h-[44px] transition-all"
                              >
                                Decline
                              </button>
                            </div>
                          )}
                          {scannedProfile.relationship === 'FRIENDS' && (
                            <div className="flex items-center space-x-2">
                              <button
                                onClick={() => {
                                  const existingChat = chats.find(c => c.type === 'DIRECT' && c.otherMember?.publicId === scannedProfile.publicId);
                                  if (existingChat) {
                                    setSelectedChat(existingChat);
                                  } else {
                                    const friend = friends.find(f => f.publicId === scannedProfile.publicId);
                                    if (friend) startDirectChat(friend);
                                  }
                                  setShowFriendshipModal(false);
                                }}
                                className="px-3 py-2 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-xs font-semibold min-h-[44px] transition-all"
                              >
                                Message
                              </button>
                              <button
                                onClick={() => handleRemoveFriendPublic(scannedProfile.publicId)}
                                className="px-3 py-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-semibold min-h-[44px] transition-all"
                              >
                                Remove Friend
                              </button>
                            </div>
                          )}
                          {scannedProfile.relationship === 'BLOCKED' && (
                            <>
                              {scannedProfile.blockState === 'YOU_BLOCKED' ? (
                                <button
                                  onClick={() => handleUnblockUserPublic(scannedProfile.publicId)}
                                  className="px-3 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-semibold min-h-[44px] transition-all"
                                >
                                  Unblock
                                </button>
                              ) : (
                                <span className="text-xs text-red-400 italic font-semibold">Blocked</span>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      {/* WebRTC Calling Overlay — Premium Desktop Design */}
      {callState !== 'idle' && callPeer && (
        <div className="absolute inset-0 z-50 flex flex-col overflow-hidden select-none" style={{ background: '#000' }}>
          
          {/* Background: video fills behind everything or gradient */}
          {callType === 'video' && callState === 'active' ? (
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className="absolute inset-0 w-full h-full object-cover"
            />
          ) : (
            <div className="absolute inset-0" style={{ background: 'linear-gradient(160deg, #1a1040 0%, #0d1626 60%, #071220 100%)' }}>
              <div className="absolute -top-1/4 -left-1/4 w-3/4 h-3/4 rounded-full opacity-30" style={{ background: 'radial-gradient(circle, rgba(99,102,241,0.4) 0%, transparent 70%)', filter: 'blur(80px)' }} />
            </div>
          )}

          {/* Video scrim */}
          {callType === 'video' && callState === 'active' && (
            <div className="absolute inset-0 pointer-events-none" style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.2) 30%, rgba(0,0,0,0.2) 70%, rgba(0,0,0,0.9) 100%)', zIndex: 1 }} />
          )}

          {/* Hidden audio element */}
          <audio ref={remoteAudioRef} autoPlay />

          {/* PiP: local camera (video active) */}
          {callType === 'video' && callState === 'active' && (
            <div className="absolute top-20 right-6 w-40 h-56 rounded-2xl overflow-hidden border-2 border-white/20 shadow-2xl z-20" style={{ background: '#111' }}>
              {isVideoEnabled ? (
                <video ref={localVideoRef} autoPlay playsInline muted className="w-full h-full object-cover" style={{ transform: 'scaleX(-1)' }} />
              ) : (
                <div className="w-full h-full flex items-center justify-center" style={{ background: '#0a0d16' }}>
                  <VideoOff size={24} className="text-white/30" />
                </div>
              )}
            </div>
          )}

          {/* Connection quality + live timer (active calls) */}
          {callState === 'active' && (
            <div className="absolute top-5 left-6 z-20 flex items-center gap-3">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full" style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.1)' }}>
                <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                <span className="text-white text-xs font-bold">{formatCallDuration(callDuration)}</span>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full" style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.1)' }}>
                <span className="text-[11px] font-bold" style={{
                  color: connectionQuality === 'good' ? '#10b981' : connectionQuality === 'fair' ? '#f59e0b' : connectionQuality === 'poor' ? '#f97316' : '#ef4444'
                }}>
                  {connectionQuality === 'good' ? '●●●●' : connectionQuality === 'fair' ? '●●●○' : connectionQuality === 'poor' ? '●●○○' : '●○○○'}
                </span>
              </div>
            </div>
          )}

          {/* Fallback prompt */}
          {showFallbackPrompt && callType === 'video' && (
            <div className="absolute top-16 left-1/2 -translate-x-1/2 z-20 px-4 py-2 rounded-full text-xs font-semibold text-amber-300 animate-bounce" style={{ background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.3)' }}>
              Low bandwidth — switching to audio only…
            </div>
          )}

          {/* Diagnostics panel */}
          {showDiagnosticsHUD && liveDiagnostics && (
            <div className="absolute top-20 left-6 w-72 z-30 rounded-2xl p-4 text-left text-[11px] font-mono" style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(20px)', border: '1px solid rgba(99,102,241,0.3)', color: '#a5b4fc' }}>
              <div className="flex justify-between items-center mb-3">
                <span className="text-[9px] font-black tracking-widest text-indigo-400">WEBRTC DIAGNOSTICS</span>
                <button onClick={() => setShowDiagnosticsHUD(false)} className="text-white/40 hover:text-white"><X size={12} /></button>
              </div>
              {[
                ['Local', liveDiagnostics.localStreamStatus],
                ['Remote', liveDiagnostics.remoteStreamStatus],
                ['Tracks', `${liveDiagnostics.localVideoTracksCount}V ${liveDiagnostics.localAudioTracksCount}A`],
                ['ICE', liveDiagnostics.iceConnectionState || liveDiagnostics.iceState],
                ['Conn', liveDiagnostics.connectionState],
                ['Candidate', liveDiagnostics.selectedCandidateType],
                ['TURN', liveDiagnostics.isTurnUsed ? 'YES' : 'NO'],
                ['Route', liveDiagnostics.audioRoute || 'default'],
              ].map(([k, v]) => v && (
                <div key={k} className="flex gap-2 mb-1">
                  <span className="text-white/40 min-w-[64px]">{k}:</span>
                  <span className="text-white/80">{v}</span>
                </div>
              ))}
              {diagnosticsLog.length > 0 && (
                <div className="mt-2 pt-2 border-t border-white/10">
                  <p className="text-[9px] text-amber-400 font-bold uppercase mb-1">Recovery Log</p>
                  <div className="max-h-20 overflow-y-auto space-y-0.5">
                    {diagnosticsLog.map((log, i) => <p key={i} className="text-[9px] text-amber-200">{log}</p>)}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Audio route menu */}
          {showAudioRouteMenu && (
            <div className="absolute bottom-36 left-1/2 -translate-x-1/2 w-72 z-30 rounded-2xl p-4" style={{ background: 'rgba(18,22,36,0.95)', backdropFilter: 'blur(24px)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <div className="flex justify-between items-center mb-3">
                <span className="text-xs font-bold text-indigo-400 tracking-wider">AUDIO OUTPUT</span>
                <button onClick={() => setShowAudioRouteMenu(false)} className="text-white/40 hover:text-white"><X size={14} /></button>
              </div>
              {audioRouteError ? (
                <p className="text-xs text-red-400">{audioRouteError}</p>
              ) : audioOutputs.length > 0 ? (
                audioOutputs.map(d => (
                  <button
                    key={d.deviceId}
                    onClick={() => { handleSelectAudioRoute(d.deviceId); setShowAudioRouteMenu(false); }}
                    className="w-full text-left px-3 py-2.5 rounded-xl mb-1.5 text-sm font-medium transition-all"
                    style={{
                      background: selectedAudioOutput === d.deviceId ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.04)',
                      border: `1px solid ${selectedAudioOutput === d.deviceId ? 'rgba(99,102,241,0.4)' : 'rgba(255,255,255,0.06)'}`,
                      color: selectedAudioOutput === d.deviceId ? '#a5b4fc' : 'rgba(255,255,255,0.7)',
                    }}
                  >
                    {d.label || `Output (${d.deviceId.slice(0, 8)})`}
                  </button>
                ))
              ) : (
                <p className="text-xs text-white/40">No outputs detected</p>
              )}
            </div>
          )}

          {/* ── Main content ── */}
          <div className="relative z-10 flex flex-col items-center justify-between h-full py-12 px-6">

            {/* Top: peer info */}
            <div className="flex flex-col items-center gap-3 animate-fade-in">
              <div className="px-4 py-1.5 rounded-full text-xs font-black tracking-widest uppercase" style={{
                background: callState === 'active' ? 'rgba(16,185,129,0.15)' : 'rgba(99,102,241,0.15)',
                border: `1px solid ${callState === 'active' ? 'rgba(16,185,129,0.25)' : 'rgba(99,102,241,0.25)'}`,
                color: callState === 'active' ? '#6ee7b7' : '#a5b4fc',
              }}>
                {callState === 'outgoing' && `📞  Calling ${callType === 'video' ? '(Video)' : '(Voice)'}…`}
                {callState === 'incoming' && `${callType === 'video' ? '📹' : '📞'}  Incoming ${callType === 'video' ? 'Video' : 'Voice'} Call`}
                {callState === 'active' && `${callType === 'video' ? '📹' : '📞'}  ${formatCallDuration(callDuration)}`}
              </div>
              <h2 className="text-3xl font-black text-white tracking-tight" style={{ textShadow: '0 2px 16px rgba(0,0,0,0.7)' }}>
                {callPeer.profile?.displayName || callPeer.username}
              </h2>
              <span className="text-white/40 text-sm">@{callPeer.username}</span>
            </div>

            {/* Middle: avatar for audio / pre-call */}
            {!(callType === 'video' && callState === 'active') && (
              <div className="flex items-center justify-center flex-1 animate-fade-in">
                <div className="relative">
                  {callState !== 'active' && (
                    <>
                      <div className="absolute -inset-8 rounded-full opacity-30 animate-ping" style={{ background: 'rgba(99,102,241,0.3)' }} />
                      <div className="absolute -inset-4 rounded-full opacity-20 animate-ping" style={{ background: 'rgba(99,102,241,0.3)', animationDelay: '0.5s' }} />
                    </>
                  )}
                  <img
                    src={callPeer.profile?.avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${callPeer.username}`}
                    alt="Peer"
                    className="relative z-10 rounded-full object-cover"
                    style={{ width: 140, height: 140, border: '4px solid rgba(255,255,255,0.12)', boxShadow: '0 16px 64px rgba(0,0,0,0.6)' }}
                  />
                </div>
              </div>
            )}

            {/* Spacer for video active */}
            {callType === 'video' && callState === 'active' && <div className="flex-1" />}

            {/* Bottom controls */}
            <div className="flex flex-col items-center gap-5 animate-fade-in w-full max-w-md">

              {/* INCOMING */}
              {callState === 'incoming' && (
                <div className="flex gap-16 items-center">
                  <div className="flex flex-col items-center gap-2">
                    <button
                      onClick={rejectCall}
                      className="w-16 h-16 rounded-full flex items-center justify-center text-white transition-transform hover:scale-105 active:scale-95"
                      style={{ background: '#ef4444', boxShadow: '0 8px 32px rgba(239,68,68,0.5)' }}
                    >
                      <PhoneOff size={26} />
                    </button>
                    <span className="text-xs text-white/50 font-medium">Decline</span>
                  </div>
                  <div className="flex flex-col items-center gap-2">
                    <button
                      onClick={acceptCall}
                      className="w-16 h-16 rounded-full flex items-center justify-center text-white transition-transform hover:scale-105 active:scale-95"
                      style={{ background: '#22c55e', boxShadow: '0 8px 32px rgba(34,197,94,0.5)' }}
                    >
                      <Phone size={26} />
                    </button>
                    <span className="text-xs text-white/50 font-medium">Accept</span>
                  </div>
                </div>
              )}

              {/* OUTGOING: cancel */}
              {callState === 'outgoing' && (
                <div className="flex flex-col items-center gap-2">
                  <button
                    onClick={endCall}
                    className="w-16 h-16 rounded-full flex items-center justify-center text-white transition-transform hover:scale-105 active:scale-95"
                    style={{ background: '#ef4444', boxShadow: '0 8px 32px rgba(239,68,68,0.5)' }}
                  >
                    <PhoneOff size={26} />
                  </button>
                  <span className="text-xs text-white/50 font-medium">Cancel</span>
                </div>
              )}

              {/* ACTIVE controls */}
              {callState === 'active' && (
                <>
                  {/* Control strip */}
                  <div className="flex items-center gap-3 px-6 py-3.5 rounded-3xl" style={{ background: 'rgba(18,22,36,0.7)', backdropFilter: 'blur(24px)', border: '1px solid rgba(255,255,255,0.08)' }}>
                    {/* Mute */}
                    <button
                      onClick={toggleMute}
                      className="w-11 h-11 rounded-2xl flex flex-col items-center justify-center gap-1 transition-all hover:scale-105"
                      style={{
                        background: isMuted ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.08)',
                        border: `1px solid ${isMuted ? 'rgba(239,68,68,0.4)' : 'rgba(255,255,255,0.1)'}`,
                        color: isMuted ? '#fca5a5' : 'rgba(255,255,255,0.7)',
                      }}
                      title={isMuted ? 'Unmute' : 'Mute'}
                    >
                      {isMuted ? <MicOff size={17} /> : <Mic size={17} />}
                      <span style={{ fontSize: 8, fontWeight: 700, letterSpacing: '0.04em' }}>{isMuted ? 'UNMUTE' : 'MUTE'}</span>
                    </button>

                    {/* Camera (video calls) */}
                    {callType === 'video' && (
                      <button
                        onClick={toggleCamera}
                        className="w-11 h-11 rounded-2xl flex flex-col items-center justify-center gap-1 transition-all hover:scale-105"
                        style={{
                          background: !isVideoEnabled ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.08)',
                          border: `1px solid ${!isVideoEnabled ? 'rgba(239,68,68,0.4)' : 'rgba(255,255,255,0.1)'}`,
                          color: !isVideoEnabled ? '#fca5a5' : 'rgba(255,255,255,0.7)',
                        }}
                        title={isVideoEnabled ? 'Disable Camera' : 'Enable Camera'}
                      >
                        {isVideoEnabled ? <Video size={17} /> : <VideoOff size={17} />}
                        <span style={{ fontSize: 8, fontWeight: 700, letterSpacing: '0.04em' }}>CAMERA</span>
                      </button>
                    )}

                    {/* Switch to audio only (video calls) */}
                    {callType === 'video' && (
                      <button
                        onClick={switchToAudioOnly}
                        className="w-11 h-11 rounded-2xl flex flex-col items-center justify-center gap-1 transition-all hover:scale-105"
                        style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(245,158,11,0.9)' }}
                        title="Switch to Audio Only"
                      >
                        <VideoOff size={17} />
                        <span style={{ fontSize: 8, fontWeight: 700, letterSpacing: '0.04em' }}>AUDIO</span>
                      </button>
                    )}

                    {/* Speaker */}
                    <button
                      onClick={toggleSpeakerphone}
                      className="w-11 h-11 rounded-2xl flex flex-col items-center justify-center gap-1 transition-all hover:scale-105"
                      style={{
                        background: isSpeakerphone ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.08)',
                        border: `1px solid ${isSpeakerphone ? 'rgba(99,102,241,0.4)' : 'rgba(255,255,255,0.1)'}`,
                        color: isSpeakerphone ? '#a5b4fc' : 'rgba(255,255,255,0.7)',
                      }}
                      title={isSpeakerphone ? 'Earpiece' : 'Speaker'}
                    >
                      {isSpeakerphone ? <Volume2 size={17} /> : <VolumeX size={17} />}
                      <span style={{ fontSize: 8, fontWeight: 700, letterSpacing: '0.04em' }}>SPEAKER</span>
                    </button>

                    {/* Audio route */}
                    <button
                      onClick={() => { fetchAudioOutputs(); setShowAudioRouteMenu(!showAudioRouteMenu); }}
                      className="w-11 h-11 rounded-2xl flex flex-col items-center justify-center gap-1 transition-all hover:scale-105"
                      style={{
                        background: showAudioRouteMenu ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.08)',
                        border: `1px solid ${showAudioRouteMenu ? 'rgba(99,102,241,0.4)' : 'rgba(255,255,255,0.1)'}`,
                        color: showAudioRouteMenu ? '#a5b4fc' : 'rgba(255,255,255,0.7)',
                      }}
                      title="Audio Output"
                    >
                      <Headphones size={17} />
                      <span style={{ fontSize: 8, fontWeight: 700, letterSpacing: '0.04em' }}>OUTPUT</span>
                    </button>

                    {/* Fullscreen (video) */}
                    {callType === 'video' && (
                      <button
                        onClick={() => setIsFullscreenVideo(!isFullscreenVideo)}
                        className="w-11 h-11 rounded-2xl flex flex-col items-center justify-center gap-1 transition-all hover:scale-105"
                        style={{
                          background: isFullscreenVideo ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.08)',
                          border: '1px solid rgba(255,255,255,0.1)',
                          color: isFullscreenVideo ? '#a5b4fc' : 'rgba(255,255,255,0.7)',
                        }}
                        title={isFullscreenVideo ? 'Exit Fullscreen' : 'Fullscreen'}
                      >
                        {isFullscreenVideo ? <Minimize2 size={17} /> : <Maximize2 size={17} />}
                        <span style={{ fontSize: 8, fontWeight: 700, letterSpacing: '0.04em' }}>{isFullscreenVideo ? 'EXIT' : 'FULL'}</span>
                      </button>
                    )}

                    {/* Diagnostics */}
                    <button
                      onClick={() => setShowDiagnosticsHUD(!showDiagnosticsHUD)}
                      className="w-11 h-11 rounded-2xl flex flex-col items-center justify-center gap-1 transition-all hover:scale-105"
                      style={{
                        background: showDiagnosticsHUD ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.08)',
                        border: `1px solid ${showDiagnosticsHUD ? 'rgba(99,102,241,0.4)' : 'rgba(255,255,255,0.1)'}`,
                        color: showDiagnosticsHUD ? '#a5b4fc' : 'rgba(255,255,255,0.5)',
                      }}
                      title="Diagnostics"
                    >
                      <Info size={17} />
                      <span style={{ fontSize: 8, fontWeight: 700, letterSpacing: '0.04em' }}>DEBUG</span>
                    </button>
                  </div>

                  {/* End call */}
                  <div className="flex flex-col items-center gap-2">
                    <button
                      onClick={endCall}
                      className="w-16 h-16 rounded-full flex items-center justify-center text-white transition-transform hover:scale-105 active:scale-95"
                      style={{ background: '#ef4444', boxShadow: '0 8px 32px rgba(239,68,68,0.5)' }}
                    >
                      <PhoneOff size={26} />
                    </button>
                    <span className="text-xs text-white/50 font-medium">End Call</span>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}


      {/* Call History Modal */}
      {showCallHistoryModal && (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-2xl max-h-[90vh] h-[550px] glass-panel rounded-3xl p-6 shadow-2xl flex flex-col animate-scale-up">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-bold text-white flex items-center space-x-2">
                <Clock size={20} className="text-brand-400" />
                <span>Call History</span>
              </h3>
              <button 
                onClick={() => setShowCallHistoryModal(false)}
                className="p-1 rounded-lg hover:bg-white/5 text-dark-muted hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            {/* Sub-tabs */}
            <div className="flex space-x-1 border-b border-white/5 mb-4 pb-1 overflow-x-auto min-h-[44px]">
              {['all', 'incoming', 'outgoing', 'missed'].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setCallHistoryTab(tab as any)}
                  className={`px-4 py-2 text-xs font-semibold rounded-t-xl transition-all capitalize min-h-[44px] ${
                    callHistoryTab === tab
                      ? 'border-b-2 border-brand-500 text-brand-400 bg-white/5'
                      : 'text-dark-muted hover:text-white'
                  }`}
                >
                  {tab} Calls
                </button>
              ))}
            </div>

            {/* Logs List */}
            <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
              {(() => {
                const filtered = callHistory.filter((log) => {
                  const isOutgoing = log.callerId === user?.id;
                  if (callHistoryTab === 'incoming') return !isOutgoing;
                  if (callHistoryTab === 'outgoing') return isOutgoing;
                  if (callHistoryTab === 'missed') return log.status === 'MISSED';
                  return true;
                });

                if (filtered.length === 0) {
                  return (
                    <div className="h-full flex flex-col items-center justify-center text-center p-6">
                      <Phone className="text-white/10 mb-2" size={32} />
                      <p className="text-xs text-dark-muted">No call logs found in this category.</p>
                    </div>
                  );
                }

                return filtered.map((log) => {
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

                  // Duration string
                  const mins = Math.floor(log.durationSeconds / 60);
                  const secs = log.durationSeconds % 60;
                  const durationStr = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;

                  return (
                    <div key={log.id} className="flex items-center justify-between p-3.5 rounded-2xl bg-white/5 border border-white/5 hover:border-brand-500/20 transition-all">
                      <div className="flex items-center space-x-3.5 min-w-0">
                        <div className="w-10 h-10 rounded-xl overflow-hidden border border-white/5 flex-shrink-0">
                          <img src={avatar} alt="avatar" className="w-full h-full object-cover" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center space-x-2">
                            <span className="font-bold text-xs text-white truncate leading-none">
                              {displayName}
                            </span>
                            <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded leading-none ${
                              isOutgoing ? 'text-blue-400 bg-blue-500/10' : 'text-purple-400 bg-purple-500/10'
                            }`}>
                              {isOutgoing ? 'Outgoing' : 'Incoming'}
                            </span>
                          </div>
                          <p className="text-[10px] text-dark-muted mt-1 flex items-center space-x-1.5">
                            {log.callType === 'VIDEO' ? <Video size={10} /> : <Phone size={10} />}
                            <span>{formattedDate}</span>
                            <span>•</span>
                            <span className={`font-semibold ${
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
                          </p>
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center space-x-2 min-h-[44px]">
                        <button
                          onClick={() => {
                            startCall(log.callType.toLowerCase() as 'audio' | 'video', partner);
                            setShowCallHistoryModal(false);
                          }}
                          className="p-2.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-white min-h-[44px] min-w-[44px] flex items-center justify-center transition-all"
                          title="Redial"
                        >
                          {log.callType === 'VIDEO' ? <Video size={14} /> : <Phone size={14} />}
                        </button>
                        <button
                          onClick={() => openChatForUser(partner)}
                          className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 text-dark-muted hover:text-white min-h-[44px] min-w-[44px] flex items-center justify-center transition-all"
                          title="Open Chat"
                        >
                          <MessageSquare size={14} />
                        </button>
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Notification Center Panel Drawer */}
      {showNotificationCenter && (
        <div className="absolute right-0 top-0 bottom-0 w-full sm:w-[400px] bg-dark-surface/95 backdrop-blur-xl border-l border-white/10 shadow-2xl z-50 flex flex-col p-6 animate-slide-left">
          {/* Header */}
          <div className="flex justify-between items-center pb-4 border-b border-white/5 mb-4">
            <div className="flex items-center space-x-2">
              <Bell size={20} className="text-brand-400" />
              <h3 className="text-base font-bold text-white">Notifications</h3>
              {unreadNotificationsCount > 0 && (
                <span className="px-1.5 py-0.5 rounded-full bg-brand-500 text-[9px] text-white font-bold animate-pulse">
                  {unreadNotificationsCount} new
                </span>
              )}
            </div>
            <div className="flex items-center space-x-2">
              {unreadNotificationsCount > 0 && (
                <button
                  onClick={markAllNotificationsRead}
                  className="px-2 py-1.5 rounded-lg bg-brand-500/10 hover:bg-brand-500/20 text-brand-400 text-[10px] font-bold transition-all min-h-[44px]"
                >
                  Mark All Read
                </button>
              )}
              <button
                onClick={() => setShowNotificationCenter(false)}
                className="p-2.5 rounded-xl hover:bg-white/5 text-dark-muted hover:text-white min-h-[44px] min-w-[44px] flex items-center justify-center"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* List Area */}
          <div className="flex-1 overflow-y-auto space-y-3 pr-1 pb-4">
            {notifications.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6">
                <BellOff className="text-white/10 mb-2" size={32} />
                <p className="text-xs text-dark-muted">No notifications found.</p>
              </div>
            ) : (
              <>
                {notifications.map((notification) => {
                  const type = notification.type;
                  const isRead = notification.isRead;
                  const formattedDate = new Date(notification.createdAt).toLocaleString([], {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  });

                  // Determine icon based on type
                  let Icon = Info;
                  let iconColor = 'text-dark-muted bg-white/5';
                  if (type === 'FRIEND_REQUEST') {
                    Icon = UserPlus;
                    iconColor = 'text-blue-400 bg-blue-500/10';
                  } else if (type === 'FRIEND_ACCEPTED') {
                    Icon = UserCheck;
                    iconColor = 'text-emerald-400 bg-emerald-500/10';
                  } else if (type === 'GROUP_INVITE') {
                    Icon = Users;
                    iconColor = 'text-purple-400 bg-purple-500/10';
                  } else if (type === 'MISSED_CALL') {
                    Icon = PhoneOff;
                    iconColor = 'text-red-400 bg-red-500/10';
                  } else if (type === 'MENTION') {
                    Icon = MessageSquare;
                    iconColor = 'text-amber-400 bg-amber-500/10';
                  } else if (type === 'SYSTEM') {
                    Icon = Info;
                    iconColor = 'text-blue-400 bg-blue-500/10';
                  }

                  // Parse Metadata
                  let meta: any = null;
                  try {
                    meta = notification.metadata ? JSON.parse(notification.metadata) : null;
                  } catch (e) {}

                  return (
                    <div 
                      key={notification.id} 
                      onClick={() => !isRead && markNotificationRead(notification.id)}
                      className={`p-3.5 rounded-2xl border transition-all flex flex-col space-y-2 cursor-pointer ${
                        isRead 
                          ? 'bg-white/5 border-transparent' 
                          : 'bg-brand-500/5 border-brand-500/20 shadow-md relative'
                      }`}
                    >
                      {/* Unread blue dot */}
                      {!isRead && (
                        <span className="absolute top-3 right-3 w-2 h-2 rounded-full bg-brand-500 animate-pulse"></span>
                      )}

                      <div className="flex items-start space-x-3">
                        <div className={`p-2.5 rounded-xl ${iconColor} flex-shrink-0`}>
                          <Icon size={16} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <h4 className="font-bold text-xs text-white truncate leading-tight pr-4">
                            {notification.title}
                          </h4>
                          <p className="text-[11px] text-dark-muted mt-1 leading-normal pr-4">
                            {notification.body}
                          </p>
                          <span className="text-[9px] text-dark-muted font-medium mt-1.5 block">
                            {formattedDate}
                          </span>
                        </div>
                      </div>

                      {/* Action buttons inside notification card */}
                      {(() => {
                        if (type === 'FRIEND_REQUEST') {
                          return (
                            <div className="flex items-center space-x-2 pt-2 border-t border-white/5 min-h-[44px]" onClick={(e) => e.stopPropagation()}>
                              <button
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  if (meta?.requestId) {
                                    try {
                                      await api.post(`/friends/request/${meta.requestId}/accept`);
                                      alert('Friend request accepted');
                                      markNotificationRead(notification.id);
                                      fetchFriendshipData();
                                      fetchChats();
                                    } catch (err: any) {
                                      alert(err.response?.data?.error || 'Failed to accept');
                                    }
                                  }
                                }}
                                className="flex-1 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white font-semibold text-[10px] min-h-[44px]"
                              >
                                Accept
                              </button>
                              <button
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  if (meta?.requestId) {
                                    try {
                                      await api.post(`/friends/request/${meta.requestId}/reject`);
                                      alert('Friend request declined');
                                      markNotificationRead(notification.id);
                                      fetchFriendshipData();
                                    } catch (err: any) {
                                      alert(err.response?.data?.error || 'Failed to decline');
                                    }
                                  }
                                }}
                                className="flex-1 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-dark-muted hover:text-white font-semibold text-[10px] min-h-[44px]"
                              >
                                Decline
                              </button>
                            </div>
                          );
                        } else if (type === 'MISSED_CALL') {
                          return (
                            <div className="flex items-center space-x-2 pt-2 border-t border-white/5 min-h-[44px]" onClick={(e) => e.stopPropagation()}>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (meta?.callerId) {
                                    const peerObj: UserType = {
                                      id: meta.callerId,
                                      username: meta.callerUsername || 'user',
                                      email: '',
                                      publicId: meta.callerPublicId || '',
                                      profile: {
                                        id: '',
                                        userId: meta.callerId,
                                        displayName: meta.callerDisplayName || meta.callerUsername || 'User',
                                        avatarUrl: meta.callerAvatarUrl || null,
                                        bio: null,
                                        isOnline: false,
                                        lastSeen: ''
                                      }
                                    };
                                    startCall('audio', peerObj);
                                    setShowNotificationCenter(false);
                                  }
                                }}
                                className="flex-1 py-1.5 rounded-lg bg-brand-500 hover:bg-brand-600 text-white font-semibold text-[10px] flex items-center justify-center space-x-1.5 min-h-[44px]"
                              >
                                <Phone size={10} />
                                <span>Redial Voice</span>
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (meta?.callerId) {
                                    const peerObj: UserType = {
                                      id: meta.callerId,
                                      username: meta.callerUsername || 'user',
                                      email: '',
                                      publicId: meta.callerPublicId || '',
                                      profile: {
                                        id: '',
                                        userId: meta.callerId,
                                        displayName: meta.callerDisplayName || meta.callerUsername || 'User',
                                        avatarUrl: meta.callerAvatarUrl || null,
                                        bio: null,
                                        isOnline: false,
                                        lastSeen: ''
                                      }
                                    };
                                    startCall('video', peerObj);
                                    setShowNotificationCenter(false);
                                  }
                                }}
                                className="flex-1 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/5 text-dark-muted hover:text-white font-semibold text-[10px] flex items-center justify-center space-x-1.5 min-h-[44px]"
                              >
                                <Video size={10} />
                                <span>Redial Video</span>
                              </button>
                            </div>
                          );
                        } else if (type === 'MENTION' && meta?.chatId) {
                          return (
                            <div className="pt-2 border-t border-white/5 min-h-[44px]" onClick={(e) => e.stopPropagation()}>
                              <button
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  const match = chats.find(c => c.id === meta.chatId);
                                  if (match) {
                                    setSelectedChat(match);
                                    setShowNotificationCenter(false);
                                  } else {
                                    await fetchChats();
                                    setShowNotificationCenter(false);
                                  }
                                }}
                                className="w-full py-1.5 rounded-lg bg-brand-500/10 hover:bg-brand-500/20 text-brand-400 font-semibold text-[10px] min-h-[44px]"
                              >
                                Go to Chat
                              </button>
                            </div>
                          );
                        }
                        return null;
                      })()}
                    </div>
                  );
                })}

                {/* Pagination Controls */}
                {notificationsPage < notificationsTotalPages && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      fetchNotifications(notificationsPage + 1, true);
                    }}
                    className="w-full py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 text-xs text-white transition-all font-semibold min-h-[44px]"
                  >
                    Load More Notifications
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      )}

    </div>
  );
};
export default ChatDashboard;