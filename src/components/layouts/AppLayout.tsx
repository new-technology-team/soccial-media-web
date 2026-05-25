import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

import { useAuthStore } from '@/contexts/auth-store'
import { useCallStore } from '@/contexts/call-store'
import { IncomingCallModal } from '@/components/call'
import { connectSocket, getSocket } from '@/services/socket'
import styles from './app-layout.module.css'

export default function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const navigate = useNavigate()
  const token = useAuthStore((state) => state.accessToken)
  const user = useAuthStore((state) => state.user)
  const incomingCall = useCallStore((state) => state.incomingCall)
  const setIncomingCall = useCallStore((state) => state.setIncomingCall)

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

    socket.on('call:offer', onOffer)
    socket.on('call:end', onEnd)

    return () => {
      socket.off('call:offer', onOffer)
      socket.off('call:end', onEnd)
    }
  }, [setIncomingCall, token, user?.id])

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
