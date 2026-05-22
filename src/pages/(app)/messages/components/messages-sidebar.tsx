import { Bell, BellOff, CirclePlus, Info, MessageCircle, Pin, Search, Send, UserPlus, Users } from 'lucide-react'

import { formatVietnamTime, getConversationDisplayName } from '@/services/messages/formatters'
import type { Conversation, NotificationItem } from '@/types'
import { cn } from '@/utils'
import styles from '../page.module.css'

type MessagesSidebarProps = {
  initials: string
  userId?: number
  conversations: Conversation[]
  selectedConversationId: string | null
  notifications: NotificationItem[]
  searchTerm: string
  setSearchTerm: (value: string) => void
  onOpenConversation: (conversationId: string) => void
  onShowNotifications: () => void
  onShowNewMessage: () => void
  onShowCreateGroup: () => void
}

export function MessagesSidebar({
  initials,
  userId,
  conversations,
  selectedConversationId,
  notifications,
  searchTerm,
  setSearchTerm,
  onOpenConversation,
  onShowNotifications,
  onShowNewMessage,
  onShowCreateGroup,
}: MessagesSidebarProps) {
  return (
    <>
      <aside className={styles.rail}>
        <div className={styles.railLogo}>
          <MessageCircle size={23} />
        </div>
        <nav className={styles.railNav}>
          <button type="button" className={cn(styles.railBtn, styles.railBtnActive)} title="Tin nhắn" aria-label="Tin nhắn">
            <Send size={16} />
          </button>
          <button type="button" className={styles.railBtn} onClick={onShowNewMessage} title="Tạo hội thoại mới" aria-label="Tạo hội thoại mới">
            <UserPlus size={16} />
          </button>
          <button type="button" className={styles.railBtn} onClick={onShowCreateGroup} title="Tạo nhóm" aria-label="Tạo nhóm">
            <CirclePlus size={16} />
          </button>
          <button type="button" className={styles.railBtn} onClick={onShowNotifications} title="Thông báo" aria-label="Thông báo">
            <Bell size={16} />
          </button>
          <button type="button" className={cn(styles.railBtn, styles.railBottomBtn)} title="Thông tin" aria-label="Thông tin">
            <Info size={16} />
          </button>
        </nav>
        <div className={styles.railAvatar}>{initials}</div>
      </aside>

      <section className={styles.listPanel}>
        <div className={styles.listHeader}>
          <div className={styles.listHeaderTop}>
            <h1>Tất cả cuộc trò chuyện</h1>
            <button
              type="button"
              className={styles.headerNotifyBtn}
              onClick={onShowNotifications}
              title="Thông báo"
              aria-label="Thông báo"
            >
              <Bell size={14} />
              {notifications.some((item) => !item.is_read) ? <i /> : null}
            </button>
          </div>
          <div className={styles.searchWrap}>
            <Search size={14} />
            <input placeholder="Tìm cuộc trò chuyện" value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} />
          </div>
        </div>

        <div className={styles.convList}>
          {conversations.map((conv) => {
            const isActive = conv.id === selectedConversationId
            const name = getConversationDisplayName(conv, userId)
            const fallback = (name[0] || 'C').toUpperCase()
            const lastMessage = conv.lastMessage || null
            const sender = lastMessage ? conv.members.find((member) => member.userId === lastMessage.senderId) || null : null
            const senderName = lastMessage ? (lastMessage.senderId === userId ? 'Bạn' : lastMessage.senderName || sender?.fullName || `Người dùng #${lastMessage.senderId}`) : ''
            const previewText = !lastMessage
              ? 'Chưa có tin nhắn'
              : lastMessage.isDeleted || (lastMessage.meta && (lastMessage.meta as Record<string, unknown>).recalled)
                ? 'Tin nhắn đã được thu hồi'
                : lastMessage.type === 'sticker'
                  ? String((lastMessage.meta && (lastMessage.meta as Record<string, unknown>).sticker) || lastMessage.text || 'Sticker').startsWith('icon:')
                    ? 'Sticker'
                    : String((lastMessage.meta && (lastMessage.meta as Record<string, unknown>).sticker) || lastMessage.text || 'Sticker')
                  : lastMessage.type === 'image'
                    ? 'Đã gửi một hình ảnh'
                    : lastMessage.type === 'video'
                      ? 'Đã gửi một video'
                      : lastMessage.type === 'audio'
                        ? 'Đã gửi một tin nhắn âm thanh'
                        : lastMessage.mediaUrl
                          ? lastMessage.fileName || 'Đã gửi tệp đính kèm'
                          : lastMessage.text || ''
            const previewLine = lastMessage ? `${senderName}: ${previewText}` : previewText
            const directPeer = conv.type === 'direct' ? conv.members.find((member) => member.userId !== userId) || null : null
            const avatarUrl = conv.avatarUrl || (conv.type === 'direct' ? directPeer?.avatarUrl || sender?.avatarUrl || null : null)
            const isOnline = Boolean(directPeer?.online)
            const statusLabel = conv.type === 'group'
              ? `${conv.members.length} thành viên${conv.onlineCount ? ` • ${conv.onlineCount} online` : ''}`
              : isOnline
                ? 'Đang hoạt động'
                : directPeer?.lastActiveAt
                  ? `Hoạt động ${new Date(directPeer.lastActiveAt).toLocaleString('vi-VN')}`
                  : 'Offline'

            return (
              <button
                key={conv.id}
                type="button"
                onClick={() => onOpenConversation(conv.id)}
                className={cn(
                  styles.convItem,
                  isActive && styles.convItemActive,
                  conv.unreadCount > 0 && styles.convItemUnread
                )}
              >
                <div className={styles.convAvatar}>
                  {avatarUrl ? <img src={avatarUrl} alt={name} className={styles.convAvatarImage} loading="lazy" /> : fallback}
                  <span className={cn(styles.presenceDot, isOnline ? styles.presenceDotOnline : styles.presenceDotOffline)} />
                </div>
                <div className={styles.convText}>
                  <div className={styles.convLineTop}>
                    <strong>{name} {conv.isPinned ? <Pin size={11} /> : null} {conv.isMuted ? <BellOff size={11} /> : null}</strong>
                    <span>{lastMessage ? formatVietnamTime(lastMessage.createdAt) : 'Chat'}</span>
                  </div>
                  <div className={styles.convStatusLine}>
                    {conv.type === 'group' ? (
                      <Users size={12} />
                    ) : (
                      <span className={cn(styles.statusSpark, isOnline ? styles.statusSparkOnline : styles.statusSparkOffline)} />
                    )}
                    <small>{statusLabel}</small>
                  </div>
                  <p>{previewLine}</p>
                  {conv.unreadCount > 0 ? (
                    <div className={styles.convFooter}>
                      <span className={styles.convUnreadBadge}>{conv.unreadCount} chua doc</span>
                    </div>
                  ) : null}
                </div>
              </button>
            )
          })}
        </div>
      </section>
    </>
  )
}
