export interface Profile {
  id: string;
  userId: string;
  displayName: string | null;
  avatarUrl: string | null;
  bio: string | null;
  isOnline: boolean;
  lastSeen: string;
}

export interface User {
  id: string;
  email: string;
  username: string;
  publicId: string;
  profile: Profile | null;
}

export interface ChatMember {
  id: string;
  chatId: string;
  userId: string;
  role: 'OWNER' | 'ADMIN' | 'MEMBER';
  lastReadMessageId?: string | null;
  joinedAt: string;
  user?: User;
}

export interface Chat {
  id: string;
  type: 'DIRECT' | 'GROUP';
  groupName?: string | null;
  groupDescription?: string | null;
  groupAvatarUrl?: string | null;
  groupCreatedAt?: string | null;
  groupUpdatedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  otherMember?: User | null;
  otherMembers?: User[];
  members?: ChatMember[];
  lastMessage: Message | null;
  unreadCount: number;
}

export interface MessageReaction {
  id: string;
  messageId: string;
  userId: string;
  emoji: string;
  user?: {
    id: string;
    username: string;
    profile: Profile | null;
  };
}

export interface MessageRead {
  id: string;
  messageId: string;
  userId: string;
  readAt: string;
}

export interface MessageStatus {
  id: string;
  messageId: string;
  userId: string;
  deliveredAt?: string | null;
  readAt?: string | null;
  deviceInfo?: string | null;
  metadata?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Attachment {
  id: string;
  messageId: string;
  fileUrl: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  createdAt: string;
}

export interface Message {
  id: string;
  chatId: string;
  senderId: string;
  content: string;
  clientMessageId?: string | null;
  isEdited: boolean;
  isDeleted: boolean;
  replyToId: string | null;
  replyTo?: Message | null;
  createdAt: string;
  updatedAt: string;
  attachments?: Attachment[];
  reactions?: MessageReaction[];
  reads?: MessageRead[];
  statuses?: MessageStatus[];
  isOfflinePending?: boolean;
  sender?: {
    id: string;
    username: string;
    profile: Profile | null;
  };
}
