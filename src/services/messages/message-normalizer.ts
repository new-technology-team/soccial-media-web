import type { ChatMessage } from '@/types'

export const resolveChatMediaUrl = (value: string | null | undefined) => {
  if (!value) return null
  if (/^https?:\/\//i.test(value) || value.startsWith('blob:') || value.startsWith('data:')) {
    return value
  }
  if (value.startsWith('/uploads/')) {
    return `/backend${value}`
  }
  return value
}

export const normalizeIncomingMessage = (payload: ChatMessage): ChatMessage => ({
  ...payload,
  id: String(payload.id),
  conversationId: String(payload.conversationId),
  mediaUrl: resolveChatMediaUrl(payload.mediaUrl),
})

export const normalizeIncomingMessageForViewer = (payload: ChatMessage, viewerUserId?: number): ChatMessage => {
  const normalized = normalizeIncomingMessage(payload)
  if (!viewerUserId || !normalized.reactions) return normalized
  return {
    ...normalized,
    viewerReaction:
      normalized.reactions.find((item) => Number(item.userId) === Number(viewerUserId))?.reaction || null,
  }
}
