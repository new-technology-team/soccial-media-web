'use client'

import { ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useSearchParams } from 'react-router-dom'
import {
  BadgeCheck,
  BadgeQuestionMark,
  Bell,
  BicepsFlexed,
  CirclePlus,
  File,
  Flame,
  Handshake,
  Heart,
  Info,
  MoreHorizontal,
  PartyPopper,
  Phone,
  PhoneOff,
  Rocket,
  Search,
  Send,
  Smile,
  SmilePlus,
  Sparkles,
  Star,
  Sticker as StickerIcon,
  ThumbsUp,
  UserPlus,
  Video,
  Zap,
  type LucideIcon,
} from 'lucide-react'
import styles from './page.module.css'
import { ApiError, api } from '@/api/client'
import { useAuthStore } from '@/contexts/auth-store'
import { useChatStore } from '@/contexts/chat-store'
import { useCallStore, type IncomingCallState } from '@/contexts/call-store'
import { connectSocket, getSocket } from '@/services/socket'
import { useConversationRouting } from '@/hooks/use-conversation-routing'
import { fileToBase64, mapTypeFromFile } from '@/services/messages/file-utils'
import {
  loadChatConversations,
  loadChatMessages,
  loadChatNotifications,
  loadFriendMap,
  searchMessageUsers,
} from '@/services/messages/chat-data-service'
import {
  formatVietnamTime,
  getAvatarInitial,
  getConversationDisplayName,
} from '@/services/messages/formatters'
import { normalizeIncomingMessageForViewer } from '@/services/messages/message-normalizer'
import { parseNotificationMeta, type MessageNotificationItem } from '@/services/messages/notification-meta'
import type { ChatMessage, Conversation, FriendConnection } from '@/types'
import { MessageComposer } from './components/message-composer'
import { ConversationDetailsPanel } from './components/conversation-details-panel'
import { MessagesSidebar } from './components/messages-sidebar'
import { MessageThread } from './components/message-thread'
import { MessagesOverlays } from './components/messages-overlays'

type ActiveCall = {
  type: 'voice' | 'video'
  withName: string
  startedAt: number
}

type AttachmentDraft = {
  file: File
  type: 'image' | 'video' | 'audio' | 'file'
  previewUrl: string | null
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

const MESSAGE_ICON_TOKENS: Record<string, { label: string; Icon: LucideIcon }> = {
  ':smile:': { label: 'Cười', Icon: Smile },
  ':smile-plus:': { label: 'Vui vẻ', Icon: SmilePlus },
  ':like:': { label: 'Thích', Icon: ThumbsUp },
  ':love:': { label: 'Yêu thích', Icon: Heart },
  ':thanks:': { label: 'Cảm ơn', Icon: Handshake },
  ':sparkles:': { label: 'Lấp lánh', Icon: Sparkles },
  ':fire:': { label: 'Nổi bật', Icon: Flame },
  ':party:': { label: 'Ăn mừng', Icon: PartyPopper },
  ':strong:': { label: 'Mạnh mẽ', Icon: BicepsFlexed },
  ':rocket:': { label: 'Bứt phá', Icon: Rocket },
  ':star:': { label: 'Ngôi sao', Icon: Star },
  ':zap:': { label: 'Nhanh', Icon: Zap },
}

const STICKER_ICON_TOKENS: Record<string, { label: string; Icon: LucideIcon }> = {
  'icon:smile': { label: 'Cười', Icon: Smile },
  'icon:smile-plus': { label: 'Vui vẻ', Icon: SmilePlus },
  'icon:heart': { label: 'Yêu thích', Icon: Heart },
  'icon:sparkles': { label: 'Lấp lánh', Icon: Sparkles },
  'icon:flame': { label: 'Nổi bật', Icon: Flame },
  'icon:party': { label: 'Ăn mừng', Icon: PartyPopper },
  'icon:rocket': { label: 'Bứt phá', Icon: Rocket },
  'icon:star': { label: 'Ngôi sao', Icon: Star },
  'icon:like': { label: 'Thích', Icon: ThumbsUp },
  'icon:thanks': { label: 'Cảm ơn', Icon: Handshake },
  'icon:strong': { label: 'Mạnh mẽ', Icon: BicepsFlexed },
  'icon:zap': { label: 'Nhanh', Icon: Zap },
  'icon:badge-check': { label: 'Đã xong', Icon: BadgeCheck },
  'icon:question': { label: 'Cần hỏi', Icon: BadgeQuestionMark },
  'icon:sticker': { label: 'Sticker', Icon: StickerIcon },
  'icon:file': { label: 'Tệp', Icon: File },
}

const STICKER_EMOJI_TOKENS: Record<string, { label: string; emoji: string }> = {
  'emoji:🤩': { label: 'Mắt sao', emoji: '🤩' },
  'emoji:🥰': { label: 'Ấm áp', emoji: '🥰' },
  'emoji:😂': { label: 'Cười lớn', emoji: '😂' },
  'emoji:🥹': { label: 'Cảm động', emoji: '🥹' },
  'emoji:🔥': { label: 'Nổi bật', emoji: '🔥' },
  'emoji:🎉': { label: 'Ăn mừng', emoji: '🎉' },
  'emoji:🚀': { label: 'Bứt phá', emoji: '🚀' },
  'emoji:🌈': { label: 'Rực rỡ', emoji: '🌈' },
  'emoji:👏': { label: 'Vỗ tay', emoji: '👏' },
  'emoji:🙌': { label: 'Tuyệt vời', emoji: '🙌' },
  'emoji:💪': { label: 'Mạnh mẽ', emoji: '💪' },
  'emoji:🤝': { label: 'Cảm ơn', emoji: '🤝' },
  'emoji:✅': { label: 'Đã xong', emoji: '✅' },
  'emoji:❓': { label: 'Cần hỏi', emoji: '❓' },
  'emoji:💡': { label: 'Ý tưởng', emoji: '💡' },
  'emoji:📎': { label: 'Đính kèm', emoji: '📎' },
}

export default function MessagesPage() {
  const [searchParams] = useSearchParams()
  const token = useAuthStore((state) => state.accessToken)
  const user = useAuthStore((state) => state.user)
  const {
    conversations,
    selectedConversationId,
    messagesByConversation,
    setConversations,
    selectConversation,
    markConversationRead,
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
  const [showSettingsDrawer, setShowSettingsDrawer] = useState(false)
  const [rightPanelSection, setRightPanelSection] = useState<'overview' | 'members' | 'manage'>('overview')
  const [groupName, setGroupName] = useState('')
  const [groupSearchKeyword, setGroupSearchKeyword] = useState('')
  const [groupMemberIds, setGroupMemberIds] = useState<number[]>([])
  const [creatingGroup, setCreatingGroup] = useState(false)
  const [groupActionBusyId, setGroupActionBusyId] = useState<string | null>(null)
  const [newMessageKeyword, setNewMessageKeyword] = useState('')
  const [searchUsersResult, setSearchUsersResult] = useState<Array<{ id: number; name: string }>>([])
  const [notifications, setNotifications] = useState<Array<{ id: number; type: string; title: string; body: string | null; created_at: string; is_read: number; meta?: Record<string, unknown> | null }>>([])
  const [showJumpToLatest, setShowJumpToLatest] = useState(false)
  const [hasMoreHistory, setHasMoreHistory] = useState<Record<string, boolean>>({})
  const [messageLimitByConversation, setMessageLimitByConversation] = useState<
    Record<string, { total: number; sent: number; remaining: number; isFriend: boolean } | null>
  >({})
  const [friendMap, setFriendMap] = useState<Record<number, FriendConnection>>({})
  const [pendingFriendRequestTo, setPendingFriendRequestTo] = useState<Record<number, boolean>>({})
  const [mutedMic, setMutedMic] = useState(false)
  const [mutedCam, setMutedCam] = useState(false)
  const [callAnswered, setCallAnswered] = useState(false)
  const [ringingStartedAt, setRingingStartedAt] = useState<number | null>(null)
  const [isSendingMessage, setIsSendingMessage] = useState(false)
  const [attachmentDraft, setAttachmentDraft] = useState<AttachmentDraft | null>(null)
  const [typingUserIds, setTypingUserIds] = useState<Set<number>>(new Set())
  const [messageSearchDraft, setMessageSearchDraft] = useState('')
  const [messageSearchKeyword, setMessageSearchKeyword] = useState('')
  const [showMessageFilters, setShowMessageFilters] = useState(false)
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [sharedContent, setSharedContent] = useState<{ photosVideos: ChatMessage[]; files: ChatMessage[]; links: ChatMessage[] }>({
    photosVideos: [],
    files: [],
    links: [],
  })
  const [loadingSharedContent, setLoadingSharedContent] = useState(false)
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

  const scrollConversationToBottom = useCallback((behavior: ScrollBehavior = 'auto') => {
    window.setTimeout(() => {
      const node = messagesWrapRef.current
      if (!node) return
      node.scrollTo({ top: node.scrollHeight, behavior })
    }, 0)
  }, [])

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
  const { openConversation } = useConversationRouting({
    token,
    queryConversationId,
    selectedConversationId,
    setConversations,
    selectConversation,
  })

  const handleOpenConversation = useCallback(
    (conversationId: string) => {
      openConversation(conversationId)
      markConversationRead(conversationId)
    },
    [markConversationRead, openConversation]
  )

  const reloadNotifications = useCallback(async () => {
    if (!token) return
    try {
      setNotifications(await loadChatNotifications(token))
    } catch {
      // Ignore transient notification reload issues.
    }
  }, [token])

  const reloadFriendMap = useCallback(async () => {
    if (!token || !user?.id) return
    try {
      setFriendMap(await loadFriendMap(token))
    } catch (error) {
      console.error('Không thể tải danh sách bạn bè', error)
    }
  }, [token, user?.id])

  const refreshConversations = useCallback(async () => {
    if (!token) return
    setConversations(await loadChatConversations(token))
  }, [token, setConversations])

  useEffect(() => {
    if (!token || !selectedConversationId) return

    setLoadingMessages(true)
    api.listMessages(token, selectedConversationId, {
      limit: 25,
      q: messageSearchKeyword.trim() || undefined,
    })
      .then((response) => {
        setMessages(selectedConversationId, response.messages)
        setHasMoreHistory((prev) => ({ ...prev, [selectedConversationId]: response.messages.length >= 25 }))
        setMessageLimitByConversation((prev) => ({
          ...prev,
          [selectedConversationId]: response.messageLimit || null,
        }))
        const lastMessageId = response.messages[response.messages.length - 1]?.id || null
        api.markConversationRead(token, selectedConversationId, lastMessageId).catch(() => undefined)
        scrollConversationToBottom('auto')
      })
      .catch(console.error)
      .finally(() => setLoadingMessages(false))
  }, [messageSearchKeyword, scrollConversationToBottom, token, selectedConversationId, setMessages])

  useEffect(() => {
    if (!token || !selectedConversationId) return
    setLoadingSharedContent(true)
    api.getConversationSharedContent(token, selectedConversationId)
      .then(setSharedContent)
      .catch(() => setSharedContent({ photosVideos: [], files: [], links: [] }))
      .finally(() => setLoadingSharedContent(false))
  }, [token, selectedConversationId, messagesByConversation[selectedConversationId || '']?.length])

  useEffect(() => {
    reloadNotifications().catch(() => undefined)
  }, [reloadNotifications])

  useEffect(() => {
    if (!token || !newMessageKeyword.trim()) {
      setSearchUsersResult([])
      return
    }

    const timer = window.setTimeout(() => {
      searchMessageUsers(token, newMessageKeyword.trim())
        .then((result) => {
          setSearchUsersResult(result)
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
    setTypingUserIds(new Set())
    setMessageSearchDraft('')
    markConversationRead(selectedConversationId)
  }, [markConversationRead, selectedConversationId])

  useEffect(() => {
    if (!token) return

    const socket = connectSocket(token, user?.id)
    socket.on('message:new', (payload: ChatMessage) => {
      const normalized = normalizeIncomingMessageForViewer(payload, user?.id)
      upsertMessage(normalized.conversationId, normalized)
      if (normalized.conversationId === selectedConversationId) {
        setTypingUserIds((prev) => {
          const next = new Set(prev)
          next.delete(normalized.senderId)
          return next
        })
      }
      refreshConversations().catch(() => undefined)
    })

    socket.on('message:reaction', (payload: { conversationId: string; message: ChatMessage }) => {
      upsertMessage(String(payload.conversationId), normalizeIncomingMessageForViewer(payload.message, user?.id))
      refreshConversations().catch(() => undefined)
    })

    socket.on('message:updated', (payload: { conversationId: string; message: ChatMessage | null }) => {
      if (!payload?.message) return
      upsertMessage(String(payload.conversationId), normalizeIncomingMessageForViewer(payload.message, user?.id))
      refreshConversations().catch(() => undefined)
    })

    socket.on('conversation:updated', () => {
      refreshConversations().catch(() => undefined)
    })

    socket.on('conversation:seen', () => {
      refreshConversations().catch(() => undefined)
    })

    socket.on('conversation:nickname', () => {
      refreshConversations().catch(() => undefined)
    })

    socket.on('conversation:members', () => {
      refreshConversations().catch(() => undefined)
    })

    socket.on('presence:updated', () => {
      refreshConversations().catch(() => undefined)
    })

    socket.on('message:seen', () => {
      refreshConversations().catch(() => undefined)
    })

    socket.on('message:typing', (payload: { conversationId: string; fromUserId: number; isTyping: boolean }) => {
      if (!payload || String(payload.conversationId) !== String(selectedConversationId) || Number(payload.fromUserId) === Number(user?.id)) return
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

    const handleSocketNotification = (payload: { type?: string } | null) => {
      if (!payload) return
      reloadNotifications().catch(() => undefined)
      if (payload.type === 'message') {
        refreshConversations().catch(() => undefined)
      }

      if (payload.type === 'friend-request' || payload.type === 'friend-accepted') {
        reloadFriendMap().catch(() => undefined)
      }
    }
    socket.on('notification:new', handleSocketNotification)

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
      setCallStatus(`Cuộc gọi ${payload.callType === 'video' ? 'video' : 'thoại'} đến`)
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
      setCallStatus('Người nhận đã tham gia cuộc gọi')
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
          setCallStatus('Mọi người đã rời cuộc gọi')
        } else {
          setCallStatus('Một người đã rời cuộc gọi')
        }
        return
      }

      setCallStatus('Cuộc gọi đã kết thúc')
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
        setCallStatus(`Cuộc gọi đang có ${payload.participantCount} người tham gia`)
      }
    })

    return () => {
      socket.off('message:new')
      socket.off('message:reaction')
      socket.off('message:updated')
      socket.off('message:typing')
      socket.off('message:seen')
      socket.off('conversation:updated')
      socket.off('conversation:seen')
      socket.off('conversation:nickname')
      socket.off('conversation:members')
      socket.off('presence:updated')
      socket.off('notification:new', handleSocketNotification)
      socket.off('call:offer')
      socket.off('call:answer')
      socket.off('call:join')
      socket.off('call:leave')
      socket.off('call:ice-candidate')
      socket.off('call:end')
      socket.off('call:participants')
    }
  }, [activeCall, joinedCallUserIds, refreshConversations, reloadFriendMap, reloadNotifications, selectedConversationId, setGlobalIncomingCall, token, upsertMessage, user?.id])

  useEffect(() => {
    if (!globalIncomingCall || incomingCall) return
    setIncomingCall(globalIncomingCall)
    setCallStatus(`Cuộc gọi ${globalIncomingCall.callType === 'video' ? 'video' : 'thoại'} đến`)
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
    if (!chatNotice) return
    const timer = window.setTimeout(() => {
      setChatNotice(null)
    }, 3000)
    return () => window.clearTimeout(timer)
  }, [chatNotice])

  useEffect(() => {
    return () => {
      if (attachmentDraft?.previewUrl) {
        URL.revokeObjectURL(attachmentDraft.previewUrl)
      }
    }
  }, [attachmentDraft])

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

  useEffect(() => {
    if (!selectedConversationId || loadingOlderMessages) return
    scrollConversationToBottom('smooth')
  }, [loadingOlderMessages, messages.length, scrollConversationToBottom, selectedConversationId])

  const activeActionMessage = useMemo(
    () => (actionMenu ? messages.find((msg) => msg.id === actionMenu.messageId) || null : null),
    [actionMenu, messages]
  )

  const [searchTerm, setSearchTerm] = useState('')

  const selectedConversationMembers = useMemo(
    () => new Map((selectedConversation?.members || []).map((member) => [member.userId, member])),
    [selectedConversation]
  )

  const resolveConversationActor = useCallback(
    (userId: number, fallbackName?: string | null, fallbackAvatar?: string | null) => {
      const member = selectedConversationMembers.get(userId)
      if (member) {
        return {
          name: member.fullName || fallbackName || `Người dùng #${userId}`,
          avatarUrl: member.avatarUrl || fallbackAvatar || null,
        }
      }

      if (user?.id === userId) {
        return {
          name: user.fullName || 'Bạn',
          avatarUrl: user.avatarUrl || null,
        }
      }

      return {
        name: fallbackName || `Người dùng #${userId}`,
        avatarUrl: fallbackAvatar || null,
      }
    },
    [selectedConversationMembers, user?.avatarUrl, user?.fullName, user?.id]
  )

  const getConversationActivityTime = (conversation: Conversation) => {
    const raw = conversation.lastMessage?.createdAt || conversation.lastMessage?.updatedAt || conversation.updatedAt || null
    const value = raw ? new Date(raw).getTime() : 0
    return Number.isNaN(value) ? 0 : value
  }

  const getMessageReadLabel = useCallback(
    (message: ChatMessage) => {
      if (!selectedConversation || message.senderId !== user?.id) return null

      const readByIds = new Set((message.readBy || []).map((item) => Number(item.userId)))
      if (readByIds.size > 0) {
        const otherMembers = selectedConversation.members.filter((member) => member.userId !== user.id)
        const names = otherMembers
          .filter((member) => readByIds.has(Number(member.userId)))
          .map((member) => member.fullName)
        if (selectedConversation.type === 'direct') return names.length ? 'Đã xem' : message.status === 'delivered' ? 'Đã nhận' : 'Đã gửi'
        if (names.length > 0) return `Đã xem bởi ${names.slice(0, 2).join(', ')}${names.length > 2 ? ` +${names.length - 2}` : ''}`
      }

      const sentAt = new Date(message.createdAt).getTime()
      if (Number.isNaN(sentAt)) return 'Đã gửi'

      const otherMembers = selectedConversation.members.filter((member) => member.userId !== user.id)
      const seenCount = otherMembers.filter((member) => {
        if (!member.lastReadAt) return false
        const readAt = new Date(member.lastReadAt).getTime()
        return !Number.isNaN(readAt) && readAt >= sentAt
      }).length

      if (seenCount === 0) return message.status === 'delivered' ? 'Đã nhận' : 'Đã gửi'
      if (selectedConversation.type === 'direct' || seenCount >= otherMembers.length) return 'Đã xem'
      return `Đã xem bởi ${seenCount}`
    },
    [selectedConversation, user?.id]
  )

  useEffect(() => {
    reloadFriendMap().catch(() => undefined)
  }, [reloadFriendMap])

  const filteredConversations = useMemo(() => {
    const q = searchTerm.trim().toLowerCase()
    const items = !q
      ? conversations
      : conversations.filter((conversation) =>
          getConversationDisplayName(conversation, user?.id).toLowerCase().includes(q)
        )

    return [...items].sort((a, b) => {
      if (Boolean(a.isPinned) !== Boolean(b.isPinned)) return Number(Boolean(b.isPinned)) - Number(Boolean(a.isPinned))
      return getConversationActivityTime(b) - getConversationActivityTime(a)
    })
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
      setCallStatus('Không có phản hồi sau 1 phút. Cuộc gọi đã tự kết thúc.')
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
      online: Boolean(member.online),
      lastActiveAt: member.lastActiveAt || null,
    }
  }, [selectedConversation, user?.id])

  const directPeerActivityLabel = useMemo(() => {
    if (!directPeer) return ''
    if (directPeer.online) return 'Đang hoạt động'
    if (!directPeer.lastActiveAt) return 'Ngoại tuyến'
    const minutes = Math.max(1, Math.round((Date.now() - new Date(directPeer.lastActiveAt).getTime()) / 60000))
    if (!Number.isFinite(minutes)) return 'Ngoại tuyến'
    return minutes < 60 ? `Hoạt động ${minutes} phút trước` : `Hoạt động ${Math.round(minutes / 60)} giờ trước`
  }, [directPeer])

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
  const canLeaderLeaveGroup = Boolean(selectedGroup && selectedGroup.members.some((member) => Number(member.userId) !== Number(user?.id)))

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
    setMessageSearchKeyword('')
  }, [selectedConversationId])

  const handleToggleConversationPin = async () => {
    if (!token || !selectedConversation) return
    try {
      await api.pinConversation(token, selectedConversation.id, !selectedConversation.isPinned)
      await refreshConversations()
      setChatNotice(selectedConversation.isPinned ? 'Đã bỏ ghim hội thoại.' : 'Đã ghim hội thoại.')
    } catch (error) {
      setChatNotice(error instanceof Error ? error.message : 'Không thể cập nhật ghim hội thoại.')
    }
  }

  const handleToggleConversationMute = async () => {
    if (!token || !selectedConversation) return
    try {
      await api.muteConversation(token, selectedConversation.id, !selectedConversation.isMuted)
      await refreshConversations()
      setChatNotice(selectedConversation.isMuted ? 'Đã bật thông báo.' : 'Đã tắt thông báo.')
    } catch (error) {
      setChatNotice(error instanceof Error ? error.message : 'Không thể cập nhật thông báo.')
    }
  }

  const handleUpdateNickname = async (memberId: number) => {
    if (!token || !selectedConversation) return
    const member = selectedConversation.members.find((item) => item.userId === memberId)
    const nextNickname = window.prompt('Nhập biệt danh. Để trống để xóa biệt danh.', member?.nickname || '')
    if (nextNickname === null) return
    try {
      await api.updateConversationNickname(token, selectedConversation.id, memberId, nextNickname.trim() || null)
      await refreshConversations()
      setChatNotice(nextNickname.trim() ? 'Đã cập nhật biệt danh.' : 'Đã xóa biệt danh.')
    } catch (error) {
      setChatNotice(error instanceof Error ? error.message : 'Không thể cập nhật biệt danh.')
    }
  }

  const handleUpdateGroupProfile = async () => {
    if (!token || !selectedGroup || !canAddMembers) return
    const nextName = window.prompt('Tên nhóm mới', selectedGroup.name || '')
    if (nextName === null || !nextName.trim()) return
    const nextAvatar = window.prompt('URL ảnh đại diện nhóm (có thể để trống)', selectedGroup.avatarUrl || '')
    if (nextAvatar === null) return
    try {
      await api.updateGroupProfile(token, selectedGroup.id, { name: nextName.trim(), avatarUrl: nextAvatar.trim() || null })
      await refreshConversations()
      setChatNotice('Đã cập nhật thông tin nhóm.')
    } catch (error) {
      setChatNotice(error instanceof Error ? error.message : 'Không thể cập nhật nhóm.')
    }
  }

  const handleBlockPeer = async () => {
    if (!token || !directPeer) return
    if (!window.confirm(`Chặn ${directPeer.name}? Hai bên sẽ không thể gửi tin nhắn trực tiếp trong hội thoại này.`)) return
    try {
      await api.blockUser(token, directPeer.id)
      setChatNotice(`Đã chặn ${directPeer.name}.`)
    } catch (error) {
      setChatNotice(error instanceof Error ? error.message : 'Không thể chặn người dùng.')
    }
  }

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
      setChatNotice('Đã gửi lời mời kết bạn. Hãy chờ đối phương chấp nhận để nhắn không giới hạn.')
      await reloadFriendMap()
    } catch (error) {
      if (error instanceof Error) {
        setChatNotice(error.message)
      } else {
        setChatNotice('Không thể gửi lời mời kết bạn.')
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
      setChatNotice('Đã hủy lời mời kết bạn.')
    } catch (error) {
      if (error instanceof Error) {
        setChatNotice(error.message)
      } else {
        setChatNotice('Không thể hủy lời mời kết bạn.')
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
      setChatNotice('Đã chấp nhận lời mời kết bạn.')
    } catch (error) {
      if (error instanceof Error) {
        setChatNotice(error.message)
      } else {
        setChatNotice('Không thể chấp nhận lời mời kết bạn.')
      }
    } finally {
      setPendingFriendRequestTo((prev) => ({ ...prev, [directPeer.id]: false }))
    }
  }

  const handlePickAttachmentType = (type: 'image' | 'video' | 'file') => {
    if (!selectedConversationId) {
      setChatNotice('Vui lòng chọn cuộc trò chuyện trước khi gửi tệp.')
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
      await refreshConversations()
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
      setChatNotice('Đã chấp nhận lời mời kết bạn.')
      if (meta?.conversationId) {
        handleOpenNotificationConversation(meta.conversationId)
      }
    } catch (error) {
      if (error instanceof Error) {
        setChatNotice(error.message)
      } else {
        setChatNotice('Không thể chấp nhận lời mời từ thông báo.')
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
      setChatNotice('Đã tạo nhóm chat thành công.')
    } catch (error) {
      if (error instanceof Error) {
        setChatNotice(error.message)
      } else {
        setChatNotice('Không thể tạo nhóm chat.')
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
      setChatNotice('Đã thêm thành viên vào nhóm.')
    } catch (error) {
      if (error instanceof Error) {
        setChatNotice(error.message)
      } else {
        setChatNotice('Không thể thêm thành viên.')
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
      setChatNotice('Đã xóa thành viên khỏi nhóm.')
    } catch (error) {
      if (error instanceof Error) {
        setChatNotice(error.message)
      } else {
        setChatNotice('Không thể xóa thành viên.')
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
      setChatNotice(targetUserId ? 'Đã cấp quyền phó nhóm.' : 'Đã thu hồi quyền phó nhóm.')
    } catch (error) {
      if (error instanceof Error) {
        setChatNotice(error.message)
      } else {
        setChatNotice('Không thể cập nhật phó nhóm.')
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
      setChatNotice('Đã chuyển quyền trưởng nhóm.')
    } catch (error) {
      if (error instanceof Error) {
        setChatNotice(error.message)
      } else {
        setChatNotice('Không thể chuyển quyền trưởng nhóm.')
      }
    } finally {
      setGroupActionBusyId(null)
    }
  }

  const handleDissolveGroup = async () => {
    if (!token || !selectedGroup || !canDissolveSelectedGroup) return
    const confirmed = window.confirm('Bạn chắc chắn muốn giải tán nhóm này? Hành động này không thể hoàn tác.')
    if (!confirmed) return
    setGroupActionBusyId('dissolve-group')
    try {
      await api.dissolveGroupConversation(token, selectedGroup.id)
      await refreshConversations()
      setChatNotice('Đã giải tán nhóm chat.')
      const fallback = conversations.find((item) => item.id !== selectedGroup.id)
      if (fallback) {
        openConversation(fallback.id)
      }
    } catch (error) {
      if (error instanceof Error) {
        setChatNotice(error.message)
      } else {
        setChatNotice('Không thể giải tán nhóm.')
      }
    } finally {
      setGroupActionBusyId(null)
    }
  }

  const handleLeaveGroup = async () => {
    if (!token || !selectedGroup || !canLeaveGroup) return
    if (myGroupRole === 'leader' && !canLeaderLeaveGroup) {
      setChatNotice('Nhóm cần có thành viên khác trước khi trưởng nhóm rời đi.')
      setRightPanelSection('manage')
      return
    }

    const confirmed = window.confirm('Bạn có chắc muốn rời nhóm này không?')
    if (!confirmed) return

    setGroupActionBusyId('leave-group')
    try {
      await api.leaveGroupConversation(token, selectedGroup.id)
      await refreshConversations()
      setChatNotice(
        myGroupRole === 'leader'
          ? 'Bạn đã rời nhóm. Quyền trưởng nhóm đã tự động chuyển cho phó nhóm.'
          : 'Bạn đã rời nhóm chat.'
      )

      const fallback = conversations.find((item) => item.id !== selectedGroup.id)
      if (fallback) {
        openConversation(fallback.id)
      } else {
        await refreshConversations()
        const refreshed = useChatStore.getState().conversations
        if (refreshed.length > 0) {
          openConversation(refreshed[0].id)
        }
      }
    } catch (error) {
      if (error instanceof Error) {
        setChatNotice(error.message)
      } else {
        setChatNotice('Không thể rời nhóm lúc này.')
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
        q: messageSearchKeyword.trim() || undefined,
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
      console.error('Không thể tải tin nhắn cũ hơn', error)
    } finally {
      setLoadingOlderMessages(false)
    }
  }

  const decrementMessageAllowance = useCallback(() => {
    if (!selectedConversationId) return

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
  }, [selectedConversationId])

  const clearAttachmentDraft = useCallback(() => {
    setAttachmentDraft((current) => {
      if (current?.previewUrl) {
        URL.revokeObjectURL(current.previewUrl)
      }
      return null
    })
  }, [])

  const handleSend = async () => {
    if ((!message.trim() && !attachmentDraft) || !token || !selectedConversationId || sendingMessageRef.current) return

    sendingMessageRef.current = true
    setIsSendingMessage(true)
    setBusyUploading(Boolean(attachmentDraft))
    try {
      const trimmedMessage = message.trim()
      const response = attachmentDraft
        ? await (async () => {
            const base64Data = await fileToBase64(attachmentDraft.file)
            const upload = await api.uploadMessageBase64(token, selectedConversationId, {
              fileName: attachmentDraft.file.name,
              contentType: attachmentDraft.file.type || 'application/octet-stream',
              base64Data,
            })

            if (!upload.mediaUrl) {
              throw new Error('Tải tệp lên thất bại, không nhận được đường dẫn file.')
            }

            return api.sendMessagePayload(token, selectedConversationId, {
              type: attachmentDraft.type,
              text: trimmedMessage || undefined,
              mediaUrl: upload.mediaUrl,
              fileName: attachmentDraft.file.name,
              mimeType: attachmentDraft.file.type || 'application/octet-stream',
              fileSize: attachmentDraft.file.size,
            })
          })()
        : await api.sendMessage(token, selectedConversationId, trimmedMessage)
      upsertMessage(selectedConversationId, response.message)
      setMessage('')
      clearAttachmentDraft()
      setChatNotice(null)
      setShowEmojiPanel(false)
      setShowStickerPanel(false)
      decrementMessageAllowance()
    } catch (error) {
      if (error instanceof ApiError && error.code === 'MESSAGE_LIMIT_NON_FRIEND') {
        setChatNotice('Bạn chỉ gửi được tối đa 3 tin nhắn khi chưa kết bạn. Hãy kết bạn để tiếp tục.')
      } else if (error instanceof Error) {
        setChatNotice(error.message)
      } else {
        setChatNotice('Không thể gửi tin nhắn.')
      }
      console.error('Failed to send message:', error)
    } finally {
      sendingMessageRef.current = false
      setIsSendingMessage(false)
      setBusyUploading(false)
    }
  }

  const handlePickAttachment = () => {
    if (!selectedConversationId) {
      setChatNotice('Vui lòng chọn cuộc trò chuyện trước khi gửi tệp.')
      return
    }
    setComposerMenuOpen((prev) => !prev)
  }

  const handleFileSelected = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file || !token || !selectedConversationId) return

    const maxBytes = 12 * 1024 * 1024
    if (file.size > maxBytes) {
      setChatNotice('Tệp quá lớn. Vui lòng chọn tệp nhỏ hơn 12MB.')
      event.target.value = ''
      return
    }

    const fileType = mapTypeFromFile(file)
    const previewUrl = fileType === 'image' || fileType === 'video' ? URL.createObjectURL(file) : null

    setAttachmentDraft((current) => {
      if (current?.previewUrl) {
        URL.revokeObjectURL(current.previewUrl)
      }
      return {
        file,
        type: fileType,
        previewUrl,
      }
    })
    setChatNotice(null)
    setComposerMenuOpen(false)
    event.target.value = ''
  }
  const handleSendSticker = useCallback(
    async (sticker: string) => {
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
          setChatNotice('Bạn chỉ gửi được tối đa 3 tin nhắn khi chưa kết bạn. Hãy kết bạn để tiếp tục.')
        } else if (error instanceof Error) {
          setChatNotice(error.message)
        }
      }
    },
    [selectedConversationId, setChatNotice, setMessageLimitByConversation, setShowStickerPanel, token, upsertMessage]
  )

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
      console.error('Không thể cập nhật cảm xúc:', error)
      setChatNotice('Không thể cập nhật cảm xúc cho tin nhắn này.')
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
      console.error('Không thể thu hồi tin nhắn:', error)
      setChatNotice('Không thể thu hồi tin nhắn này.')
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
      setChatNotice('Đã chuyển tiếp tin nhắn thành công.')
      await refreshConversations()
    } catch (error) {
      console.error('Không thể chuyển tiếp tin nhắn:', error)
      if (error instanceof Error) {
        setChatNotice(error.message)
      } else {
        setChatNotice('Không thể chuyển tiếp tin nhắn.')
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
      setChatNotice('Đã xóa tin nhắn.')
    } catch (error) {
      console.error('Không thể xóa tin nhắn:', error)
      if (error instanceof Error) {
        setChatNotice(error.message)
      } else {
        setChatNotice('Không thể xóa tin nhắn này.')
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
      await refreshConversations()
      setChatNotice(wasPinned ? 'Đã bỏ ghim tin nhắn.' : 'Đã ghim tin nhắn.')
    } catch (error) {
      console.error('Không thể ghim/bỏ ghim tin nhắn:', error)
      if (error instanceof Error) {
        setChatNotice(error.message)
      } else {
        setChatNotice('Không thể ghim/bỏ ghim tin nhắn.')
      }
    } finally {
      setBusyActionId(null)
    }
  }

  const handleClearChatForMe = async () => {
    if (!token || !selectedConversationId) return
    const confirmed = window.confirm('Xóa toàn bộ đoạn chat ở phía bạn? Hành động này không ảnh hưởng người khác.')
    if (!confirmed) return
    setBusyActionId(`clear-${selectedConversationId}`)
    try {
      await api.clearConversationMessages(token, selectedConversationId)
      const refreshed = await loadChatMessages(token, selectedConversationId, 25)
      setMessages(selectedConversationId, refreshed.messages)
      setChatNotice('Đã xóa đoạn chat ở phía bạn.')
    } catch (error) {
      console.error('Không thể xóa đoạn chat:', error)
      if (error instanceof Error) {
        setChatNotice(error.message)
      } else {
        setChatNotice('Không thể xóa đoạn chat.')
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
      console.error('Không thể bắt đầu cuộc gọi:', error)
      return
    }

    setCallStatus(`Đang gọi ${callType === 'video' ? 'video' : 'thoại'} tới ${selectedConversation ? getConversationDisplayName(selectedConversation, user?.id) : 'người nhận'}`)
    setCallAnswered(false)
    setRingingStartedAt(Date.now())
    setCallSeconds(0)
    const initialParticipants = user?.id ? [user.id] : []
    setActiveCall({
      type: callType,
      withName: selectedConversation
        ? getConversationDisplayName(selectedConversation, user?.id)
        : `Người dùng #${callTargetId}`,
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
      console.error('Không thể chấp nhận cuộc gọi:', error)
      return
    }

    setCallStatus('Đã chấp nhận cuộc gọi')
    setCallAnswered(true)
    setRingingStartedAt(null)
    setCallSeconds(0)
    setActiveCall({
      type: incomingCall.callType,
      withName: selectedConversation
        ? getConversationDisplayName(selectedConversation, user?.id)
        : `Người dùng #${incomingCall.fromUserId}`,
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
    setCallStatus('Đã từ chối cuộc gọi')
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
    setCallStatus('Bạn đã kết thúc cuộc gọi')
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
    : 'Chọn cuộc trò chuyện'
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
            name: user.fullName || 'Bạn',
            avatarUrl: user.avatarUrl || null,
          }
        }
        return {
          userId: id,
          name: `Người dùng #${id}`,
          avatarUrl: null,
        }
      })
  }, [activeCall, joinedCallUserIds, remoteStreams, selectedConversation, user?.avatarUrl, user?.fullName, user?.id])

  const renderMessagePreview = (msg: ChatMessage) => {
    const renderRichMessageText = (text: string) => {
      const richTokenRegex = /(https?:\/\/[^\s]+|:[a-z-]+:)/g
      const parts = text.split(richTokenRegex)
      if (parts.length === 1) return text

      return parts.map((part, index) => {
        const iconToken = MESSAGE_ICON_TOKENS[part]
        if (iconToken) {
          return (
            <span key={`icon-${index}`} className={styles.inlineMessageIcon} title={iconToken.label} aria-label={iconToken.label}>
              <iconToken.Icon size={16} />
            </span>
          )
        }

        if (!/^https?:\/\//i.test(part)) {
          return <span key={`text-${index}`}>{part}</span>
        }

        const isSharedPostLink = /\/posts\/\d+(?:\?.*)?$/i.test(part)
        return (
          <a
            key={`link-${index}`}
            href={part}
            target="_blank"
            rel="noreferrer"
            className={styles.fileLink}
            title={isSharedPostLink ? 'Mở bài viết được chia sẻ' : 'Mở liên kết'}
          >
            {isSharedPostLink ? 'Xem bài viết được chia sẻ' : part}
          </a>
        )
      })
    }

    const recalled = Boolean(msg.meta && (msg.meta as Record<string, unknown>).recalled)
    const forwarded = Boolean(msg.meta && (msg.meta as Record<string, unknown>).forwarded)
    const forwardedTag = forwarded ? <small className={styles.forwardTag}>Đã chuyển tiếp</small> : null

    if (recalled) {
      return <p className={styles.recalledText}>Tin nhắn đã được thu hồi</p>
    }

    if (msg.type === 'image' && msg.mediaUrl) {
      return (
        <div className={styles.mediaWrap}>
          {forwardedTag}
          <img
            src={msg.mediaUrl}
            alt={msg.fileName || 'image'}
            loading="lazy"
            onError={(event) => {
              event.currentTarget.style.display = 'none'
            }}
          />
          {msg.text ? <p className={styles.messageText}>{renderRichMessageText(msg.text)}</p> : null}
        </div>
      )
    }

    if (msg.type === 'video' && msg.mediaUrl) {
      return (
        <div className={styles.mediaWrap}>
          {forwardedTag}
          <video controls src={msg.mediaUrl} />
          {msg.text ? <p className={styles.messageText}>{renderRichMessageText(msg.text)}</p> : null}
        </div>
      )
    }

    if (msg.type === 'audio' && msg.mediaUrl) {
      return (
        <div className={styles.mediaWrap}>
          {forwardedTag}
          <audio controls src={msg.mediaUrl} />
          {msg.text ? <p className={styles.messageText}>{renderRichMessageText(msg.text)}</p> : null}
        </div>
      )
    }

    if (msg.type === 'sticker') {
      const sticker = (msg.meta?.sticker as string) || msg.text || ':)'
      const stickerEmoji = STICKER_EMOJI_TOKENS[sticker]
      if (stickerEmoji) {
        return (
          <p className={styles.stickerBubble} title={stickerEmoji.label} aria-label={stickerEmoji.label}>
            <span className={styles.stickerMessageGlyph}>{stickerEmoji.emoji}</span>
          </p>
        )
      }
      const stickerIcon = STICKER_ICON_TOKENS[sticker]
      if (stickerIcon) {
        return (
          <p className={styles.stickerBubble} title={stickerIcon.label} aria-label={stickerIcon.label}>
            <stickerIcon.Icon size={34} />
          </p>
        )
      }
      return <p className={styles.stickerBubble}>{sticker}</p>
    }

    if (msg.mediaUrl) {
      return (
        <div className={styles.mediaWrap}>
          {forwardedTag}
          <a href={msg.mediaUrl} target="_blank" rel="noreferrer" className={styles.fileLink}>
            {msg.fileName || 'Mở tệp đính kèm'}
          </a>
          {(msg.mimeType || msg.fileSize) ? (
            <small className={styles.fileMeta}>
              {[msg.mimeType, msg.fileSize ? `${Math.max(1, Math.round(msg.fileSize / 1024))} KB` : null]
                .filter(Boolean)
                .join(' - ')}
            </small>
          ) : null}
          {msg.text ? <p className={styles.messageText}>{renderRichMessageText(msg.text)}</p> : null}
        </div>
      )
    }

    return (
      <p className={styles.messageText}>
        {forwarded ? <small className={styles.forwardTagInline}>[Đã chuyển tiếp] </small> : null}
        {msg.text ? renderRichMessageText(msg.text) : ''}
      </p>
    )
  }
  return (
    <div className={styles.page}>
      <div className={styles.layout}>
        <MessagesSidebar
          initials={initials}
          userId={user?.id}
          conversations={filteredConversations}
          selectedConversationId={selectedConversationId}
          notifications={notifications}
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          onOpenConversation={handleOpenConversation}
          onShowNotifications={() => setShowNotificationsDrawer(true)}
          onShowNewMessage={() => setShowNewMessageModal(true)}
          onShowCreateGroup={() => {
            setShowCreateGroupModal(true)
            setGroupName('')
            setGroupSearchKeyword('')
            setGroupMemberIds([])
          }}
        />

        <section className={styles.chatPanel}>
          <header className={styles.chatHeader}>
            <div className={styles.chatIdentity}>
              <div className={styles.chatHeaderAvatar}>{(selectedName[0] || 'C').toUpperCase()}</div>
              <div>
                <h2>
                  {directPeer ? <Link to={`/profile/${directPeer.id}`}>{selectedName}</Link> : selectedName}
                </h2>
                <p>
                  {directPeer
                    ? isDirectPeerFriend
                      ? `Bạn bè • ${directPeerActivityLabel}`
                      : 'Chưa kết bạn • Giới hạn 3 tin nhắn'
                    : `${selectedConversation?.onlineCount || 0} thành viên online`}
                </p>
              </div>
            </div>
            <div className={styles.chatActions}>
              <button type="button" onClick={() => handleStartCall('video')} disabled={!callTargetId} title="Gọi video" aria-label="Gọi video">
                <Video size={16} />
              </button>
              <button type="button" onClick={() => handleStartCall('voice')} disabled={!callTargetId} title="Gọi thoại" aria-label="Gọi thoại">
                <Phone size={16} />
              </button>
              <button
                type="button"
                className={showMessageFilters || messageSearchKeyword ? styles.chatActionActive : undefined}
                title="Tìm tin nhắn"
                aria-label="Tìm tin nhắn"
                aria-expanded={showMessageFilters}
                disabled={!selectedConversation}
                onClick={() => setShowMessageFilters((value) => !value)}
              >
                <Search size={16} />
              </button>
              <button
                type="button"
                title="Thêm người vào cuộc trò chuyện"
                aria-label="Thêm người vào cuộc trò chuyện"
                disabled={!selectedGroup || !canAddMembers}
                onClick={() => {
                  setRightPanelSection('manage')
                  setShowSettingsDrawer(true)
                }}
              >
                <UserPlus size={16} />
              </button>
              <button
                type="button"
                title="Xem chi tiết cuộc trò chuyện"
                aria-label="Xem chi tiết cuộc trò chuyện"
                disabled={!selectedConversation}
                onClick={() => {
                  setRightPanelSection('overview')
                  setShowSettingsDrawer(true)
                }}
              >
                <Info size={16} />
              </button>
            </div>
          </header>

          {showMessageFilters ? (
            <form
              className={styles.messageFilters}
              onSubmit={(event) => {
                event.preventDefault()
                setMessageSearchKeyword(messageSearchDraft.trim())
              }}
            >
              <input
                value={messageSearchDraft}
                onChange={(event) => setMessageSearchDraft(event.target.value)}
                placeholder="Tìm theo nội dung tin nhắn"
                aria-label="Tìm theo nội dung tin nhắn"
              />
              <button type="submit">Tìm</button>
              {messageSearchKeyword ? (
                <button
                  type="button"
                  onClick={() => {
                    setMessageSearchDraft('')
                    setMessageSearchKeyword('')
                  }}
                >
                  Xóa tìm kiếm
                </button>
              ) : null}
            </form>
          ) : null}

          {selectedConversationId && messageLimitByConversation[selectedConversationId] ? (
            <div className={styles.limitBadge}>
              Còn {messageLimitByConversation[selectedConversationId]?.remaining ?? 0}/{messageLimitByConversation[selectedConversationId]?.total ?? 3} tin nhắn miễn phí trước khi cần kết bạn.
            </div>
          ) : null}

          {selectedConversation?.pinnedMessageIds && selectedConversation.pinnedMessageIds.length > 0 ? (
            <div className={styles.pinnedBanner}>
              Đang ghim {selectedConversation.pinnedMessageIds.length} tin nhắn trong cuộc trò chuyện này.
            </div>
          ) : null}

          {directPeer ? (
            <div className={styles.chatSocialBar}>
              {!isDirectPeerFriend && !isDirectPeerPending ? (
                <button
                  type="button"
                  className={styles.socialActionBtnPrimary}
                  onClick={handleRequestFriend}
                  disabled={Boolean(pendingFriendRequestTo[directPeer.id])}
                >
                  {pendingFriendRequestTo[directPeer.id] ? 'Đang gửi lời mời...' : 'Kết bạn để nhắn không giới hạn'}
                </button>
              ) : null}
              {!isDirectPeerFriend && isDirectPeerPending && isDirectPeerRequestedByMe ? (
                <button
                  type="button"
                  className={styles.socialActionBtn}
                  onClick={handleCancelFriendRequest}
                  disabled={Boolean(pendingFriendRequestTo[directPeer.id])}
                >
                  {pendingFriendRequestTo[directPeer.id] ? 'Đang hủy...' : 'Hủy lời mời kết bạn'}
                </button>
              ) : null}
              {!isDirectPeerFriend && isDirectPeerPending && !isDirectPeerRequestedByMe ? (
                <button
                  type="button"
                  className={styles.socialActionBtnPrimary}
                  onClick={handleAcceptFriendRequestDirect}
                  disabled={Boolean(pendingFriendRequestTo[directPeer.id])}
                >
                  {pendingFriendRequestTo[directPeer.id] ? 'Đang xử lý...' : 'Đồng ý lời mời kết bạn'}
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
                  <button type="button" onClick={handleAcceptIncomingCall} title="Chấp nhận cuộc gọi" aria-label="Chấp nhận cuộc gọi">
                    Chấp nhận
                  </button>
                  <button type="button" onClick={handleDeclineIncomingCall} title="Từ chối cuộc gọi" aria-label="Từ chối cuộc gọi">
                    Từ chối
                  </button>
                </div>
              ) : null}
              <button type="button" className={styles.endCallBtn} onClick={handleEndCall} disabled={!callTargetId} title="Kết thúc cuộc gọi" aria-label="Kết thúc cuộc gọi">
                <PhoneOff size={14} />
                Kết thúc
              </button>
            </div>
          )}

          <MessageThread
            userId={user?.id}
            selectedConversation={selectedConversation}
            virtualSlice={virtualSlice}
            messagesWrapRef={messagesWrapRef}
            loadingOlderMessages={loadingOlderMessages || loadingMessages}
            typingUserIds={typingUserIds}
            busyActionId={busyActionId}
            pinnedMessageIds={pinnedMessageIds}
            reactionPickerMessageId={reactionPickerMessageId}
            setReactionPickerMessageId={setReactionPickerMessageId}
            openMessageActions={openMessageActions}
            handleReaction={handleReaction}
            renderMessagePreview={renderMessagePreview}
            getMessageReadLabel={getMessageReadLabel}
            onLoadOlderMessages={loadOlderMessages}
            onScroll={(event) => {
              const element = event.currentTarget
              const fromBottom = element.scrollHeight - (element.scrollTop + element.clientHeight)
              setShowJumpToLatest(fromBottom > 260)
            }}
          />

          <MessageComposer
            message={message}
            setMessage={setMessage}
            handleSend={handleSend}
            handleFileSelected={handleFileSelected}
            handlePickAttachment={handlePickAttachment}
            handlePickAttachmentType={handlePickAttachmentType}
            busyUploading={busyUploading}
            isSendingMessage={isSendingMessage}
            composerMenuOpen={composerMenuOpen}
            setComposerMenuOpen={setComposerMenuOpen}
            showEmojiPanel={showEmojiPanel}
            setShowEmojiPanel={setShowEmojiPanel}
            showStickerPanel={showStickerPanel}
            setShowStickerPanel={setShowStickerPanel}
            onSendSticker={handleSendSticker}
            attachmentDraft={attachmentDraft}
            onRemoveAttachment={clearAttachmentDraft}
            fileInputRef={fileInputRef as any}
            imageInputRef={imageInputRef as any}
            videoInputRef={videoInputRef as any}
          />

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
              Về tin nhắn mới nhất
            </button>
          ) : null}

          <MessagesOverlays
            userId={user?.id}
            conversations={conversations}
            selectedConversationId={selectedConversationId}
            actionMenu={actionMenu}
            activeActionMessage={activeActionMessage}
            pinnedMessageIds={pinnedMessageIds}
            forwardingMessageId={forwardingMessageId}
            showNewMessageModal={showNewMessageModal}
            newMessageKeyword={newMessageKeyword}
            searchUsersResult={searchUsersResult}
            showNotificationsDrawer={showNotificationsDrawer}
            notifications={notifications}
            showCreateGroupModal={showCreateGroupModal}
            groupName={groupName}
            groupSearchKeyword={groupSearchKeyword}
            filteredCreateGroupInviteCandidates={filteredCreateGroupInviteCandidates}
            groupMemberIds={groupMemberIds}
            busyActionId={busyActionId}
            creatingGroup={creatingGroup}
            acceptedFriendsCount={acceptedFriends.length}
            setForwardingMessageId={setForwardingMessageId}
            setActionMenu={setActionMenu}
            setShowNewMessageModal={setShowNewMessageModal}
            setNewMessageKeyword={setNewMessageKeyword}
            handleCreateConversationWithUser={handleCreateConversationWithUser}
            setShowNotificationsDrawer={setShowNotificationsDrawer}
            handleOpenNotificationConversation={handleOpenNotificationConversation}
            handleAcceptFromNotification={handleAcceptFromNotification}
            setShowCreateGroupModal={setShowCreateGroupModal}
            handleCreateGroupConversation={handleCreateGroupConversation}
            setGroupName={setGroupName}
            setGroupSearchKeyword={setGroupSearchKeyword}
            toggleGroupMember={toggleGroupMember}
            handleTogglePinMessage={handleTogglePinMessage}
            handleRecall={handleRecall}
            handleDeleteMessage={handleDeleteMessage}
            handleForward={handleForward}
          />
        </section>

        {showSettingsDrawer ? <button type="button" className={styles.settingsBackdrop} aria-label="Đóng cài đặt hội thoại" onClick={() => setShowSettingsDrawer(false)} /> : null}
        <aside className={`${styles.detailsPanel} ${showSettingsDrawer ? styles.detailsPanelOpen : ''}`}>
          <div className={styles.detailsBody}>
          <ConversationDetailsPanel
            selectedConversation={selectedConversation}
            selectedGroup={selectedGroup}
            rightPanelSection={rightPanelSection}
            setRightPanelSection={setRightPanelSection}
            myGroupRole={myGroupRole}
            groupLeader={groupLeader}
            groupDeputy={groupDeputy}
            canManageRoles={canManageRoles}
            canRemoveMembers={canRemoveMembers}
            canAddMembers={canAddMembers}
            canDissolveSelectedGroup={canDissolveSelectedGroup}
            canLeaderLeaveGroup={canLeaderLeaveGroup}
            groupSearchKeyword={groupSearchKeyword}
            setGroupSearchKeyword={setGroupSearchKeyword}
            filteredGroupInviteCandidates={filteredGroupInviteCandidates}
            groupActionBusyId={groupActionBusyId}
            userId={user?.id}
            handleClearChatForMe={handleClearChatForMe}
            handleTransferLeader={handleTransferLeader}
            handleSetDeputyRole={handleSetDeputyRole}
            handleRemoveMemberFromGroup={handleRemoveMemberFromGroup}
            handleAddMemberToGroup={handleAddMemberToGroup}
            handleLeaveGroup={handleLeaveGroup}
            handleDissolveGroup={handleDissolveGroup}
            handleToggleConversationPin={handleToggleConversationPin}
            handleToggleConversationMute={handleToggleConversationMute}
            handleUpdateNickname={handleUpdateNickname}
            handleUpdateGroupProfile={handleUpdateGroupProfile}
            handleBlockPeer={handleBlockPeer}
            sharedContent={sharedContent}
            loadingSharedContent={loadingSharedContent}
            onClose={() => setShowSettingsDrawer(false)}
          />
          </div>
        </aside>
      </div>
    </div>
  )
}

