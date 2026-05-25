export type Role = 'user' | 'admin' | 'moderator'

export interface User {
  id: number
  email: string | null
  phone: string | null
  fullName: string
  role: Role
  accountStatus: 'active' | 'restricted' | 'hidden' | 'deleted'
  avatarUrl: string | null
  isVerified: boolean
}

export interface AuthPayload {
  accessToken: string
  refreshToken: string
  user: User
}

export interface FeedPost {
  id: number
  authorId: number
  authorName: string
  authorAvatar: string | null
  content: string
  mediaUrl: string | null
  visibility: 'public' | 'private'
  status: 'published' | 'hidden' | 'deleted'
  reactionCount: number
  commentCount: number
  viewerReaction: string | null
  createdAt: string
}

export interface FeedComment {
  id: number | string
  postId: number | string
  userId: number
  authorName: string
  authorAvatar: string | null
  content: string
  reactionCount: number
  viewerReaction: string | null
  createdAt: string
}

export interface Conversation {
  id: string
  type: 'direct' | 'group'
  name: string | null
  avatarUrl: string | null
  createdBy?: number
  createdAt?: string
  updatedAt?: string
  unreadCount: number
  lastMessage?: {
    id: string
    senderId: number
    senderName?: string | null
    senderAvatar?: string | null
    type: string
    text: string | null
    mediaUrl: string | null
    fileName?: string | null
    mimeType?: string | null
    fileSize?: number | null
    meta?: Record<string, unknown> | null
    createdAt: string
    updatedAt?: string | null
    isDeleted?: boolean
  } | null
  pinnedMessageIds?: string[]
  role?: string
  groupOwner?: number
  onlineCount?: number
  isPinned?: boolean
  isMuted?: boolean
  mutedUntil?: string | null
  notificationsEnabled?: boolean
  members: Array<{
    userId: number
    fullName: string
    realName?: string
    nickname?: string | null
    avatarUrl: string | null
    role: string
    lastReadAt?: string | null
    lastReadMessageId?: string | null
    isPinned?: boolean
    isMuted?: boolean
    mutedUntil?: string | null
    deletedHistoryAt?: string | null
    online?: boolean
    lastActiveAt?: string | null
  }>
}

export interface PostReactionViewer {
  userId: number
  fullName: string
  avatarUrl: string | null
  reaction: string
  createdAt?: string | null
}

export interface ChatMessage {
  id: string
  conversationId: string
  senderId: number
  senderName: string
  senderAvatar: string | null
  type: string
  text: string | null
  mediaUrl: string | null
  fileName?: string | null
  mimeType?: string | null
  fileSize?: number | null
  meta?: Record<string, unknown> | null
  links?: string[]
  status?: 'sent' | 'delivered' | 'seen'
  readBy?: Array<{ userId: number; at?: string | null }>
  deliveredTo?: Array<{ userId: number; at?: string | null }>
  isDeleted?: boolean
  reactionCount: number
  viewerReaction: string | null
  reactions?: Array<{ userId: number; reaction: string; createdAt?: string | null }>
  createdAt: string
  updatedAt?: string
}

export interface NotificationItem {
  id: number | string
  type: string
  title: string
  body: string | null
  is_read: number
  created_at: string
  meta_json?: string | null
  meta?: Record<string, unknown> | null
}

export interface FriendConnection {
  id: number
  fullName: string
  email: string | null
  phone: string | null
  avatarUrl: string | null
  isVerified: boolean
  role: Role
  accountStatus: User['accountStatus']
  status: 'pending' | 'accepted'
  requestedByMe: boolean
  createdAt: string
}
