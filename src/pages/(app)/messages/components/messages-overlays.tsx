import { Check, CornerUpRight, Pin, RotateCcw, Trash2 } from 'lucide-react'

import { formatVietnamTime, getAvatarInitial, getConversationDisplayName } from '@/services/messages/formatters'
import { parseNotificationMeta, type MessageNotificationItem } from '@/services/messages/notification-meta'
import type { ChatMessage, Conversation, FriendConnection } from '@/types'
import { cn } from '@/utils'

type MessagesOverlaysProps = {
  userId?: number
  conversations: Conversation[]
  selectedConversationId: string | null
  actionMenu: { messageId: string; x: number; y: number } | null
  activeActionMessage: ChatMessage | null
  pinnedMessageIds: Set<string>
  forwardingMessageId: string | null
  showNewMessageModal: boolean
  newMessageKeyword: string
  searchUsersResult: Array<{ id: number; name: string }>
  showNotificationsDrawer: boolean
  notifications: MessageNotificationItem[]
  showCreateGroupModal: boolean
  groupName: string
  groupSearchKeyword: string
  filteredCreateGroupInviteCandidates: FriendConnection[]
  groupMemberIds: number[]
  busyActionId: string | null
  creatingGroup: boolean
  acceptedFriendsCount: number
  setForwardingMessageId: (messageId: string | null) => void
  setActionMenu: (value: { messageId: string; x: number; y: number } | null) => void
  setShowNewMessageModal: (value: boolean) => void
  setNewMessageKeyword: (value: string) => void
  handleCreateConversationWithUser: (userId: number) => void | Promise<void>
  setShowNotificationsDrawer: (value: boolean) => void
  handleOpenNotificationConversation: (conversationId: string | null | undefined) => void
  handleAcceptFromNotification: (item: MessageNotificationItem) => void | Promise<void>
  setShowCreateGroupModal: (value: boolean) => void
  handleCreateGroupConversation: () => void | Promise<void>
  setGroupName: (value: string) => void
  setGroupSearchKeyword: (value: string) => void
  toggleGroupMember: (userId: number) => void
  handleTogglePinMessage: (message: ChatMessage) => void | Promise<void>
  handleRecall: (message: ChatMessage) => void | Promise<void>
  handleDeleteMessage: (message: ChatMessage) => void | Promise<void>
  handleForward: (targetConversationId: string) => void | Promise<void>
}

const backdrop = 'absolute inset-0 z-50 grid place-items-center bg-slate-950/45 p-3 backdrop-blur-sm'
const card = 'grid max-h-[min(76vh,620px)] w-[min(520px,100%)] gap-3 overflow-hidden rounded-2xl border border-slate-300/70 bg-slate-50 p-4 shadow-[0_20px_44px_rgba(5,12,18,0.25)]'
const input = 'min-h-10 rounded-[10px] border border-slate-300 bg-white px-3 text-sm outline-none focus:border-primary'
const list = 'grid min-h-[120px] max-h-[340px] gap-1.5 overflow-y-auto'
const listButton = 'flex min-h-[52px] w-full items-center gap-2 rounded-[11px] bg-slate-200 px-3 py-2 text-left text-slate-800 hover:bg-slate-300/70'
const primaryButton = 'inline-flex min-h-9 items-center justify-center rounded-[9px] bg-primary px-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50'
const secondaryButton = 'inline-flex min-h-9 items-center justify-center rounded-[9px] bg-slate-200 px-3 text-sm font-bold text-slate-700 hover:bg-slate-300'

function ListIdentity({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <span className="flex min-w-0 flex-1 items-center gap-2">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] bg-primary text-xs font-extrabold text-white">{getAvatarInitial(title)}</span>
      <span className="grid min-w-0 gap-0.5">
        <strong className="truncate text-sm text-slate-800">{title}</strong>
        <small className="truncate text-xs text-slate-500">{subtitle}</small>
      </span>
    </span>
  )
}

export function MessagesOverlays({
  userId,
  conversations,
  selectedConversationId,
  actionMenu,
  activeActionMessage,
  pinnedMessageIds,
  forwardingMessageId,
  showNewMessageModal,
  newMessageKeyword,
  searchUsersResult,
  showNotificationsDrawer,
  notifications,
  showCreateGroupModal,
  groupName,
  groupSearchKeyword,
  filteredCreateGroupInviteCandidates,
  groupMemberIds,
  busyActionId,
  creatingGroup,
  acceptedFriendsCount,
  setForwardingMessageId,
  setActionMenu,
  setShowNewMessageModal,
  setNewMessageKeyword,
  handleCreateConversationWithUser,
  setShowNotificationsDrawer,
  handleOpenNotificationConversation,
  handleAcceptFromNotification,
  setShowCreateGroupModal,
  handleCreateGroupConversation,
  setGroupName,
  setGroupSearchKeyword,
  toggleGroupMember,
  handleTogglePinMessage,
  handleRecall,
  handleDeleteMessage,
  handleForward,
}: MessagesOverlaysProps) {
  return (
    <>
      {actionMenu && activeActionMessage ? (
        <div
          className="fixed z-[60] min-w-[210px] max-w-[250px] rounded-xl border border-slate-300 bg-white p-1.5 shadow-[0_16px_34px_rgba(10,15,20,0.25)]"
          style={{ left: actionMenu.x, top: actionMenu.y }}
          onClick={(event) => event.stopPropagation()}
        >
          <div className="mb-1 flex items-center gap-2 border-b border-slate-200 px-1.5 pb-2">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] bg-primary text-xs font-extrabold text-white">
              {getAvatarInitial(activeActionMessage.senderName || `Nguoi dung #${activeActionMessage.senderId}`)}
            </span>
            <div className="grid min-w-0">
              <strong className="truncate text-sm text-slate-800">{String(activeActionMessage.senderName || `Nguoi dung #${activeActionMessage.senderId}`)}</strong>
              <small className="text-xs text-slate-500">{formatVietnamTime(activeActionMessage.createdAt)}</small>
            </div>
          </div>
          <button className="flex min-h-8 w-full items-center gap-2 rounded-lg px-2 text-left text-sm font-semibold text-slate-700 hover:bg-slate-100" type="button" onClick={() => { setForwardingMessageId(activeActionMessage.id); setActionMenu(null) }}>
            <CornerUpRight size={15} />
            Chuyen tiep
          </button>
          <button className="flex min-h-8 w-full items-center gap-2 rounded-lg px-2 text-left text-sm font-semibold text-slate-700 hover:bg-slate-100" type="button" onClick={() => { void handleTogglePinMessage(activeActionMessage); setActionMenu(null) }}>
            <Pin size={15} />
            {pinnedMessageIds.has(activeActionMessage.id) ? 'Bo ghim' : 'Ghim'}
          </button>
          {activeActionMessage.senderId === userId ? (
            <button className="flex min-h-8 w-full items-center gap-2 rounded-lg px-2 text-left text-sm font-semibold text-slate-700 hover:bg-slate-100" type="button" onClick={() => { void handleRecall(activeActionMessage); setActionMenu(null) }}>
              <RotateCcw size={15} />
              Thu hoi
            </button>
          ) : null}
          {activeActionMessage.senderId === userId ? (
            <button className="flex min-h-8 w-full items-center gap-2 rounded-lg px-2 text-left text-sm font-semibold text-red-600 hover:bg-red-50" type="button" onClick={() => { void handleDeleteMessage(activeActionMessage); setActionMenu(null) }}>
              <Trash2 size={15} />
              Xoa
            </button>
          ) : null}
        </div>
      ) : null}

      {showNewMessageModal ? (
        <div className={backdrop}>
          <div className={card}>
            <h3 className="m-0 text-lg font-extrabold">Tin nhan moi</h3>
            <input className={input} value={newMessageKeyword} onChange={(event) => setNewMessageKeyword(event.target.value)} placeholder="Nhap ten ban be hoac email dang ky" />
            <div className={list}>
              {searchUsersResult.map((item) => (
                <button key={item.id} type="button" className={listButton} onClick={() => void handleCreateConversationWithUser(item.id)}>
                  <ListIdentity title={item.name} subtitle={`ID ${item.id}`} />
                </button>
              ))}
              {searchUsersResult.length === 0 ? <p className="m-0 text-sm text-slate-500">Khong co ket qua phu hop.</p> : null}
            </div>
            <button type="button" className={secondaryButton} onClick={() => setShowNewMessageModal(false)}>Dong</button>
          </div>
        </div>
      ) : null}

      {showNotificationsDrawer ? (
        <div className={backdrop}>
          <div className={card}>
            <h3 className="m-0 text-lg font-extrabold">Thong bao nang cao</h3>
            <div className={list}>
              {notifications.map((item) => {
                const meta = parseNotificationMeta(item)
                const conversationId = meta?.conversationId
                const canAccept = item.type === 'friend-request' && !item.is_read && Boolean(meta?.requesterId || meta?.friendshipId)
                return (
                  <div key={item.id} className="grid gap-1 rounded-[10px] bg-slate-200 p-1.5">
                    <button type="button" className={cn(listButton, 'bg-transparent hover:bg-slate-300/70')} onClick={() => handleOpenNotificationConversation(conversationId)}>
                      <ListIdentity title={item.title} subtitle={`${item.body || 'Thong bao he thong'} - ${new Date(item.created_at).toLocaleString('vi-VN')}`} />
                    </button>
                    <div className="flex flex-wrap gap-1 px-1 pb-1">
                      {conversationId ? <button type="button" className={secondaryButton} onClick={() => handleOpenNotificationConversation(conversationId)}>Mo doan chat</button> : null}
                      {canAccept ? (
                        <button type="button" className={primaryButton} disabled={busyActionId === `notif-${item.id}`} onClick={() => void handleAcceptFromNotification(item)}>
                          {busyActionId === `notif-${item.id}` ? 'Dang dong y...' : 'Dong y'}
                        </button>
                      ) : null}
                    </div>
                  </div>
                )
              })}
              {notifications.length === 0 ? <p className="m-0 text-sm text-slate-500">Hien chua co thong bao quan trong.</p> : null}
            </div>
            <button type="button" className={secondaryButton} onClick={() => setShowNotificationsDrawer(false)}>Dong</button>
          </div>
        </div>
      ) : null}

      {forwardingMessageId ? (
        <div className={backdrop}>
          <div className="grid w-[min(420px,calc(100%-1.5rem))] gap-3 rounded-2xl border border-slate-300 bg-slate-50 p-4 shadow-[0_16px_36px_rgba(5,12,18,0.2)]">
            <h3 className="m-0 text-lg font-extrabold">Chuyen tiep tin nhan</h3>
            <p className="m-0 text-sm text-slate-600">Chon cuoc tro chuyen de chuyen tiep:</p>
            <div className="grid max-h-[220px] gap-1.5 overflow-y-auto">
              {conversations.filter((conv) => conv.id !== selectedConversationId).map((conv) => {
                const name = getConversationDisplayName(conv, userId)
                return (
                  <button key={conv.id} type="button" className={listButton} onClick={() => void handleForward(conv.id)}>
                    <ListIdentity title={name} subtitle={`ID ${conv.id}`} />
                  </button>
                )
              })}
            </div>
            <button type="button" className={secondaryButton} onClick={() => setForwardingMessageId(null)}>Huy</button>
          </div>
        </div>
      ) : null}

      {showCreateGroupModal ? (
        <div className={backdrop}>
          <div className={card}>
            <h3 className="m-0 text-lg font-extrabold">Tao nhom chat</h3>
            <input className={input} value={groupName} onChange={(event) => setGroupName(event.target.value)} placeholder="Nhap ten nhom" />
            <input className={input} value={groupSearchKeyword} onChange={(event) => setGroupSearchKeyword(event.target.value)} placeholder="Tim ban be de them vao nhom" />
            <div className={list}>
              {filteredCreateGroupInviteCandidates.map((friend) => {
                const checked = groupMemberIds.includes(friend.id)
                return (
                  <button key={friend.id} type="button" className={listButton} onClick={() => toggleGroupMember(friend.id)}>
                    <ListIdentity title={friend.fullName} subtitle={friend.email || friend.phone || `ID ${friend.id}`} />
                    <span className={cn('inline-flex min-h-7 shrink-0 items-center rounded-full px-2 text-xs font-bold', checked ? 'bg-primary text-white' : 'bg-white text-slate-600')}>
                      {checked ? <Check size={13} /> : 'Chon'}
                    </span>
                  </button>
                )
              })}
              {acceptedFriendsCount === 0 ? <p className="m-0 text-sm text-slate-500">Ban chua co ban be de tao nhom.</p> : null}
              {acceptedFriendsCount > 0 && filteredCreateGroupInviteCandidates.length === 0 ? <p className="m-0 text-sm text-slate-500">Khong tim thay ban be phu hop.</p> : null}
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" className={primaryButton} disabled={!groupName.trim() || groupMemberIds.length === 0 || creatingGroup} onClick={() => void handleCreateGroupConversation()}>
                {creatingGroup ? 'Dang tao nhom...' : 'Tao nhom'}
              </button>
              <button type="button" className={secondaryButton} onClick={() => setShowCreateGroupModal(false)}>Dong</button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
