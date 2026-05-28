import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

import { useAuthStore } from '@/contexts/auth-store'
import { useCallStore } from '@/contexts/call-store'
import { useChatStore } from '@/contexts/chat-store'
import { IncomingCallModal } from '@/components/call'
import { connectSocket, getSocket } from '@/services/socket'
import { toast } from '@/hooks/use-toast'
import styles from './app-layout.module.css'

export default function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const navigate = useNavigate()
  const token = useAuthStore((state) => state.accessToken)
  const user = useAuthStore((state) => state.user)
  const refreshToken = useAuthStore((state) => state.refreshToken)
  const setAuth = useAuthStore((state) => state.setAuth)
  const clearAuth = useAuthStore((state) => state.clearAuth)
  const incomingCall = useCallStore((state) => state.incomingCall)
  const setIncomingCall = useCallStore((state) => state.setIncomingCall)
  const updateUserAvatar = useChatStore((state) => state.updateUserAvatar)

  useEffect(() => {
    if (!token || !user?.id) return

    const socket = connectSocket(token, user.id)

    const onOffer = (payload: any) => {
      if (!payload?.offer) return
      setIncomingCall({
        fromUserId: Number(payload.fromUserId || 0),
        conversationId: payload.conversationId ? String(payload.conversationId) : null,
        callType: payload.callType === 'video' ? 'video' : 'voice',
        offer: payload.offer,
      })
    }

    const onEnd = () => {
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
      const nextAvatar = payload.avatarUrl?.startsWith('/uploads/') ? `/backend${payload.avatarUrl}` : payload.avatarUrl
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
  }, [clearAuth, navigate, refreshToken, setAuth, setIncomingCall, token, updateUserAvatar, user])

  const handleOpenCall = () => {
    if (!incomingCall?.conversationId) {
      navigate('/messages')
      return
    }
    navigate(`/messages?conversation=${encodeURIComponent(incomingCall.conversationId)}`)
  }

  const handleDeclineCall = () => {
    const socket = getSocket()
    if (socket && incomingCall?.conversationId && incomingCall?.fromUserId) {
      socket.emit('call:end', {
        targetUserId: incomingCall.fromUserId,
        conversationId: incomingCall.conversationId,
      })
    }
    setIncomingCall(null)
  }

  return (
    <div className={styles.page}>
      <main className={styles.main}>{children}</main>
      {incomingCall ? (
        <IncomingCallModal
          name={`Người dùng #${incomingCall.fromUserId}`}
          callType={incomingCall.callType}
          state="incoming"
          onAccept={handleOpenCall}
          onDecline={handleDeclineCall}
        />
      ) : null}
    </div>
  )
}
