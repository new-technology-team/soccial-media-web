import { Bell, CirclePlus, Info, Search, Send, UserPlus } from 'lucide-react'

import { formatVietnamTime, getConversationDisplayName } from '@/services/messages/formatters'
import type { Conversation, NotificationItem } from '@/types'
import { cn } from '@/utils'

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

const railButton = 'grid h-[38px] w-[38px] place-items-center rounded-[11px] text-slate-500 transition hover:bg-white/70'

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
      <aside className="flex flex-col items-center bg-slate-100 px-2 py-3 max-[720px]:hidden">
        <div className="mt-1 text-[1.7rem] font-black text-primary">M</div>
        <nav className="mt-4 flex flex-1 flex-col gap-2">
          <button type="button" className={cn(railButton, 'bg-white text-primary shadow-[0_6px_14px_rgba(0,82,206,0.12)]')} title="Tin nhan" aria-label="Tin nhan">
            <Send size={16} />
          </button>
          <button type="button" className={railButton} onClick={onShowNewMessage} title="Tao hoi thoai moi" aria-label="Tao hoi thoai moi">
            <UserPlus size={16} />
          </button>
          <button type="button" className={railButton} onClick={onShowCreateGroup} title="Tao nhom" aria-label="Tao nhom">
            <CirclePlus size={16} />
          </button>
          <button type="button" className={railButton} onClick={onShowNotifications} title="Thong bao" aria-label="Thong bao">
            <Bell size={16} />
          </button>
          <button type="button" className={cn(railButton, 'mt-auto')} title="Thong tin" aria-label="Thong tin">
            <Info size={16} />
          </button>
        </nav>
        <div className="grid h-[38px] w-[38px] place-items-center rounded-[11px] bg-primary text-sm font-extrabold text-white">{initials}</div>
      </aside>

      <section className="flex min-h-0 flex-col overflow-hidden border-r border-slate-300/60 bg-slate-100 max-[1100px]:hidden">
        <div className="p-4">
          <div className="flex items-center justify-between gap-2">
            <h1 className="m-0 text-xl font-extrabold text-slate-900">Tat ca cuoc tro chuyen</h1>
            <button
              type="button"
              className="relative grid h-9 w-9 shrink-0 place-items-center rounded-[10px] border border-slate-300/70 bg-white text-slate-500"
              onClick={onShowNotifications}
              title="Thong bao"
              aria-label="Thong bao"
            >
              <Bell size={14} />
              {notifications.some((item) => !item.is_read) ? <i className="absolute right-1 top-1 h-2 w-2 rounded-full bg-primary" /> : null}
            </button>
          </div>
          <div className="mt-3 grid h-10 grid-cols-[auto_minmax(0,1fr)] items-center gap-2 rounded-full border border-slate-300/60 bg-white px-3 text-slate-500">
            <Search size={14} />
            <input className="min-w-0 border-0 bg-transparent text-sm text-slate-900 outline-none" placeholder="Tim cuoc tro chuyen" value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} />
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
          {conversations.map((conv) => {
            const isActive = conv.id === selectedConversationId
            const name = getConversationDisplayName(conv, userId)
            const fallback = (name[0] || 'C').toUpperCase()
            const lastMessage = conv.lastMessage || null
            const sender = lastMessage ? conv.members.find((member) => member.userId === lastMessage.senderId) || null : null
            const senderName = lastMessage ? (lastMessage.senderId === userId ? 'Ban' : lastMessage.senderName || sender?.fullName || `Nguoi dung #${lastMessage.senderId}`) : ''
            const previewText = !lastMessage
              ? 'Chua co tin nhan'
              : lastMessage.isDeleted || (lastMessage.meta && (lastMessage.meta as Record<string, unknown>).recalled)
                ? 'Tin nhan da duoc thu hoi'
                : lastMessage.type === 'sticker'
                  ? String((lastMessage.meta && (lastMessage.meta as Record<string, unknown>).sticker) || lastMessage.text || 'Sticker')
                  : lastMessage.type === 'image'
                    ? 'Da gui mot hinh anh'
                    : lastMessage.type === 'video'
                      ? 'Da gui mot video'
                      : lastMessage.type === 'audio'
                        ? 'Da gui mot tin nhan am thanh'
                        : lastMessage.mediaUrl
                          ? lastMessage.fileName || 'Da gui tep dinh kem'
                          : lastMessage.text || ''
            const previewLine = lastMessage ? `${senderName}: ${previewText}` : previewText
            const avatarUrl = conv.avatarUrl || (conv.type === 'direct' ? sender?.avatarUrl || null : null)

            return (
              <button
                key={conv.id}
                type="button"
                onClick={() => onOpenConversation(conv.id)}
                className={cn(
                  'grid w-full grid-cols-[auto_minmax(0,1fr)] items-center gap-2 rounded-xl p-2 text-left transition hover:bg-white/70',
                  isActive && 'bg-white shadow-[0_7px_14px_rgba(11,19,29,0.08)]'
                )}
              >
                <div className="grid h-10 w-10 place-items-center overflow-hidden rounded-[11px] bg-primary text-sm font-extrabold text-white">
                  {avatarUrl ? <img src={avatarUrl} alt={name} className="h-full w-full object-cover" loading="lazy" /> : fallback}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <strong className={cn('truncate text-sm text-slate-800', conv.unreadCount > 0 && 'text-blue-800')}>{name}</strong>
                    <span className="shrink-0 text-[0.69rem] text-slate-500">{lastMessage ? formatVietnamTime(lastMessage.createdAt) : 'Chat'}</span>
                  </div>
                  <p className="mt-0.5 truncate text-xs text-slate-500">{previewLine}</p>
                  {conv.unreadCount > 0 ? (
                    <div className="mt-1 flex justify-end">
                      <span className="inline-flex min-h-[22px] items-center rounded-full bg-primary px-2 text-[0.67rem] font-bold text-white">{conv.unreadCount} chua doc</span>
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
