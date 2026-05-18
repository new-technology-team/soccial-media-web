import type { ChatMessage, Conversation } from '@/types'
import { MESSAGE_REACTIONS } from './constants'

const VN_TIMEZONE = 'Asia/Ho_Chi_Minh'

export const parseChatDate = (value: string) => {
  const base = new Date(value)
  if (Number.isNaN(base.getTime())) return new Date()
  return base
}

export const formatVietnamTime = (value: string) =>
  new Intl.DateTimeFormat('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: VN_TIMEZONE,
  }).format(parseChatDate(value))

export const getConversationDisplayName = (
  conversation: Pick<Conversation, 'type' | 'name' | 'members'>,
  currentUserId?: number
) => {
  if (conversation.type === 'group') {
    return conversation.name || 'Nhóm chat'
  }
  const peer = conversation.members.find((member) => member.userId !== currentUserId)
  return peer?.fullName || conversation.name || 'CuĂ¡»™c trò chuyĂ¡»‡n'
}

export const getGroupRoleLabel = (role: string | null | undefined) => {
  if (role === 'leader') return 'TrưĂ¡»ng nhóm'
  if (role === 'deputy') return 'Phó nhóm'
  return 'Thành viên'
}

export const getAvatarInitial = (value: string | null | undefined) => {
  const normalized = String(value || '').trim()
  return (normalized[0] || 'U').toUpperCase()
}

export const getMessageReactionMeta = (reaction: string) =>
  MESSAGE_REACTIONS.find((item) => item.type === reaction) || MESSAGE_REACTIONS[2]

export const getMessageReactionItems = (msg: ChatMessage) =>
  (msg.reactions || [])
    .map((item) => ({ ...item, meta: getMessageReactionMeta(item.reaction) }))
    .filter((item) => MESSAGE_REACTIONS.some((reaction) => reaction.type === item.reaction))
