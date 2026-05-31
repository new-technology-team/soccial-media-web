'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type React from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  Clock3,
  Copy,
  Heart,
  MessageCircle,
  MoreHorizontal,
  RefreshCw,
  Send,
  Share2,
  ShieldCheck,
  Sparkles,
  UserRound,
} from 'lucide-react'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Skeleton } from '@/components/ui/skeleton'
import { api, normalizeFeedComment, resolveApiAssetUrl } from '@/api/client'
import { useAuthStore } from '@/contexts/auth-store'
import { connectSocket } from '@/services/socket'
import type { FeedComment, FeedPost } from '@/types'
import styles from './page.module.css'

const POST_REACTIONS = [
  { type: 'like', emoji: '👍', label: 'Thích' },
  { type: 'love', emoji: '❤️', label: 'Yêu thích' },
  { type: 'haha', emoji: '😆', label: 'Haha' },
  { type: 'wow', emoji: '😮', label: 'Wow' },
  { type: 'sad', emoji: '😢', label: 'Buồn' },
  { type: 'angry', emoji: '😡', label: 'Phẫn nộ' },
] as const

type ReactionType = (typeof POST_REACTIONS)[number]['type']

const isVideoMediaUrl = (url: string) =>
  /\.(mp4|webm|ogg|mov|m4v|avi|mkv)(\?.*)?$/i.test(url) || url.includes('/video/')

const formatDateTime = (value?: string | Date | null) => {
  if (!value) return 'Không rõ thời gian'

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return 'Không rõ thời gian'
  }

  return date.toLocaleString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

const getRelativeTime = (value?: string | Date | null) => {
  if (!value) return 'Vừa xong'

  const date = new Date(value)
  const diffMs = Date.now() - date.getTime()

  if (Number.isNaN(diffMs)) return 'Vừa xong'

  const diffMinutes = Math.floor(diffMs / 60_000)
  const diffHours = Math.floor(diffMinutes / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffMinutes < 1) return 'Vừa xong'
  if (diffMinutes < 60) return `${diffMinutes} phút trước`
  if (diffHours < 24) return `${diffHours} giờ trước`
  if (diffDays < 7) return `${diffDays} ngày trước`

  return formatDateTime(value)
}

const countAllComments = (items: FeedComment[]): number =>
  items.reduce((total, item) => total + 1 + countAllComments(item.replies || []), 0)

const appendCommentOnce = (items: FeedComment[], comment: FeedComment): FeedComment[] => {
  const commentId = String(comment.id)
  const parentId = comment.parentCommentId ? String(comment.parentCommentId) : null

  if (!parentId) {
    return items.some((item) => String(item.id) === commentId) ? items : [comment, ...items]
  }

  return items.map((item) => {
    if (String(item.id) === parentId) {
      const alreadyExists = (item.replies || []).some((reply) => String(reply.id) === commentId)

      return {
        ...item,
        replies: alreadyExists ? item.replies || [] : [...(item.replies || []), comment],
      }
    }

    return {
      ...item,
      replies: item.replies ? appendCommentOnce(item.replies, comment) : [],
    }
  })
}

const removeCommentById = (items: FeedComment[], commentId?: string | number): FeedComment[] => {
  const id = String(commentId || '')

  return items
    .filter((item) => String(item.id) !== id)
    .map((item) => ({
      ...item,
      replies: item.replies ? removeCommentById(item.replies, id) : [],
    }))
}

export default function PostDetailPage() {
  const navigate = useNavigate()
  const params = useParams<{ id: string }>()
  const postId = String(params.id || '').trim()

  const token = useAuthStore((state) => state.accessToken)
  const me = useAuthStore((state) => state.user)

  const [post, setPost] = useState<FeedPost | null>(null)
  const [comments, setComments] = useState<FeedComment[]>([])
  const [commentInput, setCommentInput] = useState('')
  const [loading, setLoading] = useState(true)
  const [reloading, setReloading] = useState(false)
  const [submittingComment, setSubmittingComment] = useState(false)
  const [showReactionPicker, setShowReactionPicker] = useState(false)
  const [replyingToCommentIds, setReplyingToCommentIds] = useState<Record<string, boolean>>({})
  const [replyInputs, setReplyInputs] = useState<Record<string, string>>({})
  const [busyCommentId, setBusyCommentId] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const reactionPickerRef = useRef<HTMLDivElement>(null)
  const commentTextareaRef = useRef<HTMLTextAreaElement>(null)
  const commentSectionRef = useRef<HTMLElement>(null)

  const loadData = async (silent = false) => {
    if (!postId) {
      setLoading(false)
      setPost(null)
      setComments([])
      return
    }

    if (silent) {
      setReloading(true)
    } else {
      setLoading(true)
    }

    try {
      const [postRes, commentRes] = await Promise.all([
        api.getPost(postId, token || undefined),
        api.listComments(postId, token || undefined),
      ])

      setPost(postRes.post || null)
      setComments(commentRes.comments || [])
    } catch (error) {
      console.error('Không thể tải chi tiết bài viết', error)
    } finally {
      setLoading(false)
      setReloading(false)
    }
  }

  useEffect(() => {
    void loadData()
  }, [postId, token])

  useEffect(() => {
    if (!token || !me?.id || !postId) return

    const socket = connectSocket(token, me.id)
    const isThisPost = (value: unknown) => String(value || '') === String(postId)

    const onPostUpdated = (payload: { post?: FeedPost }) => {
      if (payload?.post && isThisPost(payload.post.id)) {
        setPost(payload.post)
      }
    }

    const onPostDeleted = (payload: { postId?: number | string }) => {
      if (isThisPost(payload?.postId)) {
        setPost(null)
      }
    }

    const onPostReaction = (payload: {
      postId?: number | string
      actorId?: number | string
      reaction?: string | null
      reactionCount?: number
    }) => {
      if (!isThisPost(payload?.postId)) return

      setPost((current) =>
        current
          ? {
              ...current,
              reactionCount: Number(payload.reactionCount ?? current.reactionCount),
              viewerReaction:
                String(payload.actorId || '') === String(me.id)
                  ? payload.reaction || null
                  : current.viewerReaction,
            }
          : current,
      )
    }

    const onCommentCreated = (payload: {
      postId?: number | string
      comment?: FeedComment
      commentCount?: number
    }) => {
      if (!isThisPost(payload?.postId)) return

      if (payload.comment) {
        setComments((prev) => appendCommentOnce(prev, payload.comment as FeedComment))
      }

      setPost((current) =>
        current
          ? {
              ...current,
              commentCount: Number(payload.commentCount ?? current.commentCount + 1),
            }
          : current,
      )
    }

    const onCommentDeleted = (payload: {
      postId?: number | string
      commentId?: number | string
      commentCount?: number
    }) => {
      if (!isThisPost(payload?.postId)) return

      setComments((prev) => removeCommentById(prev, payload.commentId))

      setPost((current) =>
        current
          ? {
              ...current,
              commentCount: Number(payload.commentCount ?? Math.max(0, current.commentCount - 1)),
            }
          : current,
      )
    }

    const onAvatarUpdated = (payload: { userId?: number | string; avatarUrl?: string }) => {
      const avatarUrl = resolveApiAssetUrl(payload?.avatarUrl) ?? payload?.avatarUrl ?? null

      setPost((current) =>
        current && String(current.authorId) === String(payload?.userId)
          ? { ...current, authorAvatar: avatarUrl }
          : current,
      )

      setComments((prev) =>
        prev.map((comment) =>
          String(comment.userId) === String(payload?.userId)
            ? { ...comment, authorAvatar: avatarUrl }
            : comment,
        ),
      )
    }

    socket.on('post:updated', onPostUpdated)
    socket.on('post:deleted', onPostDeleted)
    socket.on('post:reaction', onPostReaction)
    socket.on('comment:created', onCommentCreated)
    socket.on('comment:deleted', onCommentDeleted)
    socket.on('user:avatar-updated', onAvatarUpdated)

    return () => {
      socket.off('post:updated', onPostUpdated)
      socket.off('post:deleted', onPostDeleted)
      socket.off('post:reaction', onPostReaction)
      socket.off('comment:created', onCommentCreated)
      socket.off('comment:deleted', onCommentDeleted)
      socket.off('user:avatar-updated', onAvatarUpdated)
    }
  }, [me?.id, postId, token])

  useEffect(() => {
    if (!showReactionPicker) return

    const handleClickOutside = (event: MouseEvent) => {
      if (reactionPickerRef.current && !reactionPickerRef.current.contains(event.target as Node)) {
        setShowReactionPicker(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)

    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showReactionPicker])

  const createdAtText = useMemo(() => formatDateTime(post?.createdAt), [post?.createdAt])
  const relativeCreatedAtText = useMemo(() => getRelativeTime(post?.createdAt), [post?.createdAt])

  const totalComments = useMemo(() => countAllComments(comments), [comments])

  const currentReaction = useMemo(() => {
    if (!post?.viewerReaction) return null
    return POST_REACTIONS.find((reaction) => reaction.type === post.viewerReaction) || null
  }, [post?.viewerReaction])

  const handleReactPost = async (type: ReactionType) => {
    if (!token || !post) return

    const oldPost = post
    const isSameReaction = post.viewerReaction === type

    setShowReactionPicker(false)

    setPost({
      ...post,
      viewerReaction: isSameReaction ? null : type,
      reactionCount: Math.max(0, post.reactionCount + (isSameReaction ? -1 : post.viewerReaction ? 0 : 1)),
    })

    try {
      const response = isSameReaction
        ? await api.unreactPost(token, post.id)
        : await api.reactPost(token, post.id, type)

      setPost(response.post)
    } catch (error) {
      setPost(oldPost)
      console.error('Không thể thả cảm xúc', error)
    }
  }

  const handleFocusComment = () => {
    commentSectionRef.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    })

    window.setTimeout(() => {
      commentTextareaRef.current?.focus()
    }, 350)
  }

  const handleAddComment = async () => {
    const value = commentInput.trim()

    if (!token || !value || !postId || submittingComment) return

    setSubmittingComment(true)

    try {
      const response = await api.addComment(token, postId, value)

      setComments((prev) => appendCommentOnce(prev, normalizeFeedComment(response.comment)))
      setPost((current) =>
        current ? { ...current, commentCount: current.commentCount + 1 } : current,
      )
      setCommentInput('')
    } catch (error) {
      console.error('Không thể thêm bình luận', error)
    } finally {
      setSubmittingComment(false)
    }
  }

  const handleAddReply = async (comment: FeedComment) => {
    const key = String(comment.id)
    const value = (replyInputs[key] || '').trim()

    if (!token || !value || busyCommentId) return

    setBusyCommentId(key)

    try {
      const response = await api.addCommentReply(token, comment.id, value)

      setComments((prev) => appendCommentOnce(prev, normalizeFeedComment(response.comment)))
      setPost((current) =>
        current ? { ...current, commentCount: current.commentCount + 1 } : current,
      )
      setReplyInputs((prev) => ({ ...prev, [key]: '' }))
      setReplyingToCommentIds((prev) => ({ ...prev, [key]: false }))
    } catch (error) {
      console.error('Không thể gửi phản hồi', error)
    } finally {
      setBusyCommentId(null)
    }
  }

  const handleSharePost = async () => {
    const url = window.location.href

    try {
      if (navigator.share) {
        await navigator.share({
          title: 'ZChat - Chi tiết bài viết',
          text: post?.content || 'Xem bài viết này trên ZChat',
          url,
        })
        return
      }

      await navigator.clipboard.writeText(url)
      setCopied(true)

      window.setTimeout(() => {
        setCopied(false)
      }, 1600)
    } catch (error) {
      console.error('Không thể chia sẻ bài viết', error)
    }
  }

  const renderComment = (comment: FeedComment, depth = 0): React.ReactNode => {
    const key = String(comment.id)
    const showReplyForm = replyingToCommentIds[key]
    const canReply = Boolean(token && depth < 3)

    return (
      <div
        key={comment.id}
        className={`${styles.commentItem} ${depth > 0 ? styles.commentReply : ''}`}
      >
        <Link to={`/profile/${comment.userId}`} className={styles.commentAvatarLink}>
          <Avatar className={styles.commentAvatar}>
            <AvatarImage src={comment.authorAvatar || ''} />
            <AvatarFallback>{comment.authorName?.[0] || 'U'}</AvatarFallback>
          </Avatar>
        </Link>

        <div className={styles.commentContent}>
          <div className={styles.commentBubble}>
            <div className={styles.commentTop}>
              <Link to={`/profile/${comment.userId}`} className={styles.commentAuthor}>
                {comment.authorName || 'Người dùng'}
              </Link>
              <span>{getRelativeTime(comment.createdAt)}</span>
            </div>

            {comment.content ? <p className={styles.commentText}>{comment.content}</p> : null}

            {comment.imageUrl ? (
              <img
                src={comment.imageUrl}
                alt="Ảnh trong bình luận"
                className={styles.commentImage}
                loading="lazy"
              />
            ) : null}
          </div>

          <div className={styles.commentActions}>
            <span title={formatDateTime(comment.createdAt)}>
              <Clock3 size={13} />
              {formatDateTime(comment.createdAt)}
            </span>

            {canReply ? (
              <button
                type="button"
                onClick={() =>
                  setReplyingToCommentIds((prev) => ({
                    ...prev,
                    [key]: !prev[key],
                  }))
                }
              >
                {showReplyForm ? 'Hủy' : 'Trả lời'}
              </button>
            ) : null}
          </div>

          {showReplyForm ? (
            <div className={styles.replyForm}>
              <input
                className={styles.replyInput}
                value={replyInputs[key] || ''}
                onChange={(event) =>
                  setReplyInputs((prev) => ({
                    ...prev,
                    [key]: event.target.value,
                  }))
                }
                placeholder={`Trả lời ${comment.authorName || 'người dùng'}...`}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault()
                    void handleAddReply(comment)
                  }
                }}
                autoFocus
              />

              <button
                type="button"
                className={styles.replySubmit}
                onClick={() => void handleAddReply(comment)}
                disabled={busyCommentId === key || !replyInputs[key]?.trim()}
              >
                {busyCommentId === key ? 'Đang gửi...' : 'Gửi'}
              </button>
            </div>
          ) : null}

          {comment.replies && comment.replies.length > 0 ? (
            <div className={styles.replyList}>
              {comment.replies.map((reply) => renderComment(reply, depth + 1))}
            </div>
          ) : null}
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <main className={styles.page}>
        <div className={styles.backgroundBlurOne} />
        <div className={styles.backgroundBlurTwo} />

        <div className={styles.container}>
          <div className={styles.pageHeader}>
            <Skeleton className={styles.skeletonBack} />
            <div>
              <Skeleton className={styles.skeletonTitle} />
              <Skeleton className={styles.skeletonSubtitle} />
            </div>
          </div>

          <div className={styles.layout}>
            <section className={styles.mainColumn}>
              <div className={styles.postCard}>
                <Skeleton className={styles.skeletonHeader} />
                <Skeleton className={styles.skeletonText} />
                <Skeleton className={styles.skeletonTextShort} />
                <Skeleton className={styles.skeletonMedia} />
              </div>

              <div className={styles.commentCard}>
                <Skeleton className={styles.skeletonText} />
                <Skeleton className={styles.skeletonTextShort} />
              </div>
            </section>

            <aside className={styles.sideColumn}>
              <Skeleton className={styles.skeletonSide} />
            </aside>
          </div>
        </div>
      </main>
    )
  }

  if (!post) {
    return (
      <main className={styles.page}>
        <div className={styles.container}>
          <div className={styles.emptyState}>
            <Sparkles size={46} />
            <h1>Không tìm thấy bài viết</h1>
            <p>Bài viết có thể đã bị xóa, bị ẩn hoặc đường dẫn không còn hợp lệ.</p>

            <div className={styles.emptyActions}>
              <button type="button" className={styles.primaryBtn} onClick={() => navigate('/')}>
                <ArrowLeft size={18} />
                Về trang chủ
              </button>

              <button type="button" className={styles.secondaryBtn} onClick={() => void loadData()}>
                <RefreshCw size={18} />
                Tải lại
              </button>
            </div>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className={styles.page}>
      <div className={styles.backgroundBlurOne} />
      <div className={styles.backgroundBlurTwo} />

      <div className={styles.container}>
        <div className={styles.pageHeader}>
          <button type="button" className={styles.backLink} onClick={() => navigate(-1)}>
            <ArrowLeft size={18} />
            Quay lại
          </button>

          <div>
            <span className={styles.pageBadge}>
              <Sparkles size={15} />
              Bài viết realtime
            </span>
            <h1>Chi tiết bài viết</h1>
            <p>Theo dõi nội dung, cảm xúc và bình luận mới nhất.</p>
          </div>

          <button
            type="button"
            className={styles.refreshBtn}
            onClick={() => void loadData(true)}
            disabled={reloading}
          >
            <RefreshCw size={17} className={reloading ? styles.spinIcon : ''} />
            Làm mới
          </button>
        </div>

        <div className={styles.layout}>
          <section className={styles.mainColumn}>
            <article className={styles.postCard}>
              <header className={styles.postHeader}>
                <div className={styles.authorBlock}>
                  <Link to={`/profile/${post.authorId}`}>
                    <Avatar className={styles.postAvatar}>
                      <AvatarImage src={post.authorAvatar || ''} />
                      <AvatarFallback>{post.authorName?.[0] || 'U'}</AvatarFallback>
                    </Avatar>
                  </Link>

                  <div>
                    <Link to={`/profile/${post.authorId}`} className={styles.authorName}>
                      {post.authorName || 'Người dùng'}
                    </Link>
                    <div className={styles.postTimeRow}>
                      <span>{relativeCreatedAtText}</span>
                      <span>•</span>
                      <span>{createdAtText}</span>
                    </div>
                  </div>
                </div>

                <button type="button" className={styles.iconBtn}>
                  <MoreHorizontal size={20} />
                </button>
              </header>

              {post.content ? (
                <div className={styles.postContentBox}>
                  <p className={styles.postContent}>{post.content}</p>
                </div>
              ) : (
                <div className={styles.noContentBox}>
                  <Sparkles size={18} />
                  Bài viết này không có nội dung chữ.
                </div>
              )}

              {post.mediaUrl ? (
                <div className={styles.mediaFrame}>
                  {isVideoMediaUrl(post.mediaUrl) ? (
                    <video
                      src={post.mediaUrl}
                      className={styles.postMedia}
                      controls
                      preload="metadata"
                    />
                  ) : (
                    <img
                      src={post.mediaUrl}
                      alt="Ảnh bài viết"
                      className={styles.postMedia}
                      loading="lazy"
                      onError={(event) => {
                        event.currentTarget.style.display = 'none'
                      }}
                    />
                  )}
                </div>
              ) : null}

              <div className={styles.statRow}>
                <div className={styles.statLeft}>
                  <span className={styles.reactionBadge}>{currentReaction?.emoji || '👍'}</span>
                  <span>{post.reactionCount} lượt cảm xúc</span>
                </div>

                <button type="button" onClick={handleFocusComment}>
                  {totalComments || post.commentCount} bình luận
                </button>
              </div>

              <div className={styles.actionBar}>
                {token ? (
                  <div className={styles.reactionWrap} ref={reactionPickerRef}>
                    <button
                      type="button"
                      className={`${styles.actionBtn} ${
                        currentReaction ? styles.actionBtnActive : ''
                      }`}
                      onClick={() => setShowReactionPicker((value) => !value)}
                    >
                      {currentReaction ? (
                        <>
                          <span>{currentReaction.emoji}</span>
                          {currentReaction.label}
                        </>
                      ) : (
                        <>
                          <Heart size={18} />
                          Thích
                        </>
                      )}
                    </button>

                    {showReactionPicker ? (
                      <div className={styles.reactionPicker}>
                        {POST_REACTIONS.map((reaction) => (
                          <button
                            key={reaction.type}
                            type="button"
                            className={`${styles.reactionOption} ${
                              post.viewerReaction === reaction.type
                                ? styles.reactionOptionActive
                                : ''
                            }`}
                            onClick={() => void handleReactPost(reaction.type)}
                            title={reaction.label}
                          >
                            <span>{reaction.emoji}</span>
                            <small>{reaction.label}</small>
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <button type="button" className={styles.actionBtn} disabled>
                    <Heart size={18} />
                    Thích
                  </button>
                )}

                <button type="button" className={styles.actionBtn} onClick={handleFocusComment}>
                  <MessageCircle size={18} />
                  Bình luận
                </button>

                <button type="button" className={styles.actionBtn} onClick={() => void handleSharePost()}>
                  {copied ? <Copy size={18} /> : <Share2 size={18} />}
                  {copied ? 'Đã copy' : 'Chia sẻ'}
                </button>
              </div>
            </article>

            <section className={styles.commentCard} ref={commentSectionRef}>
              <div className={styles.commentHeader}>
                <div>
                  <h2>Bình luận</h2>
                  <p>{totalComments} bình luận đang hiển thị trong bài viết này</p>
                </div>

                <button type="button" onClick={() => void loadData(true)} disabled={reloading}>
                  <RefreshCw size={15} className={reloading ? styles.spinIcon : ''} />
                  Cập nhật
                </button>
              </div>

              {token ? (
                <div className={styles.commentForm}>
                  <Avatar className={styles.myAvatar}>
                    <AvatarImage src={me?.avatarUrl || ''} />
                    <AvatarFallback>{me?.name?.[0] || 'U'}</AvatarFallback>
                  </Avatar>

                  <div className={styles.commentInputWrap}>
                    <textarea
                      ref={commentTextareaRef}
                      value={commentInput}
                      onChange={(event) => setCommentInput(event.target.value)}
                      placeholder="Viết bình luận của bạn..."
                      className={styles.commentTextarea}
                      rows={2}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' && !event.shiftKey) {
                          event.preventDefault()
                          void handleAddComment()
                        }
                      }}
                    />

                    <button
                      type="button"
                      onClick={() => void handleAddComment()}
                      disabled={!commentInput.trim() || submittingComment}
                      className={styles.submitBtn}
                    >
                      {submittingComment ? <RefreshCw size={17} className={styles.spinIcon} /> : <Send size={17} />}
                    </button>
                  </div>
                </div>
              ) : (
                <div className={styles.loginNotice}>
                  <div>
                    <ShieldCheck size={20} />
                    <p>Đăng nhập để thả cảm xúc và bình luận bài viết.</p>
                  </div>
                  <Link to="/auth/login">Đăng nhập</Link>
                </div>
              )}

              <div className={styles.commentList}>
                {comments.length > 0 ? (
                  comments.map((comment) => renderComment(comment))
                ) : (
                  <div className={styles.emptyComments}>
                    <MessageCircle size={38} />
                    <p>Chưa có bình luận nào.</p>
                    <span>Hãy là người đầu tiên mở đầu cuộc trò chuyện.</span>
                  </div>
                )}
              </div>
            </section>
          </section>

          <aside className={styles.sideColumn}>
            <div className={styles.sideCard}>
              <div className={styles.sideTitle}>
                <UserRound size={19} />
                <h3>Tác giả</h3>
              </div>

              <div className={styles.authorMiniCard}>
                <Avatar className={styles.sideAvatar}>
                  <AvatarImage src={post.authorAvatar || ''} />
                  <AvatarFallback>{post.authorName?.[0] || 'U'}</AvatarFallback>
                </Avatar>

                <div>
                  <Link to={`/profile/${post.authorId}`}>{post.authorName || 'Người dùng'}</Link>
                  <span>Người đăng bài</span>
                </div>
              </div>
            </div>

            <div className={styles.sideCard}>
              <div className={styles.sideTitle}>
                <Sparkles size={19} />
                <h3>Thống kê</h3>
              </div>

              <div className={styles.sideStat}>
                <span>Lượt cảm xúc</span>
                <strong>{post.reactionCount}</strong>
              </div>

              <div className={styles.sideStat}>
                <span>Bình luận</span>
                <strong>{totalComments || post.commentCount}</strong>
              </div>

              <div className={styles.sideStat}>
                <span>Trạng thái</span>
                <strong>Realtime</strong>
              </div>
            </div>

            <div className={styles.sideCard}>
              <div className={styles.sideTitle}>
                <ShieldCheck size={19} />
                <h3>Gợi ý tương tác</h3>
              </div>

              <p className={styles.sideText}>
                Thả cảm xúc, bình luận hoặc chia sẻ bài viết để tăng tương tác và giúp hệ thống đề xuất
                nội dung phù hợp hơn.
              </p>
            </div>
          </aside>
        </div>
      </div>
    </main>
  )
}