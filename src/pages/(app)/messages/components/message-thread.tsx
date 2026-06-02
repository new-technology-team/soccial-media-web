import { MoreHorizontal, Smile } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { MouseEvent, MutableRefObject, ReactNode, UIEvent } from 'react'

import { formatVietnamTime, getMessageReactionItems } from '@/services/messages/formatters'
import { CallHistoryMessage } from '@/components/call'
import type { ChatMessage, Conversation } from '@/types'
import { cn } from '@/utils'
import styles from '../page.module.css'

type VirtualSlice = {
  startIndex: number
  items: ChatMessage[]
}

type MessageThreadProps = {
  userId?: number
  selectedConversation: Conversation | null
  virtualSlice: VirtualSlice
  messagesWrapRef: MutableRefObject<HTMLDivElement | null>
  loadingOlderMessages: boolean
  typingUserIds: Set<number>
  pinnedMessageIds: Set<string>
  reactionPickerMessageId: string | null
  reactionPickerPlacement: 'above' | 'below' | null
  openReactionPicker: (event: MouseEvent<HTMLElement>, messageId: string) => void
  openMessageActions: (event: MouseEvent<HTMLElement>, messageId: string) => void
  renderMessagePreview: (message: ChatMessage) => ReactNode
  getMessageReadLabel: (message: ChatMessage) => string | null
  onJoinGroupCall?: (message: ChatMessage) => void
  onLoadOlderMessages: () => Promise<void>
  onScroll?: (event: UIEvent<HTMLDivElement>) => void
}

const MESSAGE_REACTION_ICONS: Array<{ type: string; label: string; emoji: string }> = [
  { type: 'smile', label: 'Cười', emoji: '😄' },
  { type: 'sad', label: 'Buồn', emoji: '😔' },
  { type: 'like', label: 'Thích', emoji: '👍' },
  { type: 'love', label: 'Yêu thích', emoji: '❤️' },
  { type: 'wow', label: 'Bất ngờ', emoji: '😮' },
  { type: 'cry', label: 'Khóc', emoji: '😭' },
  { type: 'angry', label: 'Tức giận', emoji: '😡' },
]

function ReactionIcon({ type, size = 15 }: { type: string | null | undefined; size?: number }) {
  const reaction = MESSAGE_REACTION_ICONS.find((item) => item.type === type) || MESSAGE_REACTION_ICONS[2]
  return (
    <span className={styles.reactionEmojiGlyph} style={{ fontSize: size }}>
      {reaction.emoji}
    </span>
  )
}

function getCallHistoryTime(message: ChatMessage, meta: Record<string, unknown>) {
  const raw = meta.endedAt || meta.startedAt || message.createdAt
  const time = raw ? new Date(String(raw)).getTime() : 0
  return Number.isFinite(time) ? time : 0
}

export function MessageThread({
  userId,
  selectedConversation,
  virtualSlice,
  messagesWrapRef,
  loadingOlderMessages,
  typingUserIds,
  pinnedMessageIds,
  reactionPickerMessageId,
  reactionPickerPlacement,
  openReactionPicker,
  openMessageActions,
  renderMessagePreview,
  getMessageReadLabel,
  onJoinGroupCall,
  onLoadOlderMessages,
  onScroll,
}: MessageThreadProps) {
  return (
    <div
      className={cn(styles.messagesWrap, virtualSlice.items.length === 0 && styles.messagesWrapEmpty)}
      ref={messagesWrapRef}
      onScroll={(event) => {
        const element = event.currentTarget
        if (element.scrollTop <= 24) {
          onLoadOlderMessages().catch(() => undefined)
        }
        onScroll?.(event)
      }}
    >
      {loadingOlderMessages ? <p className={styles.historyLoading}>Đang tải tin nhắn cũ hơn...</p> : null}
      {virtualSlice.startIndex > 0 ? (
        <p className={styles.virtualHint}>Đang hiển thị các tin nhắn mới nhất. Cuộn lên để tải thêm lịch sử.</p>
      ) : null}

      {virtualSlice.items.map((msg, index) => {
        if (msg.type === 'call-history') {
          const meta = (msg.meta || {}) as Record<string, unknown>
          const callSessionId = String(meta.callSessionId || '')
          const activeMessageTime = getCallHistoryTime(msg, meta)
          const hasEndedMessage = Boolean(callSessionId && virtualSlice.items.some((item) => {
            const itemMeta = (item.meta || {}) as Record<string, unknown>
            return item.type === 'call-history' && itemMeta.callSessionId === callSessionId && itemMeta.status && itemMeta.status !== 'active'
          })) || virtualSlice.items.some((item) => {
            if (item.type !== 'call-history' || item.conversationId !== msg.conversationId) return false
            const itemMeta = (item.meta || {}) as Record<string, unknown>
            return Boolean(itemMeta.status && itemMeta.status !== 'active' && getCallHistoryTime(item, itemMeta) >= activeMessageTime)
          })
          const canJoinGroupCall = meta.mode === 'group' && meta.status === 'active' && !hasEndedMessage
          return (
            <CallHistoryMessage
              key={msg.id}
              text={msg.text || 'Cuộc gọi đã kết thúc'}
              actionLabel={canJoinGroupCall ? 'Tham gia' : undefined}
              onAction={canJoinGroupCall ? () => onJoinGroupCall?.(msg) : undefined}
            />
          )
        }

        const mine = msg.senderId === userId
        const reactionItems = getMessageReactionItems(msg)
        const isRecalled = !!(msg.isDeleted || (msg.meta && (msg.meta as Record<string, unknown>).recalled))
        const hasReactions = !isRecalled && reactionItems.length > 0
        const sender = selectedConversation?.members.find((member) => member.userId === msg.senderId) || null
        const senderName = sender?.fullName || msg.senderName || `Người dùng #${msg.senderId}`
        const readLabel = mine ? getMessageReadLabel(msg) : null
        const previousMessage = virtualSlice.items[index - 1]
        const nextMessage = virtualSlice.items[index + 1]
        const groupedWithPrevious = Boolean(previousMessage && previousMessage.type !== 'call-history' && previousMessage.senderId === msg.senderId)
        const groupedWithNext = Boolean(nextMessage && nextMessage.type !== 'call-history' && nextMessage.senderId === msg.senderId)
        const isGroupConversation = selectedConversation?.type === 'group'
        const showSenderName = !mine && isGroupConversation && !groupedWithPrevious
        const showAvatar = !mine && !groupedWithNext
        const reactionNames = reactionItems
          .map((reaction) => {
            const reactor = selectedConversation?.members.find((member) => member.userId === reaction.userId) || null
            const reactorName = reactor?.fullName || `Người dùng #${reaction.userId}`
            return `${reactorName}: ${reaction.meta.label}`
          })
          .join(', ')
        const reactionGroups = reactionItems.reduce<Array<{ reaction: string; emoji: string; label: string; count: number }>>((groups, reaction) => {
          const existing = groups.find((item) => item.reaction === reaction.reaction)
          const meta = MESSAGE_REACTION_ICONS.find((item) => item.type === reaction.reaction) || MESSAGE_REACTION_ICONS[2]
          if (existing) {
            existing.count += 1
          } else {
            groups.push({ reaction: reaction.reaction, emoji: meta.emoji, label: meta.label, count: 1 })
          }
          return groups
        }, [])

        return (
          <div
            key={msg.id}
            data-message-id={msg.id}
            className={cn(
              styles.messageRow,
              mine && styles.messageRowMine,
              groupedWithPrevious && styles.messageRowGrouped,
              groupedWithNext && styles.messageRowHasNext,
            )}
          >
            {showAvatar ? (
              <div className={styles.messageAvatar}>
                {sender?.avatarUrl ? <img src={sender.avatarUrl} alt={senderName} className={styles.messageAvatarImage} loading="lazy" /> : (senderName[0] || 'U').toUpperCase()}
              </div>
            ) : (
              <div className={styles.messageAvatarSpacer} aria-hidden="true" />
            )}

            <div className={cn(styles.messageBlock, hasReactions && styles.messageBlockHasReactions)}>
              {showSenderName ? (
                <div className={styles.senderRow}>
                  <Link to={`/profile/${msg.senderId}`} className={styles.senderLink}>
                    {senderName}
                  </Link>
                </div>
              ) : null}

              {reactionPickerMessageId === msg.id && reactionPickerPlacement === 'above' ? (
                <div className={styles.reactionPickerSpacer} aria-hidden="true" />
              ) : null}

              <div
                className={cn(styles.bubble, mine && styles.bubbleMine)}
                data-message-bubble="true"
                onContextMenu={(event) => {
                  event.preventDefault()
                  openMessageActions(event, msg.id)
                }}
              >
                <button
                  type="button"
                  className={styles.messageActionTrigger}
                  title="Mở menu thao tác"
                  aria-label="Mở menu thao tác"
                  onClick={(event) => {
                    event.stopPropagation()
                    openMessageActions(event, msg.id)
                  }}
                >
                  <MoreHorizontal size={14} />
                </button>

                {renderMessagePreview(msg)}
                {pinnedMessageIds.has(msg.id) ? <small className={styles.forwardTag}>Đã ghim</small> : null}

              </div>

              {hasReactions ? (
                <div className={styles.reactionsPill} title={reactionNames}>
                  {reactionGroups.map((reaction) => (
                    <span key={reaction.reaction} className={styles.reactionChip} title={reaction.label}>
                      <span className={styles.reactionEmoji}>{reaction.emoji}</span>
                      {reaction.count > 1 ? <span className={styles.reactionCount}>{reaction.count}</span> : null}
                    </span>
                  ))}
                </div>
              ) : null}

              <div className={cn(styles.messageFooter, mine && styles.messageFooterMine)}>
                {!isRecalled ? (
                  <button
                    type="button"
                    className={cn(styles.reactionTrigger, msg.viewerReaction && styles.reactionTriggerActive)}
                    title="Thả cảm xúc"
                    aria-label="Thả cảm xúc"
                    onClick={(event) => openReactionPicker(event, msg.id)}
                  >
                    {msg.viewerReaction ? <ReactionIcon type={msg.viewerReaction} size={14} /> : <Smile size={14} />}
                  </button>
                ) : null}
                <span className={styles.messageTime}>{formatVietnamTime(msg.createdAt)}</span>
                {readLabel ? <span className={styles.readLabel}>· {readLabel}</span> : null}
              </div>

              {reactionPickerMessageId === msg.id && reactionPickerPlacement !== 'above' ? (
                <div className={styles.reactionPickerSpacer} aria-hidden="true" />
              ) : null}
            </div>
          </div>
        )
      })}

      {typingUserIds.size > 0 ? (
        <div className={styles.messageRow}>
          <div className={styles.messageAvatar}>...</div>
          <div className={cn(styles.bubble, styles.typingNotice)}>
            {Array.from(typingUserIds)
              .map((memberId) => selectedConversation?.members.find((member) => member.userId === memberId)?.fullName || `Người dùng #${memberId}`)
              .join(', ')}{' '}
            đang soạn tin nhắn...
          </div>
        </div>
      ) : null}

      {virtualSlice.items.length === 0 ? <p className={styles.empty}>Chưa có tin nhắn trong cuộc trò chuyện này.</p> : null}
    </div>
  )
}
