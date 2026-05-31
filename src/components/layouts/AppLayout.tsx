import { useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'

import { useAuthStore } from '@/contexts/auth-store'
import { useCallStore } from '@/contexts/call-store'
import { useChatStore } from '@/contexts/chat-store'
import { callSession } from '@/services/call-session'
import { ActiveCallWindow, IncomingCallModal, MinimizedCallPill, OutgoingCallModal } from '@/components/call'
import { resolveApiAssetUrl } from '@/api/client'
import { connectSocket, getSocket } from '@/services/socket'
import { toast } from '@/hooks/use-toast'
import styles from './app-layout.module.css'

export default function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const token = useAuthStore((state) => state.accessToken)
  const user = useAuthStore((state) => state.user)
  const refreshToken = useAuthStore((state) => state.refreshToken)
  const setAuth = useAuthStore((state) => state.setAuth)
  const clearAuth = useAuthStore((state) => state.clearAuth)
  const incomingCall = useCallStore((state) => state.incomingCall)
  const setAcceptPending = useCallStore((state) => state.setAcceptPending)
  const updateUserAvatar = useChatStore((state) => state.updateUserAvatar)

  // Active call state from Zustand
  const activeCall = useCallStore((s) => s.activeCall)
  const callState = useCallStore((s) => s.callState)
  const callAnswered = useCallStore((s) => s.callAnswered)
  const callMinimized = useCallStore((s) => s.callMinimized)
  const mutedMic = useCallStore((s) => s.mutedMic)
  const mutedCam = useCallStore((s) => s.mutedCam)
  const callSeconds = useCallStore((s) => s.callSeconds)
  const cameraAvailable = useCallStore((s) => s.cameraAvailable)
  const callParticipants = useCallStore((s) => s.callParticipants)
  const localStream = useCallStore((s) => s.localStream)
  const remoteStreams = useCallStore((s) => s.remoteStreams)

  const [mutedSpeaker, setMutedSpeaker] = useState(false)

  const formattedCallTime = `${String(Math.floor(callSeconds / 60)).padStart(2, '0')}:${String(callSeconds % 60).padStart(2, '0')}`

  // Call timer — runs in AppLayout so it persists across navigation
  useEffect(() => {
    if (!callAnswered || !activeCall) return
    const { setCallSeconds } = useCallStore.getState()
    setCallSeconds(Math.floor((Date.now() - activeCall.startedAt) / 1000))
    const id = window.setInterval(() => {
      setCallSeconds(Math.floor((Date.now() - activeCall.startedAt) / 1000))
    }, 1000)
    return () => window.clearInterval(id)
  }, [callAnswered, activeCall?.startedAt]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!token || !user?.id) return

    const socket = connectSocket(token, user.id)

    const onOffer = (payload: any) => {
      if (!payload?.offer) return
      const { setIncomingCall } = useCallStore.getState()
      setIncomingCall({
        fromUserId: Number(payload.fromUserId || 0),
        conversationId: payload.conversationId ? String(payload.conversationId) : null,
        callType: payload.callType === 'video' ? 'video' : 'voice',
        offer: payload.offer,
      })
    }

    const onEnd = () => {
      const { setIncomingCall } = useCallStore.getState()
      setIncomingCall(null)
    }

    const onAuthRevoked = (payload: { reason?: string }) => {
      clearAuth()
      socket.disconnect()
      toast({
        title: 'Phiên đăng nhập đã bị thu hồi',
        description: payload?.reason ? `Lý do: ${payload.reason}` : 'Vui lòng đăng nhập lại để tiếp tục.',
        variant: 'destructive',
      })
      navigate('/auth/login?reason=session-expired', { replace: true })
    }

    const onAvatarUpdated = (payload: { userId?: number; avatarUrl?: string; user?: typeof user }) => {
      if (!payload?.userId) return
      const nextAvatar = resolveApiAssetUrl(payload.avatarUrl) ?? payload.avatarUrl ?? null
      updateUserAvatar(Number(payload.userId), nextAvatar || null)
      if (Number(payload.userId) !== Number(user.id) || !refreshToken) return
      setAuth({
        accessToken: token,
        refreshToken,
        user: {
          ...user,
          ...(payload.user || {}),
          avatarUrl: nextAvatar || payload.user?.avatarUrl || user.avatarUrl,
        },
      })
    }

    socket.on('call:offer', onOffer)
    socket.on('call:end', onEnd)
    socket.on('auth:revoked', onAuthRevoked)
    socket.on('user:avatar-updated', onAvatarUpdated)

    return () => {
      socket.off('call:offer', onOffer)
      socket.off('call:end', onEnd)
      socket.off('auth:revoked', onAuthRevoked)
      socket.off('user:avatar-updated', onAvatarUpdated)
    }
  }, [clearAuth, navigate, refreshToken, setAuth, token, updateUserAvatar, user])

  const handleOpenCall = () => {
    setAcceptPending(true)
    const target = incomingCall?.conversationId
      ? `/messages?conversation=${encodeURIComponent(incomingCall.conversationId)}`
      : '/messages'
    navigate(target)
  }

  const handleDeclineCall = () => {
    const socket = getSocket()
    if (socket && incomingCall?.conversationId && incomingCall?.fromUserId) {
      socket.emit('call:end', {
        targetUserId: incomingCall.fromUserId,
        conversationId: incomingCall.conversationId,
      })
    }
    const { setIncomingCall } = useCallStore.getState()
    setIncomingCall(null)
  }

  // Call control handlers for AppLayout (used when navigated away from /messages)
  const handleToggleMicGlobal = () => {
    const { mutedMic: current, setMutedMic } = useCallStore.getState()
    const next = !current
    useCallStore.getState().localStream?.getAudioTracks().forEach((t) => { t.enabled = !next })
    setMutedMic(next)
    getSocket()?.emit('participant_updated', { conversationId: activeCall?.conversationId, micMuted: next })
  }

  const handleToggleCameraGlobal = () => {
    const { mutedCam: current, setMutedCam, cameraAvailable: available } = useCallStore.getState()
    if (!available || activeCall?.type === 'voice') return
    const next = !current
    useCallStore.getState().localStream?.getVideoTracks().forEach((t) => { t.enabled = !next })
    setMutedCam(next)
  }

  const handleEndCallGlobal = () => {
    const socket = getSocket()
    const conversationId = activeCall?.conversationId
    if (socket && conversationId && activeCall?.targetUserIds?.length) {
      activeCall.targetUserIds.forEach((targetUserId) => {
        socket.emit('call:end', { targetUserId, conversationId })
      })
    }
    callSession.peers.forEach((p) => p.close())
    callSession.peers.clear()
    callSession.pendingCandidates.clear()
    useCallStore.getState().localStream?.getTracks().forEach((t) => t.stop())
    const {
      setActiveCall, setCallState, setCallAnswered, setCallMinimized,
      setCallSeconds, setCallParticipants, setLocalStream, setRemoteStreams,
      setMutedMic, setMutedCam,
    } = useCallStore.getState()
    setLocalStream(null)
    setRemoteStreams([])
    setActiveCall(null)
    setCallState('idle')
    setCallAnswered(false)
    setCallMinimized(false)
    setCallSeconds(0)
    setCallParticipants([])
    setMutedMic(false)
    setMutedCam(false)
    callSession.localStream = null
  }

  // Only show global call windows when NOT on /messages (page.tsx handles its own IncomingCallModal there)
  // OutgoingCallModal and ActiveCallWindow always show globally
  const onMessagesPage = pathname.startsWith('/messages')

  return (
    <div className={styles.page}>
      <main className={styles.main}>{children}</main>

      {/* Incoming call modal — shown outside /messages only (messages page has its own) */}
      {incomingCall && !onMessagesPage ? (
        <IncomingCallModal
          name={
            incomingCall.conversationName ||
            incomingCall.fromUserName ||
            `Người dùng #${incomingCall.fromUserId}`
          }
          callType={incomingCall.callType}
          state="incoming"
          onAccept={handleOpenCall}
          onDecline={handleDeclineCall}
        />
      ) : null}

      {/* OutgoingCallModal — persists across navigation */}
      {activeCall && !callAnswered && !callMinimized ? (
        <OutgoingCallModal
          name={activeCall.withName}
          avatarUrl={activeCall.avatarUrl}
          callType={activeCall.type}
          mode={activeCall.mode}
          state={callState === 'idle' ? 'calling' : callState}
          timer={formattedCallTime}
          onEnd={handleEndCallGlobal}
        />
      ) : null}

      {/* ActiveCallWindow — persists across navigation */}
      {activeCall && callAnswered && !callMinimized ? (
        <ActiveCallWindow
          name={activeCall.withName}
          avatarUrl={activeCall.avatarUrl}
          callType={activeCall.type}
          mode={activeCall.mode}
          state={callState === 'idle' ? 'connected' : callState}
          duration={formattedCallTime}
          participants={callParticipants}
          localStream={localStream}
          remoteStreams={remoteStreams}
          mutedMic={mutedMic}
          mutedCam={mutedCam}
          mutedSpeaker={mutedSpeaker}
          cameraAvailable={cameraAvailable}
          onToggleMic={handleToggleMicGlobal}
          onToggleCamera={handleToggleCameraGlobal}
          onToggleSpeaker={() => setMutedSpeaker((v) => !v)}
          onMinimize={() => useCallStore.getState().setCallMinimized(true)}
          onEnd={handleEndCallGlobal}
        />
      ) : null}

      {/* Minimized call pill — persists across navigation */}
      {activeCall && callMinimized ? (
        <MinimizedCallPill
          name={activeCall.withName}
          avatarUrl={activeCall.avatarUrl}
          duration={formattedCallTime}
          participantCount={
            activeCall.mode === 'group'
              ? callParticipants.filter((p) => p.status === 'joined').length || undefined
              : undefined
          }
          onOpen={() => useCallStore.getState().setCallMinimized(false)}
          onEnd={handleEndCallGlobal}
        />
      ) : null}
    </div>
  )
}
