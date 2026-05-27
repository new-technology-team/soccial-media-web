'use client'

import { ChangeEvent, FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  Bell,
  CircleHelp,
  Dot,
  Ellipsis,
  Heart,
  House,
  Image as ImageIcon,
  MessageCircle,
  MessagesSquare,
  MoreHorizontal,
  PenLine,
  Settings,
  Share2,
  Smile,
  UserRound,
  UserPlus,
  X,
  MapPin,
} from 'lucide-react'
import { api, isAuthExpiredError } from '@/api/client'
import { ConfirmDialog, ReportDialog } from '@/components/dialogs'
import Sidebar from '@/components/navigation/sidebar'
import type { FeedComment, FeedPost } from '@/types'
import { useAuthStore } from '@/contexts/auth-store'
import { useSocialRealtime } from '@/hooks/use-social-realtime'
import { toast } from '@/hooks/use-toast'
import styles from './page.module.css'

const VN_TIMEZONE = 'Asia/Ho_Chi_Minh'
const FEED_BATCH_SIZE = 4
const VN_UTC_OFFSET_MS = 7 * 60 * 60 * 1000

const parseFeedDate = (value: string) => {
  const base = new Date(value)
  if (Number.isNaN(base.getTime())) return new Date()

  // Backend currently returns Z-suffixed values that are shifted by UTC offset.
  // Add 7h to align wall-clock posting time for feed display.
  if (typeof value === 'string' && value.endsWith('Z')) {
    return new Date(base.getTime() + VN_UTC_OFFSET_MS)
  }

  return base
}

const VN_LOCATIONS = [
  'Hà Nội',
  'Hà Nam',
  'Hà Giang',
  'Hà Tĩnh',
  'Hải Phòng',
  'Hải Dương',
  'Đà Nẵng',
  'Huế',
  'Nghệ An',
  'Thanh Hóa',
  'Quảng Ninh',
  'Nha Trang',
  'Đà Lạt',
  'TP. Hồ Chí Minh',
  'Cần Thơ',
  'An Giang',
  'Kiên Giang',
]

const POST_REACTIONS = [
  { type: 'like', emoji: '👍', label: 'Thích' },
  { type: 'love', emoji: '❤️', label: 'Yêu thích' },
  { type: 'haha', emoji: '😆', label: 'Haha' },
  { type: 'wow', emoji: '😮', label: 'Wow' },
  { type: 'sad', emoji: '😢', label: 'Buồn' },
  { type: 'angry', emoji: '😡', label: 'Phẫn nộ' },
] as const

const getPostReactionMeta = (type: string | null | undefined) =>
  POST_REACTIONS.find((item) => item.type === type) || POST_REACTIONS[0]

const dedupePostsById = (items: FeedPost[]) => {
  const seen = new Set<number>()
  const result: FeedPost[] = []
  items.forEach((item) => {
    if (seen.has(item.id)) return
    seen.add(item.id)
    result.push(item)
  })
  return result
}

type ConfirmModalState = {
  title: string
  description: string
  confirmLabel: string
  onConfirm: () => void | Promise<void>
}

const isVideoMediaUrl = (url: string) =>
  /\.(mp4|webm|ogg|mov|m4v|avi|mkv)(\?.*)?$/i.test(url) || url.includes('/video/')

type ComposerExtraPanel = 'tag' | 'location' | 'emoji' | null

type CommentPaging = {
  offset: number
  total: number
  hasMore: boolean
}

export default function FeedPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const token = useAuthStore((state) => state.accessToken)
  const me = useAuthStore((state) => state.user)
  const clearAuth = useAuthStore((state) => state.clearAuth)
  const [posts, setPosts] = useState<FeedPost[]>([])
  const [isLoadingFeed, setIsLoadingFeed] = useState(true)
  const [content, setContent] = useState('')
  const [modalContent, setModalContent] = useState('')
  const [isPosting, setIsPosting] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [errorText, setErrorText] = useState('')
  const [commentInputs, setCommentInputs] = useState<Record<number, string>>({})
  const [isCommenting, setIsCommenting] = useState<Record<number, boolean>>({})
  const [modalMediaUrl, setModalMediaUrl] = useState('')
  const [modalVisibility, setModalVisibility] = useState<'public' | 'private'>('public')
  const [modalLocation, setModalLocation] = useState('')
  const [modalTaggedFriend, setModalTaggedFriend] = useState('')
  const [tagKeyword, setTagKeyword] = useState('')
  const [locationKeyword, setLocationKeyword] = useState('')
  const [tagSuggestions, setTagSuggestions] = useState<Array<{ id: number; name: string }>>([])
  const [commentLists, setCommentLists] = useState<Record<number, FeedComment[]>>({})
  const [reactionViewers, setReactionViewers] = useState<Record<number, Array<{ userId: number; fullName: string; avatarUrl: string | null; reaction: string }>>>({})
  const [reactionViewerPostId, setReactionViewerPostId] = useState<number | null>(null)
  const [busyCommentId, setBusyCommentId] = useState<number | string | null>(null)
  const [expandedComments, setExpandedComments] = useState<Record<number, boolean>>({})
  const [loadingComments, setLoadingComments] = useState<Record<number, boolean>>({})
  const [loadingMoreComments, setLoadingMoreComments] = useState<Record<number, boolean>>({})
  const [commentPaging, setCommentPaging] = useState<Record<number, CommentPaging>>({})
  const [shareTargetPostId, setShareTargetPostId] = useState<number | null>(null)
  const [shareConversations, setShareConversations] = useState<Array<{ id: string; name: string | null }>>([])
  const [activePostMenuId, setActivePostMenuId] = useState<number | null>(null)
  const [hiddenPostIds, setHiddenPostIds] = useState<Record<number, boolean>>({})
  const [editingPostId, setEditingPostId] = useState<number | null>(null)
  const [isSavingPostEdit, setIsSavingPostEdit] = useState(false)
  const [composerMoreMenuOpen, setComposerMoreMenuOpen] = useState(false)
  const [postEditDraft, setPostEditDraft] = useState<{
    content: string
    mediaUrl: string
    visibility: 'public' | 'private'
  } | null>(null)
  const [showEmojiTray, setShowEmojiTray] = useState(false)
  const [activeComposerPanel, setActiveComposerPanel] = useState<ComposerExtraPanel>(null)
  const [timeTick, setTimeTick] = useState(0)
  const [uploadingMedia, setUploadingMedia] = useState(false)
  const [openReactionPostId, setOpenReactionPostId] = useState<number | null>(null)
  const [visiblePostsCount, setVisiblePostsCount] = useState(FEED_BATCH_SIZE)
  const [feedSearchQuery, setFeedSearchQuery] = useState('')
  const [feedSearchUsers, setFeedSearchUsers] = useState<Array<{ id: number; name: string; avatarUrl: string | null }>>([])
  const [confirmModal, setConfirmModal] = useState<ConfirmModalState | null>(null)
  const [reportPost, setReportPost] = useState<FeedPost | null>(null)
  const [reportComment, setReportComment] = useState<FeedComment | null>(null)
  const mediaInputRef = useRef<HTMLInputElement | null>(null)
  const feedBottomSentinelRef = useRef<HTMLDivElement | null>(null)
  const isGuestView = !token

  useSocialRealtime({
    token,
    user: me,
    setPosts,
    setCommentLists,
  })

  const resetComposerPanels = () => {
    setShowEmojiTray(false)
    setActiveComposerPanel(null)
    setComposerMoreMenuOpen(false)
    setTagKeyword('')
    setLocationKeyword('')
    setTagSuggestions([])
  }

  const closeComposerModal = () => {
    resetComposerPanels()
    setIsModalOpen(false)
  }

  const handleAuthExpired = useCallback((error: unknown, fallbackMessage = 'Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại.') => {
    if (!isAuthExpiredError(error)) return false
    setErrorText(fallbackMessage)
    clearAuth()
    navigate('/auth/login?reason=session-expired')
    return true
  }, [clearAuth, navigate])

  useEffect(() => {
    const loadFeed = async () => {
      setIsLoadingFeed(true)
      try {
        const response = await api.listFeed(token || undefined)
        const dedupedPosts = dedupePostsById(response.posts)
        setPosts(dedupedPosts)
        setVisiblePostsCount(Math.min(FEED_BATCH_SIZE, dedupedPosts.length || FEED_BATCH_SIZE))
      } catch (error) {
        if (handleAuthExpired(error)) return
        console.error('Failed to load feed', error)
      } finally {
        setIsLoadingFeed(false)
      }
    }

    loadFeed()
  }, [handleAuthExpired, token])

  useEffect(() => {
    if (!posts.length) {
      setVisiblePostsCount(FEED_BATCH_SIZE)
      return
    }

    setVisiblePostsCount((prev) => {
      if (prev < FEED_BATCH_SIZE) {
        return Math.min(FEED_BATCH_SIZE, posts.length)
      }
      return Math.min(prev, posts.length)
    })
  }, [posts.length])

  useEffect(() => {
    if (searchParams.get('compose') === '1') {
      setIsModalOpen(true)
    }
  }, [searchParams])

  useEffect(() => {
    if (!token || !tagKeyword.trim()) {
      setTagSuggestions([])
      return
    }

    const timer = setTimeout(async () => {
      try {
        const result = await api.searchUsers(token, tagKeyword.trim())
        setTagSuggestions(
          (result.users || [])
            .map((item) => ({
              id: Number(item.id || 0),
              name: String(item.full_name || item.fullName || 'Người dùng'),
            }))
            .filter((item) => item.id > 0)
            .slice(0, 8)
        )
      } catch (error) {
        if (handleAuthExpired(error)) return
        console.error('Failed to search users for tagging', error)
        setTagSuggestions([])
      }
    }, 260)

    return () => clearTimeout(timer)
  }, [handleAuthExpired, tagKeyword, token])

  useEffect(() => {
    const q = feedSearchQuery.trim()
    if (!token || q.length < 2) {
      setFeedSearchUsers([])
      return
    }

    const timer = setTimeout(async () => {
      try {
        const result = await api.searchUsers(token, q)
        setFeedSearchUsers(
          (result.users || [])
            .map((item) => ({
              id: Number(item.id || item.userId || 0),
              name: String(item.full_name || item.fullName || item.displayName || 'Người dùng'),
              avatarUrl: (item.avatarUrl || item.avatar_url || null) as string | null,
            }))
            .filter((item) => item.id > 0)
            .slice(0, 5)
        )
      } catch (error) {
        if (handleAuthExpired(error)) return
        setFeedSearchUsers([])
      }
    }, 240)

    return () => clearTimeout(timer)
  }, [feedSearchQuery, handleAuthExpired, token])

  useEffect(() => {
    if (!token) return
    if (shareTargetPostId === null) return

    api
      .listConversations(token)
      .then((result) => setShareConversations(result.conversations.map((item) => ({ id: item.id, name: item.name }))))
      .catch((error) => {
        if (handleAuthExpired(error)) return
        console.error('Failed to load conversations for sharing', error)
      })
  }, [handleAuthExpired, shareTargetPostId, token])

  useEffect(() => {
    const timer = setInterval(() => setTimeTick((prev) => prev + 1), 30000)
    return () => clearInterval(timer)
  }, [])

  const suggestedPeople = useMemo(() => {
    const byAuthor = new Map<number, { id: number; name: string; postCount: number }>()

    posts.forEach((post) => {
      if (me?.id && post.authorId === me.id) return
      const current = byAuthor.get(post.authorId)
      if (current) {
        current.postCount += 1
        return
      }
      byAuthor.set(post.authorId, { id: post.authorId, name: post.authorName, postCount: 1 })
    })

    return Array.from(byAuthor.values())
      .sort((a, b) => b.postCount - a.postCount)
      .slice(0, 6)
  }, [me?.id, posts])

  const filteredPosts = useMemo(() => {
    const q = feedSearchQuery.trim().toLowerCase()
    return posts.filter((post) => {
      if (hiddenPostIds[post.id]) return false
      if (!q) return true
      return (
        post.content.toLowerCase().includes(q) ||
        post.authorName.toLowerCase().includes(q) ||
        (post.content.match(/#[^\s#.,!?;:]+/g) || []).some((tag) => tag.toLowerCase().includes(q))
      )
    })
  }, [feedSearchQuery, hiddenPostIds, posts])
  const visiblePosts = useMemo(
    () => filteredPosts.slice(0, visiblePostsCount),
    [filteredPosts, visiblePostsCount]
  )
  const hasMorePosts = visiblePostsCount < filteredPosts.length

  useEffect(() => {
    if (!hasMorePosts) return
    const node = feedBottomSentinelRef.current
    if (!node) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return
        setVisiblePostsCount((prev) => Math.min(filteredPosts.length, prev + FEED_BATCH_SIZE))
      },
      {
        root: null,
        rootMargin: '260px 0px',
        threshold: 0.05,
      }
    )

    observer.observe(node)
    return () => observer.disconnect()
  }, [filteredPosts.length, hasMorePosts])

  useEffect(() => {
    if (!activePostMenuId) return

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target
      if (!(target instanceof Element)) return
      if (target.closest('[data-post-menu-root="true"]')) return
      setActivePostMenuId(null)
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setActivePostMenuId(null)
      }
    }

    window.addEventListener('pointerdown', handlePointerDown)
    window.addEventListener('keydown', handleEscape)

    return () => {
      window.removeEventListener('pointerdown', handlePointerDown)
      window.removeEventListener('keydown', handleEscape)
    }
  }, [activePostMenuId])

  useEffect(() => {
    if (!composerMoreMenuOpen) return

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target
      if (!(target instanceof Element)) return
      if (target.closest('[data-composer-more-root="true"]')) return
      setComposerMoreMenuOpen(false)
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setComposerMoreMenuOpen(false)
      }
    }

    window.addEventListener('pointerdown', handlePointerDown)
    window.addEventListener('keydown', handleEscape)

    return () => {
      window.removeEventListener('pointerdown', handlePointerDown)
      window.removeEventListener('keydown', handleEscape)
    }
  }, [composerMoreMenuOpen])

  const hotTopics = useMemo(() => {
    const tags = new Map<string, number>()

    posts.forEach((post) => {
      const matches = post.content.match(/#[^\s#.,!?;:]+/g) || []
      matches.forEach((rawTag) => {
        const tag = rawTag.trim()
        if (!tag || tag.length < 2) return
        tags.set(tag, (tags.get(tag) || 0) + 1)
      })
    })

    return Array.from(tags.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([tag, count]) => ({
        tag,
        text: `Có ${count} bài viết gần đây nhắc đến chủ đề này`,
        count: `${count} bài viết`,
      }))
  }, [posts])

  const formatTime = (value: string) => {
    void timeTick
    const date = parseFeedDate(value)
    const diffMs = Math.max(0, Date.now() - date.getTime())
    const diffMinutes = Math.floor(diffMs / (60 * 1000))
    const diffHours = Math.floor(diffMs / (60 * 60 * 1000))
    const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000))

    if (diffMinutes < 1) return 'vừa xong'
    if (diffMinutes < 60) return `${diffMinutes} phút`
    if (diffHours < 24) return `${diffHours} giờ`
    if (diffDays < 7) return `${diffDays} ngày`

    return new Intl.DateTimeFormat('vi-VN', {
      timeZone: VN_TIMEZONE,
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(date)
  }

  const formatExactTime = (value: string) =>
    new Intl.DateTimeFormat('vi-VN', {
      timeZone: VN_TIMEZONE,
      hour12: false,
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).format(parseFeedDate(value))

  const submitPost = async (payload: {
    text: string
    mediaUrl?: string
    visibility?: 'public' | 'private'
    location?: string
    taggedFriend?: string
  }) => {
    const textWithMeta = [
      payload.text.trim(),
      payload.taggedFriend ? `\n\n👥 Cùng với: ${payload.taggedFriend.trim()}` : '',
      payload.location ? `\n📍 Địa điểm: ${payload.location.trim()}` : '',
    ]
      .filter(Boolean)
      .join('')

    if (!textWithMeta && !payload.mediaUrl?.trim()) return
    if (!token) {
      setErrorText('Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại.')
      navigate('/auth/login')
      return
    }
    setIsPosting(true)
    setErrorText('')
    try {
      const response = await api.createPost(token, {
        content: textWithMeta,
        mediaUrl: payload.mediaUrl?.trim() || undefined,
        visibility: payload.visibility || 'public',
      })
      setPosts((prev) => dedupePostsById([response.post, ...prev]))
      setContent('')
      setModalContent('')
      setModalMediaUrl('')
      setModalLocation('')
      setModalTaggedFriend('')
      resetComposerPanels()
      setModalVisibility('public')
      setIsModalOpen(false)
    } catch (error) {
      if (handleAuthExpired(error)) return
      if (error instanceof Error) {
        setErrorText(error.message || 'Không thể tạo bài viết')
      } else {
        setErrorText('Không thể tạo bài viết')
      }
      console.error('Failed to create post', error)
    } finally {
      setIsPosting(false)
    }
  }

  const handlePostReaction = async (post: FeedPost, reactionType: string) => {
    if (!token) {
      navigate('/auth/login')
      return
    }
    const previousReaction = post.viewerReaction
    const nextReaction = previousReaction === reactionType ? null : reactionType
    const reactionDelta = previousReaction
      ? nextReaction
        ? 0
        : -1
      : nextReaction
        ? 1
        : 0
    setPosts((prev) =>
      prev.map((item) =>
        String(item.id) === String(post.id)
          ? {
              ...item,
              viewerReaction: nextReaction,
              reactionCount: Math.max(0, Number(item.reactionCount || 0) + reactionDelta),
            }
          : item
      )
    )
    setOpenReactionPostId(null)
    try {
      const response = post.viewerReaction === reactionType
        ? await api.unreactPost(token, post.id)
        : await api.reactPost(token, post.id, reactionType)
      setPosts((prev) => prev.map((item) => (String(item.id) === String(post.id) ? response.post : item)))
    } catch (error) {
      if (handleAuthExpired(error)) return
      setPosts((prev) => prev.map((item) => (String(item.id) === String(post.id) ? post : item)))
      console.error('Failed to react post', error)
    }
  }

  const handleAddComment = async (postId: number) => {
    const value = (commentInputs[postId] || '').trim()
    if (!value) return
    if (!token) {
      navigate('/auth/login')
      return
    }

    setIsCommenting((prev) => ({ ...prev, [postId]: true }))
    try {
      const response = await api.addComment(token, postId, value)
      setPosts((prev) =>
        prev.map((item) =>
          item.id === postId ? { ...item, commentCount: Number(item.commentCount || 0) + 1 } : item
        )
      )
      setCommentLists((prev) => ({
        ...prev,
        [postId]: [...(prev[postId] || []), response.comment],
      }))
      setCommentPaging((prev) => {
        const current = prev[postId]
        if (!current) return prev
        return {
          ...prev,
          [postId]: {
            ...current,
            offset: current.offset + 1,
            total: current.total + 1,
          },
        }
      })
      setExpandedComments((prev) => ({ ...prev, [postId]: true }))
      setCommentInputs((prev) => ({ ...prev, [postId]: '' }))
    } catch (error) {
      if (handleAuthExpired(error)) return
      console.error('Failed to add comment', error)
    } finally {
      setIsCommenting((prev) => ({ ...prev, [postId]: false }))
    }
  }

  const handleOpenReactionViewers = async (post: FeedPost) => {
    setReactionViewerPostId(post.id)
    if (reactionViewers[post.id]) return
    try {
      const response = await api.listPostReactions(post.id)
      setReactionViewers((prev) => ({ ...prev, [post.id]: response.reactions }))
    } catch (error) {
      if (handleAuthExpired(error)) return
      console.error('Failed to load reaction viewers', error)
    }
  }

  const handleDeleteComment = async (post: FeedPost, comment: FeedComment) => {
    const canDeleteComment =
      Number(comment.userId) === Number(me?.id) ||
      Number(post.authorId) === Number(me?.id) ||
      me?.role === 'admin' ||
      me?.role === 'moderator'
    if (!token || !canDeleteComment) return
    setConfirmModal({
      title: 'Xóa bình luận?',
      description: 'Bình luận này sẽ bị xóa khỏi bài viết.',
      confirmLabel: 'Xóa',
      onConfirm: async () => {
        setBusyCommentId(comment.id)
        try {
          await api.deleteComment(token, comment.id)
          setCommentLists((prev) => ({ ...prev, [post.id]: (prev[post.id] || []).filter((item) => item.id !== comment.id) }))
          setPosts((prev) => prev.map((item) => (item.id === post.id ? { ...item, commentCount: Math.max(0, item.commentCount - 1) } : item)))
          toast({ title: 'Đã xóa bình luận' })
        } catch (error) {
          if (handleAuthExpired(error)) return
          const message = error instanceof Error ? error.message : 'Không thể xóa bình luận.'
          toast({ title: 'Không thể xóa bình luận', description: message, variant: 'destructive' })
          throw error
        } finally {
          setBusyCommentId(null)
        }
      },
    })
  }

  const handleReportComment = async (comment: FeedComment) => {
    if (!token) {
      navigate('/auth/login')
      return
    }
    setReportComment(comment)
  }

  const submitReportComment = async (payload: { reason: string; details?: string }) => {
    if (!token || !reportComment) return
    setBusyCommentId(reportComment.id)
    try {
      await api.submitReport(token, {
        targetType: 'comment',
        targetId: reportComment.id,
        reason: payload.reason,
        details: payload.details,
      })
      setErrorText('Đã gửi báo cáo bình luận.')
      toast({ title: 'Đã gửi báo cáo bình luận' })
    } catch (error) {
      if (handleAuthExpired(error)) return
      const message = error instanceof Error ? error.message : 'Không thể gửi báo cáo bình luận.'
      console.error('Failed to report comment', error)
      toast({ title: 'Không thể gửi báo cáo', description: message, variant: 'destructive' })
      throw error
    } finally {
      setBusyCommentId(null)
    }
  }

  const handleShare = async (post: FeedPost) => {
    try {
      setShareTargetPostId((prev) => (prev === post.id ? null : post.id))
    } catch (error) {
      console.error('Failed to share post', error)
    }
  }

  const handleShareToProfile = async (post: FeedPost) => {
    if (!token) {
      navigate('/auth/login')
      return
    }

    try {
      await api.createPost(token, {
        content: '',
        sharedPostId: post.id,
        visibility: 'public',
      })
      const refreshed = await api.listFeed(token)
      setPosts(dedupePostsById(refreshed.posts))
      setErrorText('Đã chia sẻ lên trang cá nhân.')
      setShareTargetPostId(null)
    } catch (error) {
      if (handleAuthExpired(error)) return
      console.error('Failed to share to profile', error)
    }
  }

  const handleShareToConversation = async (post: FeedPost, conversationId: string) => {
    if (!token) {
      navigate('/auth/login')
      return
    }

    try {
      await api.sendMessagePayload(token, conversationId, {
        type: 'text',
        text: `${me?.fullName || 'Bạn của bạn'} đã chia sẻ một bài viết của ${post.authorName}`,
        mediaUrl: post.mediaUrl || undefined,
        meta: {
          sharedPost: {
            id: post.id,
            authorId: post.authorId,
            authorName: post.authorName,
            authorAvatar: post.authorAvatar,
            content: post.content.slice(0, 240),
            mediaUrl: post.mediaUrl,
            reactionCount: post.reactionCount,
            commentCount: post.commentCount,
          },
        },
      })
      setErrorText('Đã chia sẻ bài viết vào tin nhắn.')
      setShareTargetPostId(null)
    } catch (error) {
      if (handleAuthExpired(error)) return
      console.error('Failed to share to conversation', error)
    }
  }

  const handleCopyLink = async (postId: number) => {
    const url = `${window.location.origin}/posts/${postId}`
    try {
      await navigator.clipboard.writeText(url)
      setErrorText('Đã sao chép liên kết bài viết.')
      setShareTargetPostId(null)
    } catch (error) {
      console.error('Failed to copy link', error)
    }
  }

  const handleCopyPostId = async (postId: number) => {
    try {
      await navigator.clipboard.writeText(String(postId))
      setErrorText(`Đã sao chép ID bài viết: #${postId}`)
      setActivePostMenuId(null)
    } catch (error) {
      console.error('Failed to copy post id', error)
    }
  }

  const canManagePost = (post: FeedPost) => {
    if (!me) return false
    return post.authorId === me.id
  }

  const handleStartEditPost = (post: FeedPost) => {
    setPostEditDraft({
      content: post.content || '',
      mediaUrl: post.mediaUrl || '',
      visibility: post.visibility,
    })
    setEditingPostId(post.id)
    setActivePostMenuId(null)
  }

  const handleCancelEditPost = () => {
    setEditingPostId(null)
    setPostEditDraft(null)
  }

  const handleEditSelectedMedia = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file || !token) return

    setUploadingMedia(true)
    try {
      const upload = await api.uploadPostMediaBase64(token, {
        fileName: file.name,
        contentType: file.type || 'application/octet-stream',
        base64Data: await fileToBase64(file),
      })
      if (!upload.mediaUrl) {
        throw new Error('Không thể tải media bài viết.')
      }
      setPostEditDraft((prev) => (prev ? { ...prev, mediaUrl: upload.mediaUrl } : prev))
      toast({ title: 'Đã tải media', description: 'Preview đã được cập nhật trong bài viết.' })
    } catch (error) {
      if (handleAuthExpired(error)) return
      const message = error instanceof Error ? error.message : 'Không thể tải media bài viết.'
      toast({ title: 'Không thể tải media', description: message, variant: 'destructive' })
    } finally {
      setUploadingMedia(false)
      event.target.value = ''
    }
  }

  const handleSaveEditPost = async (post: FeedPost) => {
    if (!token) {
      navigate('/auth/login')
      return
    }
    if (!postEditDraft) return

    const contentText = postEditDraft.content.trim()
    const mediaText = postEditDraft.mediaUrl.trim()
    if (!contentText && !mediaText) {
      setErrorText('Bài viết cần có nội dung hoặc media.')
      return
    }

    try {
      setIsSavingPostEdit(true)
      const updated = await api.updatePost(token, post.id, {
        content: contentText,
        mediaUrl: mediaText,
        visibility: postEditDraft.visibility,
      })
      setPosts((prev) => prev.map((item) => (item.id === post.id ? updated.post : item)))
      setErrorText('Đã cập nhật bài viết.')
      handleCancelEditPost()
    } catch (error) {
      if (handleAuthExpired(error)) return
      console.error('Failed to update post', error)
      setErrorText('Không thể cập nhật bài viết. Vui lòng thử lại.')
    } finally {
      setIsSavingPostEdit(false)
    }
  }

  const handleDeletePost = async (post: FeedPost) => {
    if (!token) {
      navigate('/auth/login')
      return
    }

    setConfirmModal({
      title: 'Xóa bài viết?',
      description: 'Bài viết này sẽ bị xóa khỏi bảng tin của bạn.',
      confirmLabel: 'Xóa',
      onConfirm: async () => {
        try {
          await api.deletePost(token, post.id)
          setPosts((prev) => prev.filter((item) => item.id !== post.id))
          setShareTargetPostId((prev) => (prev === post.id ? null : prev))
          setActivePostMenuId(null)
          if (editingPostId === post.id) {
            handleCancelEditPost()
          }
          setErrorText('Đã xóa bài viết.')
          toast({ title: 'Đã xóa bài viết' })
        } catch (error) {
          if (handleAuthExpired(error)) return
          console.error('Failed to delete post', error)
          const message = 'Không thể xóa bài viết. Vui lòng thử lại.'
          setErrorText(message)
          toast({ title: 'Không thể xóa bài viết', description: message, variant: 'destructive' })
          throw error
        }
      },
    })
  }

  const handleHidePost = (postId: number) => {
    setHiddenPostIds((prev) => ({ ...prev, [postId]: true }))
    setActivePostMenuId(null)
    setErrorText('Đã ẩn bài viết khỏi bảng tin của bạn.')
  }

  const handleReportPost = async (post: FeedPost) => {
    if (!token) {
      navigate('/auth/login')
      return
    }
    setReportPost(post)
    setActivePostMenuId(null)
  }

  const submitReportPost = async (payload: { reason: string; details?: string }) => {
    if (!token || !reportPost) return
    try {
      await api.submitReport(token, {
        targetType: 'post',
        targetId: reportPost.id,
        reason: payload.reason,
        details: payload.details || `Bài viết từ ${reportPost.authorName}`,
      })
      setReportPost(null)
      setErrorText('Đã gửi báo cáo bài viết. Cảm ơn bạn đã phản hồi.')
    } catch (error) {
      if (handleAuthExpired(error)) return
      console.error('Failed to report post', error)
      setErrorText('Không thể gửi báo cáo bài viết. Vui lòng thử lại.')
      throw error
    }
  }

  const fileToBase64 = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => {
        const result = typeof reader.result === 'string' ? reader.result : ''
        resolve(result.includes(',') ? result.split(',')[1] : result)
      }
      reader.onerror = () => reject(new Error('Không thể đọc file'))
      reader.readAsDataURL(file)
    })

  const handleChooseMediaFile = () => {
    mediaInputRef.current?.click()
  }

  const handleSelectedMedia = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file || !token) return

    const maxBytes = 15 * 1024 * 1024
    if (file.size > maxBytes) {
      setErrorText('Media quá lớn. Vui lòng chọn tệp nhỏ hơn 15MB.')
      event.target.value = ''
      return
    }

    setUploadingMedia(true)
    setErrorText('')
    try {
      const base64Data = await fileToBase64(file)
      const uploaded = await api.uploadPostMediaBase64(token, {
        fileName: file.name,
        contentType: file.type || 'application/octet-stream',
        base64Data,
      })
      if (!uploaded.mediaUrl) {
        throw new Error('Upload media thất bại, không nhận được URL.')
      }
      setModalMediaUrl(uploaded.mediaUrl)
    } catch (error) {
      if (handleAuthExpired(error)) return
      console.error('Failed to upload post media', error)
      setErrorText(error instanceof Error ? error.message : 'Không thể tải ảnh/video lên bài viết.')
    } finally {
      setUploadingMedia(false)
      event.target.value = ''
    }
  }

  const handleToggleComments = async (postId: number) => {
    const opened = expandedComments[postId]
    setExpandedComments((prev) => ({ ...prev, [postId]: !opened }))
    if (opened) return
    if (commentLists[postId]) return

    setLoadingComments((prev) => ({ ...prev, [postId]: true }))
    try {
      const result = await api.listComments(postId, token || undefined, { limit: 3, offset: 0 })
      setCommentLists((prev) => ({ ...prev, [postId]: result.comments }))
      setCommentPaging((prev) => ({
        ...prev,
        [postId]: {
          offset: result.comments.length,
          total: Number(result.total || result.comments.length),
          hasMore: Boolean(result.hasMore),
        },
      }))
    } catch (error) {
      if (handleAuthExpired(error)) return
      console.error('Failed to load comments list', error)
    } finally {
      setLoadingComments((prev) => ({ ...prev, [postId]: false }))
    }
  }

  const handleLoadMoreComments = async (postId: number) => {
    if (loadingMoreComments[postId]) return
    const paging = commentPaging[postId]
    if (!paging?.hasMore) return

    setLoadingMoreComments((prev) => ({ ...prev, [postId]: true }))
    try {
      const result = await api.listComments(postId, token || undefined, {
        limit: 5,
        offset: paging.offset,
      })
      setCommentLists((prev) => ({
        ...prev,
        [postId]: [...(prev[postId] || []), ...result.comments],
      }))
      setCommentPaging((prev) => ({
        ...prev,
        [postId]: {
          offset: paging.offset + result.comments.length,
          total: Number(result.total || paging.total),
          hasMore: Boolean(result.hasMore),
        },
      }))
    } catch (error) {
      if (handleAuthExpired(error)) return
      console.error('Failed to load more comments', error)
    } finally {
      setLoadingMoreComments((prev) => ({ ...prev, [postId]: false }))
    }
  }

  const handleQuickCreate = async (event: FormEvent) => {
    event.preventDefault()
    await submitPost({ text: content, visibility: 'public' })
  }

  const handleModalCreate = async (event: FormEvent) => {
    event.preventDefault()
    await submitPost({
      text: modalContent,
      mediaUrl: modalMediaUrl,
      visibility: modalVisibility,
      location: modalLocation,
      taggedFriend: modalTaggedFriend,
    })
  }

  const appendEmoji = (emoji: string) => {
    setModalContent((prev) => `${prev}${emoji}`)
  }

  const locationSuggestions = useMemo(() => {
    const q = locationKeyword.trim().toLowerCase()
    if (!q) return VN_LOCATIONS.slice(0, 8)
    return VN_LOCATIONS.filter((item) => item.toLowerCase().includes(q)).slice(0, 8)
  }, [locationKeyword])

  return (
    <div className={styles.page}>
      <div className={styles.layout}>
        <Sidebar
          user={me}
          onCreatePost={() => {
            if (isGuestView) {
              navigate('/auth/login?next=/feed')
              return
            }
            setIsModalOpen(true)
          }}
        />

        <section className={styles.mainCol}>
          <section className={styles.feedSearchBox}>
            <input
              value={feedSearchQuery}
              onChange={(event) => setFeedSearchQuery(event.target.value)}
              placeholder="Tìm người, bài viết hoặc hashtag..."
            />
            {feedSearchQuery.trim() ? (
              <div className={styles.feedSearchDropdown}>
                {feedSearchUsers.map((item) => (
                  <Link key={item.id} to={`/profile/${item.id}`} className={styles.feedSearchRow}>
                    {item.avatarUrl ? <img src={item.avatarUrl} alt={item.name} /> : <span>{(item.name[0] || 'U').toUpperCase()}</span>}
                    <b>{item.name}</b>
                    <small>Tài khoản</small>
                  </Link>
                ))}
                {filteredPosts.slice(0, 4).map((post) => (
                  <button
                    key={post.id}
                    type="button"
                    className={styles.feedSearchRow}
                    onClick={() => navigate(`/posts/${post.id}`)}
                  >
                    {post.authorAvatar ? <img src={post.authorAvatar} alt={post.authorName} /> : <span>{(post.authorName[0] || 'U').toUpperCase()}</span>}
                    <b>{post.content.slice(0, 54) || `Bài viết của ${post.authorName}`}</b>
                    <small>Bài viết</small>
                  </button>
                ))}
                {feedSearchUsers.length === 0 && filteredPosts.length === 0 ? (
                  <p className={styles.feedSearchEmpty}>Không tìm thấy kết quả phù hợp.</p>
                ) : null}
              </div>
            ) : null}
          </section>

          {isGuestView ? (
            <section className={styles.guestBanner}>
              <h3>Chế độ khách vãng lai</h3>
              <p>Bạn đang xem bảng tin ở chế độ chỉ đọc. Đăng nhập để đăng bài, bình luận, chia sẻ và nhắn tin.</p>
              <div className={styles.guestBannerActions}>
                <button type="button" className={styles.submitBtn} onClick={() => navigate('/auth/login?next=/feed')}>
                  Đăng nhập để tương tác
                </button>
                <Link to="/ai-chat" className={styles.softBtn}>
                  <Smile size={15} /> Chat hỗ trợ với AI
                </Link>
              </div>
            </section>
          ) : (
            <form className={styles.composer} onSubmit={handleQuickCreate}>
              <div className={styles.composerHead}>
                <div className={styles.avatarBadge}>{(me?.fullName?.[0] || 'U').toUpperCase()}</div>
                <textarea
                  placeholder="Bạn đang nghĩ gì?"
                  className={styles.composerInput}
                  value={content}
                  onChange={(event) => setContent(event.target.value)}
                />
              </div>
              <div className={styles.composerFoot}>
                <div className={styles.composerActions}>
                  <button type="button" className={styles.softBtn} onClick={() => setIsModalOpen(true)}>
                    <ImageIcon size={15} /> Ảnh/Video
                  </button>
                  <button type="button" className={styles.softBtn} onClick={() => setIsModalOpen(true)}>
                    <Smile size={15} /> Cảm xúc
                  </button>
                </div>
                <button type="submit" className={styles.submitBtn} disabled={!content.trim() || isPosting}>
                  {isPosting ? 'Đang đăng...' : 'Đăng'}
                </button>
              </div>
            </form>
          )}

          {errorText ? <p className={styles.errorBanner}>{errorText}</p> : null}

          <div className={styles.feedList}>
            {isLoadingFeed ? (
              <>
                <div className={styles.feedSkeleton} />
                <div className={styles.feedSkeleton} />
                <div className={styles.feedSkeleton} />
              </>
            ) : null}
            {visiblePosts.map((post) => {
              const postComments = commentLists[post.id] || []
              const paging = commentPaging[post.id]
              const hasMoreComments = Boolean(paging?.hasMore)
              const hiddenCount = Math.max(0, Number(paging?.total || post.commentCount || 0) - postComments.length)
              const postIsManageable = canManagePost(post)

              return (
                <article key={`${post.id}-${post.createdAt}`} className={styles.postCard}>
                <div className={styles.postHead}>
                  <div className={styles.authorInfo}>
                    <div className={styles.avatarBadge}>{(post.authorName[0] || 'U').toUpperCase()}</div>
                    <div>
                      <Link to={`/profile/${post.authorId}`} className={styles.authorNameLink}>
                        <p className={styles.authorName}>{post.authorName}</p>
                      </Link>
                      <p className={styles.postMeta}>
                        <time dateTime={post.createdAt} title={formatExactTime(post.createdAt)}>
                          {formatTime(post.createdAt)}
                        </time>{' '}
                        <Dot size={12} /> {post.visibility === 'public' ? 'Công khai' : 'Riêng tư'}
                      </p>
                    </div>
                  </div>
                  <div className={styles.postHeadActions} data-post-menu-root="true">
                    <button
                      type="button"
                      className={styles.iconBtn}
                      aria-label="Tùy chọn bài viết"
                      aria-expanded={activePostMenuId === post.id}
                      onClick={() => setActivePostMenuId((prev) => (prev === post.id ? null : post.id))}
                    >
                      <Ellipsis size={16} />
                    </button>
                    {activePostMenuId === post.id ? (
                      <div className={styles.postMenu} role="menu">
                        <button type="button" onClick={() => void handleCopyPostId(post.id)}>
                          Sao chép ID bài viết (#{post.id})
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            void handleCopyLink(post.id)
                            setActivePostMenuId(null)
                          }}
                        >
                          Sao chép liên kết
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            void handleShare(post)
                            setActivePostMenuId(null)
                          }}
                        >
                          Chia sẻ ngay
                        </button>
                        {postIsManageable ? (
                          <>
                            <button type="button" onClick={() => handleStartEditPost(post)}>
                              Chỉnh sửa bài viết
                            </button>
                            <button
                              type="button"
                              className={styles.postMenuDanger}
                              onClick={() => void handleDeletePost(post)}
                            >
                              Xóa bài viết
                            </button>
                          </>
                        ) : (
                          <>
                            <button type="button" onClick={() => handleHidePost(post.id)}>
                              Ẩn bài viết
                            </button>
                            <button
                              type="button"
                              className={styles.postMenuDanger}
                              onClick={() => void handleReportPost(post)}
                            >
                              Báo cáo bài viết
                            </button>
                          </>
                        )}
                      </div>
                    ) : null}
                  </div>
                </div>

                {post.sharedPost ? (
                  <p className={styles.sharedByLine}>
                    {post.authorName} đã chia sẻ bài viết
                  </p>
                ) : null}

                {post.content ? <p className={styles.postContent}>{post.content}</p> : null}

                {post.mediaUrl ? (
                  <img
                    src={post.mediaUrl}
                    alt="Post media"
                    className={styles.postMedia}
                    loading="lazy"
                    onError={(event) => {
                      event.currentTarget.style.display = 'none'
                    }}
                  />
                ) : null}

                {post.sharedPost ? (
                  <Link to={post.sharedPost.unavailable ? '#' : `/posts/${post.sharedPost.id}`} className={styles.sharedPostEmbed}>
                    {post.sharedPost.unavailable ? (
                      <p className={styles.sharedUnavailable}>Bài viết gốc không còn khả dụng</p>
                    ) : (
                      <>
                        <div className={styles.sharedPostAuthor}>
                          {post.sharedPost.authorAvatar ? (
                            <img src={post.sharedPost.authorAvatar} alt={post.sharedPost.authorName || 'Tác giả'} />
                          ) : (
                            <span>{(post.sharedPost.authorName?.[0] || 'U').toUpperCase()}</span>
                          )}
                          <b>{post.sharedPost.authorName || 'Người dùng ZChat'}</b>
                        </div>
                        {post.sharedPost.content ? <p>{post.sharedPost.content}</p> : null}
                        {post.sharedPost.mediaUrl ? <img src={post.sharedPost.mediaUrl} alt="Shared post media" /> : null}
                        <small>
                          {Number(post.sharedPost.reactionCount || 0)} cảm xúc • {Number(post.sharedPost.commentCount || 0)} bình luận
                        </small>
                      </>
                    )}
                  </Link>
                ) : null}

                <div className={styles.postStats}>
                  <button type="button" onClick={() => void handleOpenReactionViewers(post)}>
                    {post.reactionCount} lượt cảm xúc
                  </button>
                  <button type="button" onClick={() => handleToggleComments(post.id)} disabled={isGuestView}>
                    {post.commentCount} bình luận
                  </button>
                </div>

                <div className={styles.postActions}>
                  <div className={styles.reactionActionWrap}>
                    <button
                      type="button"
                      className={`${styles.actionBtn} ${post.viewerReaction ? styles.actionBtnActive : ''}`}
                      onClick={() => setOpenReactionPostId((current) => (current === post.id ? null : post.id))}
                      disabled={isGuestView}
                    >
                      {post.viewerReaction ? (
                        <>
                          <span className={styles.reactionActionEmoji}>{getPostReactionMeta(post.viewerReaction).emoji}</span>
                          {getPostReactionMeta(post.viewerReaction).label}
                        </>
                      ) : (
                        <>
                          <Heart size={16} /> Thả cảm xúc
                        </>
                      )}
                    </button>
                    {openReactionPostId === post.id ? (
                      <div className={styles.postReactionPicker}>
                        {POST_REACTIONS.map((reaction) => (
                          <button
                            key={reaction.type}
                            type="button"
                            className={post.viewerReaction === reaction.type ? styles.postReactionActive : ''}
                            title={reaction.label}
                            aria-label={reaction.label}
                            onClick={() => void handlePostReaction(post, reaction.type)}
                          >
                            {reaction.emoji}
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    className={styles.actionBtn}
                    onClick={() => handleToggleComments(post.id)}
                    disabled={isGuestView}
                  >
                    <MessageCircle size={16} /> {expandedComments[post.id] ? 'Ẩn bình luận' : 'Bình luận'}
                  </button>
                  <button
                    type="button"
                    className={styles.actionBtn}
                    onClick={() => handleShare(post)}
                    disabled={isGuestView}
                  >
                    <Share2 size={16} /> Chia sẻ
                  </button>
                </div>

                {!isGuestView && shareTargetPostId === post.id ? (
                  <div className={styles.sharePanel}>
                    <button type="button" onClick={() => handleShareToProfile(post)}>
                      Chia sẻ lên trang cá nhân
                    </button>
                    <button type="button" onClick={() => handleCopyLink(post.id)}>
                      Sao chép liên kết
                    </button>
                    {shareConversations.length > 0 ? (
                      <div className={styles.shareToMessageList}>
                        <p>Chia sẻ qua tin nhắn:</p>
                        {shareConversations.slice(0, 6).map((conv) => (
                          <button
                            key={conv.id}
                            type="button"
                            onClick={() => handleShareToConversation(post, conv.id)}
                          >
                            {conv.name || `Cuộc trò chuyện ${conv.id}`}
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ) : null}

                {!isGuestView ? (
                  <div className={styles.commentBar}>
                    <input
                      value={commentInputs[post.id] || ''}
                      onChange={(event) =>
                        setCommentInputs((prev) => ({ ...prev, [post.id]: event.target.value }))
                      }
                      placeholder="Viết bình luận nhanh..."
                    />
                    <button type="button" onClick={() => handleAddComment(post.id)} disabled={isCommenting[post.id]}>
                      {isCommenting[post.id] ? 'Đang gửi...' : 'Gửi'}
                    </button>
                  </div>
                ) : (
                  <div className={styles.guestPostHint}>
                    Đăng nhập để bình luận và chia sẻ bài viết này.
                  </div>
                )}

                {expandedComments[post.id] ? (
                  <div className={`${styles.commentsList} ${styles.commentsListOpen}`}>
                    {loadingComments[post.id] ? <p className={styles.commentState}>Đang tải bình luận...</p> : null}
                    {postComments.map((comment) => (
                      <div key={comment.id} className={styles.commentItem}>
                        <div className={styles.commentAvatar}>{(comment.authorName[0] || 'U').toUpperCase()}</div>
                        <div className={styles.commentBody}>
                          <Link to={`/profile/${comment.userId}`}>
                            <b>{comment.authorName}</b>
                          </Link>
                          <p>{comment.content}</p>
                          {token ? (
                            <div className={styles.commentActions}>
                              <button type="button" onClick={() => void handleReportComment(comment)} disabled={busyCommentId === comment.id}>
                                Báo cáo
                              </button>
                              {Number(comment.userId) === Number(me?.id) ||
                              Number(post.authorId) === Number(me?.id) ||
                              me?.role === 'admin' ||
                              me?.role === 'moderator' ? (
                                <button type="button" onClick={() => void handleDeleteComment(post, comment)} disabled={busyCommentId === comment.id}>
                                  Xóa
                                </button>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    ))}
                    {!loadingComments[post.id] && postComments.length === 0 ? (
                      <p className={styles.commentState}>Chưa có bình luận nào.</p>
                    ) : null}
                    {!loadingComments[post.id] && hasMoreComments ? (
                      <button
                        type="button"
                        className={styles.showMoreCommentsBtn}
                        onClick={() => handleLoadMoreComments(post.id)}
                        disabled={loadingMoreComments[post.id]}
                      >
                        {loadingMoreComments[post.id]
                          ? 'Đang tải thêm...'
                          : hiddenCount > 0
                            ? `Xem thêm ${hiddenCount} cmt`
                            : 'Xem thêm cmt'}
                      </button>
                    ) : null}
                    <button type="button" className={styles.viewDetailBtn} onClick={() => navigate(`/posts/${post.id}`)}>
                      Xem chi tiết bình luận
                    </button>
                  </div>
                ) : null}
                </article>
              )
            })}

            {filteredPosts.length === 0 && <div className={styles.empty}>Chưa có bài viết nào trong bảng tin.</div>}
            {filteredPosts.length > 0 && hasMorePosts ? (
              <div ref={feedBottomSentinelRef} className={styles.feedLoadingMore}>
                Đang tải thêm bài viết...
              </div>
            ) : null}
            {filteredPosts.length > 0 && !hasMorePosts ? (
              <div className={styles.feedEndMarker}>Bạn đã xem hết bài viết hiện có.</div>
            ) : null}
          </div>
        </section>

        <aside className={styles.rightCol}>
          <section className={styles.widget}>
            <h3>Gợi ý cho bạn</h3>
            {suggestedPeople.length === 0 ? (
              <p className={styles.suggestionMeta}>Chưa đủ dữ liệu để gợi ý người dùng.</p>
            ) : (
              suggestedPeople.map((person) => (
                <div key={person.id} className={styles.suggestionItem}>
                  <div className={styles.avatarSm}>{(person.name[0] || 'U').toUpperCase()}</div>
                  <div>
                    <p className={styles.suggestionName}>{person.name}</p>
                    <p className={styles.suggestionMeta}>{person.postCount} bài viết gần đây</p>
                  </div>
                  <Link to={`/profile/${person.id}`} className={styles.followBtn}>
                    Xem hồ sơ
                  </Link>
                </div>
              ))
            )}
          </section>

          <section className={styles.widget}>
            <h3>Xu hướng hot</h3>
            {hotTopics.length === 0 ? (
              <p className={styles.topicCount}>Chưa có hashtag nào trong dữ liệu hiện tại.</p>
            ) : (
              hotTopics.map((topic) => (
                <div key={topic.tag} className={styles.topicItem}>
                  <p className={styles.topicTag}>{topic.tag}</p>
                  <p className={styles.topicText}>{topic.text}</p>
                  <p className={styles.topicCount}>{topic.count}</p>
                </div>
              ))
            )}
            <Link to="/explore" className={styles.moreBtn}>
              Xem thêm
            </Link>
          </section>
        </aside>
      </div>

      {reactionViewerPostId ? (
        <div className={styles.viewerBackdrop} role="presentation" onClick={() => setReactionViewerPostId(null)}>
          <section className={styles.viewerDialog} role="dialog" aria-label="Người thả cảm xúc" onClick={(event) => event.stopPropagation()}>
            <div className={styles.viewerHead}>
              <h3>Người thả cảm xúc</h3>
              <button type="button" onClick={() => setReactionViewerPostId(null)} aria-label="Đóng">
                <X size={16} />
              </button>
            </div>
            <div className={styles.viewerList}>
              {(reactionViewers[reactionViewerPostId] || []).map((viewer) => (
                <Link key={`${viewer.userId}-${viewer.reaction}`} to={`/profile/${viewer.userId}`} className={styles.viewerRow}>
                  {viewer.avatarUrl ? <img src={viewer.avatarUrl} alt={viewer.fullName} /> : <span>{(viewer.fullName[0] || 'U').toUpperCase()}</span>}
                  <b>{viewer.fullName}</b>
                  <i>{getPostReactionMeta(viewer.reaction).emoji}</i>
                </Link>
              ))}
              {reactionViewers[reactionViewerPostId]?.length === 0 ? <p>Chưa có lượt cảm xúc.</p> : null}
              {!reactionViewers[reactionViewerPostId] ? <p>Đang tải danh sách...</p> : null}
            </div>
          </section>
        </div>
      ) : null}

      {isModalOpen ? (
        <div className={styles.modalOverlay}>
          <form className={styles.modal} onSubmit={handleModalCreate}>
            <header className={styles.modalHeader}>
              <h2>Tạo bài viết</h2>
              <button type="button" className={styles.closeBtn} onClick={closeComposerModal}>
                <X size={16} />
              </button>
            </header>

            <div className={styles.modalUser}>
              <div className={styles.avatarBadge}>{(me?.fullName?.[0] || 'U').toUpperCase()}</div>
              <div>
                <b>{me?.fullName || 'Người dùng'}</b>
                <small>{modalVisibility === 'public' ? 'Công khai' : 'Riêng tư'}</small>
              </div>
            </div>

            <label className={styles.visibilityRow}>
              <span>Quyền riêng tư</span>
              <select
                value={modalVisibility}
                onChange={(event) => setModalVisibility(event.target.value as 'public' | 'private')}
              >
                <option value="public">Công khai</option>
                <option value="private">Riêng tư</option>
              </select>
            </label>

            <textarea
              className={styles.modalInput}
              placeholder="Bạn đang nghĩ gì?"
              value={modalContent}
              onChange={(event) => setModalContent(event.target.value)}
            />

            <input ref={mediaInputRef} type="file" accept="image/*,video/*" className={styles.hiddenInput} onChange={handleSelectedMedia} />

            {activeComposerPanel === 'emoji' && showEmojiTray ? (
              <div className={styles.emojiTray}>
                {['😀', '😍', '🔥', '🎉', '💙', '👍', '🥳', '🤝'].map((emoji) => (
                  <button key={emoji} type="button" onClick={() => appendEmoji(emoji)}>
                    {emoji}
                  </button>
                ))}
              </div>
            ) : null}

            {modalMediaUrl ? (
              <div className={styles.modalMediaPreview}>
                {isVideoMediaUrl(modalMediaUrl) ? (
                  <video src={modalMediaUrl} controls className={styles.modalMediaPreviewAsset} />
                ) : (
                  <img
                    src={modalMediaUrl}
                    alt="Media preview"
                    className={styles.modalMediaPreviewAsset}
                    onError={(event) => {
                      event.currentTarget.style.display = 'none'
                      setErrorText('Không thể hiển thị media đã tải lên. Vui lòng thử lại.')
                    }}
                  />
                )}
              </div>
            ) : null}
            {modalTaggedFriend ? (
              <p className={styles.metaPreview}>Đã gắn thẻ: {modalTaggedFriend}</p>
            ) : null}
            {modalLocation ? <p className={styles.metaPreview}>Địa điểm: {modalLocation}</p> : null}

            {activeComposerPanel === 'tag' ? (
              <div className={styles.modalSection}>
                <p>Gắn thẻ bạn bè</p>
                <input
                  value={tagKeyword}
                  onChange={(event) => setTagKeyword(event.target.value)}
                  placeholder="Nhập tên, ví dụ: Tuấn"
                />
                {tagSuggestions.length > 0 ? (
                  <div className={styles.dropdownList}>
                    {tagSuggestions.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          setModalTaggedFriend(item.name)
                          setTagKeyword(item.name)
                          setTagSuggestions([])
                        }}
                      >
                        {item.name}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}

            {activeComposerPanel === 'location' ? (
              <div className={styles.modalSection}>
                <p>Địa điểm (Việt Nam)</p>
                <input
                  value={locationKeyword}
                  onChange={(event) => setLocationKeyword(event.target.value)}
                  placeholder="Nhập Hà để gợi ý Hà Nội, Hà Nam..."
                />
                <div className={styles.dropdownList}>
                  {locationSuggestions.map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => {
                        setModalLocation(item)
                        setLocationKeyword(item)
                      }}
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            <div className={styles.modalTools}>
              <span>Thêm vào bài viết của bạn</span>
              <div>
                <button type="button" onClick={handleChooseMediaFile} title="Thêm ảnh/video" disabled={uploadingMedia}>
                  <ImageIcon size={16} />
                </button>
                <button
                  type="button"
                  className={activeComposerPanel === 'tag' ? styles.modalToolBtnActive : ''}
                  onClick={() =>
                    setActiveComposerPanel((prev) => {
                      const next = prev === 'tag' ? null : 'tag'
                      setShowEmojiTray(false)
                      return next
                    })
                  }
                  title="Gắn thẻ bạn bè"
                >
                  <UserPlus size={16} />
                </button>
                <button
                  type="button"
                  className={activeComposerPanel === 'emoji' ? styles.modalToolBtnActive : ''}
                  onClick={() => {
                    setActiveComposerPanel((prev) => (prev === 'emoji' ? null : 'emoji'))
                    setShowEmojiTray((prev) => !prev)
                  }}
                  title="Thêm cảm xúc"
                >
                  <Smile size={16} />
                </button>
                <button
                  type="button"
                  className={activeComposerPanel === 'location' ? styles.modalToolBtnActive : ''}
                  onClick={() =>
                    setActiveComposerPanel((prev) => {
                      const next = prev === 'location' ? null : 'location'
                      setShowEmojiTray(false)
                      return next
                    })
                  }
                  title="Thêm vị trí"
                >
                  <MapPin size={16} />
                </button>
                <div className={styles.composerMoreWrap} data-composer-more-root="true">
                  <button
                    type="button"
                    className={composerMoreMenuOpen ? styles.modalToolBtnActive : ''}
                    onClick={() => setComposerMoreMenuOpen((prev) => !prev)}
                    title="Tùy chọn khác"
                  >
                    <MoreHorizontal size={16} />
                  </button>
                  {composerMoreMenuOpen ? (
                    <div className={styles.composerMoreMenu}>
                      <button
                        type="button"
                        className={modalVisibility === 'public' ? styles.composerMoreMenuActive : ''}
                        onClick={() => {
                          setModalVisibility('public')
                          setComposerMoreMenuOpen(false)
                        }}
                      >
                        Quyền riêng tư: Công khai
                      </button>
                      <button
                        type="button"
                        className={modalVisibility === 'private' ? styles.composerMoreMenuActive : ''}
                        onClick={() => {
                          setModalVisibility('private')
                          setComposerMoreMenuOpen(false)
                        }}
                      >
                        Quyền riêng tư: Riêng tư
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setModalMediaUrl('')
                          setComposerMoreMenuOpen(false)
                        }}
                        disabled={!modalMediaUrl}
                      >
                        Gỡ ảnh/video đã chọn
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setModalTaggedFriend('')
                          setTagKeyword('')
                          setTagSuggestions([])
                          setComposerMoreMenuOpen(false)
                        }}
                        disabled={!modalTaggedFriend}
                      >
                        Gỡ gắn thẻ bạn bè
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setModalLocation('')
                          setLocationKeyword('')
                          setComposerMoreMenuOpen(false)
                        }}
                        disabled={!modalLocation}
                      >
                        Gỡ vị trí
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>

            <button
              type="submit"
              className={styles.modalSubmit}
              disabled={(!modalContent.trim() && !modalMediaUrl.trim()) || isPosting}
            >
              {isPosting ? 'Đang đăng...' : 'Đăng'}
            </button>
          </form>
        </div>
      ) : null}
      {editingPostId && postEditDraft ? (
        <div className={styles.modalOverlay}>
          <form
            className={`${styles.modal} ${styles.editPostModal}`}
            onSubmit={(event) => {
              event.preventDefault()
              const targetPost = posts.find((item) => item.id === editingPostId)
              if (targetPost) void handleSaveEditPost(targetPost)
            }}
          >
            <header className={styles.modalHeader}>
              <h2>Chỉnh sửa bài viết</h2>
              <button type="button" className={styles.closeBtn} onClick={handleCancelEditPost} disabled={isSavingPostEdit}>
                <X size={16} />
              </button>
            </header>

            <div className={styles.modalUser}>
              <div className={styles.avatarBadge}>{(me?.fullName?.[0] || 'U').toUpperCase()}</div>
              <div>
                <b>{me?.fullName || 'Người dùng'}</b>
                <small>{postEditDraft.visibility === 'public' ? 'Công khai' : 'Riêng tư'}</small>
              </div>
            </div>

            <label className={styles.visibilityRow}>
              <span>Quyền riêng tư</span>
              <select
                value={postEditDraft.visibility}
                onChange={(event) =>
                  setPostEditDraft((prev) =>
                    prev ? { ...prev, visibility: event.target.value as 'public' | 'private' } : prev
                  )
                }
              >
                <option value="public">Công khai</option>
                <option value="private">Riêng tư</option>
              </select>
            </label>

            <textarea
              className={styles.modalInput}
              placeholder="Bạn muốn cập nhật điều gì?"
              value={postEditDraft.content}
              onChange={(event) => {
                event.currentTarget.style.height = 'auto'
                event.currentTarget.style.height = `${event.currentTarget.scrollHeight}px`
                setPostEditDraft((prev) => (prev ? { ...prev, content: event.target.value } : prev))
              }}
            />

            <input type="file" accept="image/*,video/*" className={styles.hiddenInput} onChange={handleEditSelectedMedia} />

            <div className={styles.editMediaBox}>
              {postEditDraft.mediaUrl ? (
                <>
                  {isVideoMediaUrl(postEditDraft.mediaUrl) ? (
                    <video src={postEditDraft.mediaUrl} controls className={styles.modalMediaPreviewAsset} />
                  ) : (
                    <img src={postEditDraft.mediaUrl} alt="Media preview" className={styles.modalMediaPreviewAsset} />
                  )}
                  <button
                    type="button"
                    className={styles.removeMediaBtn}
                    onClick={() => setPostEditDraft((prev) => (prev ? { ...prev, mediaUrl: '' } : prev))}
                  >
                    Gỡ media
                  </button>
                </>
              ) : (
                <label className={styles.dropMediaLabel}>
                  <ImageIcon size={18} />
                  <span>{uploadingMedia ? 'Đang tải media...' : 'Chọn ảnh/video cho bài viết'}</span>
                  <input type="file" accept="image/*,video/*" onChange={handleEditSelectedMedia} disabled={uploadingMedia} />
                </label>
              )}
            </div>

            {postEditDraft.mediaUrl ? (
              <label className={styles.replaceMediaBtn}>
                <ImageIcon size={16} />
                <span>{uploadingMedia ? 'Đang tải...' : 'Đổi media'}</span>
                <input type="file" accept="image/*,video/*" onChange={handleEditSelectedMedia} disabled={uploadingMedia} />
              </label>
            ) : null}

            <div className={styles.modalActionRow}>
              <button type="button" className={styles.ghostBtn} onClick={handleCancelEditPost} disabled={isSavingPostEdit}>
                Hủy
              </button>
              <button
                type="submit"
                className={styles.modalSubmit}
                disabled={isSavingPostEdit || uploadingMedia || (!postEditDraft.content.trim() && !postEditDraft.mediaUrl.trim())}
              >
                {isSavingPostEdit ? 'Đang lưu...' : 'Lưu thay đổi'}
              </button>
            </div>
          </form>
        </div>
      ) : null}
      <ConfirmDialog
        open={Boolean(confirmModal)}
        onOpenChange={(open) => {
          if (!open) setConfirmModal(null)
        }}
        title={confirmModal?.title || ''}
        description={confirmModal?.description || ''}
        confirmLabel={confirmModal?.confirmLabel || 'Xác nhận'}
        onConfirm={async () => {
          await confirmModal?.onConfirm()
        }}
      />
      <ReportDialog
        open={Boolean(reportPost)}
        onOpenChange={(open) => {
          if (!open) setReportPost(null)
        }}
        title="Báo cáo bài viết"
        onSubmit={submitReportPost}
      />
      <ReportDialog
        open={Boolean(reportComment)}
        onOpenChange={(open) => {
          if (!open) setReportComment(null)
        }}
        title="Báo cáo bình luận"
        onSubmit={submitReportComment}
      />
    </div>
  )
}
