import type {
  AuthPayload,
  ChatMessage,
  Conversation,
  FeedComment,
  FriendConnection,
  FeedPost,
  NotificationItem,
  User,
} from '@/lib/types'

const API_BASE =
  import.meta.env.VITE_API_BASE_URL ||
  import.meta.env.NEXT_PUBLIC_API_BASE_URL ||
  '/backend/api'

const resolveApiAssetUrl = (value: string | null | undefined) => {
  if (!value) return null
  if (/^https?:\/\//i.test(value) || value.startsWith('blob:') || value.startsWith('data:')) {
    return value
  }

  if (value.startsWith('/uploads/')) {
    if (API_BASE.startsWith('/backend')) {
      return `/backend${value}`
    }

    if (API_BASE.startsWith('/api')) {
      return value
    }

    try {
      const origin =
        typeof window !== 'undefined' && window.location?.origin ? window.location.origin : 'http://localhost'
      const base = new URL(API_BASE, origin)
      return new URL(value, `${base.origin}/`).toString()
    } catch {
      return value
    }
  }

  return value
}

const normalizeConversation = (conversation: Conversation): Conversation => ({
  ...conversation,
  id: String(conversation.id),
  pinnedMessageIds: (conversation.pinnedMessageIds || []).map((item) => String(item)),
})

const normalizeChatMessage = (message: ChatMessage): ChatMessage => ({
  ...message,
  id: String(message.id),
  conversationId: String(message.conversationId),
  mediaUrl: resolveApiAssetUrl(message.mediaUrl),
})

export class ApiError extends Error {
  status?: number
  code?: string

  constructor(message: string, options?: { status?: number; code?: string }) {
    super(message)
    this.name = 'ApiError'
    this.status = options?.status
    this.code = options?.code
  }
}

export const isAuthExpiredError = (error: unknown) => {
  if (!(error instanceof Error)) return false
  const status = error instanceof ApiError ? error.status : undefined
  const code = error instanceof ApiError ? error.code : undefined
  const lower = error.message.toLowerCase()

  return (
    status === 401 ||
    status === 403 ||
    code === 'AUTH_EXPIRED' ||
    lower.includes('invalid or expired token') ||
    lower.includes('token expired') ||
    lower.includes('jwt expired') ||
    lower.includes('unauthorized')
  )
}

const buildHeaders = (token?: string) => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }

  if (token) {
    headers.Authorization = `Bearer ${token}`
  }

  return headers
}

const request = async <T>(
  path: string,
  options: RequestInit = {},
  token?: string
): Promise<T> => {
  const requestUrl = `${API_BASE}${path}`
  let response: Response

  try {
    response = await fetch(requestUrl, {
      ...options,
      headers: {
        ...buildHeaders(token),
        ...(options.headers || {}),
      },
      cache: 'no-store',
    })
  } catch (error) {
    const lower = error instanceof Error ? error.message.toLowerCase() : ''
    const isNetworkError =
      error instanceof TypeError ||
      lower.includes('failed to fetch') ||
      lower.includes('networkerror') ||
      lower.includes('load failed')

    if (isNetworkError) {
      throw new ApiError(
        'Không thể kết nối backend API. Hãy chạy server API ở frontend (npm run dev:api) và tải lại trang.',
        { code: 'BACKEND_UNREACHABLE' }
      )
    }

    throw error
  }

  const data = await response.json().catch(() => ({}))

  if (!response.ok) {
    const message = typeof data.message === 'string' ? data.message : ''
    const lowerMessage = message.toLowerCase()
    const isDbUnavailable =
      response.status === 503 ||
      lowerMessage.includes('database') ||
      lowerMessage.includes('mariadb') ||
      lowerMessage.includes('pool failed')

    if (isDbUnavailable) {
      throw new ApiError('Máy chủ đang mất kết nối cơ sở dữ liệu. Vui lòng bật MariaDB và thử lại.', {
        status: response.status,
        code: 'DB_UNAVAILABLE',
      })
    }

    const isAuthError =
      response.status === 401 ||
      response.status === 403 ||
      lowerMessage.includes('invalid or expired token') ||
      lowerMessage.includes('token expired') ||
      lowerMessage.includes('jwt expired') ||
      lowerMessage.includes('unauthorized')

    if (isAuthError) {
      throw new ApiError(message || 'Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại.', {
        status: response.status,
        code: 'AUTH_EXPIRED',
      })
    }

    throw new ApiError(message || 'Request failed', {
      status: response.status,
      code: typeof data.code === 'string' ? data.code : undefined,
    })
  }

  return data as T
}

export const api = {
  login: (emailOrPhone: string, password: string) =>
    request<AuthPayload>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ emailOrPhone, password }),
    }),

  register: (payload: {
    emailOrPhone: string
    fullName: string
    dateOfBirth?: string
    gender?: string
    password: string
  }) =>
    request<{ requiresVerification?: boolean; verificationCode?: string; emailOrPhone?: string; message?: string }>(
      '/auth/register',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      }
    ),

  verifyRegistration: (payload: { emailOrPhone: string; code: string }) =>
    request<AuthPayload>('/auth/verify-registration', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  resendVerificationCode: (emailOrPhone: string) =>
    request<{
      message: string
      otpSent?: boolean
      otpChannel?: string
      otpDestination?: string
      otpReason?: string
      verificationCode?: string
    }>('/auth/resend-verification', {
      method: 'POST',
      body: JSON.stringify({ emailOrPhone }),
    }),

  forgotPassword: (emailOrPhone: string) =>
    request<{
      message: string
      otpSent?: boolean
      otpChannel?: string
      otpDestination?: string
      otpReason?: string
      resetCode?: string
    }>('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ emailOrPhone }),
    }),

  resetPassword: (payload: { emailOrPhone: string; code: string; newPassword: string }) =>
    request<{ message: string }>('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  me: (token: string) => request<{ user: User }>('/auth/me', { method: 'GET' }, token),

  updateProfile: (
    token: string,
    payload: { fullName?: string; avatarUrl?: string; dateOfBirth?: string; gender?: string }
  ) => request<{ message: string; user: User }>('/auth/me', { method: 'PUT', body: JSON.stringify(payload) }, token),

  listFeed: (token?: string) =>
    request<{ posts: FeedPost[]; viewer: { id: number; role: string } | null }>(
      '/social/feed',
      { method: 'GET' },
      token
    ),

  listFeedWithParams: (params: { includeHidden?: boolean; limit?: number }, token?: string) => {
    const query = new URLSearchParams()
    if (params.includeHidden) query.set('includeHidden', '1')
    if (params.limit) query.set('limit', String(params.limit))
    const suffix = query.toString() ? `?${query.toString()}` : ''
    return request<{ posts: FeedPost[]; viewer: { id: number; role: string } | null }>(
      `/social/feed${suffix}`,
      { method: 'GET' },
      token
    )
  },

  createPost: (token: string, payload: { content?: string; mediaUrl?: string; visibility?: 'public' | 'private' }) =>
    request<{ post: FeedPost }>(
      '/social/posts',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
      token
    ),

  updatePost: (
    token: string,
    postId: number,
    payload: { content?: string; mediaUrl?: string; visibility?: 'public' | 'private' }
  ) =>
    request<{ message: string; post: FeedPost }>(
      `/social/posts/${postId}`,
      {
        method: 'PATCH',
        body: JSON.stringify(payload),
      },
      token
    ),

  deletePost: (token: string, postId: number) =>
    request<{ message: string }>(`/social/posts/${postId}`, { method: 'DELETE' }, token),

  getPost: (postId: number, token?: string) =>
    request<{ post: FeedPost }>(`/social/posts/${postId}`, { method: 'GET' }, token),

  uploadPostMediaBase64: (
    token: string,
    payload: { fileName: string; contentType: string; base64Data: string }
  ) =>
    request<{ message: string; mediaUrl: string }>(
      '/social/posts/upload-base64',
      { method: 'POST', body: JSON.stringify(payload) },
      token
    ),

  reactPost: (token: string, postId: number, type = 'like') =>
    request<{ post: FeedPost }>(
      `/social/posts/${postId}/reaction`,
      {
        method: 'POST',
        body: JSON.stringify({ type }),
      },
      token
    ),

  unreactPost: (token: string, postId: number) =>
    request<{ post: FeedPost }>(`/social/posts/${postId}/reaction`, { method: 'DELETE' }, token),

  listComments: (
    postId: number,
    token?: string,
    params?: {
      limit?: number
      offset?: number
    }
  ) => {
    const query = new URLSearchParams()
    if (params?.limit) query.set('limit', String(params.limit))
    if (params?.offset) query.set('offset', String(params.offset))
    const suffix = query.toString() ? `?${query.toString()}` : ''

    return request<{
      comments: FeedComment[]
      total?: number
      hasMore?: boolean
      limit?: number
      offset?: number
    }>(`/social/posts/${postId}/comments${suffix}`, { method: 'GET' }, token)
  },

  addComment: (token: string, postId: number, content: string) =>
    request<{ comment: FeedComment }>(
      `/social/posts/${postId}/comments`,
      { method: 'POST', body: JSON.stringify({ content }) },
      token
    ),

  listConversations: (token: string) =>
    request<{ conversations: Conversation[] }>('/chat/conversations', { method: 'GET' }, token).then((data) => ({
      conversations: (data.conversations || []).map(normalizeConversation),
    })),

  searchUsers: (token: string, keyword: string) =>
    request<{ users: Array<Record<string, unknown>> }>(
      `/social/users/search?q=${encodeURIComponent(keyword)}`,
      { method: 'GET' },
      token
    ),

  listFriends: (token: string) =>
    request<{ friends: FriendConnection[] }>('/social/friends', { method: 'GET' }, token),

  requestFriend: (token: string, userId: number) =>
    request<{ message: string }>('/social/friends/request', {
      method: 'POST',
      body: JSON.stringify({ userId }),
    }, token),

  acceptFriend: (token: string, userId: number) =>
    request<{ message: string }>(`/social/friends/${userId}/accept`, { method: 'POST' }, token),

  deleteFriend: (token: string, userId: number) =>
    request<{ message: string }>(`/social/friends/${userId}`, { method: 'DELETE' }, token),

  createDirectConversation: (token: string, userId: number) =>
    request<{ conversation: Conversation }>(
      '/chat/conversations/direct',
      { method: 'POST', body: JSON.stringify({ userId }) },
      token
    ).then((data) => ({ conversation: normalizeConversation(data.conversation) })),

  createGroupConversation: (
    token: string,
    payload: { name: string; memberIds: number[]; avatarUrl?: string }
  ) =>
    request<{ conversation: Conversation }>(
      '/chat/conversations/group',
      { method: 'POST', body: JSON.stringify(payload) },
      token
    ).then((data) => ({ conversation: normalizeConversation(data.conversation) })),

  addGroupMember: (token: string, conversationId: string, userId: number) =>
    request<{ message: string }>(
      `/chat/conversations/${conversationId}/members`,
      { method: 'POST', body: JSON.stringify({ userId }) },
      token
    ),

  removeGroupMember: (token: string, conversationId: string, userId: number) =>
    request<{ message: string }>(`/chat/conversations/${conversationId}/members/${userId}`, { method: 'DELETE' }, token),

  leaveGroupConversation: (token: string, conversationId: string) =>
    request<{ message: string }>(`/chat/conversations/${conversationId}/leave`, { method: 'DELETE' }, token),

  updateGroupMemberAdmin: (token: string, conversationId: string, userId: number, isAdmin: boolean) =>
    request<{ message: string }>(
      `/chat/conversations/${conversationId}/admins`,
      { method: 'PATCH', body: JSON.stringify({ userId, isAdmin }) },
      token
    ),

  transferGroupLeader: (token: string, conversationId: string, userId: number) =>
    request<{ message: string }>(
      `/chat/conversations/${conversationId}/leader`,
      { method: 'PATCH', body: JSON.stringify({ userId }) },
      token
    ),

  setGroupDeputy: (token: string, conversationId: string, userId: number | null) =>
    request<{ message: string }>(
      `/chat/conversations/${conversationId}/deputy`,
      { method: 'PATCH', body: JSON.stringify({ userId }) },
      token
    ),

  dissolveGroupConversation: (token: string, conversationId: string) =>
    request<{ message: string }>(`/chat/conversations/${conversationId}`, { method: 'DELETE' }, token),

  listMessages: (
    token: string,
    conversationId: string,
    params?: {
      limit?: number
      beforeId?: string
    }
  ) => {
    const query = new URLSearchParams()
    if (params?.limit) query.set('limit', String(params.limit))
    if (params?.beforeId) query.set('beforeId', String(params.beforeId))
    const suffix = query.toString() ? `?${query.toString()}` : ''

    return request<{
      messages: ChatMessage[]
      messageLimit?: {
        total: number
        sent: number
        remaining: number
        isFriend: boolean
      } | null
    }>(`/chat/conversations/${conversationId}/messages${suffix}`, { method: 'GET' }, token).then((data) => ({
      ...data,
      messages: (data.messages || []).map(normalizeChatMessage),
    }))
  },

  sendMessage: (token: string, conversationId: string, text: string) =>
    request<{ message: ChatMessage }>(
      `/chat/conversations/${conversationId}/messages`,
      { method: 'POST', body: JSON.stringify({ type: 'text', text }) },
      token
    ).then((data) => ({ message: normalizeChatMessage(data.message) })),

  sendMessagePayload: (
    token: string,
    conversationId: string,
    payload: {
      type: 'text' | 'image' | 'video' | 'audio' | 'file' | 'sticker'
      text?: string
      mediaUrl?: string
      fileName?: string
      mimeType?: string
      fileSize?: number
      sticker?: string
    }
  ) =>
    request<{ message: ChatMessage }>(
      `/chat/conversations/${conversationId}/messages`,
      { method: 'POST', body: JSON.stringify(payload) },
      token
    ).then((data) => ({ message: normalizeChatMessage(data.message) })),

  uploadMessageBase64: (
    token: string,
    conversationId: string,
    payload: { fileName: string; contentType: string; base64Data: string }
  ) =>
    request<{ message?: string; mediaUrl?: string; fileUrl?: string }>(
      `/chat/conversations/${conversationId}/messages/upload-base64`,
      { method: 'POST', body: JSON.stringify(payload) },
      token
    ).then((data) => ({
      message: data.message || 'Uploaded',
      mediaUrl: resolveApiAssetUrl(data.mediaUrl || data.fileUrl || '') || '',
    })),

  reactMessage: (token: string, messageId: string, type: 'like' | 'love' | 'care') =>
    request<{ message: string; chatMessage: ChatMessage }>(
      `/chat/messages/${messageId}/reaction`,
      { method: 'POST', body: JSON.stringify({ type }) },
      token
    ).then((data) => ({ ...data, chatMessage: normalizeChatMessage(data.chatMessage) })),

  removeMessageReaction: (token: string, messageId: string) =>
    request<{ message: string; chatMessage: ChatMessage }>(`/chat/messages/${messageId}/reaction`, { method: 'DELETE' }, token).then((data) => ({
      ...data,
      chatMessage: normalizeChatMessage(data.chatMessage),
    })),

  recallMessage: (token: string, messageId: string) =>
    request<{ message: string; chatMessage: ChatMessage }>(`/chat/messages/${messageId}/recall`, { method: 'PATCH' }, token).then((data) => ({
      ...data,
      chatMessage: normalizeChatMessage(data.chatMessage),
    })),

  deleteMessage: (token: string, messageId: string) =>
    request<{ message: string }>(`/chat/messages/${messageId}`, { method: 'DELETE' }, token),

  pinMessage: (token: string, messageId: string) =>
    request<{ message: string }>(`/chat/messages/${messageId}/pin`, { method: 'PATCH' }, token),

  unpinMessage: (token: string, messageId: string) =>
    request<{ message: string }>(`/chat/messages/${messageId}/pin`, { method: 'DELETE' }, token),

  clearConversationMessages: (token: string, conversationId: string) =>
    request<{ message: string }>(`/chat/conversations/${conversationId}/messages`, { method: 'DELETE' }, token),

  forwardMessage: (token: string, messageId: string, targetConversationId: string) =>
    request<{ message: string; chatMessage: ChatMessage }>(
      `/chat/messages/${messageId}/forward`,
      { method: 'POST', body: JSON.stringify({ targetConversationId }) },
      token
    ).then((data) => ({ ...data, chatMessage: normalizeChatMessage(data.chatMessage) })),

  aiChat: (token: string | undefined, message: string, history?: { role: 'user' | 'model'; text: string }[]) =>
    request<{ message?: string; reply?: string }>('/social/ai/support', {
      method: 'POST',
      body: JSON.stringify({ message, history }),
    }, token),

  notifications: (token: string) =>
    request<{ notifications: NotificationItem[] }>('/social/notifications', { method: 'GET' }, token),

  readNotification: (token: string, id: number) =>
    request<{ message: string }>(`/social/notifications/${id}/read`, { method: 'PATCH' }, token),

  readAllNotifications: (token: string) =>
    request<{ message: string }>('/social/notifications/read-all', { method: 'PATCH' }, token),

  submitReport: (
    token: string,
    payload: {
      targetType: 'post' | 'comment' | 'user' | 'message'
      targetId: number
      reason: string
      details?: string
    }
  ) =>
    request<{ message: string; report: Record<string, unknown> }>(
      '/social/reports',
      { method: 'POST', body: JSON.stringify(payload) },
      token
    ),

  adminStats: (token: string) => request<{ stats: Record<string, number> }>('/social/admin/stats', { method: 'GET' }, token),

  moderationReports: (token: string) =>
    request<{ reports: Array<Record<string, unknown>> }>('/social/moderation/reports', { method: 'GET' }, token),

  moderationUsers: (token: string) =>
    request<{ users: User[] }>('/social/admin/users', { method: 'GET' }, token),

  reviewModerationReport: (
    token: string,
    reportId: number,
    payload: { status: 'pending' | 'reviewed' | 'resolved'; resolutionNote?: string }
  ) =>
    request<{ message: string; report: Record<string, unknown> }>(
      `/social/moderation/reports/${reportId}`,
      { method: 'PATCH', body: JSON.stringify(payload) },
      token
    ),

  moderatePost: (
    token: string,
    postId: number,
    payload: { status: 'published' | 'hidden' | 'deleted'; resolutionNote?: string }
  ) =>
    request<{ message: string; post: FeedPost }>(
      `/social/moderation/posts/${postId}`,
      { method: 'PATCH', body: JSON.stringify(payload) },
      token
    ),

  adminPosts: (
    token: string,
    params?: {
      q?: string
      status?: 'published' | 'hidden' | 'deleted'
      visibility?: 'public' | 'private'
      limit?: number
    }
  ) => {
    const query = new URLSearchParams()
    if (params?.q) query.set('q', params.q)
    if (params?.status) query.set('status', params.status)
    if (params?.visibility) query.set('visibility', params.visibility)
    if (params?.limit) query.set('limit', String(params.limit))
    const suffix = query.toString() ? `?${query.toString()}` : ''
    return request<{ posts: FeedPost[] }>(`/social/admin/posts${suffix}`, { method: 'GET' }, token)
  },

  updateAdminPost: (
    token: string,
    postId: number,
    payload: {
      content?: string
      mediaUrl?: string | null
      visibility?: 'public' | 'private'
      status?: 'published' | 'hidden' | 'deleted'
    }
  ) =>
    request<{ message: string; post: FeedPost }>(
      `/social/admin/posts/${postId}`,
      { method: 'PATCH', body: JSON.stringify(payload) },
      token
    ),

  deleteAdminPost: (token: string, postId: number) =>
    request<{ message: string }>(`/social/admin/posts/${postId}`, { method: 'DELETE' }, token),

  updateModerationUser: (
    token: string,
    userId: number,
    payload: { role?: 'user' | 'moderator' | 'admin'; accountStatus?: 'active' | 'restricted' | 'hidden' | 'deleted' }
  ) =>
    request<{ message: string; user: User }>(
      `/social/admin/users/${userId}`,
      { method: 'PATCH', body: JSON.stringify(payload) },
      token
    ),
}
