import { MoreHorizontal, Smile } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { Dispatch, MouseEvent, MutableRefObject, ReactNode, SetStateAction, UIEvent } from 'react'

import { MESSAGE_REACTIONS } from '@/services/messages/constants'
import { formatVietnamTime, getMessageReactionItems, getMessageReactionMeta } from '@/services/messages/formatters'
import type { ChatMessage, Conversation } from '@/types'
import { cn } from '@/utils'

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
  busyActionId: string | null
  pinnedMessageIds: Set<string>
  reactionPickerMessageId: string | null
  setReactionPickerMessageId: Dispatch<SetStateAction<string | null>>
  openMessageActions: (event: MouseEvent<HTMLElement>, messageId: string) => void
  handleReaction: (message: ChatMessage, reaction: string) => void | Promise<void>
  renderMessagePreview: (message: ChatMessage) => ReactNode
  getMessageReadLabel: (message: ChatMessage) => string | null
  onLoadOlderMessages: () => Promise<void>
  onScroll?: (event: UIEvent<HTMLDivElement>) => void
}

const avatarClass =
  'grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-[9px] bg-slate-200 text-xs font-bold text-slate-600'

export function MessageThread({
  userId,
  selectedConversation,
  virtualSlice,
  messagesWrapRef,
  loadingOlderMessages,
  typingUserIds,
  busyActionId,
  pinnedMessageIds,
  reactionPickerMessageId,
  setReactionPickerMessageId,
  openMessageActions,
  handleReaction,
  renderMessagePreview,
  getMessageReadLabel,
  onLoadOlderMessages,
  onScroll,
}: MessageThreadProps) {
  return (
    <div
      className="grid min-h-0 flex-1 auto-rows-max content-start gap-3 overflow-y-auto overflow-x-hidden px-4 py-3"
      ref={messagesWrapRef}
      onScroll={(event) => {
        const element = event.currentTarget
        if (element.scrollTop <= 24) {
          onLoadOlderMessages().catch(() => undefined)
        }
        onScroll?.(event)
      }}
    >
      {loadingOlderMessages ? <p className="justify-self-center rounded-full bg-slate-200 px-3 py-1 text-xs text-slate-600">Dang tai tin nhan cu hon...</p> : null}
      {virtualSlice.startIndex > 0 ? (
        <p className="justify-self-center text-xs text-slate-500">Dang hien thi cac tin nhan moi nhat. Cuon len de tai them lich su.</p>
      ) : null}

      {virtualSlice.items.map((msg) => {
        const mine = msg.senderId === userId
        const reactionItems = getMessageReactionItems(msg)
        const sender = selectedConversation?.members.find((member) => member.userId === msg.senderId) || null
        const senderName = sender?.fullName || msg.senderName || `Nguoi dung #${msg.senderId}`
        const readLabel = mine ? getMessageReadLabel(msg) : null

        return (
          <div key={msg.id} className={cn('flex max-w-[82%] items-end gap-2 max-[720px]:max-w-[94%]', mine && 'justify-self-end flex-row-reverse')}>
            <div className={avatarClass}>
              {sender?.avatarUrl ? <img src={sender.avatarUrl} alt={senderName} className="h-full w-full object-cover" loading="lazy" /> : (senderName[0] || 'U').toUpperCase()}
            </div>

            <div className="grid min-w-0 gap-1">
              <div className="min-h-4">
                {mine ? (
                  <span className="text-xs font-bold text-slate-600">{senderName}</span>
                ) : (
                  <Link to={`/profile/${msg.senderId}`} className="text-xs font-bold text-slate-600 hover:underline">
                    {senderName}
                  </Link>
                )}
              </div>

              <div
                className={cn(
                  'relative grid gap-2 rounded-[14px] rounded-bl-[5px] bg-slate-300 px-3 py-2 pr-9 text-slate-900 shadow-[0_4px_12px_rgba(20,30,40,0.08)]',
                  mine && 'rounded-bl-[14px] rounded-br-[5px] bg-primary text-primary-foreground'
                )}
                onContextMenu={(event) => {
                  event.preventDefault()
                  openMessageActions(event, msg.id)
                }}
              >
                <button
                  type="button"
                  className={cn(
                    'absolute right-1 top-1 z-10 grid h-6 w-6 place-items-center rounded-full bg-white/35 text-inherit opacity-85 transition hover:bg-white/60 hover:opacity-100',
                    mine && 'bg-white/20 hover:bg-white/30'
                  )}
                  title="Mo menu thao tac"
                  aria-label="Mo menu thao tac"
                  onClick={(event) => {
                    event.stopPropagation()
                    openMessageActions(event, msg.id)
                  }}
                >
                  <MoreHorizontal size={14} />
                </button>

                {renderMessagePreview(msg)}
                {pinnedMessageIds.has(msg.id) ? <small className="text-[0.65rem] opacity-75">Da ghim</small> : null}

                {reactionItems.length > 0 ? (
                  <div className="mt-1 flex max-w-full flex-wrap items-center gap-1 rounded-full bg-white/25 px-1.5 py-1">
                    {reactionItems.slice(0, 4).map((reaction, index) => {
                      const reactor = selectedConversation?.members.find((member) => member.userId === reaction.userId) || null
                      const reactorName = reactor?.fullName || `Nguoi dung #${reaction.userId}`
                      const meta = getMessageReactionMeta(reaction.meta)
                      return (
                        <span key={`${reaction.userId}-${index}`} className="inline-flex items-center gap-1 rounded-full bg-white/30 py-0.5 pl-0.5 pr-1.5" title={`${reactorName} da tha ${meta.label}`}>
                          {reactor?.avatarUrl ? (
                            <img src={reactor.avatarUrl} alt={reactorName} className="h-4 w-4 rounded-full object-cover" loading="lazy" />
                          ) : (
                            <span className="grid h-4 w-4 place-items-center rounded-full bg-white/55 text-[0.58rem] font-bold">{(reactorName[0] || 'U').toUpperCase()}</span>
                          )}
                          <span className="text-sm leading-none">{meta.emoji}</span>
                        </span>
                      )
                    })}
                    {reactionItems.length > 4 ? <span className="px-1 text-[0.65rem] font-bold opacity-80">+{reactionItems.length - 4}</span> : null}
                  </div>
                ) : null}
              </div>

              <div className={cn('flex items-center gap-2 text-xs text-slate-500', mine && 'justify-end')}>
                <button
                  type="button"
                  className={cn(
                    'grid h-7 w-7 place-items-center rounded-full bg-slate-200 text-slate-600 hover:bg-slate-300',
                    msg.viewerReaction && 'bg-blue-100 text-primary'
                  )}
                  title="Tha cam xuc"
                  aria-label="Tha cam xuc"
                  onClick={() => setReactionPickerMessageId((current) => (current === msg.id ? null : msg.id))}
                >
                  {msg.viewerReaction ? getMessageReactionMeta(msg.viewerReaction).emoji : <Smile size={14} />}
                </button>
                <span>{formatVietnamTime(msg.createdAt)}</span>
                {readLabel ? <span className="font-semibold text-emerald-600">{readLabel}</span> : null}
              </div>

              {reactionPickerMessageId === msg.id ? (
                <div className="z-20 flex justify-self-end gap-1 rounded-full border border-slate-300 bg-white p-1 shadow-[0_10px_24px_rgba(14,20,28,0.18)]">
                  {MESSAGE_REACTIONS.map((reaction) => (
                    <button
                      key={reaction.type}
                      type="button"
                      className={cn('grid h-8 w-8 place-items-center rounded-full text-base hover:-translate-y-0.5 hover:bg-slate-100', msg.viewerReaction === reaction.type && 'bg-blue-50')}
                      title={reaction.label}
                      aria-label={reaction.label}
                      disabled={busyActionId === msg.id}
                      onClick={() => {
                        void handleReaction(msg, reaction.type)
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
        <div className="flex max-w-[82%] items-end gap-2">
          <div className={avatarClass}>...</div>
          <div className="rounded-[14px] rounded-bl-[5px] bg-slate-300 px-3 py-2 text-sm italic text-slate-700">
            {Array.from(typingUserIds)
              .map((memberId) => selectedConversation?.members.find((member) => member.userId === memberId)?.fullName || `Nguoi dung #${memberId}`)
              .join(', ')}{' '}
            dang soan tin nhan...
          </div>
        </div>
      ) : null}

      {virtualSlice.items.length === 0 ? <p className="text-sm text-slate-500">Chua co tin nhan trong cuoc tro chuyen nay.</p> : null}
    </div>
  )
}
