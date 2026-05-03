'use client'

import { ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  Bell,
  CirclePlus,
  Crown,
  Info,
  LogOut,
  MoreHorizontal,
  Paperclip,
  Phone,
  PhoneOff,
  Search,
  Send,
  Smile,
  Sticker,
  Trash2,
  UserCheck,
  UserPlus,
  Video,
} from 'lucide-react'
import { ApiError, api } from '@/lib/api'
import { useAuthStore } from '@/lib/store/auth-store'
import { useChatStore } from '@/lib/store/chat-store'
import { useCallStore, type IncomingCallState } from '@/lib/store/call-store'
import { connectSocket, getSocket } from '@/lib/socket'
import type { ChatMessage, FriendConnection } from '@/lib/types'
import styles from './page.module.css'

// 26 emoji for message composer
const EMOJI_SET = ['đŸ˜€', 'đŸ˜„', 'đŸ˜‚', 'đŸ¥¹', 'đŸ˜', 'đŸ˜˜', 'đŸ¤', 'đŸ™', 'đŸ”¥', 'đŸ‰', 'đŸ’™', 'đŸ‘', 'đŸ¤”', 'đŸ˜', 'đŸ˜¢', 'đŸ˜¡', 'â¤ï¸', 'đŸ¤—', 'đŸ‘', 'đŸ’ª', 'đŸ™Œ', 'âœ¨', 'đŸ', 'đŸ’¯', 'đŸ€', 'đŸŒŸ']

const MESSAGE_REACTIONS = [
  { type: 'smile', emoji: '\u{1f604}', label: 'Cười' },
  { type: 'sad', emoji: '\u{1f622}', label: 'Buồn' },
  { type: 'like', emoji: '\u{1f44d}', label: 'Like' },
  { type: 'love', emoji: '\u2764\ufe0f', label: 'Tym' },
  { type: 'wow', emoji: '\u{1f62e}', label: 'Bất ngờ' },
  { type: 'cry', emoji: '\u{1f62d}', label: 'Khóc' },
  { type: 'angry', emoji: '\u{1f621}', label: 'Tức giận' },
] as const

const STICKER_PACKS: Record<string, string[]> = {
  Cute: ['đŸ¼', 'đŸ±', 'đŸ¶', 'đŸ¦', 'đŸµ', 'đŸ¸', 'đŸ¯', 'đŸ¦„'],
  Meme: ['đŸ¤£', 'đŸ« ', 'đŸ˜', 'đŸ˜µ', 'đŸ¤¯', 'đŸ¤¡', 'đŸ‘€', 'đŸ’€'],
  Animals: ['đŸ¨', 'đŸ»', 'đŸ¦', 'đŸ®', 'đŸ·', 'đŸ”', 'đŸ§', 'đŸ™'],
  Party: ['đŸ‰', 'đŸ¥³', 'đŸ', 'đŸ”¥', 'đŸ’¥', 'âœ¨', 'đŸ¾', 'đŸˆ'],
}

const getMessageReactionMeta = (reaction: string) =>
  MESSAGE_REACTIONS.find((item) => item.type === reaction) || MESSAGE_REACTIONS[2]

const getMessageReactionItems = (msg: ChatMessage) =>
  (msg.reactions || [])
    .map((item) => ({ ...item, meta: getMessageReactionMeta(item.reaction) }))
    .filter((item) => MESSAGE_REACTIONS.some((reaction) => reaction.type === item.reaction))

const VN_TIMEZONE = 'Asia/Ho_Chi_Minh'

const formatVietnamTime = (value: string) =>
  new Intl.DateTimeFormat('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: VN_TIMEZONE,
  }).format(parseChatDate(value))

const parseChatDate = (value: string) => {
  const base = new Date(value)
  if (Number.isNaN(base.getTime())) return new Date()
  return base
}

const getConversationDisplayName = (
  conversation: { type: 'direct' | 'group'; name: string | null; members: Array<{ userId: number; fullName: string }> },
  currentUserId?: number
) => {
  if (conversation.type === 'group') {
    return conversation.name || 'NhĂ³m chat'
  }
  const peer = conversation.members.find((member) => member.userId !== currentUserId)
  return peer?.fullName || conversation.name || 'Cuá»™c trĂ² chuyá»‡n'
}

const getGroupRoleLabel = (role: string | null | undefined) => {
  if (role === 'leader') return 'TrÆ°á»Ÿng nhĂ³m'
  if (role === 'deputy') return 'PhĂ³ nhĂ³m'
  return 'ThĂ nh viĂªn'
}

const getAvatarInitial = (value: string | null | undefined) => {
  const normalized = String(value || '').trim()
  return (normalized[0] || 'U').toUpperCase()
}

type ActiveCall = {
  type: 'voice' | 'video'
  withName: string
  startedAt: number
}

type MessageNotificationItem = {
  id: number
  type: string
  title: string
  body: string | null
  created_at: string
  is_read: number
  meta?: Record<string, unknown> | null
}

const resolveChatMediaUrl = (value: string | null | undefined) => {
  if (!value) return null
  if (/^https?:\/\//i.test(value) || value.startsWith('blob:') || value.startsWith('data:')) {
    return value
  }
  if (value.startsWith('/uploads/')) {
    return `/backend${value}`
  }
  return value
}

const normalizeIncomingMessage = (payload: ChatMessage): ChatMessage => ({
  ...payload,
  id: String(payload.id),
  conversationId: String(payload.conversationId),
  mediaUrl: resolveChatMediaUrl(payload.mediaUrl),
})

const normalizeIncomingMessageForViewer = (payload: ChatMessage, viewerUserId?: number): ChatMessage => {
  const normalized = normalizeIncomingMessage(payload)
  if (!viewerUserId || !normalized.reactions) return normalized
  return {
    ...normalized,
    viewerReaction:
      normalized.reactions.find((item) => Number(item.userId) === Number(viewerUserId))?.reaction || null,
  }
}

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    ...(import.meta.env.VITE_TURN_URL
      ? [
          {
            urls: import.meta.env.VITE_TURN_URL,
            username: import.meta.env.VITE_TURN_USERNAME,
            credential: import.meta.env.VITE_TURN_CREDENTIAL,
          },
        ]
      : []),
  ],
}

export default function MessagesPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const token = useAuthStore((state) => state.accessToken)
  const user = useAuthStore((state) => state.user)
  const {
    conversations,
    selectedConversationId,
    messagesByConversation,
    setConversations,
    selectConversation,
    setMessages,
    appendMessage,
    upsertMessage,
  } = useChatStore()
  const [message, setMessage] = useState('')
  const [callStatus, setCallStatus] = useState<string | null>(null)
  const [incomingCall, setIncomingCall] = useState<IncomingCallState | null>(null)
  const [activeCall, setActiveCall] = useState<ActiveCall | null>(null)
  const [joinedCallUserIds, setJoinedCallUserIds] = useState<number[]>([])
  const [callSeconds, setCallSeconds] = useState(0)
  const [busyUploading, setBusyUploading] = useState(false)
  const [busyActionId, setBusyActionId] = useState<string | null>(null)
  const [forwardingMessageId, setForwardingMessageId] = useState<string | null>(null)
  const [remoteStreams, setRemoteStreams] = useState<Array<{ userId: number; stream: MediaStream }>>([])
  const [actionMenu, setActionMenu] = useState<{ messageId: string; x: number; y: number } | null>(null)
  const [reactionPickerMessageId, setReactionPickerMessageId] = useState<string | null>(null)
  const [composerMenuOpen, setComposerMenuOpen] = useState(false)
  const [chatNotice, setChatNotice] = useState<string | null>(null)
  const [showEmojiPanel, setShowEmojiPanel] = useState(false)
  const [showStickerPanel, setShowStickerPanel] = useState(false)
  const [loadingOlderMessages, setLoadingOlderMessages] = useState(false)
  const [showNewMessageModal, setShowNewMessageModal] = useState(false)
  const [showNotificationsDrawer, setShowNotificationsDrawer] = useState(false)
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false)
  const [rightPanelSection, setRightPanelSection] = useState<'overview' | 'members' | 'manage'>('overview')
  const [groupName, setGroupName] = useState('')
  const [groupSearchKeyword, setGroupSearchKeyword] = useState('')
  const [groupMemberIds, setGroupMemberIds] = useState<number[]>([])
  const [creatingGroup, setCreatingGroup] = useState(false)
  const [groupActionBusyId, setGroupActionBusyId] = useState<string | null>(null)
  const [newMessageKeyword, setNewMessageKeyword] = useState('')
  const [searchUsersResult, setSearchUsersResult] = useState<Array<{ id: number; name: string }>>([])
  const [notifications, setNotifications] = useState<Array<{ id: number; type: string; title: string; body: string | null; created_at: string; is_read: number; meta?: Record<string, unknown> | null }>>([])
  const [activeStickerPack, setActiveStickerPack] = useState<keyof typeof STICKER_PACKS>('Cute')
  const [loadedStickerPacks, setLoadedStickerPacks] = useState<Record<string, boolean>>({ Cute: true })
  const [showJumpToLatest, setShowJumpToLatest] = useState(false)
  const [hasMoreHistory, setHasMoreHistory] = useState<Record<string, boolean>>({})
  const [messageLimitByConversation, setMessageLimitByConversation] = useState<
    Record<string, { total: number; sent: number; remaining: number; isFriend: boolean } | null>
  >({})
  const [friendMap, setFriendMap] = useState<Record<number, FriendConnection>>({})
  const [pendingFriendRequestTo, setPendingFriendRequestTo] = useState<Record<number, boolean>>({})
  const [creatingDirectConversation, setCreatingDirectConversation] = useState(false)
  const [mutedMic, setMutedMic] = useState(false)
  const [mutedCam, setMutedCam] = useState(false)
  const [callAnswered, setCallAnswered] = useState(false)
  const [ringingStartedAt, setRingingStartedAt] = useState<number | null>(null)
  const [isSendingMessage, setIsSendingMessage] = useState(false)
  const [typingUserIds, setTypingUserIds] = useState<Set<number>>(new Set())
  const typingTimeoutRef = useRef<number | null>(null)
  const sendingMessageRef = useRef(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const imageInputRef = useRef<HTMLInputElement | null>(null)
  const videoInputRef = useRef<HTMLInputElement | null>(null)
  const longPressTimer = useRef<number | null>(null)
  const localVideoRef = useRef<HTMLVideoElement | null>(null)
  const localStreamRef = useRef<MediaStream | null>(null)
  const peersRef = useRef<Map<number, RTCPeerConnection>>(new Map())
  const messagesWrapRef = useRef<HTMLDivElement | null>(null)
  const actionMenuRef = useRef<HTMLDivElement | null>(null)

  const VIRTUAL_CHUNK = 50
  const virtualSlice = useMemo(() => {
    if (!selectedConversationId) return { items: [], startIndex: 0, endIndex: 0 }
    const allMessages = messagesByConversation[selectedConversationId] || []
    if (allMessages.length <= VIRTUAL_CHUNK) {
      return { items: allMessages, startIndex: 0, endIndex: allMessages.length }
    }
    return {
      items: allMessages.slice(-VIRTUAL_CHUNK),
      startIndex: Math.max(0, allMessages.length - VIRTUAL_CHUNK),
      endIndex: allMessages.length,
    }
  }, [messagesByConversation, selectedConversationId])

  const selectedConversation = conversations.find((c) => c.id === selectedConversationId) || null
  const queryConversationId = searchParams.get('conversation') || ''
  const globalIncomingCall = useCallStore((state) => state.incomingCall)
  const setGlobalIncomingCall = useCallStore((state) => state.setIncomingCall)
  const openConversation = useCallback(
    (conversationId: string) => {
      selectConversation(conversationId)
      navigate(`/messages?conversation=${encodeURIComponent(conversationId)}`, { replace: true })
    },
    [navigate, selectConversation]
  )
  const parseNotificationMeta = useCallback((item: MessageNotificationItem) => {
    const rawMeta = item?.meta
    if (!rawMeta || typeof rawMeta !== 'object') return null
    const source = rawMeta as Record<string, unknown>
    const conversationId = source.conversationId ?? source.conversation_id ?? source.chatId ?? source.chat_id
    const requesterId = source.requesterId ?? source.requester_id ?? source.fromUserId ?? source.from_user_id
    const friendshipId = source.friendshipId ?? source.friendship_id
    return {
      conversationId: conversationId ? String(conversationId) : null,
      requesterId: requesterId ? Number(requesterId) : null,
      friendshipId: friendshipId ? Number(friendshipId) : null,
    }
  }, [])

  const reloadNotifications = useCallback(async () => {
    if (!token) return
    try {
      const result = await api.notifications(token)
      const items = (result.notifications || [])
        .filter((item) => item.type === 'missed-call' || item.type === 'message' || item.type === 'friend-request')
        .slice(0, 40)
      setNotifications(items)
    } catch {
      // Ignore transient notification reload issues.
    }
  }, [token])

  const reloadFriendMap = useCallback(async () => {
    if (!token || !user?.id) return
    try {
      const result = await api.listFriends(token)
      const map: Record<number, FriendConnection> = {}
      result.friends.forEach((friend) => {
        map[friend.id] = friend
      })
      setFriendMap(map)
    } catch (error) {
      console.error('KhĂ´ng thá»ƒ táº£i danh sĂ¡ch báº¡n bĂ¨', error)
    }
  }, [token, user?.id])

  useEffect(() => {
    if (!token) return

    const loadConversations = async () => {
      const response = await api.listConversations(token)
      setConversations(response.conversations)

      if (queryConversationId && response.conversations.some((item) => item.id === queryConversationId)) {
        selectConversation(queryConversationId)
      } else if (!selectedConversationId && response.conversations.length > 0) {
        selectConversation(response.conversations[0].id)
      }
    }

    loadConversations().catch(console.error)
  }, [queryConversationId, token, selectedConversationId, selectConversation, setConversations])

  useEffect(() => {
    if (!token || !selectedConversationId) return

    api
      .listMessages(token, selectedConversationId, { limit: 25 })
      .then((response) => {
        setMessages(selectedConversationId, response.messages)
        setHasMoreHistory((prev) => ({ ...prev, [selectedConversationId]: response.messages.length >= 25 }))
        setMessageLimitByConversation((prev) => ({
          ...prev,
          [selectedConversationId]: response.messageLimit || null,
        }))
      })
      .catch(console.error)
  }, [token, selectedConversationId, setMessages])

  useEffect(() => {
    reloadNotifications().catch(() => undefined)
  }, [reloadNotifications])

  useEffect(() => {
    if (!token || !newMessageKeyword.trim()) {
      setSearchUsersResult([])
      return
    }

    const timer = window.setTimeout(() => {
      api
        .searchUsers(token, newMessageKeyword.trim())
        .then((result) => {
          const users = (result.users || [])
            .map((item) => ({
              id: Number(item.id || 0),
              name: String(item.full_name || item.fullName || item.email || item.phone || ''),
            }))
            .filter((item) => item.id > 0)
          setSearchUsersResult(users)
        })
        .catch(() => setSearchUsersResult([]))
    }, 260)

    return () => window.clearTimeout(timer)
  }, [newMessageKeyword, token])

  useEffect(() => {
    if (!selectedConversationId) return
    setComposerMenuOpen(false)
    setShowEmojiPanel(false)
    setShowStickerPanel(false)
    setShowJumpToLatest(false)
    setReactionPickerMessageId(null)
  }, [selectedConversationId])

  useEffect(() => {
    if (!selectedConversationId || queryConversationId === selectedConversationId) return
    navigate(`/messages?conversation=${encodeURIComponent(selectedConversationId)}`, { replace: true })
  }, [navigate, queryConversationId, selectedConversationId])

  useEffect(() => {
    if (!token) return

    const socket = connectSocket(token, user?.id)
    socket.on('message:new', (payload: ChatMessage) => {
      const normalized = normalizeIncomingMessageForViewer(payload, user?.id)
      upsertMessage(normalized.conversationId, normalized)
    })

    socket.on('message:reaction', (payload: { conversationId: string; message: ChatMessage }) => {
      upsertMessage(String(payload.conversationId), normalizeIncomingMessageForViewer(payload.message, user?.id))
    })

    socket.on('message:updated', (payload: { conversationId: string; message: ChatMessage | null }) => {
      if (!payload?.message) return
      upsertMessage(String(payload.conversationId), normalizeIncomingMessageForViewer(payload.message, user?.id))
    })

    socket.on('message:typing', (payload: { conversationId: string; fromUserId: number; isTyping: boolean }) => {
      if (!payload) return
      setTypingUserIds((prev) => {
        const next = new Set(prev)
        if (payload.isTyping) {
          next.add(payload.fromUserId)
        } else {
          next.delete(payload.fromUserId)
        }
        return next
      })
    })

    socket.on('notification:new', (payload) => {
      if (!payload) return
      reloadNotifications().catch(() => undefined)
      if (payload.type === 'message') {
        api
          .listConversations(token)
          .then((response) => setConversations(response.conversations))
          .catch(() => undefined)
      }

      if (payload.type === 'friend-request' || payload.type === 'friend-accepted') {
        reloadFriendMap().catch(() => undefined)
      }
    })

    socket.on('call:offer', (payload) => {
      if (!payload.offer) return
      const incomingConversationId = payload.conversationId ? String(payload.conversationId) : null
      const incomingPayload: IncomingCallState = {
        fromUserId: Number(payload.fromUserId),
        callType: payload.callType || 'voice',
        conversationId: incomingConversationId,
        offer: payload.offer,
      }
      setIncomingCall(incomingPayload)
      setGlobalIncomingCall(incomingPayload)
      setCallStatus(`Cuá»™c gá»i ${payload.callType === 'video' ? 'video' : 'thoáº¡i'} Ä‘áº¿n`)
    })

    socket.on('call:answer', async (payload) => {
      const fromUserId = Number(payload.fromUserId || 0)
      const peer = peersRef.current.get(fromUserId)
      if (peer && payload.answer) {
        await peer.setRemoteDescription(new RTCSessionDescription(payload.answer))
      }
      const answeredAt = Number(payload?.answeredAt || 0) || Date.now()
      setCallAnswered(true)
      setRingingStartedAt(null)
      setCallSeconds(0)
      setActiveCall((prev) => (prev ? { ...prev, startedAt: answeredAt } : prev))
      setCallStatus('NgÆ°á»i nháº­n Ä‘Ă£ tham gia cuá»™c gá»i')
    })

    socket.on('call:join', (payload) => {
      const fromUserId = Number(payload?.fromUserId || 0)
      if (fromUserId > 0) {
        setJoinedCallUserIds((prev) => (prev.includes(fromUserId) ? prev : [...prev, fromUserId]))
      }
    })

    socket.on('call:leave', (payload) => {
      const fromUserId = Number(payload?.fromUserId || 0)
      if (fromUserId > 0) {
        setJoinedCallUserIds((prev) => prev.filter((id) => id !== fromUserId))
      }
    })

    socket.on('call:ice-candidate', async (payload) => {
      const fromUserId = Number(payload.fromUserId || 0)
      const peer = peersRef.current.get(fromUserId)
      if (!peer || !payload.candidate) return
      try {
        await peer.addIceCandidate(new RTCIceCandidate(payload.candidate))
      } catch (error) {
        console.error('Failed to add ICE candidate', error)
      }
    })

    socket.on('call:end', (payload) => {
      const endedByUserId = Number(payload?.fromUserId || 0)

      if (endedByUserId > 0 && activeCall) {
        const peer = peersRef.current.get(endedByUserId)
        if (peer) {
          peer.close()
          peersRef.current.delete(endedByUserId)
        }

        setRemoteStreams((prev) => prev.filter((item) => item.userId !== endedByUserId))

        const nextJoined = joinedCallUserIds.filter((id) => id !== endedByUserId)
        setJoinedCallUserIds(nextJoined)

        const myId = Number(user?.id || 0)
        const remainingOthers = nextJoined.filter((id) => id !== myId)

        if (remainingOthers.length === 0) {
          localStreamRef.current?.getTracks().forEach((track) => track.stop())
          localStreamRef.current = null
          setRemoteStreams([])
          setJoinedCallUserIds([])
          setActiveCall(null)
          setCallSeconds(0)
          setCallAnswered(false)
          setRingingStartedAt(null)
          setCallStatus('Má»i ngÆ°á»i Ä‘Ă£ rá»i cuá»™c gá»i')
        } else {
          setCallStatus('Má»™t ngÆ°á»i Ä‘Ă£ rá»i cuá»™c gá»i')
        }
        return
      }

      setCallStatus('Cuá»™c gá»i Ä‘Ă£ káº¿t thĂºc')
      setIncomingCall(null)
      setGlobalIncomingCall(null)
      peersRef.current.forEach((peer) => peer.close())
      peersRef.current.clear()
      localStreamRef.current?.getTracks().forEach((track) => track.stop())
      localStreamRef.current = null
      setRemoteStreams([])
      setJoinedCallUserIds([])
      setActiveCall(null)
      setCallSeconds(0)
      setCallAnswered(false)
      setRingingStartedAt(null)
    })

    socket.on('call:participants', (payload) => {
      // Update participant display for group calls
      if (payload?.participantIds) {
        setJoinedCallUserIds(payload.participantIds)
        setCallStatus(`Cuá»™c gá»i Ä‘ang cĂ³ ${payload.participantCount} ngÆ°á»i tham gia`)
      }
    })

    return () => {
      socket.off('message:new')
      socket.off('message:reaction')
      socket.off('message:updated')
      socket.off('message:typing')
      socket.off('notification:new')
      socket.off('call:offer')
      socket.off('call:answer')
      socket.off('call:join')
      socket.off('call:leave')
      socket.off('call:ice-candidate')
      socket.off('call:end')
      socket.off('call:participants')
    }
  }, [activeCall, joinedCallUserIds, reloadFriendMap, reloadNotifications, setConversations, setGlobalIncomingCall, token, upsertMessage, user?.id])

  useEffect(() => {
    if (!globalIncomingCall || incomingCall) return
    setIncomingCall(globalIncomingCall)
    setCallStatus(`Cuá»™c gá»i ${globalIncomingCall.callType === 'video' ? 'video' : 'thoáº¡i'} Ä‘áº¿n`)
  }, [globalIncomingCall, incomingCall])

  useEffect(() => {
    if (!selectedConversationId) return
    const socket = getSocket()
    if (!socket) return

    socket.emit('join-conversation', selectedConversationId)
    return () => {
      socket.emit('leave-conversation', selectedConversationId)
    }
  }, [selectedConversationId])

  useEffect(() => {
    if (!actionMenu || !actionMenuRef.current) return
    actionMenuRef.current.style.left = `${actionMenu.x}px`
    actionMenuRef.current.style.top = `${actionMenu.y}px`
  }, [actionMenu])

  useEffect(() => {
    if (!chatNotice) return
    const timer = window.setTimeout(() => {
      setChatNotice(null)
    }, 3000)
    return () => window.clearTimeout(timer)
  }, [chatNotice])

  useEffect(() => {
    if (!callStatus || incomingCall || activeCall) return
    const timer = window.setTimeout(() => {
      setCallStatus(null)
    }, 3000)
    return () => window.clearTimeout(timer)
  }, [callStatus, incomingCall, activeCall])

  useEffect(() => {
    if (!activeCall || !callAnswered) return
    setCallSeconds(Math.floor((Date.now() - activeCall.startedAt) / 1000))
    const timer = window.setInterval(() => {
      setCallSeconds(Math.floor((Date.now() - activeCall.startedAt) / 1000))
    }, 1000)

    return () => {
      window.clearInterval(timer)
    }
  }, [activeCall, callAnswered])

  const messages = useMemo(
    () => (selectedConversationId ? messagesByConversation[selectedConversationId] || [] : []),
    [messagesByConversation, selectedConversationId]
  )

  const activeActionMessage = useMemo(
    () => (actionMenu ? messages.find((msg) => msg.id === actionMenu.messageId) || null : null),
    [actionMenu, messages]
  )

  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    reloadFriendMap().catch(() => undefined)
  }, [reloadFriendMap])

  const filteredConversations = useMemo(() => {
    const q = searchTerm.trim().toLowerCase()
    if (!q) return conversations
    return conversations.filter((conversation) =>
      getConversationDisplayName(conversation, user?.id).toLowerCase().includes(q)
    )
  }, [conversations, searchTerm, user?.id])

  const callTargetId = useMemo(() => {
    if (!selectedConversation || !user?.id) return null
    const directTarget = selectedConversation.members.find((m) => m.userId !== user.id)
    return directTarget?.userId || null
  }, [selectedConversation, user?.id])

  const callTargets = useMemo(() => {
    if (!selectedConversation || !user?.id) return []
    return selectedConversation.members.map((m) => m.userId).filter((id) => id !== user.id)
  }, [selectedConversation, user?.id])

  useEffect(() => {
    if (!activeCall || callAnswered || !ringingStartedAt) return

    const timeoutMs = 60_000 - (Date.now() - ringingStartedAt)
    const conversationId = selectedConversationId
    const targets = [...callTargets]

    const autoEnd = () => {
      const socket = getSocket()
      if (socket && conversationId) {
        targets.forEach((targetUserId) => {
          socket.emit('call:end', {
            targetUserId,
            conversationId,
          })
        })
      }
      closeCallResources()
      setCallStatus('KhĂ´ng cĂ³ pháº£n há»“i sau 1 phĂºt. Cuá»™c gá»i Ä‘Ă£ tá»± káº¿t thĂºc.')
      setIncomingCall(null)
      setActiveCall(null)
      setCallSeconds(0)
      setCallAnswered(false)
      setRingingStartedAt(null)
    }

    if (timeoutMs <= 0) {
      autoEnd()
      return
    }

    const timer = window.setTimeout(autoEnd, timeoutMs)
    return () => window.clearTimeout(timer)
  }, [activeCall, callAnswered, callTargets, ringingStartedAt, selectedConversationId])

  const directPeer = useMemo(() => {
    if (!selectedConversation || !user?.id) return null
    if (selectedConversation.type !== 'direct') return null
    const member = selectedConversation.members.find((m) => m.userId !== user.id)
    if (!member) return null
    return {
      id: member.userId,
      name: member.fullName,
    }
  }, [selectedConversation, user?.id])

  const selectedGroup = useMemo(() => {
    if (!selectedConversation || selectedConversation.type !== 'group') return null
    return selectedConversation
  }, [selectedConversation])

  const myGroupMember = useMemo(() => {
    if (!selectedGroup || !user?.id) return null
    return selectedGroup.members.find((item) => item.userId === user.id) || null
  }, [selectedGroup, user?.id])

  const myGroupRole = myGroupMember?.role || 'member'
  const canRemoveMembers = Boolean(selectedGroup && (myGroupRole === 'leader' || myGroupRole === 'deputy'))
  const canManageRoles = Boolean(selectedGroup && myGroupRole === 'leader')
  const canDissolveSelectedGroup = Boolean(selectedGroup && myGroupRole === 'leader')
  const canAddMembers = canRemoveMembers

  const groupLeader = useMemo(() => {
    if (!selectedGroup) return null
    const currentLeader = selectedGroup.members.find((member) => member.role === 'leader')
    if (currentLeader) return currentLeader
    return selectedGroup.members.find((member) => Number(member.userId) === Number(selectedGroup.createdBy)) || selectedGroup.members[0] || null
  }, [selectedGroup])

  const groupDeputy = useMemo(() => {
    if (!selectedGroup) return null
    return selectedGroup.members.find((member) => member.role === 'deputy') || null
  }, [selectedGroup])

  const canLeaveGroup = Boolean(selectedGroup && myGroupMember)
  const canLeaderLeaveGroup = myGroupRole !== 'leader' || Boolean(groupDeputy && Number(groupDeputy.userId) !== Number(user?.id))

  const groupInviteCandidates = useMemo(() => {
    if (!selectedGroup) return []
    const existingIds = new Set(selectedGroup.members.map((member) => member.userId))
    return Object.values(friendMap)
      .filter((friend) => friend.status === 'accepted')
      .filter((friend) => !existingIds.has(friend.id))
  }, [friendMap, selectedGroup])

  const createGroupInviteCandidates = useMemo(
    () => Object.values(friendMap).filter((friend) => friend.status === 'accepted'),
    [friendMap]
  )

  const filteredGroupInviteCandidates = useMemo(() => {
    const q = groupSearchKeyword.trim().toLowerCase()
    if (!q) return groupInviteCandidates
    return groupInviteCandidates.filter((friend) =>
      [friend.fullName, friend.email || '', friend.phone || '', String(friend.id)].join(' ').toLowerCase().includes(q)
    )
  }, [groupInviteCandidates, groupSearchKeyword])

  const filteredCreateGroupInviteCandidates = useMemo(() => {
    const q = groupSearchKeyword.trim().toLowerCase()
    if (!q) return createGroupInviteCandidates
    return createGroupInviteCandidates.filter((friend) =>
      [friend.fullName, friend.email || '', friend.phone || '', String(friend.id)].join(' ').toLowerCase().includes(q)
    )
  }, [createGroupInviteCandidates, groupSearchKeyword])

  const pinnedMessageIds = useMemo(() => new Set((selectedConversation?.pinnedMessageIds || []).map((item) => String(item))), [selectedConversation])

  const directPeerFriendship = directPeer ? friendMap[directPeer.id] : null
  const isDirectPeerFriend = Boolean(directPeerFriendship && directPeerFriendship.status === 'accepted')
  const isDirectPeerPending = Boolean(directPeerFriendship && directPeerFriendship.status === 'pending')
  const isDirectPeerRequestedByMe = Boolean(directPeerFriendship?.requestedByMe)

  useEffect(() => {
    setRightPanelSection('overview')
  }, [selectedConversationId])

  const ensureLocalStream = async (callType: 'voice' | 'video') => {
    if (localStreamRef.current) return localStreamRef.current
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: callType === 'video',
    })
    localStreamRef.current = stream
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = stream
    }
    return stream
  }

  const buildPeerConnection = async (targetUserId: number, callType: 'voice' | 'video') => {
    const socket = getSocket()
    if (!socket || !selectedConversationId) return null

    const pc = new RTCPeerConnection(RTC_CONFIG)
    const localStream = await ensureLocalStream(callType)

    localStream.getTracks().forEach((track) => {
      pc.addTrack(track, localStream)
    })

    pc.ontrack = (event) => {
      const [stream] = event.streams
      if (!stream) return
      setJoinedCallUserIds((prev) => (prev.includes(targetUserId) ? prev : [...prev, targetUserId]))
      setRemoteStreams((prev) => {
        const found = prev.find((item) => item.userId === targetUserId)
        if (found) {
          return prev.map((item) => (item.userId === targetUserId ? { userId: targetUserId, stream } : item))
        }
        return [...prev, { userId: targetUserId, stream }]
      })
    }

    pc.onicecandidate = (event) => {
      if (!event.candidate) return
      socket.emit('call:ice-candidate', {
        targetUserId,
        conversationId: selectedConversationId,
        candidate: event.candidate,
      })
    }

    peersRef.current.set(targetUserId, pc)
    return pc
  }

  const closeCallResources = () => {
    peersRef.current.forEach((peer) => peer.close())
    peersRef.current.clear()
    localStreamRef.current?.getTracks().forEach((track) => track.stop())
    localStreamRef.current = null
    setRemoteStreams([])
    setJoinedCallUserIds([])
    setMutedCam(false)
    setMutedMic(false)
  }

  const handleRequestFriend = async () => {
    if (!token || !directPeer) return
    setPendingFriendRequestTo((prev) => ({ ...prev, [directPeer.id]: true }))
    try {
      await api.requestFriend(token, directPeer.id)
      setChatNotice('ÄĂ£ gá»­i lá»i má»i káº¿t báº¡n. HĂ£y chá» Ä‘á»‘i phÆ°Æ¡ng cháº¥p nháº­n Ä‘á»ƒ nháº¯n khĂ´ng giá»›i háº¡n.')
      await reloadFriendMap()
    } catch (error) {
      if (error instanceof Error) {
        setChatNotice(error.message)
      } else {
        setChatNotice('KhĂ´ng thá»ƒ gá»­i lá»i má»i káº¿t báº¡n.')
      }
    } finally {
      setPendingFriendRequestTo((prev) => ({ ...prev, [directPeer.id]: false }))
    }
  }

  const handleCancelFriendRequest = async () => {
    if (!token || !directPeer) return
    setPendingFriendRequestTo((prev) => ({ ...prev, [directPeer.id]: true }))
    try {
      await api.deleteFriend(token, directPeer.id)
      await reloadFriendMap()
      setChatNotice('ÄĂ£ há»§y lá»i má»i káº¿t báº¡n.')
    } catch (error) {
      if (error instanceof Error) {
        setChatNotice(error.message)
      } else {
        setChatNotice('KhĂ´ng thá»ƒ há»§y lá»i má»i káº¿t báº¡n.')
      }
    } finally {
      setPendingFriendRequestTo((prev) => ({ ...prev, [directPeer.id]: false }))
    }
  }

  const handleAcceptFriendRequestDirect = async () => {
    if (!token || !directPeer) return
    setPendingFriendRequestTo((prev) => ({ ...prev, [directPeer.id]: true }))
    try {
      await api.acceptFriend(token, directPeer.id)
      await reloadFriendMap()
      setChatNotice('ÄĂ£ cháº¥p nháº­n lá»i má»i káº¿t báº¡n.')
    } catch (error) {
      if (error instanceof Error) {
        setChatNotice(error.message)
      } else {
        setChatNotice('KhĂ´ng thá»ƒ cháº¥p nháº­n lá»i má»i káº¿t báº¡n.')
      }
    } finally {
      setPendingFriendRequestTo((prev) => ({ ...prev, [directPeer.id]: false }))
    }
  }

  const handleOpenOrCreateDirectConversation = async (targetUserId: number) => {
    if (!token) return

    const existing = conversations.find(
      (conv) => conv.type === 'direct' && conv.members.some((m) => m.userId === targetUserId)
    )
    if (existing) {
      openConversation(existing.id)
      return
    }

    setCreatingDirectConversation(true)
    try {
      const result = await api.createDirectConversation(token, targetUserId)
      const refreshed = await api.listConversations(token)
      setConversations(refreshed.conversations)
      openConversation(result.conversation.id)
      setChatNotice('ÄĂ£ má»Ÿ cuá»™c trĂ² chuyá»‡n trá»±c tiáº¿p.')
    } catch (error) {
      if (error instanceof Error) {
        setChatNotice(error.message)
      } else {
        setChatNotice('KhĂ´ng thá»ƒ má»Ÿ cuá»™c trĂ² chuyá»‡n.')
      }
    } finally {
      setCreatingDirectConversation(false)
    }
  }

  const handlePickAttachmentType = (type: 'image' | 'video' | 'file') => {
    if (!selectedConversationId) {
      setChatNotice('Vui lĂ²ng chá»n cuá»™c trĂ² chuyá»‡n trÆ°á»›c khi gá»­i tá»‡p.')
      setComposerMenuOpen(false)
      return
    }

    setComposerMenuOpen(false)
    if (type === 'image') {
      imageInputRef.current?.click()
      return
    }
    if (type === 'video') {
      videoInputRef.current?.click()
      return
    }
    fileInputRef.current?.click()
  }

  const handleCreateConversationWithUser = async (targetUserId: number) => {
    if (!token) return
    try {
      const created = await api.createDirectConversation(token, targetUserId)
      const refreshed = await api.listConversations(token)
      setConversations(refreshed.conversations)
      openConversation(created.conversation.id)
      setShowNewMessageModal(false)
      setNewMessageKeyword('')
      setSearchUsersResult([])
    } catch (error) {
      if (error instanceof Error) {
        setChatNotice(error.message)
      }
    }
  }

  const handleOpenNotificationConversation = (conversationId: string | null | undefined) => {
    if (!conversationId) return
    openConversation(String(conversationId))
    setShowNotificationsDrawer(false)
  }

  const handleAcceptFromNotification = async (item: MessageNotificationItem) => {
    if (!token) return
    const meta = parseNotificationMeta(item)
    const identifier = meta?.requesterId || meta?.friendshipId
    if (!identifier) return
    setBusyActionId(`notif-${item.id}`)
    try {
      await api.acceptFriend(token, identifier)
      await reloadFriendMap()
      await reloadNotifications()
      setChatNotice('ÄĂ£ cháº¥p nháº­n lá»i má»i káº¿t báº¡n.')
      if (meta?.conversationId) {
        handleOpenNotificationConversation(meta.conversationId)
      }
    } catch (error) {
      if (error instanceof Error) {
        setChatNotice(error.message)
      } else {
        setChatNotice('KhĂ´ng thá»ƒ cháº¥p nháº­n lá»i má»i tá»« thĂ´ng bĂ¡o.')
      }
    } finally {
      setBusyActionId(null)
    }
  }

  const acceptedFriends = useMemo(
    () => Object.values(friendMap).filter((friend) => friend.status === 'accepted'),
    [friendMap]
  )

  const toggleGroupMember = (friendId: number) => {
    setGroupMemberIds((prev) =>
      prev.includes(friendId) ? prev.filter((id) => id !== friendId) : [...prev, friendId]
    )
  }

  const refreshConversations = useCallback(async () => {
    if (!token) return
    const refreshed = await api.listConversations(token)
    setConversations(refreshed.conversations)
  }, [token, setConversations])

  const handleCreateGroupConversation = async () => {
    if (!token || !groupName.trim() || groupMemberIds.length === 0 || creatingGroup) return

    setCreatingGroup(true)
    try {
      const created = await api.createGroupConversation(token, {
        name: groupName.trim(),
        memberIds: groupMemberIds,
      })
      await refreshConversations()
      openConversation(created.conversation.id)
      setShowCreateGroupModal(false)
      setGroupName('')
      setGroupSearchKeyword('')
      setGroupMemberIds([])
      setChatNotice('ÄĂ£ táº¡o nhĂ³m chat thĂ nh cĂ´ng.')
    } catch (error) {
      if (error instanceof Error) {
        setChatNotice(error.message)
      } else {
        setChatNotice('KhĂ´ng thá»ƒ táº¡o nhĂ³m chat.')
      }
    } finally {
      setCreatingGroup(false)
    }
  }

  const handleAddMemberToGroup = async (targetUserId: number) => {
    if (!token || !selectedGroup || !canAddMembers) return
    setGroupActionBusyId(`add-${targetUserId}`)
    try {
      await api.addGroupMember(token, selectedGroup.id, targetUserId)
      await refreshConversations()
      setChatNotice('ÄĂ£ thĂªm thĂ nh viĂªn vĂ o nhĂ³m.')
    } catch (error) {
      if (error instanceof Error) {
        setChatNotice(error.message)
      } else {
        setChatNotice('KhĂ´ng thá»ƒ thĂªm thĂ nh viĂªn.')
      }
    } finally {
      setGroupActionBusyId(null)
    }
  }

  const handleRemoveMemberFromGroup = async (targetUserId: number) => {
    if (!token || !selectedGroup || !canRemoveMembers) return
    setGroupActionBusyId(`remove-${targetUserId}`)
    try {
      await api.removeGroupMember(token, selectedGroup.id, targetUserId)
      await refreshConversations()
      setChatNotice('ÄĂ£ xĂ³a thĂ nh viĂªn khá»i nhĂ³m.')
    } catch (error) {
      if (error instanceof Error) {
        setChatNotice(error.message)
      } else {
        setChatNotice('KhĂ´ng thá»ƒ xĂ³a thĂ nh viĂªn.')
      }
    } finally {
      setGroupActionBusyId(null)
    }
  }

  const handleSetDeputyRole = async (targetUserId: number | null) => {
    if (!token || !selectedGroup || !canManageRoles) return
    setGroupActionBusyId(`deputy-${targetUserId ?? 'none'}`)
    try {
      await api.setGroupDeputy(token, selectedGroup.id, targetUserId)
      await refreshConversations()
      setChatNotice(targetUserId ? 'ÄĂ£ cáº¥p quyá»n phĂ³ nhĂ³m.' : 'ÄĂ£ thu há»“i quyá»n phĂ³ nhĂ³m.')
    } catch (error) {
      if (error instanceof Error) {
        setChatNotice(error.message)
      } else {
        setChatNotice('KhĂ´ng thá»ƒ cáº­p nháº­t phĂ³ nhĂ³m.')
      }
    } finally {
      setGroupActionBusyId(null)
    }
  }

  const handleTransferLeader = async (targetUserId: number) => {
    if (!token || !selectedGroup || !canManageRoles) return
    setGroupActionBusyId(`role-${targetUserId}`)
    try {
      await api.transferGroupLeader(token, selectedGroup.id, targetUserId)
      await refreshConversations()
      setChatNotice('ÄĂ£ chuyá»ƒn quyá»n trÆ°á»Ÿng nhĂ³m.')
    } catch (error) {
      if (error instanceof Error) {
        setChatNotice(error.message)
      } else {
        setChatNotice('KhĂ´ng thá»ƒ chuyá»ƒn quyá»n trÆ°á»Ÿng nhĂ³m.')
      }
    } finally {
      setGroupActionBusyId(null)
    }
  }

  const handleDissolveGroup = async () => {
    if (!token || !selectedGroup || !canDissolveSelectedGroup) return
    const confirmed = window.confirm('Báº¡n cháº¯c cháº¯n muá»‘n giáº£i tĂ¡n nhĂ³m nĂ y? HĂ nh Ä‘á»™ng nĂ y khĂ´ng thá»ƒ hoĂ n tĂ¡c.')
    if (!confirmed) return
    setGroupActionBusyId('dissolve-group')
    try {
      await api.dissolveGroupConversation(token, selectedGroup.id)
      await refreshConversations()
      setChatNotice('ÄĂ£ giáº£i tĂ¡n nhĂ³m chat.')
      const fallback = conversations.find((item) => item.id !== selectedGroup.id)
      if (fallback) {
        openConversation(fallback.id)
      }
    } catch (error) {
      if (error instanceof Error) {
        setChatNotice(error.message)
      } else {
        setChatNotice('KhĂ´ng thá»ƒ giáº£i tĂ¡n nhĂ³m.')
      }
    } finally {
      setGroupActionBusyId(null)
    }
  }

  const handleLeaveGroup = async () => {
    if (!token || !selectedGroup || !canLeaveGroup) return
    if (myGroupRole === 'leader' && !canLeaderLeaveGroup) {
      setChatNotice('Báº¡n Ä‘ang lĂ  trÆ°á»Ÿng nhĂ³m. HĂ£y chá»‰ Ä‘á»‹nh phĂ³ nhĂ³m trÆ°á»›c khi rá»i nhĂ³m.')
      setRightPanelSection('manage')
      return
    }

    const confirmed = window.confirm('Báº¡n cĂ³ cháº¯c muá»‘n rá»i nhĂ³m nĂ y khĂ´ng?')
    if (!confirmed) return

    setGroupActionBusyId('leave-group')
    try {
      await api.leaveGroupConversation(token, selectedGroup.id)
      await refreshConversations()
      setChatNotice(
        myGroupRole === 'leader'
          ? 'Báº¡n Ä‘Ă£ rá»i nhĂ³m. Quyá»n trÆ°á»Ÿng nhĂ³m Ä‘Ă£ tá»± Ä‘á»™ng chuyá»ƒn cho phĂ³ nhĂ³m.'
          : 'Báº¡n Ä‘Ă£ rá»i nhĂ³m chat.'
      )

      const fallback = conversations.find((item) => item.id !== selectedGroup.id)
      if (fallback) {
        openConversation(fallback.id)
      } else {
        const refreshed = await api.listConversations(token)
        if (refreshed.conversations.length > 0) {
          openConversation(refreshed.conversations[0].id)
        }
      }
    } catch (error) {
      if (error instanceof Error) {
        setChatNotice(error.message)
      } else {
        setChatNotice('KhĂ´ng thá»ƒ rá»i nhĂ³m lĂºc nĂ y.')
      }
    } finally {
      setGroupActionBusyId(null)
    }
  }

  const loadOlderMessages = async () => {
    if (!token || !selectedConversationId || loadingOlderMessages) return
    if (!hasMoreHistory[selectedConversationId]) return

    const currentMessages = messagesByConversation[selectedConversationId] || []
    if (currentMessages.length === 0) return
    const beforeId = currentMessages[0]?.id
    if (!beforeId) return

    setLoadingOlderMessages(true)
    const previousScrollHeight = messagesWrapRef.current?.scrollHeight || 0

    try {
      const response = await api.listMessages(token, selectedConversationId, {
        limit: 20,
        beforeId,
      })

      if (response.messages.length === 0) {
        setHasMoreHistory((prev) => ({ ...prev, [selectedConversationId]: false }))
        return
      }

      const merged = [...response.messages, ...currentMessages]
      setMessages(selectedConversationId, merged)
      setHasMoreHistory((prev) => ({ ...prev, [selectedConversationId]: response.messages.length >= 20 }))
      setMessageLimitByConversation((prev) => ({
        ...prev,
        [selectedConversationId]: response.messageLimit || prev[selectedConversationId] || null,
      }))

      requestAnimationFrame(() => {
        if (!messagesWrapRef.current) return
        const newScrollHeight = messagesWrapRef.current.scrollHeight
        messagesWrapRef.current.scrollTop = newScrollHeight - previousScrollHeight
      })
    } catch (error) {
      console.error('KhĂ´ng thá»ƒ táº£i tin nháº¯n cÅ© hÆ¡n', error)
    } finally {
      setLoadingOlderMessages(false)
    }
  }

  const handleSend = async () => {
    if (!message.trim() || !token || !selectedConversationId || sendingMessageRef.current) return

    sendingMessageRef.current = true
    setIsSendingMessage(true)
    try {
      const response = await api.sendMessage(token, selectedConversationId, message)
      upsertMessage(selectedConversationId, response.message)
      setMessage('')
      setChatNotice(null)
      setShowEmojiPanel(false)
      setShowStickerPanel(false)

      setMessageLimitByConversation((prev) => {
        const current = prev[selectedConversationId]
        if (!current) return prev
        return {
          ...prev,
          [selectedConversationId]: {
            ...current,
            sent: current.sent + 1,
            remaining: Math.max(0, current.remaining - 1),
          },
        }
      })
    } catch (error) {
      if (error instanceof ApiError && error.code === 'MESSAGE_LIMIT_NON_FRIEND') {
        setChatNotice('Báº¡n chá»‰ gá»­i Ä‘Æ°á»£c tá»‘i Ä‘a 3 tin nháº¯n khi chÆ°a káº¿t báº¡n. HĂ£y káº¿t báº¡n Ä‘á»ƒ tiáº¿p tá»¥c.')
      } else if (error instanceof Error) {
        setChatNotice(error.message)
      } else {
        setChatNotice('KhĂ´ng thá»ƒ gá»­i tin nháº¯n.')
      }
      console.error('Failed to send message:', error)
    } finally {
      sendingMessageRef.current = false
      setIsSendingMessage(false)
    }
  }

  const fileToBase64 = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => {
        const result = typeof reader.result === 'string' ? reader.result : ''
        const base64 = result.includes(',') ? result.split(',')[1] : result
        resolve(base64)
      }
      reader.onerror = () => reject(new Error('KhĂ´ng thá»ƒ Ä‘á»c file'))
      reader.readAsDataURL(file)
    })

  const mapTypeFromFile = (file: File): 'image' | 'video' | 'audio' | 'file' => {
    if (file.type.startsWith('image/')) return 'image'
    if (file.type.startsWith('video/')) return 'video'
    if (file.type.startsWith('audio/')) return 'audio'
    return 'file'
  }

  const handlePickAttachment = () => {
    if (!selectedConversationId) {
      setChatNotice('Vui lĂ²ng chá»n cuá»™c trĂ² chuyá»‡n trÆ°á»›c khi gá»­i tá»‡p.')
      return
    }
    setComposerMenuOpen((prev) => !prev)
  }

  const handleFileSelected = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file || !token || !selectedConversationId) return

    const maxBytes = 12 * 1024 * 1024
    if (file.size > maxBytes) {
      setChatNotice('Tá»‡p quĂ¡ lá»›n. Vui lĂ²ng chá»n tá»‡p nhá» hÆ¡n 12MB.')
      event.target.value = ''
      return
    }

    setBusyUploading(true)
    setChatNotice(null)
    try {
      const base64Data = await fileToBase64(file)
      const upload = await api.uploadMessageBase64(token, selectedConversationId, {
        fileName: file.name,
        contentType: file.type || 'application/octet-stream',
        base64Data,
      })

      if (!upload.mediaUrl) {
        throw new Error('Táº£i tá»‡p lĂªn tháº¥t báº¡i, khĂ´ng nháº­n Ä‘Æ°á»£c Ä‘Æ°á»ng dáº«n file.')
      }

      const response = await api.sendMessagePayload(token, selectedConversationId, {
        type: mapTypeFromFile(file),
        mediaUrl: upload.mediaUrl,
        fileName: file.name,
        mimeType: file.type || 'application/octet-stream',
        fileSize: file.size,
      })
      upsertMessage(selectedConversationId, response.message)
      setChatNotice('ÄĂ£ gá»­i tá»‡p thĂ nh cĂ´ng.')
      setMessageLimitByConversation((prev) => {
        const current = prev[selectedConversationId]
        if (!current) return prev
        return {
          ...prev,
          [selectedConversationId]: {
            ...current,
            sent: current.sent + 1,
            remaining: Math.max(0, current.remaining - 1),
          },
        }
      })
    } catch (error) {
      if (error instanceof ApiError && error.code === 'MESSAGE_LIMIT_NON_FRIEND') {
        setChatNotice('Báº¡n chá»‰ gá»­i Ä‘Æ°á»£c tá»‘i Ä‘a 3 tin nháº¯n khi chÆ°a káº¿t báº¡n. HĂ£y káº¿t báº¡n Ä‘á»ƒ tiáº¿p tá»¥c.')
      } else if (error instanceof Error) {
        setChatNotice(error.message)
      } else {
        setChatNotice('KhĂ´ng thá»ƒ gá»­i file Ä‘Ă­nh kĂ¨m.')
      }
      console.error('KhĂ´ng thá»ƒ gá»­i file Ä‘Ă­nh kĂ¨m:', error)
    } finally {
      setBusyUploading(false)
      event.target.value = ''
    }
  }

  const handleReaction = async (chatMessage: ChatMessage, reaction: string) => {
    if (!token) return
    setBusyActionId(chatMessage.id)
    try {
      let response: { chatMessage: ChatMessage }
      if (chatMessage.viewerReaction === reaction) {
        response = await api.removeMessageReaction(token, chatMessage.id)
      } else {
        response = await api.reactMessage(token, chatMessage.id, reaction)
      }
      upsertMessage(chatMessage.conversationId, response.chatMessage)
    } catch (error) {
      console.error('KhĂ´ng thá»ƒ cáº­p nháº­t cáº£m xĂºc:', error)
      setChatNotice('KhĂ´ng thá»ƒ cáº­p nháº­t cáº£m xĂºc cho tin nháº¯n nĂ y.')
    } finally {
      setBusyActionId(null)
    }
  }

  const handleRecall = async (chatMessage: ChatMessage) => {
    if (!token || chatMessage.senderId !== user?.id) return
    setBusyActionId(chatMessage.id)
    try {
      const response = await api.recallMessage(token, chatMessage.id)
      upsertMessage(chatMessage.conversationId, response.chatMessage)
    } catch (error) {
      console.error('KhĂ´ng thá»ƒ thu há»“i tin nháº¯n:', error)
      setChatNotice('KhĂ´ng thá»ƒ thu há»“i tin nháº¯n nĂ y.')
    } finally {
      setBusyActionId(null)
    }
  }

  const handleForward = async (targetConversationId: string) => {
    if (!token || !forwardingMessageId) return
    setBusyActionId(forwardingMessageId)
    try {
      const response = await api.forwardMessage(token, forwardingMessageId, targetConversationId)
      if (selectedConversationId === targetConversationId) {
        upsertMessage(targetConversationId, response.chatMessage)
      }
      setForwardingMessageId(null)
      setChatNotice('ÄĂ£ chuyá»ƒn tiáº¿p tin nháº¯n thĂ nh cĂ´ng.')
      api.listConversations(token).then((res) => setConversations(res.conversations)).catch(() => undefined)
    } catch (error) {
      console.error('KhĂ´ng thá»ƒ chuyá»ƒn tiáº¿p tin nháº¯n:', error)
      if (error instanceof Error) {
        setChatNotice(error.message)
      } else {
        setChatNotice('KhĂ´ng thá»ƒ chuyá»ƒn tiáº¿p tin nháº¯n.')
      }
    } finally {
      setBusyActionId(null)
    }
  }

  const handleDeleteMessage = async (chatMessage: ChatMessage) => {
    if (!token) return
    setBusyActionId(chatMessage.id)
    try {
      await api.deleteMessage(token, chatMessage.id)
      if (!selectedConversationId) return
      const current = messagesByConversation[selectedConversationId] || []
      setMessages(
        selectedConversationId,
        current.filter((item) => item.id !== chatMessage.id),
      )
      setChatNotice('ÄĂ£ xĂ³a tin nháº¯n.')
    } catch (error) {
      console.error('KhĂ´ng thá»ƒ xĂ³a tin nháº¯n:', error)
      if (error instanceof Error) {
        setChatNotice(error.message)
      } else {
        setChatNotice('KhĂ´ng thá»ƒ xĂ³a tin nháº¯n nĂ y.')
      }
    } finally {
      setBusyActionId(null)
    }
  }

  const handleTogglePinMessage = async (chatMessage: ChatMessage) => {
    if (!token) return
    const wasPinned = pinnedMessageIds.has(chatMessage.id)
    setBusyActionId(chatMessage.id)
    try {
      if (wasPinned) {
        await api.unpinMessage(token, chatMessage.id)
      } else {
        await api.pinMessage(token, chatMessage.id)
      }
      const refreshed = await api.listConversations(token)
      setConversations(refreshed.conversations)
      setChatNotice(wasPinned ? 'ÄĂ£ bá» ghim tin nháº¯n.' : 'ÄĂ£ ghim tin nháº¯n.')
    } catch (error) {
      console.error('KhĂ´ng thá»ƒ ghim/bá» ghim tin nháº¯n:', error)
      if (error instanceof Error) {
        setChatNotice(error.message)
      } else {
        setChatNotice('KhĂ´ng thá»ƒ ghim/bá» ghim tin nháº¯n.')
      }
    } finally {
      setBusyActionId(null)
    }
  }

  const handleClearChatForMe = async () => {
    if (!token || !selectedConversationId) return
    const confirmed = window.confirm('XĂ³a toĂ n bá»™ Ä‘oáº¡n chat á»Ÿ phĂ­a báº¡n? HĂ nh Ä‘á»™ng nĂ y khĂ´ng áº£nh hÆ°á»Ÿng ngÆ°á»i khĂ¡c.')
    if (!confirmed) return
    setBusyActionId(`clear-${selectedConversationId}`)
    try {
      await api.clearConversationMessages(token, selectedConversationId)
      const refreshed = await api.listMessages(token, selectedConversationId, { limit: 25 })
      setMessages(selectedConversationId, refreshed.messages)
      setChatNotice('ÄĂ£ xĂ³a Ä‘oáº¡n chat á»Ÿ phĂ­a báº¡n.')
    } catch (error) {
      console.error('KhĂ´ng thá»ƒ xĂ³a Ä‘oáº¡n chat:', error)
      if (error instanceof Error) {
        setChatNotice(error.message)
      } else {
        setChatNotice('KhĂ´ng thá»ƒ xĂ³a Ä‘oáº¡n chat.')
      }
    } finally {
      setBusyActionId(null)
    }
  }

  const openMessageActions = (event: React.MouseEvent<HTMLElement>, messageId: string) => {
    event.preventDefault()
    event.stopPropagation()
    const rect = event.currentTarget.getBoundingClientRect()
    const menuWidth = 180
    const x = Math.min(window.innerWidth - menuWidth - 12, Math.max(12, rect.right - menuWidth))
    const y = Math.max(12, Math.min(window.innerHeight - 240, rect.bottom + 8))
    setActionMenu({
      messageId,
      x,
      y,
    })
  }

  const handleStartCall = async (callType: 'voice' | 'video') => {
    const socket = getSocket()
    if (!socket || !selectedConversationId || callTargets.length === 0) return

    try {
      await ensureLocalStream(callType)
      for (const targetUserId of callTargets) {
        const pc = await buildPeerConnection(targetUserId, callType)
        if (!pc) continue
        const offer = await pc.createOffer()
        await pc.setLocalDescription(offer)

        socket.emit('call:offer', {
          targetUserId,
          conversationId: selectedConversationId,
          callType,
          offer,
        })
      }
    } catch (error) {
      console.error('KhĂ´ng thá»ƒ báº¯t Ä‘áº§u cuá»™c gá»i:', error)
      return
    }

    setCallStatus(`Äang gá»i ${callType === 'video' ? 'video' : 'thoáº¡i'} tá»›i ${selectedConversation ? getConversationDisplayName(selectedConversation, user?.id) : 'ngÆ°á»i nháº­n'}`)
    setCallAnswered(false)
    setRingingStartedAt(Date.now())
    setCallSeconds(0)
    const initialParticipants = user?.id ? [user.id] : []
    setActiveCall({
      type: callType,
      withName: selectedConversation
        ? getConversationDisplayName(selectedConversation, user?.id)
        : `NgÆ°á»i dĂ¹ng #${callTargetId}`,
      startedAt: Date.now(),
    })
    setJoinedCallUserIds(initialParticipants)
    socket.emit('call:join', {
      conversationId: selectedConversationId,
    })
    
    // Broadcast initial participant count for group calls
    if (callTargets.length > 1) {
      socket.emit('call:participants', {
        conversationId: selectedConversationId,
        participantCount: 1 + callTargets.length, // Me + all targets (even if not answered yet)
        participantIds: [...initialParticipants, ...callTargets],
      })
    }
  }

  const handleAcceptIncomingCall = async () => {
    const socket = getSocket()
    if (!socket || !incomingCall) return

    const activeConversationId = incomingCall.conversationId || selectedConversationId
    if (!activeConversationId) return
    const answeredAt = Date.now()

    try {
      const pc = (await buildPeerConnection(incomingCall.fromUserId, incomingCall.callType)) || undefined
      if (!pc) return
      await pc.setRemoteDescription(new RTCSessionDescription(incomingCall.offer))
      const answer = await pc.createAnswer()
      await pc.setLocalDescription(answer)

      socket.emit('call:answer', {
        targetUserId: incomingCall.fromUserId,
        conversationId: activeConversationId,
        answer,
        answeredAt,
      })
    } catch (error) {
      console.error('KhĂ´ng thá»ƒ cháº¥p nháº­n cuá»™c gá»i:', error)
      return
    }

    setCallStatus('ÄĂ£ cháº¥p nháº­n cuá»™c gá»i')
    setCallAnswered(true)
    setRingingStartedAt(null)
    setCallSeconds(0)
    setActiveCall({
      type: incomingCall.callType,
      withName: selectedConversation
        ? getConversationDisplayName(selectedConversation, user?.id)
        : `NgÆ°á»i dĂ¹ng #${incomingCall.fromUserId}`,
      startedAt: answeredAt,
    })
    const newJoinedIds = user?.id ? [user.id, incomingCall.fromUserId] : [incomingCall.fromUserId]
    setJoinedCallUserIds(newJoinedIds)
    socket.emit('call:join', {
      conversationId: activeConversationId,
    })
    
    // Broadcast updated participant count
    socket.emit('call:participants', {
      conversationId: activeConversationId,
      participantCount: newJoinedIds.length,
      participantIds: newJoinedIds,
    })
    
    setIncomingCall(null)
    setGlobalIncomingCall(null)
  }

  const handleDeclineIncomingCall = () => {
    const socket = getSocket()
    if (!socket || !incomingCall) {
      setIncomingCall(null)
      setGlobalIncomingCall(null)
      return
    }

    const activeConversationId = incomingCall.conversationId || selectedConversationId
    if (activeConversationId) {
      socket.emit('call:leave', {
        conversationId: activeConversationId,
      })
      socket.emit('call:end', {
        targetUserId: incomingCall.fromUserId,
        conversationId: activeConversationId,
      })
    }

    setIncomingCall(null)
    setGlobalIncomingCall(null)
    setCallStatus('ÄĂ£ tá»« chá»‘i cuá»™c gá»i')
  }

  const handleEndCall = () => {
    const socket = getSocket()
    if (!socket || !selectedConversationId) return
    
    // Get current participant count before leaving
    const remainingCount = Math.max(0, joinedCallUserIds.length - 1) // -1 because we're leaving
    
    socket.emit('call:leave', {
      conversationId: selectedConversationId,
    })
    
    // Notify other participants about the count update
    socket.emit('call:participants', {
      conversationId: selectedConversationId,
      participantCount: remainingCount,
      participantIds: joinedCallUserIds.filter(id => id !== user?.id),
    })
    
    // End call for each peer
    callTargets.forEach((targetUserId) => {
      socket.emit('call:end', {
        targetUserId,
        conversationId: selectedConversationId,
      })
    })
    
    closeCallResources()
    setCallStatus('Báº¡n Ä‘Ă£ káº¿t thĂºc cuá»™c gá»i')
    setIncomingCall(null)
    setGlobalIncomingCall(null)
    setActiveCall(null)
    setCallSeconds(0)
    setCallAnswered(false)
    setRingingStartedAt(null)
  }

  useEffect(() => {
    return () => {
      closeCallResources()
    }
  }, [])

  useEffect(() => {
    const closeMenu = () => setActionMenu(null)
    window.addEventListener('click', closeMenu)
    return () => window.removeEventListener('click', closeMenu)
  }, [])

  const selectedName = selectedConversation
    ? getConversationDisplayName(selectedConversation, user?.id)
    : 'Chá»n cuá»™c trĂ² chuyá»‡n'
  const initials = (user?.fullName?.[0] || 'U').toUpperCase()
  const formattedCallTime = `${String(Math.floor(callSeconds / 60)).padStart(2, '0')}:${String(callSeconds % 60).padStart(2, '0')}`

  const callParticipantProfiles = useMemo(() => {
    if (!activeCall) return [] as Array<{ userId: number; name: string; avatarUrl: string | null }>

    const ids = new Set<number>()
    if (user?.id) ids.add(user.id)
    joinedCallUserIds.forEach((id) => ids.add(id))
    remoteStreams.forEach((item) => ids.add(item.userId))

    return Array.from(ids)
      .filter((id) => id > 0)
      .map((id) => {
        const member = selectedConversation?.members.find((item) => item.userId === id)
        if (member) {
          return {
            userId: id,
            name: member.fullName,
            avatarUrl: member.avatarUrl,
          }
        }
        if (id === user?.id) {
          return {
            userId: id,
            name: user.fullName || 'Báº¡n',
            avatarUrl: user.avatarUrl || null,
          }
        }
        return {
          userId: id,
          name: `NgÆ°á»i dĂ¹ng #${id}`,
          avatarUrl: null,
        }
      })
  }, [activeCall, joinedCallUserIds, remoteStreams, selectedConversation, user?.avatarUrl, user?.fullName, user?.id])

  const renderMessagePreview = (msg: ChatMessage) => {
    const recalled = Boolean(msg.meta && (msg.meta as Record<string, unknown>).recalled)
    const forwarded = Boolean(msg.meta && (msg.meta as Record<string, unknown>).forwarded)

    if (recalled) {
      return <p className={styles.recalledText}>Tin nháº¯n Ä‘Ă£ Ä‘Æ°á»£c thu há»“i</p>
    }

    if (msg.type === 'image' && msg.mediaUrl) {
      return (
        <div className={styles.mediaWrap}>
          {forwarded ? <small className={styles.forwardTag}>ÄĂ£ chuyá»ƒn tiáº¿p</small> : null}
          <img
            src={msg.mediaUrl}
            alt={msg.fileName || 'image'}
            loading="lazy"
            onError={(event) => {
              event.currentTarget.style.display = 'none'
            }}
          />
        </div>
      )
    }

    if (msg.type === 'video' && msg.mediaUrl) {
      return (
        <div className={styles.mediaWrap}>
          {forwarded ? <small className={styles.forwardTag}>ÄĂ£ chuyá»ƒn tiáº¿p</small> : null}
          <video controls src={msg.mediaUrl} />
        </div>
      )
    }

    if (msg.type === 'audio' && msg.mediaUrl) {
      return (
        <div className={styles.mediaWrap}>
          {forwarded ? <small className={styles.forwardTag}>ÄĂ£ chuyá»ƒn tiáº¿p</small> : null}
          <audio controls src={msg.mediaUrl} />
        </div>
      )
    }

    if (msg.type === 'sticker') {
      const sticker = (msg.meta?.sticker as string) || msg.text || 'đŸ˜€'
      return <p className={styles.stickerBubble}>{sticker}</p>
    }

    if (msg.mediaUrl) {
      return (
        <div className={styles.mediaWrap}>
          {forwarded ? <small className={styles.forwardTag}>ÄĂ£ chuyá»ƒn tiáº¿p</small> : null}
          <a href={msg.mediaUrl} target="_blank" rel="noreferrer" className={styles.fileLink}>
            {msg.fileName || 'Má»Ÿ tá»‡p Ä‘Ă­nh kĂ¨m'}
          </a>
          {(msg.mimeType || msg.fileSize) ? (
            <small className={styles.fileMeta}>
              {[msg.mimeType, msg.fileSize ? `${Math.max(1, Math.round(msg.fileSize / 1024))} KB` : null]
                .filter(Boolean)
                .join(' â€¢ ')}
            </small>
          ) : null}
        </div>
      )
    }

    return (
      <p className={styles.messageText}>
        {forwarded ? <small className={styles.forwardTagInline}>[ÄĂ£ chuyá»ƒn tiáº¿p] </small> : null}
        {msg.text || ''}
      </p>
    )
  }

  return (
    <div className={styles.page}>
      <div className={styles.layout}>
        <aside className={styles.rail}>
          <div className={styles.railLogo}>M</div>
          <nav className={styles.railNav}>
            <button type="button" className={`${styles.railBtn} ${styles.railBtnActive}`} title="Tin nháº¯n" aria-label="Tin nháº¯n">
              <Send size={16} />
            </button>
            <button type="button" className={styles.railBtn} onClick={() => setShowNewMessageModal(true)} title="Táº¡o há»™i thoáº¡i má»›i" aria-label="Táº¡o há»™i thoáº¡i má»›i">
              <UserPlus size={16} />
            </button>
            <button
              type="button"
              className={styles.railBtn}
              onClick={() => {
                setShowCreateGroupModal(true)
                setGroupName('')
                setGroupSearchKeyword('')
                setGroupMemberIds([])
              }}
              title="Táº¡o nhĂ³m"
              aria-label="Táº¡o nhĂ³m"
            >
              <CirclePlus size={16} />
            </button>
            <button type="button" className={styles.railBtn} onClick={() => setShowNotificationsDrawer(true)} title="ThĂ´ng bĂ¡o" aria-label="ThĂ´ng bĂ¡o">
              <Bell size={16} />
            </button>
            <button type="button" className={`${styles.railBtn} ${styles.railBottomBtn}`} title="ThĂ´ng tin" aria-label="ThĂ´ng tin">
              <Info size={16} />
            </button>
          </nav>
          <div className={styles.railAvatar}>{initials}</div>
        </aside>

        <section className={styles.listPanel}>
          <div className={styles.listHeader}>
            <div className={styles.listHeaderTop}>
              <h1>Táº¥t cáº£ cuá»™c trĂ² chuyá»‡n</h1>
              <button
                type="button"
                className={styles.headerNotifyBtn}
                onClick={() => setShowNotificationsDrawer(true)}
                title="ThĂ´ng bĂ¡o"
                aria-label="ThĂ´ng bĂ¡o"
              >
                <Bell size={14} />
                {notifications.some((item) => !item.is_read) ? <i /> : null}
              </button>
            </div>
            <div className={styles.searchWrap}>
              <Search size={14} />
              <input
                placeholder="Search conversations"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
              />
            </div>
          </div>

          <div className={styles.convList}>
            {filteredConversations.map((conv) => {
              const isActive = conv.id === selectedConversationId
              const name = getConversationDisplayName(conv, user?.id)
              const fallback = (name[0] || 'C').toUpperCase()
              return (
                <button
                  key={conv.id}
                  type="button"
                  onClick={() => openConversation(conv.id)}
                  className={`${styles.convItem} ${isActive ? styles.convItemActive : ''}`}
                >
                  <div className={styles.convAvatar}>{fallback}</div>
                  <div className={styles.convText}>
                    <div className={styles.convLineTop}>
                      <strong>{name}</strong>
                      <span>Chat</span>
                    </div>
                    <p>{conv.unreadCount > 0 ? `${conv.unreadCount} tin nháº¯n chÆ°a Ä‘á»c` : 'Nháº¥n Ä‘á»ƒ má»Ÿ há»™i thoáº¡i'}</p>
                  </div>
                </button>
              )
            })}
          </div>
        </section>

        <section className={styles.chatPanel}>
          <header className={styles.chatHeader}>
            <div className={styles.chatIdentity}>
              <div className={styles.convAvatar}>{(selectedName[0] || 'C').toUpperCase()}</div>
              <div>
                <h2>
                  {directPeer ? <Link to={`/profile/${directPeer.id}`}>{selectedName}</Link> : selectedName}
                </h2>
                <p>
                  {directPeer
                    ? isDirectPeerFriend
                      ? 'Báº¡n bĂ¨ â€¢ Online'
                      : 'ChÆ°a káº¿t báº¡n â€¢ Giá»›i háº¡n 3 tin nháº¯n'
                    : 'Online'}
                </p>
              </div>
            </div>
            <div className={styles.chatActions}>
              <button type="button" onClick={() => handleStartCall('video')} disabled={!callTargetId} title="Gá»i video" aria-label="Gá»i video">
                <Video size={16} />
              </button>
              <button type="button" onClick={() => handleStartCall('voice')} disabled={!callTargetId} title="Gá»i thoáº¡i" aria-label="Gá»i thoáº¡i">
                <Phone size={16} />
              </button>
              <button
                type="button"
                title="ThĂªm ngÆ°á»i vĂ o cuá»™c trĂ² chuyá»‡n"
                aria-label="ThĂªm ngÆ°á»i vĂ o cuá»™c trĂ² chuyá»‡n"
                disabled={!selectedGroup || !canAddMembers}
                onClick={() => setRightPanelSection('manage')}
              >
                <UserPlus size={16} />
              </button>
              <button
                type="button"
                title="Xem chi tiáº¿t cuá»™c trĂ² chuyá»‡n"
                aria-label="Xem chi tiáº¿t cuá»™c trĂ² chuyá»‡n"
                disabled={!selectedConversation}
                onClick={() => setRightPanelSection('overview')}
              >
                <Info size={16} />
              </button>
            </div>
          </header>

          {selectedConversationId && messageLimitByConversation[selectedConversationId] ? (
            <div className={styles.limitBadge}>
              CĂ²n {messageLimitByConversation[selectedConversationId]?.remaining ?? 0}/{messageLimitByConversation[selectedConversationId]?.total ?? 3} tin nháº¯n miá»…n phĂ­ trÆ°á»›c khi cáº§n káº¿t báº¡n.
            </div>
          ) : null}

          {selectedConversation?.pinnedMessageIds && selectedConversation.pinnedMessageIds.length > 0 ? (
            <div className={styles.limitBadge}>
              Äang ghim {selectedConversation.pinnedMessageIds.length} tin nháº¯n trong cuá»™c trĂ² chuyá»‡n nĂ y.
            </div>
          ) : null}

          {directPeer ? (
            <div className={styles.chatSocialBar}>
              <button
                type="button"
                className={styles.socialActionBtn}
                onClick={() => handleOpenOrCreateDirectConversation(directPeer.id)}
                disabled={creatingDirectConversation}
              >
                {creatingDirectConversation ? 'Äang má»Ÿ há»™i thoáº¡i...' : 'Nháº¯n tin'}
              </button>
              {!isDirectPeerFriend && !isDirectPeerPending ? (
                <button
                  type="button"
                  className={styles.socialActionBtnPrimary}
                  onClick={handleRequestFriend}
                  disabled={Boolean(pendingFriendRequestTo[directPeer.id])}
                >
                  {pendingFriendRequestTo[directPeer.id] ? 'Äang gá»­i lá»i má»i...' : 'Káº¿t báº¡n Ä‘á»ƒ nháº¯n khĂ´ng giá»›i háº¡n'}
                </button>
              ) : null}
              {!isDirectPeerFriend && isDirectPeerPending && isDirectPeerRequestedByMe ? (
                <button
                  type="button"
                  className={styles.socialActionBtn}
                  onClick={handleCancelFriendRequest}
                  disabled={Boolean(pendingFriendRequestTo[directPeer.id])}
                >
                  {pendingFriendRequestTo[directPeer.id] ? 'Äang há»§y...' : 'Há»§y lá»i má»i káº¿t báº¡n'}
                </button>
              ) : null}
              {!isDirectPeerFriend && isDirectPeerPending && !isDirectPeerRequestedByMe ? (
                <button
                  type="button"
                  className={styles.socialActionBtnPrimary}
                  onClick={handleAcceptFriendRequestDirect}
                  disabled={Boolean(pendingFriendRequestTo[directPeer.id])}
                >
                  {pendingFriendRequestTo[directPeer.id] ? 'Äang xá»­ lĂ½...' : 'Äá»“ng Ă½ lá»i má»i káº¿t báº¡n'}
                </button>
              ) : null}
            </div>
          ) : null}

          {chatNotice ? <p className={styles.chatNotice}>{chatNotice}</p> : null}

          {(callStatus || incomingCall) && (
            <div className={styles.callBanner}>
              {callStatus ? <p>{callStatus}</p> : null}
              {incomingCall ? (
                <div className={styles.callBannerActions}>
                  <button type="button" onClick={handleAcceptIncomingCall} title="Cháº¥p nháº­n cuá»™c gá»i" aria-label="Cháº¥p nháº­n cuá»™c gá»i">
                    Cháº¥p nháº­n
                  </button>
                  <button type="button" onClick={handleDeclineIncomingCall} title="Tá»« chá»‘i cuá»™c gá»i" aria-label="Tá»« chá»‘i cuá»™c gá»i">
                    Tá»« chá»‘i
                  </button>
                </div>
              ) : null}
              <button type="button" className={styles.endCallBtn} onClick={handleEndCall} disabled={!callTargetId} title="Káº¿t thĂºc cuá»™c gá»i" aria-label="Káº¿t thĂºc cuá»™c gá»i">
                <PhoneOff size={14} />
                Káº¿t thĂºc
              </button>
            </div>
          )}

          <div className={styles.timeline}>TODAY</div>

          <div
            className={styles.messagesWrap}
            ref={messagesWrapRef}
            onScroll={(event) => {
              const element = event.currentTarget
              if (element.scrollTop <= 24) {
                loadOlderMessages().catch(() => undefined)
              }
              const fromBottom = element.scrollHeight - (element.scrollTop + element.clientHeight)
              setShowJumpToLatest(fromBottom > 260)
            }}
          >
            {loadingOlderMessages ? <p className={styles.historyLoading}>Äang táº£i tin nháº¯n cÅ© hÆ¡n...</p> : null}
            {virtualSlice.startIndex > 0 ? (
              <p className={styles.virtualHint}>Äang hiá»ƒn thá»‹ {VIRTUAL_CHUNK} tin nháº¯n má»›i nháº¥t. Cuá»™n lĂªn Ä‘á»ƒ táº£i thĂªm lá»‹ch sá»­.</p>
            ) : null}
            {virtualSlice.items.map((msg) => {
              const mine = msg.senderId === user?.id
              const reactionItems = getMessageReactionItems(msg)
              const senderName = String(msg.senderName || msg.sender?.fullName || msg.sender?.name || 'NgÆ°á»i dĂ¹ng')
              return (
                <div key={msg.id} className={`${styles.messageRow} ${mine ? styles.messageRowMine : ''}`}>
                  {!mine ? <div className={styles.messageAvatar}>{(senderName[0] || 'U').toUpperCase()}</div> : null}
                  <div className={styles.messageBlock}>
                    {!mine ? (
                      <Link to={`/profile/${msg.senderId}`} className={styles.senderLink}>
                        {senderName}
                      </Link>
                    ) : null}
                    <div
                      className={`${styles.bubble} ${mine ? styles.bubbleMine : ''}`}
                      onContextMenu={(event) => {
                        event.preventDefault()
                        setActionMenu({ messageId: msg.id, x: event.clientX, y: event.clientY })
                      }}
                      onTouchStart={(event) => {
                        const touch = event.touches[0]
                        longPressTimer.current = window.setTimeout(() => {
                          setActionMenu({ messageId: msg.id, x: touch.clientX, y: touch.clientY })
                        }, 420)
                      }}
                      onTouchEnd={() => {
                        if (longPressTimer.current) {
                          window.clearTimeout(longPressTimer.current)
                          longPressTimer.current = null
                        }
                      }}
                    >
                      <button
                        type="button"
                        className={styles.messageActionTrigger}
                        title="Má»Ÿ menu thao tĂ¡c"
                        aria-label="Má»Ÿ menu thao tĂ¡c"
                        onClick={(event) => openMessageActions(event, msg.id)}
                      >
                        <MoreHorizontal size={14} />
                      </button>
                      {renderMessagePreview(msg)}
                      {pinnedMessageIds.has(msg.id) ? <small className={styles.forwardTag}>ÄĂ£ ghim</small> : null}
                      {reactionItems.length > 0 ? (
                        <div className={styles.reactionsPill}>
                          {reactionItems.slice(0, 5).map((r, idx) => (
                            <span key={`${r.userId}-${idx}`} className={styles.reactionEmoji} title={r.meta.label}>
                              {r.meta.emoji}
                            </span>
                          ))}
                          {reactionItems.length > 5 ? <span className={styles.reactionMore}>+{reactionItems.length - 5}</span> : null}
                        </div>
                      ) : null}
                    </div>
                    <div className={styles.messageFooter}>
                      <button
                        type="button"
                        className={`${styles.reactionTrigger} ${msg.viewerReaction ? styles.reactionTriggerActive : ''}`}
                        title="Thả cảm xúc"
                        aria-label="Thả cảm xúc"
                        onClick={() => setReactionPickerMessageId((current) => (current === msg.id ? null : msg.id))}
                      >
                        {msg.viewerReaction ? getMessageReactionMeta(msg.viewerReaction).emoji : <Smile size={14} />}
                      </button>
                      <span className={styles.messageTime}>
                        {formatVietnamTime(msg.createdAt)}
                      </span>
                    </div>
                    {reactionPickerMessageId === msg.id ? (
                      <div className={styles.reactionPicker}>
                        {MESSAGE_REACTIONS.map((reaction) => (
                          <button
                            key={reaction.type}
                            type="button"
                            className={msg.viewerReaction === reaction.type ? styles.reactionPickerActive : ''}
                            title={reaction.label}
                            aria-label={reaction.label}
                            disabled={busyActionId === msg.id}
                            onClick={() => {
                              handleReaction(msg, reaction.type)
                              setReactionPickerMessageId(null)
                            }}
                          >
                            {reaction.emoji}
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>
              )
            })}

            {typingUserIds.size > 0 ? (
              <div className={`${styles.messageRow}`}>
                <div className={styles.messageAvatar}>...</div>
                <div className={styles.messageBlock}>
                  <div className={`${styles.bubble}`}>
                    <p style={{ fontSize: '0.9em', fontStyle: 'italic' }}>
                      {Array.from(typingUserIds)
                        .map((userId) => {
                          const member = selectedConversation?.members.find((m) => m.userId === userId)
                          return member?.fullName || `NgÆ°á»i dĂ¹ng #${userId}`
                        })
                        .join(', ')}{' '}
                      Ä‘ang soáº¡n tin nháº¯n...
                    </p>
                  </div>
                </div>
              </div>
            ) : null}

            {messages.length === 0 ? <p className={styles.empty}>ChÆ°a cĂ³ tin nháº¯n trong cuá»™c trĂ² chuyá»‡n nĂ y.</p> : null}
          </div>

          <footer className={styles.inputBar}>
            <input ref={fileInputRef} type="file" className={styles.hiddenFileInput} onChange={handleFileSelected} aria-label="ÄĂ­nh kĂ¨m tá»‡p" title="ÄĂ­nh kĂ¨m tá»‡p" />
            <input
              ref={imageInputRef}
              type="file"
              accept="image/*"
              className={styles.hiddenFileInput}
              onChange={handleFileSelected}
              aria-label="Gá»­i hĂ¬nh áº£nh"
              title="Gá»­i hĂ¬nh áº£nh"
            />
            <input
              ref={videoInputRef}
              type="file"
              accept="video/*"
              className={styles.hiddenFileInput}
              onChange={handleFileSelected}
              aria-label="Gá»­i video"
              title="Gá»­i video"
            />
            <button type="button" className={styles.inputIcon} onClick={handlePickAttachment} disabled={busyUploading} title="Chá»n tá»‡p Ä‘Ă­nh kĂ¨m" aria-label="Chá»n tá»‡p Ä‘Ă­nh kĂ¨m">
              <CirclePlus size={18} />
            </button>
            {composerMenuOpen ? (
              <div className={styles.composerPlusMenu}>
                <button type="button" onClick={() => handlePickAttachmentType('image')} title="Gá»­i áº£nh" aria-label="Gá»­i áº£nh">
                  <span>đŸ–¼ï¸</span>
                  <span>Gá»­i áº£nh</span>
                </button>
                <button type="button" onClick={() => handlePickAttachmentType('video')} title="Gá»­i video" aria-label="Gá»­i video">
                  <span>đŸ¬</span>
                  <span>Gá»­i video</span>
                </button>
                <button type="button" onClick={() => handlePickAttachmentType('file')} title="Gá»­i tá»‡p" aria-label="Gá»­i tá»‡p">
                  <span>đŸ“</span>
                  <span>Gá»­i tá»‡p</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowEmojiPanel(true)
                    setShowStickerPanel(false)
                    setComposerMenuOpen(false)
                  }}
                  title="ChĂ¨n emoji"
                  aria-label="ChĂ¨n emoji"
                >
                  <span>đŸ˜</span>
                  <span>ChĂ¨n emoji</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowStickerPanel((prev) => !prev)
                    setShowEmojiPanel(false)
                    setComposerMenuOpen(false)
                  }}
                >
                  <Sticker size={16} />
                  <span>Gá»­i sticker</span>
                </button>
              </div>
            ) : null}
            <textarea
              placeholder="Type a message..."
              value={message}
              rows={1}
              onChange={(event) => {
                setMessage(event.target.value)
                // Emit typing indicator
                const socket = getSocket()
                if (socket && selectedConversationId) {
                  socket.emit('message:typing', {
                    conversationId: selectedConversationId,
                    isTyping: event.target.value.length > 0,
                  })
                  // Clear existing timeout
                  if (typingTimeoutRef.current) {
                    clearTimeout(typingTimeoutRef.current)
                  }
                  // Set timeout to stop showing typing after 3 seconds of inactivity
                  if (event.target.value.length > 0) {
                    typingTimeoutRef.current = window.setTimeout(() => {
                      if (socket && selectedConversationId) {
                        socket.emit('message:typing', {
                          conversationId: selectedConversationId,
                          isTyping: false,
                        })
                      }
                    }, 3000)
                  }
                }
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault()
                  handleSend()
                }
              }}
            />
            <button type="button" className={styles.inputIcon} onClick={() => fileInputRef.current?.click()} disabled={busyUploading} title="Chá»n tá»‡p" aria-label="Chá»n tá»‡p">
              <Paperclip size={16} />
            </button>
            <button
              type="button"
              className={styles.inputIcon}
              onClick={() => {
                setShowEmojiPanel((prev) => !prev)
                setShowStickerPanel(false)
                setComposerMenuOpen(false)
              }}
              disabled={busyUploading}
              title="Má»Ÿ báº£ng emoji"
              aria-label="Má»Ÿ báº£ng emoji"
            >
              <Smile size={16} />
            </button>
            <button
              type="button"
              className={styles.sendBtn}
              onClick={handleSend}
              disabled={!message.trim() || isSendingMessage}
              title="Gá»­i tin nháº¯n"
              aria-label="Gá»­i tin nháº¯n"
            >
              <Send size={17} />
            </button>

            {showEmojiPanel ? (
              <div className={styles.emojiPanel}>
                {EMOJI_SET.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            ) : null}

            {showStickerPanel ? (
              <div className={styles.stickerPanel}>
                <div className={styles.stickerTabs}>
                  {(Object.keys(STICKER_PACKS) as Array<keyof typeof STICKER_PACKS>).map((packName) => (
                    <button
                      key={packName}
                      type="button"
                      className={packName === activeStickerPack ? styles.stickerTabActive : ''}
                      onClick={() => {
                        setActiveStickerPack(packName)
                        if (!loadedStickerPacks[packName]) {
                          setTimeout(() => {
                            setLoadedStickerPacks((prev) => ({ ...prev, [packName]: true }))
                          }, 220)
                        }
                      }}
                    >
                      {packName}
                    </button>
                  ))}
                </div>
                {loadedStickerPacks[activeStickerPack] ? STICKER_PACKS[activeStickerPack].map((sticker) => (
                  <button
                    key={sticker}
                    type="button"
                    title="Gá»­i sticker"
                    aria-label="Gá»­i sticker"
                    onClick={async () => {
                      if (!token || !selectedConversationId) return
                      try {
                        const response = await api.sendMessagePayload(token, selectedConversationId, {
                          type: 'sticker',
                          text: sticker,
                          sticker,
                        })
                        upsertMessage(selectedConversationId, response.message)
                        setShowStickerPanel(false)
                        setMessageLimitByConversation((prev) => {
                          const current = prev[selectedConversationId]
                          if (!current) return prev
                          return {
                            ...prev,
                            [selectedConversationId]: {
                              ...current,
                              sent: current.sent + 1,
                              remaining: Math.max(0, current.remaining - 1),
                            },
                          }
                        })
                      } catch (error) {
                        if (error instanceof ApiError && error.code === 'MESSAGE_LIMIT_NON_FRIEND') {
                          setChatNotice('Báº¡n chá»‰ gá»­i Ä‘Æ°á»£c tá»‘i Ä‘a 3 tin nháº¯n khi chÆ°a káº¿t báº¡n. HĂ£y káº¿t báº¡n Ä‘á»ƒ tiáº¿p tá»¥c.')
                        } else if (error instanceof Error) {
                          setChatNotice(error.message)
                        }
                      }
                    }}
                  >
                    {sticker}
                  </button>
                )) : <p className={styles.stickerLoading}>Äang táº£i pack {activeStickerPack}...</p>}
              </div>
            ) : null}
          </footer>

          {showJumpToLatest ? (
            <button
              type="button"
              className={styles.jumpToLatestBtn}
              onClick={() => {
                if (!messagesWrapRef.current) return
                messagesWrapRef.current.scrollTop = messagesWrapRef.current.scrollHeight
                setShowJumpToLatest(false)
              }}
            >
              Vá» tin nháº¯n má»›i nháº¥t
            </button>
          ) : null}

          {showNewMessageModal ? (
            <div className={styles.overlayBackdrop}>
              <div className={styles.overlayCard}>
                <h3>Tin nháº¯n má»›i</h3>
                <input
                  value={newMessageKeyword}
                  onChange={(event) => setNewMessageKeyword(event.target.value)}
                  placeholder="Nháº­p tĂªn báº¡n bĂ¨ hoáº·c email Ä‘Äƒng kĂ½"
                />
                <div className={styles.overlayList}>
                  {searchUsersResult.map((item) => (
                    <button key={item.id} type="button" onClick={() => handleCreateConversationWithUser(item.id)} title={`Táº¡o há»™i thoáº¡i vá»›i ${item.name}`} aria-label={`Táº¡o há»™i thoáº¡i vá»›i ${item.name}`}>
                      <span className={styles.listEntryIdentity}>
                        <span className={styles.listEntryAvatar}>{getAvatarInitial(item.name)}</span>
                        <span className={styles.listEntryMeta}>
                          <strong className={styles.listEntryTitle}>{item.name}</strong>
                          <small className={styles.listEntrySubtitle}>ID {item.id}</small>
                        </span>
                      </span>
                    </button>
                  ))}
                  {searchUsersResult.length === 0 ? <p>KhĂ´ng cĂ³ káº¿t quáº£ phĂ¹ há»£p.</p> : null}
                </div>
                <button type="button" className={styles.overlayCloseBtn} onClick={() => setShowNewMessageModal(false)} title="ÄĂ³ng" aria-label="ÄĂ³ng">
                  ÄĂ³ng
                </button>
              </div>
            </div>
          ) : null}

          {showNotificationsDrawer ? (
            <div className={styles.overlayBackdrop}>
              <div className={styles.overlayCard}>
                <h3>ThĂ´ng bĂ¡o nĂ¢ng cao</h3>
                <div className={styles.overlayList}>
                  {notifications.map((item) => {
                    const meta = parseNotificationMeta(item)
                    const conversationId = meta?.conversationId
                    const canAccept = item.type === 'friend-request' && !item.is_read && Boolean(meta?.requesterId || meta?.friendshipId)
                    return (
                      <div key={item.id} className={styles.notifyCard}>
                        <button
                          type="button"
                          className={styles.notifyMainBtn}
                          onClick={() => handleOpenNotificationConversation(conversationId)}
                        >
                          <span className={styles.listEntryIdentity}>
                            <span className={styles.listEntryAvatar}>{getAvatarInitial(item.title)}</span>
                            <span className={styles.listEntryMeta}>
                              <strong className={styles.listEntryTitle}>{item.title}</strong>
                              <span className={styles.listEntrySubtitle}>{item.body || 'ThĂ´ng bĂ¡o há»‡ thá»‘ng'}</span>
                              <small className={styles.listEntrySubtitle}>{new Date(item.created_at).toLocaleString('vi-VN')}</small>
                            </span>
                          </span>
                        </button>
                        <div className={styles.notifyActions}>
                          {conversationId ? (
                            <button
                              type="button"
                              onClick={() => handleOpenNotificationConversation(conversationId)}
                            >
                              Má»Ÿ Ä‘oáº¡n chat
                            </button>
                          ) : null}
                          {canAccept ? (
                            <button
                              type="button"
                              className={styles.notifyAcceptBtn}
                              disabled={busyActionId === `notif-${item.id}`}
                              onClick={() => {
                                void handleAcceptFromNotification(item)
                              }}
                            >
                              {busyActionId === `notif-${item.id}` ? 'Äang Ä‘á»“ng Ă½...' : 'Äá»“ng Ă½'}
                            </button>
                          ) : null}
                        </div>
                      </div>
                    )
                  })}
                  {notifications.length === 0 ? <p>Hiá»‡n chÆ°a cĂ³ thĂ´ng bĂ¡o quan trá»ng.</p> : null}
                </div>
                <button type="button" className={styles.overlayCloseBtn} onClick={() => setShowNotificationsDrawer(false)} title="ÄĂ³ng" aria-label="ÄĂ³ng">
                  ÄĂ³ng
                </button>
              </div>
            </div>
          ) : null}

          {forwardingMessageId ? (
            <div className={styles.forwardDialogBackdrop}>
              <div className={styles.forwardDialog}>
                <h3>Chuyá»ƒn tiáº¿p tin nháº¯n</h3>
                <p>Chá»n cuá»™c trĂ² chuyá»‡n Ä‘á»ƒ chuyá»ƒn tiáº¿p:</p>
                <div className={styles.forwardList}>
                  {conversations
                    .filter((conv) => conv.id !== selectedConversationId)
                    .map((conv) => (
                      <button key={conv.id} type="button" onClick={() => handleForward(conv.id)} title={`Chuyá»ƒn tiáº¿p Ä‘áº¿n ${getConversationDisplayName(conv, user?.id)}`} aria-label={`Chuyá»ƒn tiáº¿p Ä‘áº¿n ${getConversationDisplayName(conv, user?.id)}`}>
                        <span className={styles.listEntryIdentity}>
                          <span className={styles.listEntryAvatar}>{getAvatarInitial(getConversationDisplayName(conv, user?.id))}</span>
                          <span className={styles.listEntryMeta}>
                            <strong className={styles.listEntryTitle}>{getConversationDisplayName(conv, user?.id)}</strong>
                            <small className={styles.listEntrySubtitle}>ID {conv.id}</small>
                          </span>
                        </span>
                      </button>
                    ))}
                </div>
                <button type="button" className={styles.forwardCancel} onClick={() => setForwardingMessageId(null)} title="Há»§y chuyá»ƒn tiáº¿p" aria-label="Há»§y chuyá»ƒn tiáº¿p">
                  Há»§y
                </button>
              </div>
            </div>
          ) : null}

          {showCreateGroupModal ? (
            <div className={styles.overlayBackdrop}>
              <div className={styles.overlayCard}>
                <h3>Táº¡o nhĂ³m chat</h3>
                <input
                  value={groupName}
                  onChange={(event) => setGroupName(event.target.value)}
                  placeholder="Nháº­p tĂªn nhĂ³m"
                />
                <input
                  value={groupSearchKeyword}
                  onChange={(event) => setGroupSearchKeyword(event.target.value)}
                  placeholder="TĂ¬m báº¡n bĂ¨ Ä‘á»ƒ thĂªm vĂ o nhĂ³m"
                />
                <div className={styles.overlayList}>
                  {filteredCreateGroupInviteCandidates.map((friend) => {
                    const checked = groupMemberIds.includes(friend.id)
                    return (
                      <button key={friend.id} type="button" onClick={() => toggleGroupMember(friend.id)} title={`Chá»n ${friend.fullName}`} aria-label={`Chá»n ${friend.fullName}`}>
                        <span className={styles.listEntryIdentity}>
                          <span className={styles.listEntryAvatar}>{getAvatarInitial(friend.fullName)}</span>
                          <span className={styles.listEntryMeta}>
                            <strong className={styles.listEntryTitle}>{checked ? 'âœ“ ' : ''}{friend.fullName}</strong>
                            <span className={styles.listEntrySubtitle}>{friend.email || friend.phone || `ID ${friend.id}`}</span>
                          </span>
                        </span>
                      </button>
                    )
                  })}
                  {acceptedFriends.length === 0 ? <p>Báº¡n chÆ°a cĂ³ báº¡n bĂ¨ Ä‘á»ƒ táº¡o nhĂ³m.</p> : null}
                  {acceptedFriends.length > 0 && filteredCreateGroupInviteCandidates.length === 0 ? <p>KhĂ´ng tĂ¬m tháº¥y báº¡n bĂ¨ phĂ¹ há»£p.</p> : null}
                </div>
                <button
                  type="button"
                  className={styles.overlayCloseBtn}
                  disabled={!groupName.trim() || groupMemberIds.length === 0 || creatingGroup}
                  onClick={handleCreateGroupConversation}
                >
                  {creatingGroup ? 'Äang táº¡o nhĂ³m...' : 'Táº¡o nhĂ³m'}
                </button>
                <button type="button" className={styles.overlayCloseBtn} onClick={() => setShowCreateGroupModal(false)} title="ÄĂ³ng" aria-label="ÄĂ³ng">
                  ÄĂ³ng
                </button>
              </div>
            </div>
          ) : null}

          {activeCall ? (
            <div className={styles.callOverlay}>
              <div className={styles.callBackdropGlow} />
              <div className={styles.callTopBar}>
                <div>
                  <small>Call in progress</small>
                  <h3>{activeCall.withName}</h3>
                  <p className={styles.callParticipantCount}>
                    {callParticipantProfiles.length} ngÆ°á»i Ä‘ang tham gia
                  </p>
                </div>
                <div className={styles.callBadge}>{callAnswered ? formattedCallTime : 'Äá»• chuĂ´ng...'}</div>
              </div>
              {callParticipantProfiles.length > 0 ? (
                <div className={styles.callParticipantList}>
                  {callParticipantProfiles.map((member) => (
                    <div key={member.userId} className={styles.callParticipantItem}>
                      {member.avatarUrl ? (
                        <img src={member.avatarUrl} alt={member.name} />
                      ) : (
                        <span>{(member.name[0] || 'U').toUpperCase()}</span>
                      )}
                      <strong>{member.name}</strong>
                    </div>
                  ))}
                </div>
              ) : null}
              <div className={styles.callMainVideo}>
                {remoteStreams.length > 0 ? (
                  <div className={styles.remoteGrid}>
                    {remoteStreams.map((item) => (
                      <div key={item.userId} className={styles.remoteVideoCard}>
                        <video
                          autoPlay
                          playsInline
                          ref={(node) => {
                            if (!node) return
                            node.srcObject = item.stream
                          }}
                        />
                        <span className={styles.remoteVideoLabel}>
                          {callParticipantProfiles.find((member) => member.userId === item.userId)?.name || `NgÆ°á»i dĂ¹ng #${item.userId}`}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className={styles.callAvatarBig}>{(activeCall.withName[0] || 'U').toUpperCase()}</div>
                )}
              </div>
              <div className={styles.callMiniVideo}>
                <video ref={localVideoRef} autoPlay muted playsInline className={styles.localVideo} />
                <span>Báº¡n</span>
              </div>
              <div className={styles.callControls}>
                <button
                  type="button"
                  onClick={() => {
                    const stream = localStreamRef.current
                    if (!stream) return
                    const next = !mutedMic
                    stream.getAudioTracks().forEach((track) => {
                      track.enabled = !next
                    })
                    setMutedMic(next)
                  }}
                  title="Báº­t táº¯t micro"
                  aria-label="Báº­t táº¯t micro"
                >
                  <Phone size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const stream = localStreamRef.current
                    if (!stream) return
                    const next = !mutedCam
                    stream.getVideoTracks().forEach((track) => {
                      track.enabled = !next
                    })
                    setMutedCam(next)
                  }}
                  title="Báº­t táº¯t camera"
                  aria-label="Báº­t táº¯t camera"
                >
                  <Video size={16} />
                </button>
                <button type="button" title="Má»i ngÆ°á»i khĂ¡c" aria-label="Má»i ngÆ°á»i khĂ¡c">
                  <UserPlus size={16} />
                </button>
                <button type="button" className={styles.endCallOverlayBtn} onClick={handleEndCall} title="Káº¿t thĂºc cuá»™c gá»i" aria-label="Káº¿t thĂºc cuá»™c gá»i">
                  <PhoneOff size={16} />
                </button>
              </div>
            </div>
          ) : null}

          {actionMenu && activeActionMessage ? (
            <div ref={actionMenuRef} className={styles.actionMenu} style={{ left: `${actionMenu.x}px`, top: `${actionMenu.y}px` }}>
              <div className={styles.actionMenuHeader}>
                <span className={styles.listEntryAvatar}>{getAvatarInitial(activeActionMessage.senderName || activeActionMessage.sender?.fullName || activeActionMessage.sender?.name)}</span>
                <div className={styles.actionMenuMeta}>
                  <strong>{String(activeActionMessage.senderName || activeActionMessage.sender?.fullName || activeActionMessage.sender?.name || 'NgÆ°á»i dĂ¹ng')}</strong>
                  <small>{formatVietnamTime(activeActionMessage.createdAt)}</small>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setForwardingMessageId(activeActionMessage.id)
                  setActionMenu(null)
                }}
              >
                Chuyá»ƒn tiáº¿p
              </button>
              <button
                type="button"
                onClick={() => {
                  void handleTogglePinMessage(activeActionMessage)
                  setActionMenu(null)
                }}
              >
                {pinnedMessageIds.has(activeActionMessage.id) ? 'Bá» ghim' : 'Ghim'}
              </button>
              {activeActionMessage.senderId === user?.id ? (
                <button
                  type="button"
                  onClick={() => {
                    handleRecall(activeActionMessage)
                    setActionMenu(null)
                  }}
                >
                  Thu há»“i
                </button>
              ) : null}
              {activeActionMessage.senderId === user?.id ? (
                <button
                  type="button"
                  onClick={() => {
                    handleDeleteMessage(activeActionMessage)
                    setActionMenu(null)
                  }}
                >
                  XĂ³a
                </button>
              ) : null}
            </div>
          ) : null}
        </section>

        <aside className={styles.detailsPanel}>
          {!selectedConversation ? (
            <div className={styles.detailsEmpty}>
              <Info size={16} />
              <p>Chá»n má»™t cuá»™c trĂ² chuyá»‡n Ä‘á»ƒ xem thĂ´ng tin vĂ  thao tĂ¡c nhanh.</p>
            </div>
          ) : null}

          {selectedConversation && selectedConversation.type === 'direct' ? (
            <div className={styles.detailsBody}>
              <div className={styles.detailsHeader}>
                <h3>ThĂ´ng tin Ä‘oáº¡n chat</h3>
                <span>Chat Ä‘Æ¡n</span>
              </div>

              <div className={styles.detailsIdentity}>
                <div className={styles.detailsAvatar}>{(selectedName[0] || 'U').toUpperCase()}</div>
                <div>
                  <strong>{selectedName}</strong>
                  <small>
                    {isDirectPeerFriend
                      ? 'ÄĂ£ káº¿t báº¡n'
                      : isDirectPeerPending
                        ? 'Äang chá» xĂ¡c nháº­n káº¿t báº¡n'
                        : 'ChÆ°a káº¿t báº¡n'}
                  </small>
                </div>
              </div>

              <div className={styles.detailsSection}>
                <strong>TĂ¹y chá»n nhanh</strong>
                <div className={styles.detailActionsGrid}>
                  {directPeer ? (
                    <Link to={`/profile/${directPeer.id}`} className={styles.detailLinkAction}>
                      Xem trang cĂ¡ nhĂ¢n
                    </Link>
                  ) : null}
                  <button type="button" onClick={() => void handleClearChatForMe()}>
                    XĂ³a Ä‘oáº¡n chat phĂ­a báº¡n
                  </button>
                  <button type="button" onClick={() => setShowNotificationsDrawer(true)}>
                    Má»Ÿ thĂ´ng bĂ¡o
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          {selectedGroup ? (
            <div className={styles.detailsBody}>
              <div className={styles.detailsHeader}>
                <h3>ThĂ´ng tin nhĂ³m</h3>
                <span>{selectedGroup.members.length} thĂ nh viĂªn</span>
              </div>

              <div className={styles.detailsIdentity}>
                <div className={styles.detailsAvatar}>{(selectedGroup.name?.[0] || 'G').toUpperCase()}</div>
                <div>
                  <strong>{selectedGroup.name || 'NhĂ³m chat'}</strong>
                  <small>Báº¡n: {getGroupRoleLabel(myGroupRole)}</small>
                </div>
              </div>

              <div className={styles.detailsTabs}>
                <button
                  type="button"
                  className={rightPanelSection === 'overview' ? styles.detailsTabActive : ''}
                  onClick={() => setRightPanelSection('overview')}
                >
                  Tá»•ng quan
                </button>
                <button
                  type="button"
                  className={rightPanelSection === 'members' ? styles.detailsTabActive : ''}
                  onClick={() => setRightPanelSection('members')}
                >
                  ThĂ nh viĂªn
                </button>
                <button
                  type="button"
                  className={rightPanelSection === 'manage' ? styles.detailsTabActive : ''}
                  onClick={() => setRightPanelSection('manage')}
                >
                  Quáº£n lĂ½
                </button>
              </div>

              {rightPanelSection === 'overview' ? (
                <>
                  <div className={styles.detailsSection}>
                    <strong>Vai trĂ² chĂ­nh</strong>
                    <div className={styles.groupMemberList}>
                      <div className={styles.groupMemberRow}>
                        <div className={styles.groupMemberInfo}>
                          <b>{groupLeader?.fullName || 'ChÆ°a xĂ¡c Ä‘á»‹nh'}</b>
                          <small>TrÆ°á»Ÿng nhĂ³m Â· ID {groupLeader?.userId ?? selectedGroup.createdBy}</small>
                        </div>
                        <Crown size={14} />
                      </div>
                      <div className={styles.groupMemberRow}>
                        <div className={styles.groupMemberInfo}>
                          <b>{groupDeputy?.fullName || 'ChÆ°a cĂ³ phĂ³ nhĂ³m'}</b>
                          <small>{groupDeputy ? `PhĂ³ nhĂ³m Â· ID ${groupDeputy.userId}` : 'Cáº§n chá»‰ Ä‘á»‹nh Ä‘á»ƒ trÆ°á»Ÿng nhĂ³m cĂ³ thá»ƒ rá»i nhĂ³m'}</small>
                        </div>
                        <UserCheck size={14} />
                      </div>
                    </div>
                  </div>

                  <div className={styles.detailsSection}>
                    <strong>Thao tĂ¡c nhanh</strong>
                    <div className={styles.detailActionsGrid}>
                      <button type="button" onClick={() => setRightPanelSection('manage')}>
                        Quáº£n lĂ½ quyá»n & thĂ nh viĂªn
                      </button>
                      <button type="button" onClick={() => void handleClearChatForMe()}>
                        XĂ³a Ä‘oáº¡n chat phĂ­a báº¡n
                      </button>
                    </div>
                  </div>
                </>
              ) : null}

              {rightPanelSection === 'members' ? (
                <div className={styles.detailsSection}>
                  <strong>Danh sĂ¡ch thĂ nh viĂªn ({selectedGroup.members.length})</strong>
                  <div className={styles.groupMemberList}>
                    {selectedGroup.members.map((member) => (
                      <div key={member.userId} className={styles.groupMemberRow}>
                        <div className={styles.groupMemberInfo}>
                          <b>{member.fullName}{Number(member.userId) === Number(user?.id) ? ' (Báº¡n)' : ''}</b>
                          <small>{getGroupRoleLabel(member.role)} Â· ID {member.userId}</small>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {rightPanelSection === 'manage' ? (
                <>
                  <p className={styles.groupManageHint}>
                    {canManageRoles
                      ? 'Báº¡n lĂ  trÆ°á»Ÿng nhĂ³m: cĂ³ thá»ƒ phĂ¢n quyá»n, thĂªm/xĂ³a thĂ nh viĂªn, giáº£i tĂ¡n nhĂ³m vĂ  rá»i nhĂ³m.'
                      : canRemoveMembers
                        ? 'Báº¡n lĂ  phĂ³ nhĂ³m: cĂ³ thá»ƒ thĂªm/xĂ³a thĂ nh viĂªn.'
                        : 'Báº¡n lĂ  thĂ nh viĂªn: chá»‰ cĂ³ thá»ƒ rá»i nhĂ³m.'}
                  </p>

                  <div className={styles.detailsSection}>
                    <strong>Quáº£n lĂ½ thĂ nh viĂªn hiá»‡n táº¡i</strong>
                    <div className={styles.groupMemberList}>
                      {selectedGroup.members.map((member) => {
                        const isSelf = Number(member.userId) === Number(user?.id)
                        const isLeader = member.role === 'leader'
                        const isDeputy = member.role === 'deputy'
                        return (
                          <div key={member.userId} className={styles.groupMemberRow}>
                            <div className={styles.groupMemberInfo}>
                              <b>{member.fullName}{isSelf ? ' (Báº¡n)' : ''}</b>
                              <small>{getGroupRoleLabel(member.role)} Â· ID {member.userId}</small>
                            </div>
                            {(canManageRoles || canRemoveMembers) && !isSelf ? (
                              <div className={styles.groupMemberActions}>
                                {canManageRoles && !isLeader ? (
                                  <button
                                    type="button"
                                    disabled={groupActionBusyId === `role-${member.userId}`}
                                    onClick={() => {
                                      void handleTransferLeader(member.userId)
                                    }}
                                  >
                                    {groupActionBusyId === `role-${member.userId}` ? 'Äang chuyá»ƒn...' : 'LĂ m trÆ°á»Ÿng nhĂ³m'}
                                  </button>
                                ) : null}
                                {canManageRoles && !isLeader ? (
                                  <button
                                    type="button"
                                    disabled={groupActionBusyId === `deputy-${isDeputy ? 'none' : member.userId}`}
                                    onClick={() => {
                                      void handleSetDeputyRole(isDeputy ? null : member.userId)
                                    }}
                                  >
                                    {groupActionBusyId === `deputy-${isDeputy ? 'none' : member.userId}`
                                      ? 'Äang cáº­p nháº­t...'
                                      : isDeputy
                                        ? 'Gá»¡ phĂ³ nhĂ³m'
                                        : 'GĂ¡n phĂ³ nhĂ³m'}
                                  </button>
                                ) : null}
                                <button
                                  type="button"
                                  className={styles.dangerBtn}
                                  disabled={groupActionBusyId === `remove-${member.userId}`}
                                  onClick={() => {
                                    void handleRemoveMemberFromGroup(member.userId)
                                  }}
                                >
                                  {groupActionBusyId === `remove-${member.userId}` ? 'Äang xĂ³a...' : 'XĂ³a'}
                                </button>
                              </div>
                            ) : null}
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  {canAddMembers ? (
                    <div className={styles.detailsSection}>
                      <strong>ThĂªm thĂ nh viĂªn</strong>
                      <input
                        className={styles.detailsSearchInput}
                        value={groupSearchKeyword}
                        onChange={(event) => setGroupSearchKeyword(event.target.value)}
                        placeholder="TĂ¬m báº¡n bĂ¨ theo tĂªn, email hoáº·c ID"
                      />
                      <div className={styles.groupMemberList}>
                        {filteredGroupInviteCandidates.map((friend) => (
                          <div key={friend.id} className={styles.groupMemberRow}>
                            <div className={styles.groupMemberInfo}>
                              <b>{friend.fullName}</b>
                              <small>{friend.email || friend.phone || `ID ${friend.id}`}</small>
                            </div>
                            <div className={styles.groupMemberActions}>
                              <button
                                type="button"
                                disabled={groupActionBusyId === `add-${friend.id}`}
                                onClick={() => {
                                  void handleAddMemberToGroup(friend.id)
                                }}
                              >
                                {groupActionBusyId === `add-${friend.id}` ? 'Äang thĂªm...' : 'ThĂªm'}
                              </button>
                            </div>
                          </div>
                        ))}
                        {filteredGroupInviteCandidates.length === 0 ? <p>KhĂ´ng cĂ²n báº¡n bĂ¨ phĂ¹ há»£p Ä‘á»ƒ thĂªm.</p> : null}
                      </div>
                    </div>
                  ) : null}

                  <div className={styles.detailsSection}>
                    <strong>HĂ nh Ä‘á»™ng nhĂ³m</strong>
                    <div className={styles.detailActionsGrid}>
                      <button
                        type="button"
                        className={styles.dangerBtn}
                        disabled={groupActionBusyId === 'leave-group' || (myGroupRole === 'leader' && !canLeaderLeaveGroup)}
                        onClick={() => {
                          void handleLeaveGroup()
                        }}
                      >
                        <LogOut size={14} />
                        {groupActionBusyId === 'leave-group' ? 'Äang rá»i nhĂ³m...' : 'Rá»i nhĂ³m'}
                      </button>
                      {canDissolveSelectedGroup ? (
                        <button
                          type="button"
                          className={styles.dangerBtn}
                          disabled={groupActionBusyId === 'dissolve-group'}
                          onClick={() => {
                            void handleDissolveGroup()
                          }}
                        >
                          <Trash2 size={14} />
                          {groupActionBusyId === 'dissolve-group' ? 'Äang giáº£i tĂ¡n...' : 'Giáº£i tĂ¡n nhĂ³m'}
                        </button>
                      ) : null}
                    </div>
                    {myGroupRole === 'leader' && !canLeaderLeaveGroup ? (
                      <small className={styles.groupManageHint}>TrÆ°á»Ÿng nhĂ³m chá»‰ cĂ³ thá»ƒ rá»i nhĂ³m sau khi Ä‘Ă£ cĂ³ phĂ³ nhĂ³m.</small>
                    ) : null}
                  </div>
                </>
              ) : null}
            </div>
          ) : null}
        </aside>
      </div>
    </div>
  )
}
