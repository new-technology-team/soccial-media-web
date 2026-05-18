'use client'

import { ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useSearchParams } from 'react-router-dom'
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
import { ApiError, api } from '@/api/client'
import { useAuthStore } from '@/contexts/auth-store'
import { useChatStore } from '@/contexts/chat-store'
import { useCallStore, type IncomingCallState } from '@/contexts/call-store'
import { connectSocket, getSocket } from '@/services/socket'
import { useConversationRouting } from '@/hooks/use-conversation-routing'
import { EMOJI_SET, MESSAGE_REACTIONS, RTC_CONFIG, STICKER_PACKS } from '@/services/messages/constants'
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
  getGroupRoleLabel,
  getMessageReactionItems,
  getMessageReactionMeta,
} from '@/services/messages/formatters'
import { normalizeIncomingMessageForViewer } from '@/services/messages/message-normalizer'
import { parseNotificationMeta, type MessageNotificationItem } from '@/services/messages/notification-meta'
import type { ChatMessage, FriendConnection } from '@/types'
import styles from './page.module.css'

type ActiveCall = {
  type: 'voice' | 'video'
  withName: string
  startedAt: number
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
  const { openConversation } = useConversationRouting({
    token,
    queryConversationId,
    selectedConversationId,
    setConversations,
    selectConversation,
  })

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
      console.error('Không thể tĂ¡º£i danh sách bạn bè', error)
    }
  }, [token, user?.id])

  useEffect(() => {
    if (!token || !selectedConversationId) return

    loadChatMessages(token, selectedConversationId, 25)
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
  }, [selectedConversationId])

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
      setCallStatus(`CuĂ¡»™c gĂ¡»i ${payload.callType === 'video' ? 'video' : 'thoại'} đến`)
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
      setCallStatus('NgưĂ¡»i nhĂ¡º­n đã tham gia cuĂ¡»™c gĂ¡»i')
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
          setCallStatus('MĂ¡»i ngưĂ¡»i đã rĂ¡»i cuĂ¡»™c gĂ¡»i')
        } else {
          setCallStatus('MĂ¡»™t ngưĂ¡»i đã rĂ¡»i cuĂ¡»™c gĂ¡»i')
        }
        return
      }

      setCallStatus('CuĂ¡»™c gĂ¡»i đã kết thúc')
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
        setCallStatus(`CuĂ¡»™c gĂ¡»i đang có ${payload.participantCount} ngưĂ¡»i tham gia`)
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
    setCallStatus(`CuĂ¡»™c gĂ¡»i ${globalIncomingCall.callType === 'video' ? 'video' : 'thoại'} đến`)
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
      setCallStatus('Không có phĂ¡º£n hĂ¡»“i sau 1 phút. CuĂ¡»™c gĂ¡»i đã tĂ¡»± kết thúc.')
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
      setChatNotice('ĐĂ£ gĂ¡» i lĂ¡»i mĂ¡»i kĂ¡º¿t bạn. Hãy chĂ¡» đối phương chĂ¡º¥p nhĂ¡º­n để nhĂ¡º¯n không giĂ¡»›i hạn.')
      await reloadFriendMap()
    } catch (error) {
      if (error instanceof Error) {
        setChatNotice(error.message)
      } else {
        setChatNotice('Không thể gĂ¡» i lĂ¡»i mĂ¡»i kĂ¡º¿t bạn.')
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
      setChatNotice('ĐĂ£ hủy lĂ¡»i mĂ¡»i kĂ¡º¿t bạn.')
    } catch (error) {
      if (error instanceof Error) {
        setChatNotice(error.message)
      } else {
        setChatNotice('Không thể hủy lĂ¡»i mĂ¡»i kĂ¡º¿t bạn.')
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
      setChatNotice('ĐĂ£ chĂ¡º¥p nhĂ¡º­n lĂ¡»i mĂ¡»i kĂ¡º¿t bạn.')
    } catch (error) {
      if (error instanceof Error) {
        setChatNotice(error.message)
      } else {
        setChatNotice('Không thể chĂ¡º¥p nhĂ¡º­n lĂ¡»i mĂ¡»i kĂ¡º¿t bạn.')
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
      setConversations(await loadChatConversations(token))
      openConversation(result.conversation.id)
      setChatNotice('ĐĂ£ mĂ¡»Ÿ cuĂ¡»™c trò chuyĂ¡»‡n trĂ¡»±c tiĂ¡º¿p.')
    } catch (error) {
      if (error instanceof Error) {
        setChatNotice(error.message)
      } else {
        setChatNotice('Không thể mĂ¡»Ÿ cuĂ¡»™c trò chuyĂ¡»‡n.')
      }
    } finally {
      setCreatingDirectConversation(false)
    }
  }

  const handlePickAttachmentType = (type: 'image' | 'video' | 'file') => {
    if (!selectedConversationId) {
      setChatNotice('Vui lòng chĂ¡»n cuĂ¡»™c trò chuyĂ¡»‡n trưĂ¡»›c khi gĂ¡» i tĂ¡»‡p.')
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
      setConversations(await loadChatConversations(token))
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
      setChatNotice('ĐĂ£ chĂ¡º¥p nhĂ¡º­n lĂ¡»i mĂ¡»i kĂ¡º¿t bạn.')
      if (meta?.conversationId) {
        handleOpenNotificationConversation(meta.conversationId)
      }
    } catch (error) {
      if (error instanceof Error) {
        setChatNotice(error.message)
      } else {
        setChatNotice('Không thể chĂ¡º¥p nhĂ¡º­n lĂ¡»i mĂ¡»i tĂ¡»« thông báo.')
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
    setConversations(await loadChatConversations(token))
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
      setChatNotice('ĐĂ£ tạo nhóm chat thành công.')
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
      setChatNotice('ĐĂ£ thêm thành viên vào nhóm.')
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
      setChatNotice('ĐĂ£ xóa thành viên khĂ¡»i nhóm.')
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
      setChatNotice(targetUserId ? 'ĐĂ£ cĂ¡º¥p quyĂ¡»n phó nhóm.' : 'ĐĂ£ thu hĂ¡»“i quyĂ¡»n phó nhóm.')
    } catch (error) {
      if (error instanceof Error) {
        setChatNotice(error.message)
      } else {
        setChatNotice('Không thể cĂ¡º­p nhĂ¡º­t phó nhóm.')
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
      setChatNotice('ĐĂ£ chuyĂ¡»ƒn quyĂ¡»n trưĂ¡»Ÿng nhóm.')
    } catch (error) {
      if (error instanceof Error) {
        setChatNotice(error.message)
      } else {
        setChatNotice('Không thể chuyĂ¡»ƒn quyĂ¡»n trưĂ¡»Ÿng nhóm.')
      }
    } finally {
      setGroupActionBusyId(null)
    }
  }

  const handleDissolveGroup = async () => {
    if (!token || !selectedGroup || !canDissolveSelectedGroup) return
    const confirmed = window.confirm('Bạn chĂ¡º¯c chĂ¡º¯n muĂ¡»‘n giĂ¡º£i tán nhóm này? Hành đĂ¡»™ng này không thĂ¡»ƒ hoàn tác.')
    if (!confirmed) return
    setGroupActionBusyId('dissolve-group')
    try {
      await api.dissolveGroupConversation(token, selectedGroup.id)
      await refreshConversations()
      setChatNotice('ĐĂ£ giĂ¡º£i tán nhóm chat.')
      const fallback = conversations.find((item) => item.id !== selectedGroup.id)
      if (fallback) {
        openConversation(fallback.id)
      }
    } catch (error) {
      if (error instanceof Error) {
        setChatNotice(error.message)
      } else {
        setChatNotice('Không thể giĂ¡º£i tán nhóm.')
      }
    } finally {
      setGroupActionBusyId(null)
    }
  }

  const handleLeaveGroup = async () => {
    if (!token || !selectedGroup || !canLeaveGroup) return
    if (myGroupRole === 'leader' && !canLeaderLeaveGroup) {
      setChatNotice('Bạn đang là trưĂ¡»Ÿng nhóm. Hãy chĂ¡»‰ đĂ¡»‹nh phó nhóm trưĂ¡»›c khi rĂ¡»i nhóm.')
      setRightPanelSection('manage')
      return
    }

    const confirmed = window.confirm('Bạn có chĂ¡º¯c muĂ¡»‘n rĂ¡»i nhóm này không?')
    if (!confirmed) return

    setGroupActionBusyId('leave-group')
    try {
      await api.leaveGroupConversation(token, selectedGroup.id)
      await refreshConversations()
      setChatNotice(
        myGroupRole === 'leader'
          ? 'Bạn đã rĂ¡»i nhóm. QuyĂ¡»n trưĂ¡»Ÿng nhóm đã tĂ¡»± đĂ¡»™ng chuyĂ¡»ƒn cho phó nhóm.'
          : 'Bạn đã rĂ¡»i nhóm chat.'
      )

      const fallback = conversations.find((item) => item.id !== selectedGroup.id)
      if (fallback) {
        openConversation(fallback.id)
      } else {
        const refreshed = await loadChatConversations(token)
        if (refreshed.length > 0) {
          openConversation(refreshed[0].id)
        }
      }
    } catch (error) {
      if (error instanceof Error) {
        setChatNotice(error.message)
      } else {
        setChatNotice('Không thể rĂ¡»i nhóm lúc này.')
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
      const response = await loadChatMessages(token, selectedConversationId, 20, beforeId)

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
      console.error('Không thể tĂ¡º£i tin nhĂ¡º¯n cũ hơn', error)
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
        setChatNotice('Bạn chĂ¡»‰ gĂ¡» i đưĂ¡»£c tĂ¡»‘i đa 3 tin nhĂ¡º¯n khi chưa kĂ¡º¿t bạn. Hãy kĂ¡º¿t bạn để tiếp tĂ¡»¥c.')
      } else if (error instanceof Error) {
        setChatNotice(error.message)
      } else {
        setChatNotice('Không thể gĂ¡» i tin nhĂ¡º¯n.')
      }
      console.error('Failed to send message:', error)
    } finally {
      sendingMessageRef.current = false
      setIsSendingMessage(false)
    }
  }

  const handlePickAttachment = () => {
    if (!selectedConversationId) {
      setChatNotice('Vui lòng chĂ¡»n cuĂ¡»™c trò chuyĂ¡»‡n trưĂ¡»›c khi gĂ¡» i tĂ¡»‡p.')
      return
    }
    setComposerMenuOpen((prev) => !prev)
  }

  const handleFileSelected = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file || !token || !selectedConversationId) return

    const maxBytes = 12 * 1024 * 1024
    if (file.size > maxBytes) {
      setChatNotice('TĂ¡»‡p quá lĂ¡»›n. Vui lòng chĂ¡»n tĂ¡»‡p nhĂ¡» hơn 12MB.')
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
        throw new Error('TĂ¡º£i tĂ¡»‡p lên thĂ¡º¥t bại, không nhĂ¡º­n đưĂ¡»£c đưĂ¡»ng dẫn file.')
      }

      const response = await api.sendMessagePayload(token, selectedConversationId, {
        type: mapTypeFromFile(file),
        mediaUrl: upload.mediaUrl,
        fileName: file.name,
        mimeType: file.type || 'application/octet-stream',
        fileSize: file.size,
      })
      upsertMessage(selectedConversationId, response.message)
      setChatNotice('ĐĂ£ gĂ¡» i tĂ¡»‡p thành công.')
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
        setChatNotice('Bạn chĂ¡»‰ gĂ¡» i đưĂ¡»£c tĂ¡»‘i đa 3 tin nhĂ¡º¯n khi chưa kĂ¡º¿t bạn. Hãy kĂ¡º¿t bạn để tiếp tĂ¡»¥c.')
      } else if (error instanceof Error) {
        setChatNotice(error.message)
      } else {
        setChatNotice('Không thể gĂ¡» i file đĂnh kèm.')
      }
      console.error('Không thể gĂ¡» i file đĂnh kèm:', error)
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
      console.error('Không thể cĂ¡º­p nhĂ¡º­t cĂ¡º£m xúc:', error)
      setChatNotice('Không thể cĂ¡º­p nhĂ¡º­t cĂ¡º£m xúc cho tin nhĂ¡º¯n này.')
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
      console.error('Không thể thu hĂ¡»“i tin nhĂ¡º¯n:', error)
      setChatNotice('Không thể thu hĂ¡»“i tin nhĂ¡º¯n này.')
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
      setChatNotice('ĐĂ£ chuyển tiếp tin nhĂ¡º¯n thành công.')
      loadChatConversations(token).then(setConversations).catch(() => undefined)
    } catch (error) {
      console.error('Không thể chuyển tiếp tin nhĂ¡º¯n:', error)
      if (error instanceof Error) {
        setChatNotice(error.message)
      } else {
        setChatNotice('Không thể chuyển tiếp tin nhĂ¡º¯n.')
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
      setChatNotice('ĐĂ£ xóa tin nhĂ¡º¯n.')
    } catch (error) {
      console.error('Không thể xóa tin nhĂ¡º¯n:', error)
      if (error instanceof Error) {
        setChatNotice(error.message)
      } else {
        setChatNotice('Không thể xóa tin nhĂ¡º¯n này.')
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
      setConversations(await loadChatConversations(token))
      setChatNotice(wasPinned ? 'ĐĂ£ bĂ¡» ghim tin nhĂ¡º¯n.' : 'ĐĂ£ ghim tin nhĂ¡º¯n.')
    } catch (error) {
      console.error('Không thể ghim/bĂ¡» ghim tin nhĂ¡º¯n:', error)
      if (error instanceof Error) {
        setChatNotice(error.message)
      } else {
        setChatNotice('Không thể ghim/bĂ¡» ghim tin nhĂ¡º¯n.')
      }
    } finally {
      setBusyActionId(null)
    }
  }

  const handleClearChatForMe = async () => {
    if (!token || !selectedConversationId) return
    const confirmed = window.confirm('Xóa toàn bĂ¡»™ đoạn chat Ă¡»Ÿ phía bạn? Hành đĂ¡»™ng này không Ă¡º£nh hưĂ¡»Ÿng ngưĂ¡»i khác.')
    if (!confirmed) return
    setBusyActionId(`clear-${selectedConversationId}`)
    try {
      await api.clearConversationMessages(token, selectedConversationId)
      const refreshed = await loadChatMessages(token, selectedConversationId, 25)
      setMessages(selectedConversationId, refreshed.messages)
      setChatNotice('ĐĂ£ xóa đoạn chat Ă¡»Ÿ phía bạn.')
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
      console.error('Không thể bĂ¡º¯t đầu cuĂ¡»™c gĂ¡»i:', error)
      return
    }

    setCallStatus(`Ä ang gĂ¡»i ${callType === 'video' ? 'video' : 'thoại'} tĂ¡»›i ${selectedConversation ? getConversationDisplayName(selectedConversation, user?.id) : 'ngưĂ¡»i nhĂ¡º­n'}`)
    setCallAnswered(false)
    setRingingStartedAt(Date.now())
    setCallSeconds(0)
    const initialParticipants = user?.id ? [user.id] : []
    setActiveCall({
      type: callType,
      withName: selectedConversation
        ? getConversationDisplayName(selectedConversation, user?.id)
        : `NgưĂ¡»i dùng #${callTargetId}`,
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
      console.error('Không thể chĂ¡º¥p nhĂ¡º­n cuĂ¡»™c gĂ¡»i:', error)
      return
    }

    setCallStatus('ĐĂ£ chĂ¡º¥p nhĂ¡º­n cuĂ¡»™c gĂ¡»i')
    setCallAnswered(true)
    setRingingStartedAt(null)
    setCallSeconds(0)
    setActiveCall({
      type: incomingCall.callType,
      withName: selectedConversation
        ? getConversationDisplayName(selectedConversation, user?.id)
        : `NgưĂ¡»i dùng #${incomingCall.fromUserId}`,
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
    setCallStatus('ĐĂ£ tĂ¡»« chĂ¡»‘i cuĂ¡»™c gĂ¡»i')
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
    setCallStatus('Bạn đã kết thúc cuĂ¡»™c gĂ¡»i')
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
    : 'ChĂ¡»n cuĂ¡»™c trò chuyĂ¡»‡n'
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
          name: `NgưĂ¡»i dùng #${id}`,
          avatarUrl: null,
        }
      })
  }, [activeCall, joinedCallUserIds, remoteStreams, selectedConversation, user?.avatarUrl, user?.fullName, user?.id])

  const renderMessagePreview = (msg: ChatMessage) => {
    const recalled = Boolean(msg.meta && (msg.meta as Record<string, unknown>).recalled)
    const forwarded = Boolean(msg.meta && (msg.meta as Record<string, unknown>).forwarded)

    if (recalled) {
      return <p className={styles.recalledText}>Tin nhĂ¡º¯n đã đưĂ¡»£c thu hĂ¡»“i</p>
    }

    if (msg.type === 'image' && msg.mediaUrl) {
      return (
        <div className={styles.mediaWrap}>
          {forwarded ? <small className={styles.forwardTag}>ĐĂ£ chuyển tiếp</small> : null}
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
          {forwarded ? <small className={styles.forwardTag}>ĐĂ£ chuyển tiếp</small> : null}
          <video controls src={msg.mediaUrl} />
        </div>
      )
    }

    if (msg.type === 'audio' && msg.mediaUrl) {
      return (
        <div className={styles.mediaWrap}>
          {forwarded ? <small className={styles.forwardTag}>ĐĂ£ chuyển tiếp</small> : null}
          <audio controls src={msg.mediaUrl} />
        </div>
      )
    }

    if (msg.type === 'sticker') {
      const sticker = (msg.meta?.sticker as string) || msg.text || 'Ä‘Ÿ˜€'
      return <p className={styles.stickerBubble}>{sticker}</p>
    }

    if (msg.mediaUrl) {
      return (
        <div className={styles.mediaWrap}>
          {forwarded ? <small className={styles.forwardTag}>ĐĂ£ chuyển tiếp</small> : null}
          <a href={msg.mediaUrl} target="_blank" rel="noreferrer" className={styles.fileLink}>
            {msg.fileName || 'MĂ¡» tĂ¡»‡p đĂnh kèm'}
          </a>
          {(msg.mimeType || msg.fileSize) ? (
            <small className={styles.fileMeta}>
              {[msg.mimeType, msg.fileSize ? `${Math.max(1, Math.round(msg.fileSize / 1024))} KB` : null]
                .filter(Boolean)
                .join(' • ')}
            </small>
          ) : null}
        </div>
      )
    }

    return (
      <p className={styles.messageText}>
        {forwarded ? <small className={styles.forwardTagInline}>[ĐĂ£ chuyển tiếp] </small> : null}
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
            <button type="button" className={`${styles.railBtn} ${styles.railBtnActive}`} title="Tin nhĂ¡º¯n" aria-label="Tin nhĂ¡º¯n">
              <Send size={16} />
            </button>
            <button type="button" className={styles.railBtn} onClick={() => setShowNewMessageModal(true)} title="Tạo hĂ¡»™i thoại mĂ¡»›i" aria-label="Tạo hĂ¡»™i thoại mĂ¡»›i">
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
              title="Tạo nhóm"
              aria-label="Tạo nhóm"
            >
              <CirclePlus size={16} />
            </button>
            <button type="button" className={styles.railBtn} onClick={() => setShowNotificationsDrawer(true)} title="Thông báo" aria-label="Thông báo">
              <Bell size={16} />
            </button>
            <button type="button" className={`${styles.railBtn} ${styles.railBottomBtn}`} title="Thông tin" aria-label="Thông tin">
              <Info size={16} />
            </button>
          </nav>
          <div className={styles.railAvatar}>{initials}</div>
        </aside>

        <section className={styles.listPanel}>
          <div className={styles.listHeader}>
            <div className={styles.listHeaderTop}>
              <h1>TĂ¡º¥t cĂ¡º£ cuĂ¡»™c trò chuyĂ¡»‡n</h1>
              <button
                type="button"
                className={styles.headerNotifyBtn}
                onClick={() => setShowNotificationsDrawer(true)}
                title="Thông báo"
                aria-label="Thông báo"
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
                    <p>{conv.unreadCount > 0 ? `${conv.unreadCount} tin nhĂ¡º¯n chưa đĂ¡»c` : 'NhĂ¡º¥n để mĂ¡»Ÿ hĂ¡»™i thoại'}</p>
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
                      ? 'Bạn bè • Online'
                      : 'Chưa kĂ¡º¿t bạn • GiĂ¡»›i hạn 3 tin nhĂ¡º¯n'
                    : 'Online'}
                </p>
              </div>
            </div>
            <div className={styles.chatActions}>
              <button type="button" onClick={() => handleStartCall('video')} disabled={!callTargetId} title="GĂ¡»i video" aria-label="GĂ¡»i video">
                <Video size={16} />
              </button>
              <button type="button" onClick={() => handleStartCall('voice')} disabled={!callTargetId} title="GĂ¡»i thoại" aria-label="GĂ¡»i thoại">
                <Phone size={16} />
              </button>
              <button
                type="button"
                title="Thêm ngưĂ¡»i vào cuĂ¡»™c trò chuyĂ¡»‡n"
                aria-label="Thêm ngưĂ¡»i vào cuĂ¡»™c trò chuyĂ¡»‡n"
                disabled={!selectedGroup || !canAddMembers}
                onClick={() => setRightPanelSection('manage')}
              >
                <UserPlus size={16} />
              </button>
              <button
                type="button"
                title="Xem chi tiết cuĂ¡»™c trò chuyĂ¡»‡n"
                aria-label="Xem chi tiết cuĂ¡»™c trò chuyĂ¡»‡n"
                disabled={!selectedConversation}
                onClick={() => setRightPanelSection('overview')}
              >
                <Info size={16} />
              </button>
            </div>
          </header>

          {selectedConversationId && messageLimitByConversation[selectedConversationId] ? (
            <div className={styles.limitBadge}>
              Còn {messageLimitByConversation[selectedConversationId]?.remaining ?? 0}/{messageLimitByConversation[selectedConversationId]?.total ?? 3} tin nhĂ¡º¯n miễn phitrưĂ¡»›c khi cần kĂ¡º¿t bạn.
            </div>
          ) : null}

          {selectedConversation?.pinnedMessageIds && selectedConversation.pinnedMessageIds.length > 0 ? (
            <div className={styles.limitBadge}>
              Ä ang ghim {selectedConversation.pinnedMessageIds.length} tin nhĂ¡º¯n trong cuĂ¡»™c trò chuyĂ¡»‡n này.
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
                {creatingDirectConversation ? 'Ä ang mĂ¡»Ÿ hĂ¡»™i thoại...' : 'NhĂ¡º¯n tin'}
              </button>
              {!isDirectPeerFriend && !isDirectPeerPending ? (
                <button
                  type="button"
                  className={styles.socialActionBtnPrimary}
                  onClick={handleRequestFriend}
                  disabled={Boolean(pendingFriendRequestTo[directPeer.id])}
                >
                  {pendingFriendRequestTo[directPeer.id] ? 'Ä ang gĂ¡» i lĂ¡»i mĂ¡»i...' : 'Kết bạn để nhĂ¡º¯n không giĂ¡»›i hạn'}
                </button>
              ) : null}
              {!isDirectPeerFriend && isDirectPeerPending && isDirectPeerRequestedByMe ? (
                <button
                  type="button"
                  className={styles.socialActionBtn}
                  onClick={handleCancelFriendRequest}
                  disabled={Boolean(pendingFriendRequestTo[directPeer.id])}
                >
                  {pendingFriendRequestTo[directPeer.id] ? 'Ä ang hủy...' : 'Hủy lĂ¡»i mĂ¡»i kĂ¡º¿t bạn'}
                </button>
              ) : null}
              {!isDirectPeerFriend && isDirectPeerPending && !isDirectPeerRequestedByMe ? (
                <button
                  type="button"
                  className={styles.socialActionBtnPrimary}
                  onClick={handleAcceptFriendRequestDirect}
                  disabled={Boolean(pendingFriendRequestTo[directPeer.id])}
                >
                  {pendingFriendRequestTo[directPeer.id] ? 'Ä ang xĂ¡»  lý...' : 'ĐĂ¡»“ng ý lĂ¡»i mĂ¡»i kĂ¡º¿t bạn'}
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
                  <button type="button" onClick={handleAcceptIncomingCall} title="ChĂ¡º¥p nhĂ¡º­n cuĂ¡»™c gĂ¡»i" aria-label="ChĂ¡º¥p nhĂ¡º­n cuĂ¡»™c gĂ¡»i">
                    ChĂ¡º¥p nhĂ¡º­n
                  </button>
                  <button type="button" onClick={handleDeclineIncomingCall} title="TĂ¡»Ă¡»ừ chối cuĂ¡»™c gĂ¡»i" aria-label="TĂ¡»Ă¡»ừ chối cuĂ¡»™c gĂ¡»i">
                    TĂ¡»Ă¡»ừ chối
                  </button>
                </div>
              ) : null}
              <button type="button" className={styles.endCallBtn} onClick={handleEndCall} disabled={!callTargetId} title="Kết thúc cuĂ¡»™c gĂ¡»i" aria-label="Kết thúc cuĂ¡»™c gĂ¡»i">
                <PhoneOff size={14} />
                Kết thúc
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
            {loadingOlderMessages ? <p className={styles.historyLoading}>Ä ang tĂ¡º£i tin nhĂ¡º¯n cũ hơn...</p> : null}
            {virtualSlice.startIndex > 0 ? (
              <p className={styles.virtualHint}>Ä ang hiển thĂ¡»‹ {VIRTUAL_CHUNK} tin nhĂ¡º¯n mĂ¡»›i nhĂ¡º¥t. Cuộn lên để tĂ¡º£i thêm lĂ¡»‹ch sĂ¡» ­.</p>
            ) : null}
            {virtualSlice.items.map((msg) => {
              const mine = msg.senderId === user?.id
              const reactionItems = getMessageReactionItems(msg)
              const senderName = String(msg.senderName || msg.sender?.fullName || msg.sender?.name || 'NgưĂ¡»i dùng')
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
                        title="MĂ¡» menu thao tác"
                        aria-label="MĂ¡» menu thao tác"
                        onClick={(event) => openMessageActions(event, msg.id)}
                      >
                        <MoreHorizontal size={14} />
                      </button>
                      {renderMessagePreview(msg)}
                      {pinnedMessageIds.has(msg.id) ? <small className={styles.forwardTag}>ĐĂ£ ghim</small> : null}
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
                        title="ThĂ¡º£ cĂ¡º£m xúc"
                        aria-label="ThĂ¡º£ cĂ¡º£m xúc"
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
                          return member?.fullName || `NgưĂ¡»i dùng #${userId}`
                        })
                        .join(', ')}{' '}
                      đang soạn tin nhĂ¡º¯n...
                    </p>
                  </div>
                </div>
              </div>
            ) : null}

            {messages.length === 0 ? <p className={styles.empty}>Chưa có tin nhĂ¡º¯n trong cuĂ¡»™c trò chuyĂ¡»‡n này.</p> : null}
          </div>

          <footer className={styles.inputBar}>
            <input ref={fileInputRef} type="file" className={styles.hiddenFileInput} onChange={handleFileSelected} aria-label="ĐĂ­nh kèm tĂ¡»‡p" title="ĐĂ­nh kèm tĂ¡»‡p" />
            <input
              ref={imageInputRef}
              type="file"
              accept="image/*"
              className={styles.hiddenFileInput}
              onChange={handleFileSelected}
              aria-label="GĂ¡»­i hình Ă¡º£nh"
              title="GĂ¡»­i hình Ă¡º£nh"
            />
            <input
              ref={videoInputRef}
              type="file"
              accept="video/*"
              className={styles.hiddenFileInput}
              onChange={handleFileSelected}
              aria-label="GĂ¡»­i video"
              title="GĂ¡»­i video"
            />
            <button type="button" className={styles.inputIcon} onClick={handlePickAttachment} disabled={busyUploading} title="ChĂ¡»n tĂ¡»‡p đĂnh kèm" aria-label="ChĂ¡»n tĂ¡»‡p đĂnh kèm">
              <CirclePlus size={18} />
            </button>
            {composerMenuOpen ? (
              <div className={styles.composerPlusMenu}>
                <button type="button" onClick={() => handlePickAttachmentType('image')} title="GĂ¡»­i Ă¡º£nh" aria-label="GĂ¡»­i Ă¡º£nh">
                  <span>Ä‘Ÿ–¼ï¸</span>
                  <span>GĂ¡»­i Ă¡º£nh</span>
                </button>
                <button type="button" onClick={() => handlePickAttachmentType('video')} title="GĂ¡»­i video" aria-label="GĂ¡»­i video">
                  <span>Ä‘Ÿ¬</span>
                  <span>GĂ¡»­i video</span>
                </button>
                <button type="button" onClick={() => handlePickAttachmentType('file')} title="GĂ¡»­i tĂ¡»‡p" aria-label="GĂ¡»­i tĂ¡»‡p">
                  <span>Ä‘Ÿ“</span>
                  <span>GĂ¡»­i tĂ¡»‡p</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowEmojiPanel(true)
                    setShowStickerPanel(false)
                    setComposerMenuOpen(false)
                  }}
                  title="Chèn emoji"
                  aria-label="Chèn emoji"
                >
                  <span>Ä‘Ÿ˜</span>
                  <span>Chèn emoji</span>
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
                  <span>GĂ¡»­i sticker</span>
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
            <button type="button" className={styles.inputIcon} onClick={() => fileInputRef.current?.click()} disabled={busyUploading} title="ChĂ¡»n tĂ¡»‡p" aria-label="ChĂ¡»n tĂ¡»‡p">
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
              title="MĂ¡» bĂ¡º£ng emoji"
              aria-label="MĂ¡» bĂ¡º£ng emoji"
            >
              <Smile size={16} />
            </button>
            <button
              type="button"
              className={styles.sendBtn}
              onClick={handleSend}
              disabled={!message.trim() || isSendingMessage}
              title="GĂ¡»­i tin nhĂ¡º¯n"
              aria-label="GĂ¡»­i tin nhĂ¡º¯n"
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
                    title="GĂ¡»­i sticker"
                    aria-label="GĂ¡»­i sticker"
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
                          setChatNotice('Bạn chĂ¡»‰ gĂ¡» i đưĂ¡»£c tĂ¡»‘i đa 3 tin nhĂ¡º¯n khi chưa kĂ¡º¿t bạn. Hãy kĂ¡º¿t bạn để tiếp tĂ¡»¥c.')
                        } else if (error instanceof Error) {
                          setChatNotice(error.message)
                        }
                      }
                    }}
                  >
                    {sticker}
                  </button>
                )) : <p className={styles.stickerLoading}>Ä ang tĂ¡º£i pack {activeStickerPack}...</p>}
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
              VĂ¡» tin nhĂ¡º¯n mĂ¡»›i nhĂ¡º¥t
            </button>
          ) : null}

          {showNewMessageModal ? (
            <div className={styles.overlayBackdrop}>
              <div className={styles.overlayCard}>
                <h3>Tin nhĂ¡º¯n mĂ¡»›i</h3>
                <input
                  value={newMessageKeyword}
                  onChange={(event) => setNewMessageKeyword(event.target.value)}
                  placeholder="NhĂ¡º­p tên bạn bè hoặc email đăng ký"
                />
                <div className={styles.overlayList}>
                  {searchUsersResult.map((item) => (
                    <button key={item.id} type="button" onClick={() => handleCreateConversationWithUser(item.id)} title={`Tạo hĂ¡»™i thoại vĂ¡»›i ${item.name}`} aria-label={`Tạo hĂ¡»™i thoại vĂ¡»›i ${item.name}`}>
                      <span className={styles.listEntryIdentity}>
                        <span className={styles.listEntryAvatar}>{getAvatarInitial(item.name)}</span>
                        <span className={styles.listEntryMeta}>
                          <strong className={styles.listEntryTitle}>{item.name}</strong>
                          <small className={styles.listEntrySubtitle}>ID {item.id}</small>
                        </span>
                      </span>
                    </button>
                  ))}
                  {searchUsersResult.length === 0 ? <p>Không có kĂ¡º¿t quĂ¡º£ phù hĂ¡»£p.</p> : null}
                </div>
                <button type="button" className={styles.overlayCloseBtn} onClick={() => setShowNewMessageModal(false)} title="ĐĂ³ng" aria-label="ĐĂ³ng">
                  ĐĂ³ng
                </button>
              </div>
            </div>
          ) : null}

          {showNotificationsDrawer ? (
            <div className={styles.overlayBackdrop}>
              <div className={styles.overlayCard}>
                <h3>Thông báo nâng cao</h3>
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
                              <span className={styles.listEntrySubtitle}>{item.body || 'Thông báo hĂ¡»‡ thống'}</span>
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
                              MĂ¡» đoạn chat
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
                              {busyActionId === `notif-${item.id}` ? 'Ä ang đĂ¡»“ng ý...' : 'ĐĂ¡»“ng ý'}
                            </button>
                          ) : null}
                        </div>
                      </div>
                    )
                  })}
                  {notifications.length === 0 ? <p>HiĂ¡»‡n chưa có thông báo quan trĂ¡»ng.</p> : null}
                </div>
                <button type="button" className={styles.overlayCloseBtn} onClick={() => setShowNotificationsDrawer(false)} title="ĐĂ³ng" aria-label="ĐĂ³ng">
                  ĐĂ³ng
                </button>
              </div>
            </div>
          ) : null}

          {forwardingMessageId ? (
            <div className={styles.forwardDialogBackdrop}>
              <div className={styles.forwardDialog}>
                <h3>ChuyĂ¡»ƒn tiĂ¡º¿p tin nhĂ¡º¯n</h3>
                <p>ChĂ¡»n cuĂ¡»™c trò chuyĂ¡»‡n để chuyển tiếp:</p>
                <div className={styles.forwardList}>
                  {conversations
                    .filter((conv) => conv.id !== selectedConversationId)
                    .map((conv) => (
                      <button key={conv.id} type="button" onClick={() => handleForward(conv.id)} title={`ChuyĂ¡»ƒn tiĂ¡º¿p đến ${getConversationDisplayName(conv, user?.id)}`} aria-label={`ChuyĂ¡»ƒn tiĂ¡º¿p đến ${getConversationDisplayName(conv, user?.id)}`}>
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
                <button type="button" className={styles.forwardCancel} onClick={() => setForwardingMessageId(null)} title="Hủy chuyển tiếp" aria-label="Hủy chuyển tiếp">
                  Hủy
                </button>
              </div>
            </div>
          ) : null}

          {showCreateGroupModal ? (
            <div className={styles.overlayBackdrop}>
              <div className={styles.overlayCard}>
                <h3>Tạo nhóm chat</h3>
                <input
                  value={groupName}
                  onChange={(event) => setGroupName(event.target.value)}
                  placeholder="NhĂ¡º­p tên nhóm"
                />
                <input
                  value={groupSearchKeyword}
                  onChange={(event) => setGroupSearchKeyword(event.target.value)}
                  placeholder="Tìm bạn bè để thêm vào nhóm"
                />
                <div className={styles.overlayList}>
                  {filteredCreateGroupInviteCandidates.map((friend) => {
                    const checked = groupMemberIds.includes(friend.id)
                    return (
                      <button key={friend.id} type="button" onClick={() => toggleGroupMember(friend.id)} title={`ChĂ¡»n ${friend.fullName}`} aria-label={`ChĂ¡»n ${friend.fullName}`}>
                        <span className={styles.listEntryIdentity}>
                          <span className={styles.listEntryAvatar}>{getAvatarInitial(friend.fullName)}</span>
                          <span className={styles.listEntryMeta}>
                            <strong className={styles.listEntryTitle}>{checked ? '✓ ' : ''}{friend.fullName}</strong>
                            <span className={styles.listEntrySubtitle}>{friend.email || friend.phone || `ID ${friend.id}`}</span>
                          </span>
                        </span>
                      </button>
                    )
                  })}
                  {acceptedFriends.length === 0 ? <p>Bạn chưa có bạn bè để tạo nhóm.</p> : null}
                  {acceptedFriends.length > 0 && filteredCreateGroupInviteCandidates.length === 0 ? <p>Không tìm thĂ¡º¥y bạn bè phù hĂ¡»£p.</p> : null}
                </div>
                <button
                  type="button"
                  className={styles.overlayCloseBtn}
                  disabled={!groupName.trim() || groupMemberIds.length === 0 || creatingGroup}
                  onClick={handleCreateGroupConversation}
                >
                  {creatingGroup ? 'Ä ang tạo nhóm...' : 'Tạo nhóm'}
                </button>
                <button type="button" className={styles.overlayCloseBtn} onClick={() => setShowCreateGroupModal(false)} title="ĐĂ³ng" aria-label="ĐĂ³ng">
                  ĐĂ³ng
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
                    {callParticipantProfiles.length} ngưĂ¡»i đang tham gia
                  </p>
                </div>
                <div className={styles.callBadge}>{callAnswered ? formattedCallTime : 'ĐĂ¡»• chuông...'}</div>
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
                          {callParticipantProfiles.find((member) => member.userId === item.userId)?.name || `NgưĂ¡»i dùng #${item.userId}`}
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
                <span>Bạn</span>
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
                  title="BĂ¡º­t tĂ¡º¯t micro"
                  aria-label="BĂ¡º­t tĂ¡º¯t micro"
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
                  title="BĂ¡º­t tĂ¡º¯t camera"
                  aria-label="BĂ¡º­t tĂ¡º¯t camera"
                >
                  <Video size={16} />
                </button>
                <button type="button" title="MĂ¡»i ngưĂ¡»i khác" aria-label="MĂ¡»i ngưĂ¡»i khác">
                  <UserPlus size={16} />
                </button>
                <button type="button" className={styles.endCallOverlayBtn} onClick={handleEndCall} title="Kết thúc cuĂ¡»™c gĂ¡»i" aria-label="Kết thúc cuĂ¡»™c gĂ¡»i">
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
                  <strong>{String(activeActionMessage.senderName || activeActionMessage.sender?.fullName || activeActionMessage.sender?.name || 'NgưĂ¡»i dùng')}</strong>
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
                ChuyĂ¡»ƒn tiĂ¡º¿p
              </button>
              <button
                type="button"
                onClick={() => {
                  void handleTogglePinMessage(activeActionMessage)
                  setActionMenu(null)
                }}
              >
                {pinnedMessageIds.has(activeActionMessage.id) ? 'BĂ¡» ghim' : 'Ghim'}
              </button>
              {activeActionMessage.senderId === user?.id ? (
                <button
                  type="button"
                  onClick={() => {
                    handleRecall(activeActionMessage)
                    setActionMenu(null)
                  }}
                >
                  Thu hĂ¡»“i
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
                  Xóa
                </button>
              ) : null}
            </div>
          ) : null}
        </section>

        <aside className={styles.detailsPanel}>
          {!selectedConversation ? (
            <div className={styles.detailsEmpty}>
              <Info size={16} />
              <p>ChĂ¡»n mĂ¡»™t cuĂ¡»™c trò chuyĂ¡»‡n để xem thông tin và thao tác nhanh.</p>
            </div>
          ) : null}

          {selectedConversation && selectedConversation.type === 'direct' ? (
            <div className={styles.detailsBody}>
              <div className={styles.detailsHeader}>
                <h3>Thông tin đoạn chat</h3>
                <span>Chat đơn</span>
              </div>

              <div className={styles.detailsIdentity}>
                <div className={styles.detailsAvatar}>{(selectedName[0] || 'U').toUpperCase()}</div>
                <div>
                  <strong>{selectedName}</strong>
                  <small>
                    {isDirectPeerFriend
                      ? 'ĐĂ£ kĂ¡º¿t bạn'
                      : isDirectPeerPending
                        ? 'Ä ang chĂ¡» xác nhĂ¡º­n kĂ¡º¿t bạn'
                        : 'Chưa kĂ¡º¿t bạn'}
                  </small>
                </div>
              </div>

              <div className={styles.detailsSection}>
                <strong>Tùy chĂ¡»n nhanh</strong>
                <div className={styles.detailActionsGrid}>
                  {directPeer ? (
                    <Link to={`/profile/${directPeer.id}`} className={styles.detailLinkAction}>
                      Xem trang cá nhân
                    </Link>
                  ) : null}
                  <button type="button" onClick={() => void handleClearChatForMe()}>
                    Xóa đoạn chat phía bạn
                  </button>
                  <button type="button" onClick={() => setShowNotificationsDrawer(true)}>
                    MĂ¡» thông báo
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          {selectedGroup ? (
            <div className={styles.detailsBody}>
              <div className={styles.detailsHeader}>
                <h3>Thông tin nhóm</h3>
                <span>{selectedGroup.members.length} thành viên</span>
              </div>

              <div className={styles.detailsIdentity}>
                <div className={styles.detailsAvatar}>{(selectedGroup.name?.[0] || 'G').toUpperCase()}</div>
                <div>
                  <strong>{selectedGroup.name || 'Nhóm chat'}</strong>
                  <small>Bạn: {getGroupRoleLabel(myGroupRole)}</small>
                </div>
              </div>

              <div className={styles.detailsTabs}>
                <button
                  type="button"
                  className={rightPanelSection === 'overview' ? styles.detailsTabActive : ''}
                  onClick={() => setRightPanelSection('overview')}
                >
                  TĂ¡»•ng quan
                </button>
                <button
                  type="button"
                  className={rightPanelSection === 'members' ? styles.detailsTabActive : ''}
                  onClick={() => setRightPanelSection('members')}
                >
                  Thành viên
                </button>
                <button
                  type="button"
                  className={rightPanelSection === 'manage' ? styles.detailsTabActive : ''}
                  onClick={() => setRightPanelSection('manage')}
                >
                  QuĂ¡º£n lý
                </button>
              </div>

              {rightPanelSection === 'overview' ? (
                <>
                  <div className={styles.detailsSection}>
                    <strong>Vai trò chính</strong>
                    <div className={styles.groupMemberList}>
                      <div className={styles.groupMemberRow}>
                        <div className={styles.groupMemberInfo}>
                          <b>{groupLeader?.fullName || 'Chưa xác đĂ¡»‹nh'}</b>
                          <small>TrưĂ¡»Ÿng nhóm 킷 ID {groupLeader?.userId ?? selectedGroup.createdBy}</small>
                        </div>
                        <Crown size={14} />
                      </div>
                      <div className={styles.groupMemberRow}>
                        <div className={styles.groupMemberInfo}>
                          <b>{groupDeputy?.fullName || 'Chưa có phó nhóm'}</b>
                          <small>{groupDeputy ? `Phó nhóm 킷 ID ${groupDeputy.userId}` : 'Cần chĂ¡»‰ đĂ¡»‹nh để trưĂ¡»Ÿng nhóm có thĂ¡»ƒ rĂ¡»i nhóm'}</small>
                        </div>
                        <UserCheck size={14} />
                      </div>
                    </div>
                  </div>

                  <div className={styles.detailsSection}>
                    <strong>Thao tác nhanh</strong>
                    <div className={styles.detailActionsGrid}>
                      <button type="button" onClick={() => setRightPanelSection('manage')}>
                        QuĂ¡º£n lý quyĂ¡»n & thành viên
                      </button>
                      <button type="button" onClick={() => void handleClearChatForMe()}>
                        Xóa đoạn chat phía bạn
                      </button>
                    </div>
                  </div>
                </>
              ) : null}

              {rightPanelSection === 'members' ? (
                <div className={styles.detailsSection}>
                  <strong>Danh sách thành viên ({selectedGroup.members.length})</strong>
                  <div className={styles.groupMemberList}>
                    {selectedGroup.members.map((member) => (
                      <div key={member.userId} className={styles.groupMemberRow}>
                        <div className={styles.groupMemberInfo}>
                          <b>{member.fullName}{Number(member.userId) === Number(user?.id) ? ' (Bạn)' : ''}</b>
                          <small>{getGroupRoleLabel(member.role)} 킷 ID {member.userId}</small>
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
                      ? 'Bạn là trưĂ¡»Ÿng nhóm: có thĂ¡»ƒ phân quyĂ¡»n, thêm/xóa thành viên, giĂ¡º£i tán nhóm và rĂ¡»i nhóm.'
                      : canRemoveMembers
                        ? 'Bạn là phó nhóm: có thĂ¡»ƒ thêm/xóa thành viên.'
                        : 'Bạn là thành viên: chĂ¡»‰ có thĂ¡»ƒ rĂ¡»i nhóm.'}
                  </p>

                  <div className={styles.detailsSection}>
                    <strong>QuĂ¡º£n lý thành viên hiĂ¡»‡n tại</strong>
                    <div className={styles.groupMemberList}>
                      {selectedGroup.members.map((member) => {
                        const isSelf = Number(member.userId) === Number(user?.id)
                        const isLeader = member.role === 'leader'
                        const isDeputy = member.role === 'deputy'
                        return (
                          <div key={member.userId} className={styles.groupMemberRow}>
                            <div className={styles.groupMemberInfo}>
                              <b>{member.fullName}{isSelf ? ' (Bạn)' : ''}</b>
                              <small>{getGroupRoleLabel(member.role)} 킷 ID {member.userId}</small>
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
                                    {groupActionBusyId === `role-${member.userId}` ? 'Ä ang chuyĂ¡»ƒn...' : 'Làm trưĂ¡»Ÿng nhóm'}
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
                                      ? 'Ä ang cĂ¡º­p nhĂ¡º­t...'
                                      : isDeputy
                                        ? 'Gỡ phó nhóm'
                                        : 'Gán phó nhóm'}
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
                                  {groupActionBusyId === `remove-${member.userId}` ? 'Ä ang xóa...' : 'Xóa'}
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
                      <strong>Thêm thành viên</strong>
                      <input
                        className={styles.detailsSearchInput}
                        value={groupSearchKeyword}
                        onChange={(event) => setGroupSearchKeyword(event.target.value)}
                        placeholder="Tìm bạn bè theo tên, email hoặc ID"
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
                                {groupActionBusyId === `add-${friend.id}` ? 'Ä ang thêm...' : 'Thêm'}
                              </button>
                            </div>
                          </div>
                        ))}
                        {filteredGroupInviteCandidates.length === 0 ? <p>Không còn bạn bè phù hĂ¡»£p để thêm.</p> : null}
                      </div>
                    </div>
                  ) : null}

                  <div className={styles.detailsSection}>
                    <strong>Hành đĂ¡»™ng nhóm</strong>
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
                        {groupActionBusyId === 'leave-group' ? 'Ä ang rĂ¡»i nhóm...' : 'RĂ¡»i nhóm'}
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
                          {groupActionBusyId === 'dissolve-group' ? 'Ä ang giĂ¡º£i tán...' : 'GiĂ¡º£i tán nhóm'}
                        </button>
                      ) : null}
                    </div>
                    {myGroupRole === 'leader' && !canLeaderLeaveGroup ? (
                      <small className={styles.groupManageHint}>TrưĂ¡»Ÿng nhóm chĂ¡»‰ có thĂ¡»ƒ rĂ¡»i nhóm sau khi đã có phó nhóm.</small>
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

