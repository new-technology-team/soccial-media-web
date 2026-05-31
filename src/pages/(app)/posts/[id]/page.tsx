'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type React from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  Heart,
  MessageCircle,
  MoreHorizontal,
  Send,
  Share2,
  Sparkles,
} from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Skeleton } from '@/components/ui/skeleton'
import { api, normalizeFeedComment, resolveApiAssetUrl } from '@/api/client'
import { useAuthStore } from '@/contexts/auth-store'
import { connectSocket } from '@/services/socket'
import type { FeedComment, FeedPost } from '@/types'
import styles from './page.module.css'

const isVideoMediaUrl = (url: string) =>
  /\.(mp4|webm|ogg|mov|m4v|avi|mkv)(\?.*)?$/i.test(url) || url.includes('/video/')

const POST_REACTIONS = [
  { type: 'like', emoji: '👍', label: 'Thích' },
  { type: 'love', emoji: '❤️', label: 'Yêu thích' },
  { type: 'haha', emoji: '😆', label: 'Haha' },
  { type: 'wow', emoji: '😮', label: 'Wow' },
  { type: 'sad', emoji: '😢', label: 'Buồn' },
  { type: 'angry', emoji: '😡', label: 'Phẫn nộ' },
] as const

const appendCommentOnce = (items: FeedComment[], comment: FeedComment): FeedComment[] => {
  const commentId = String(comment.id)
  const parentId = comment.parentCommentId ? String(comment.parentCommentId) : null

  if (!parentId) {
    return items.some((item) => String(item.id) === commentId) ? items : [...items, comment]
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

export default function PostDetailPage() {
  const params = useParams<{ id: string }>()
  const postId = String(params.id || '').trim()

  const token = useAuthStore((state) => state.accessToken)
  const me = useAuthStore((state) => state.user)

  const [post, setPost] = useState<FeedPost | null>(null)
  const [comments, setComments] = useState<FeedComment[]>([])
  const [commentInput, setCommentInput] = useState('')
  const [loading, setLoading] = useState(true)
  const [showReactionPicker, setShowReactionPicker] = useState(false)
  const [replyingToCommentIds, setReplyingToCommentIds] = useState<Record<string, boolean>>({})
  const [replyInputs, setReplyInputs] = useState<Record<string, string>>({})
  const [busyCommentId, setBusyCommentId] = useState<string | null>(null)

  const reactionPickerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!postId) {
      setLoading(false)
      setPost(null)
      setComments([])
      return
    }

    const loadData = async () => {
      setLoading(true)

      try {
        const [postRes, commentRes] = await Promise.all([
          api.getPost(postId, token || undefined),
          api.listComments(postId, token || undefined),
        ])

        setPost(postRes.post || null)
        setComments(commentRes.comments)
      } catch (error) {
        console.error('Không thể tải chi tiết bài viết', error)
      } finally {
        setLoading(false)
      }
    }

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
      parentCommentId?: string | null
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

      setComments((prev) => prev.filter((item) => String(item.id) !== String(payload.commentId)))

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

  const createdAtText = useMemo(() => {
    if (!post) return ''
    return new Date(post.createdAt).toLocaleString('vi-VN')
  }, [post])

  const currentReaction = useMemo(() => {
    if (!post?.viewerReaction) return null
    return POST_REACTIONS.find((reaction) => reaction.type === post.viewerReaction) || null
  }, [post?.viewerReaction])

  const handleReactPost = async (type: string) => {
    if (!token || !post) return

    setShowReactionPicker(false)

    try {
      const response =
        post.viewerReaction === type
          ? await api.unreactPost(token, post.id)
          : await api.reactPost(token, post.id, type)

      setPost(response.post)
    } catch (error) {
      console.error('Không thể thả cảm xúc', error)
    }
  }

  const handleAddComment = async () => {
    const value = commentInput.trim()

    if (!token || !value || !postId) return

    try {
      const response = await api.addComment(token, postId, value)

      setComments((prev) => appendCommentOnce(prev, response.comment))
      setPost((current) =>
        current ? { ...current, commentCount: current.commentCount + 1 } : current,
      )
      setCommentInput('')
    } catch (error) {
      console.error('Không thể thêm bình luận', error)
    }
  }

  const handleAddReply = async (comment: FeedComment) => {
    const key = String(comment.id)
    const value = (replyInputs[key] || '').trim()

    if (!token || !value) return

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

  const renderComment = (comment: FeedComment, depth = 0): React.ReactNode => {
    const key = String(comment.id)
    const showReplyForm = replyingToCommentIds[key]

    return (
      <div
        key={comment.id}
        className={`${styles.commentItem} ${depth > 0 ? styles.commentReply : ''}`}
      >
        <Avatar className={styles.commentAvatar}>
          <AvatarImage src={comment.authorAvatar || ''} />
          <AvatarFallback>{comment.authorName?.[0] || 'U'}</AvatarFallback>
        </Avatar>

        <div className={styles.commentContent}>
          <div className={styles.commentBubble}>
            <Link to={`/profile/${comment.userId}`} className={styles.commentAuthor}>
              {comment.authorName}
            </Link>

            {comment.content ? <p className={styles.commentText}>{comment.content}</p> : null}

            {comment.imageUrl ? (
              <img
                src={comment.imageUrl}
                alt="Comment attachment"
                className={styles.commentImage}
                loading="lazy"
              />
            ) : null}
          </div>

          <div className={styles.commentActions}>
            <span>{new Date(comment.createdAt).toLocaleString('vi-VN')}</span>

            {token ? (
              <button
                type="button"
                onClick={() =>
                  setReplyingToCommentIds((prev) => ({
                    ...prev,
                    [key]: !prev[key],
                  }))
                }
              >
                Trả lời
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
                placeholder={`Trả lời ${comment.authorName}...`}
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
                {busyCommentId === key ? '...' : 'Gửi'}
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
        <div className={styles.container}>
          <div className={styles.layout}>
            <section className={styles.mainColumn}>
              <div className={styles.postCard}>
                <Skeleton className={styles.skeletonHeader} />
                <Skeleton className={styles.skeletonText} />
                <Skeleton className={styles.skeletonTextShort} />
                <Skeleton className={styles.skeletonMedia} />
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
            <Sparkles size={42} />
            <h1>Không tìm thấy bài viết</h1>
            <p>Bài viết có thể đã bị xóa hoặc không còn tồn tại.</p>
            <Link to="/" className={styles.primaryBtn}>
              <ArrowLeft size={18} />
              Quay về trang chủ
            </Link>
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
          <Link to="/" className={styles.backLink}>
            <ArrowLeft size={18} />
            Quay lại
          </Link>

          <div>
            <h1>Chi tiết bài viết</h1>
            <p>Xem bài viết, cảm xúc và bình luận theo thời gian thực.</p>
          </div>
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
                      {post.authorName}
                    </Link>
                    <p className={styles.postTime}>{createdAtText}</p>
                  </div>
                </div>

                <button type="button" className={styles.iconBtn}>
                  <MoreHorizontal size={20} />
                </button>
              </header>

              {post.content ? <p className={styles.postContent}>{post.content}</p> : null}

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
                <div>
                  <span className={styles.reactionBadge}>
                    {currentReaction?.emoji || '👍'}
                  </span>
                  <span>{post.reactionCount} lượt cảm xúc</span>
                </div>

                <div>
                  <span>{post.commentCount} bình luận</span>
                </div>
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
                            {reaction.emoji}
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

                <button type="button" className={styles.actionBtn}>
                  <MessageCircle size={18} />
                  Bình luận
                </button>

                <button type="button" className={styles.actionBtn}>
                  <Share2 size={18} />
                  Chia sẻ
                </button>
              </div>
            </article>

            <section className={styles.commentCard}>
              <div className={styles.commentHeader}>
                <div>
                  <h2>Bình luận</h2>
                  <p>{comments.length} bình luận trong bài viết này</p>
                </div>
              </div>

              {token ? (
                <div className={styles.commentForm}>
                  <Avatar className={styles.myAvatar}>
                    <AvatarImage src={me?.avatarUrl || ''} />
                    <AvatarFallback>{me?.name?.[0] || 'U'}</AvatarFallback>
                  </Avatar>

                  <div className={styles.commentInputWrap}>
                    <textarea
                      value={commentInput}
                      onChange={(event) => setCommentInput(event.target.value)}
                      placeholder="Viết bình luận của bạn..."
                      className={styles.commentTextarea}
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
                      disabled={!commentInput.trim()}
                      className={styles.submitBtn}
                    >
                      <Send size={17} />
                    </button>
                  </div>
                </div>
              ) : (
                <div className={styles.loginNotice}>
                  <p>Đăng nhập để thả cảm xúc và bình luận bài viết.</p>
                  <Link to="/auth/login">Đăng nhập</Link>
                </div>
              )}

              <div className={styles.commentList}>
                {comments.length > 0 ? (
                  comments.map((comment) => renderComment(comment))
                ) : (
                  <div className={styles.emptyComments}>
                    <MessageCircle size={34} />
                    <p>Chưa có bình luận nào.</p>
                    <span>Hãy là người đầu tiên bình luận bài viết này.</span>
                  </div>
                )}
              </div>
            </section>
          </section>

          <aside className={styles.sideColumn}>
            <div className={styles.sideCard}>
              <h3>Thông tin bài viết</h3>

              <div className={styles.sideStat}>
                <span>Lượt cảm xúc</span>
                <strong>{post.reactionCount}</strong>
              </div>

              <div className={styles.sideStat}>
                <span>Bình luận</span>
                <strong>{post.commentCount}</strong>
              </div>

              <div className={styles.sideStat}>
                <span>Người đăng</span>
                <strong>{post.authorName}</strong>
              </div>
            </div>

            <div className={styles.sideCard}>
              <h3>Gợi ý</h3>
              <p className={styles.sideText}>
                Tương tác với bài viết để nhận thêm nội dung phù hợp với sở thích của bạn.
              </p>
            </div>
          </aside>
        </div>
      </div>
    </main>
  )
}