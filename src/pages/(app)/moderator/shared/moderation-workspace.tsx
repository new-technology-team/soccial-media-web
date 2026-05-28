'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowRight, CheckCircle2, FileText, Search, ShieldAlert, UserRound } from 'lucide-react'

import { api } from '@/api/client'
import { AppDialog, DialogButton } from '@/components/dialogs'
import { useAuthStore } from '@/contexts/auth-store'
import { toast } from '@/hooks/use-toast'
import type { FeedPost, User } from '@/types'
import styles from './moderation-workspace.module.css'

type ReportRecord = Record<string, unknown>

type ReportType = 'post' | 'comment' | 'message' | 'user'
type ReportStatus = 'PENDING' | 'IN_REVIEW' | 'RESOLVED' | 'REJECTED'
type FilterStatus = ReportStatus | 'all'
type Severity = 'critical' | 'high' | 'medium' | 'low' | 'all'
type SortMode = 'priority' | 'newest'

type TargetAction =
  | 'none'
  | 'hide_post'
  | 'delete_post'
  | 'delete_comment'
  | 'delete_message'
  | 'warn_user'
  | 'restrict_user'
  | 'temp_lock_user'

type WorkspaceProps = {
  title: string
  description: string
  allowedTypes?: ReportType[]
  initialStatus?: FilterStatus
  initialReportId?: number | null
  defaultMode?: 'queue' | 'history'
}

type NormalizedReport = {
  reportId: number
  raw: ReportRecord
  reportType: ReportType
  status: ReportStatus
  reason: string
  description: string
  targetId: string
  severity: Severity
  aiScore: number
  createdAt: string
  updatedAt: string
  resolutionNote: string | null
  reviewerId: number | null
  resolvedBy: number | null
  assignedTo: number | null
  reporterLabel: string
  targetLabel: string
  targetPreview: string
  mediaUrl: string | null
  originalContent: string
}

const REPORT_STATUS_LABEL: Record<ReportStatus, string> = {
  PENDING: 'Chờ xử lý',
  IN_REVIEW: 'Đang xem xét',
  RESOLVED: 'Đã xử lý',
  REJECTED: 'Đã từ chối',
}

const REPORT_STATUS_CLASS: Record<ReportStatus, string> = {
  PENDING: styles.tagPending,
  IN_REVIEW: styles.tagReviewing,
  RESOLVED: styles.tagResolved,
  REJECTED: styles.tagRejected,
}

const REPORT_TYPE_LABEL: Record<ReportType, string> = {
  post: 'Bài viết',
  comment: 'Bình luận',
  message: 'Tin nhắn',
  user: 'Tài khoản',
}

const SEVERITY_RANK: Record<Exclude<Severity, 'all'>, number> = {
  critical: 1,
  high: 2,
  medium: 3,
  low: 4,
}

const TARGET_ACTION_LABEL: Record<TargetAction, string> = {
  none: 'Chỉ cập nhật báo cáo',
  hide_post: 'Ẩn bài viết',
  delete_post: 'Xóa bài viết',
  delete_comment: 'Xóa bình luận',
  delete_message: 'Xóa tin nhắn',
  warn_user: 'Cảnh cáo tài khoản',
  restrict_user: 'Hạn chế tương tác',
  temp_lock_user: 'Khóa tạm thời',
}

const toLower = (value: unknown) => String(value || '').toLowerCase()
const toUpper = (value: unknown) => String(value || '').toUpperCase()

const normalizeReportType = (value: unknown): ReportType => {
  const raw = toLower(value)
  if (raw === 'comment' || raw === 'message' || raw === 'user') return raw
  return 'post'
}

const normalizeStatus = (value: unknown): ReportStatus => {
  const raw = toUpper(value)
  if (raw === 'IN_REVIEW' || raw === 'RESOLVED' || raw === 'REJECTED') return raw
  return 'PENDING'
}

const computeSeverity = (report: ReportRecord, index: number): Severity => {
  const score = Number(report.aiScore || report.moderationScore || 0)
  if (score >= 90) return 'critical'
  if (score >= 75) return 'high'
  if (score >= 55) return 'medium'
  if (String(report.reason || report.description || '').toLowerCase().includes('spam')) return 'medium'
  return index % 2 === 0 ? 'low' : 'medium'
}

const normalizeReport = (report: ReportRecord, index = 0): NormalizedReport => {
  const reportType = normalizeReportType(report.reportType || report.targetType || report.type)
  const rawTargetId = String(report.targetId || report.target_id || report.target || report.subjectId || '')
  const reason = String(report.reason || report.description || report.note || 'Không có mô tả')
  const description = String(report.description || report.details || reason)
  const targetLabel = REPORT_TYPE_LABEL[reportType]
  const reporterLabel = String(report.reporterName || report.reporter || report.userName || report.userId || 'Người dùng ẩn danh')
  const originalContent = String(
    report.originalContent || report.sourceContent || report.content || report.targetContent || report.message || report.summary || description,
  )
  const createdAt = String(report.createAt || report.createdAt || report.created_at || '')
  const updatedAt = String(report.updatedAt || report.updated_at || createdAt || '')

  return {
    reportId: Number(report.reportId || report.id || 0),
    raw: report,
    reportType,
    status: normalizeStatus(report.status),
    reason,
    description,
    targetId: rawTargetId,
    severity: (toLower(report.severity) as Severity) || computeSeverity(report, index),
    aiScore: Number(report.aiScore || report.moderationScore || Math.max(40, 95 - index * 5)),
    createdAt,
    updatedAt,
    resolutionNote: report.resolutionNote ? String(report.resolutionNote) : null,
    reviewerId: report.reviewerId ? Number(report.reviewerId) : null,
    resolvedBy: report.resolvedBy ? Number(report.resolvedBy) : null,
    assignedTo: report.assignedTo ? Number(report.assignedTo) : null,
    reporterLabel,
    targetLabel,
    targetPreview: String(report.targetPreview || report.targetTitle || report.subject || rawTargetId || `${targetLabel} #${rawTargetId}`),
    mediaUrl: report.mediaUrl ? String(report.mediaUrl) : null,
    originalContent,
  }
}

const formatTime = (value: string) => {
  if (!value) return 'Không rõ'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString('vi-VN')
}

const getTargetActionOptions = (reportType: ReportType): Array<{ value: TargetAction; label: string }> => {
  if (reportType === 'post') {
    return [
      { value: 'none', label: TARGET_ACTION_LABEL.none },
      { value: 'hide_post', label: TARGET_ACTION_LABEL.hide_post },
      { value: 'delete_post', label: TARGET_ACTION_LABEL.delete_post },
    ]
  }

  if (reportType === 'comment') {
    return [
      { value: 'none', label: TARGET_ACTION_LABEL.none },
      { value: 'delete_comment', label: TARGET_ACTION_LABEL.delete_comment },
    ]
  }

  if (reportType === 'message') {
    return [
      { value: 'none', label: TARGET_ACTION_LABEL.none },
      { value: 'delete_message', label: TARGET_ACTION_LABEL.delete_message },
    ]
  }

  return [
    { value: 'none', label: TARGET_ACTION_LABEL.none },
    { value: 'warn_user', label: TARGET_ACTION_LABEL.warn_user },
    { value: 'restrict_user', label: TARGET_ACTION_LABEL.restrict_user },
    { value: 'temp_lock_user', label: TARGET_ACTION_LABEL.temp_lock_user },
  ]
}

export default function ModeratorReportWorkspace({
  title,
  description,
  allowedTypes,
  initialStatus = 'all',
  initialReportId = null,
  defaultMode = 'queue',
}: WorkspaceProps) {
  const navigate = useNavigate()
  const token = useAuthStore((state) => state.accessToken)
  const user = useAuthStore((state) => state.user)
  const [reports, setReports] = useState<NormalizedReport[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<FilterStatus>(initialStatus)
  const [typeFilter, setTypeFilter] = useState<ReportType | 'all'>(allowedTypes?.[0] || 'all')
  const [severityFilter, setSeverityFilter] = useState<Severity>('all')
  const [sortMode, setSortMode] = useState<SortMode>('priority')
  const [page, setPage] = useState(1)
  const [selectedReport, setSelectedReport] = useState<NormalizedReport | null>(null)
  const [actionReport, setActionReport] = useState<NormalizedReport | null>(null)
  const [actionType, setActionType] = useState<TargetAction>('none')
  const [actionStatus, setActionStatus] = useState<ReportStatus>('RESOLVED')
  const [actionNote, setActionNote] = useState('')
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [assigningReportId, setAssigningReportId] = useState<number | null>(null)

  const canAccess = Boolean(user && (user.role === 'admin' || user.role === 'moderator'))

  const loadReports = useCallback(async () => {
    if (!token || !canAccess) return
    setLoading(true)
    try {
      const result = await api.moderationReports(token)
      const normalized = (result.reports || []).map((item, index) => normalizeReport(item, index))
      setReports(normalized)
    } catch (error) {
      toast({
        title: 'Không thể tải danh sách báo cáo',
        description: error instanceof Error ? error.message : 'Vui lòng thử lại sau.', variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [canAccess, token])

  const openDetail = useCallback(
    async (reportId: number) => {
      if (!token) return
      setDetailError('')
      setDetailLoading(true)
      try {
        const result = await api.getModerationReport(token, reportId)
        setSelectedReport(normalizeReport(result.report, 0))
      } catch (error) {
        setDetailError(error instanceof Error ? error.message : 'Không thể tải chi tiết báo cáo')
      } finally {
        setDetailLoading(false)
      }
    },
    [token],
  )

  useEffect(() => {
    void loadReports()
  }, [loadReports])

  useEffect(() => {
    if (initialReportId) {
      void openDetail(initialReportId)
    }
  }, [initialReportId, openDetail])

  useEffect(() => {
    setPage(1)
  }, [search, statusFilter, typeFilter, severityFilter, sortMode])

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    return reports
      .filter((report) => {
        if (allowedTypes?.length && !allowedTypes.includes(report.reportType)) return false
        if (defaultMode === 'history' && !['RESOLVED', 'REJECTED'].includes(report.status)) return false
        if (statusFilter !== 'all' && report.status !== statusFilter) return false
        if (typeFilter !== 'all' && report.reportType !== typeFilter) return false
        if (severityFilter !== 'all' && report.severity !== severityFilter) return false
        if (!query) return true
        return [report.reason, report.description, report.targetPreview, report.originalContent, report.reporterLabel, report.targetId]
          .join(' ')
          .toLowerCase()
          .includes(query)
      })
      .sort((a, b) => {
        if (sortMode === 'newest') return (new Date(b.createdAt).getTime() || 0) - (new Date(a.createdAt).getTime() || 0)
        const priorityA = SEVERITY_RANK[a.severity as Exclude<Severity, 'all'>] || 99
        const priorityB = SEVERITY_RANK[b.severity as Exclude<Severity, 'all'>] || 99
        return priorityA - priorityB || b.aiScore - a.aiScore
      })
  }, [allowedTypes, defaultMode, reports, search, severityFilter, sortMode, statusFilter, typeFilter])

  const summary = useMemo(() => {
    return {
      pending: filtered.filter((item) => item.status === 'PENDING').length,
      reviewing: filtered.filter((item) => item.status === 'IN_REVIEW').length,
      resolved: filtered.filter((item) => item.status === 'RESOLVED').length,
      critical: filtered.filter((item) => item.severity === 'critical').length,
    }
  }, [filtered])

  const pageSize = 8
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const visibleReports = filtered.slice((page - 1) * pageSize, page * pageSize)

  const handleBack = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      navigate(-1)
      return
    }
    navigate('/moderator/dashboard', { replace: true })
  }

  const refreshOne = (nextReport: ReportRecord) => {
    const normalized = normalizeReport(nextReport)
    setReports((prev) => prev.map((item) => (item.reportId === normalized.reportId ? normalized : item)))
    setSelectedReport((prev) => (prev && prev.reportId === normalized.reportId ? normalized : prev))
    setActionReport((prev) => (prev && prev.reportId === normalized.reportId ? normalized : prev))
  }

  const claimReport = async (report: NormalizedReport) => {
    if (!token || !user?.id) return
    setAssigningReportId(report.reportId)
    try {
      const response = await api.assignModerationReport(token, report.reportId, user.id)
      refreshOne(response.report)
      toast({
        title: `Đã nhận xử lý báo cáo #${report.reportId}`,
        description: 'Báo cáo đã được gán cho bạn và cập nhật realtime.',
      })
    } catch (error) {
      toast({
        title: 'Không thể nhận xử lý báo cáo',
        description: error instanceof Error ? error.message : 'Vui lòng thử lại.', variant: 'destructive',
      })
    } finally {
      setAssigningReportId(null)
    }
  }

  const performAction = async () => {
    if (!token || !actionReport) return
    setSubmitting(true)
    try {
      const report = actionReport
      const note = actionNote.trim()
      const reportId = report.reportId
      const statusNote = note || `Xử lý từ trang ${title}`

      const resolveReport = async (nextStatus: ReportStatus, resolutionNote: string) => {
        const response = await api.reviewModerationReport(token, reportId, { status: nextStatus, resolutionNote })
        refreshOne(response.report)
      }

      if (actionType === 'hide_post') {
        await api.moderatePost(token, Number(report.targetId), { status: 'hidden', resolutionNote: statusNote })
        toast({ title: `Đã ẩn bài viết #${report.targetId}`, description: 'Hành động kiểm duyệt đã được ghi nhận.' })
      } else if (actionType === 'delete_post') {
        await api.moderatePost(token, Number(report.targetId), { status: 'deleted', resolutionNote: statusNote })
        toast({ title: `Đã xóa bài viết #${report.targetId}`, description: 'Bài viết vi phạm đã được gỡ khỏi hệ thống.' })
      } else if (actionType === 'delete_comment') {
        await api.deleteComment(token, report.targetId)
        toast({ title: `Đã xóa bình luận #${report.targetId}`, description: 'Bình luận vi phạm đã được xử lý.' })
      } else if (actionType === 'delete_message') {
        await api.deleteMessage(token, report.targetId)
        toast({ title: `Đã xóa tin nhắn #${report.targetId}`, description: 'Tin nhắn vi phạm đã được gỡ khỏi cuộc trò chuyện.' })
      } else if (actionType === 'warn_user') {
        await api.warnModerationUser(token, Number(report.targetId), statusNote)
        toast({ title: `Đã cảnh cáo tài khoản #${report.targetId}`, description: 'Cảnh cáo đã được ghi vào lịch sử kiểm duyệt.' })
      } else if (actionType === 'restrict_user') {
        await api.restrictModerationUser(token, Number(report.targetId), statusNote)
        toast({ title: `Đã hạn chế tài khoản #${report.targetId}`, description: 'Tài khoản đã bị giới hạn tương tác.' })
      } else if (actionType === 'temp_lock_user') {
        await api.tempLockModerationUser(token, Number(report.targetId), statusNote)
        toast({ title: `Đã khóa tạm thời tài khoản #${report.targetId}`, description: 'Phiên làm việc của người dùng có thể đã bị thu hồi.' })
      }

      if (actionStatus !== 'PENDING' || actionType === 'none') {
        await resolveReport(actionStatus, statusNote)
      } else {
        await resolveReport('IN_REVIEW', statusNote)
      }

      toast({
        title: actionStatus === 'REJECTED' ? `Đã từ chối báo cáo #${reportId}` : `Đã xử lý báo cáo #${reportId}`,
        description: 'Trạng thái báo cáo và lịch sử xử lý đã được đồng bộ realtime.',
        variant: actionStatus === 'REJECTED' ? 'destructive' : 'default',
      })
      setActionReport(null)
      setActionNote('')
      setActionType('none')
      await loadReports()
    } catch (error) {
      toast({
        title: 'Không thể thực thi hành động',
        description: error instanceof Error ? error.message : 'Vui lòng thử lại.', variant: 'destructive',
      })
    } finally {
      setSubmitting(false)
    }
  }

  const openActionModal = (report: NormalizedReport) => {
    setActionReport(report)
    setActionType(getTargetActionOptions(report.reportType)[1]?.value || 'none')
    setActionStatus('RESOLVED')
    setActionNote(report.resolutionNote || '')
  }

  if (!canAccess) {
    return <div className={styles.denied}>Bạn không có quyền truy cập.</div>
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerTop}>
          <div>
            <p className={styles.eyebrow}>Kiểm duyệt viên</p>
            <h1>{title}</h1>
            <p>{description}</p>
          </div>
          <button type="button" className={styles.backButton} onClick={handleBack}>
            <ArrowLeft size={16} />
            Quay về
          </button>
        </div>
        <div className={styles.summaryGrid}>
          <div className={styles.summaryCard}><span>Chờ xử lý</span><strong>{summary.pending}</strong></div>
          <div className={styles.summaryCard}><span>Đang xem xét</span><strong>{summary.reviewing}</strong></div>
          <div className={styles.summaryCard}><span>Đã xử lý</span><strong>{summary.resolved}</strong></div>
          <div className={styles.summaryCard}><span>Critical</span><strong>{summary.critical}</strong></div>
        </div>
      </header>

      <section className={styles.toolbar} aria-label="Bộ lọc báo cáo">
        <input
          className={styles.searchBox}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Tìm báo cáo, nội dung, người report, target..."
          aria-label="Tìm kiếm báo cáo"
        />
        <select
          className={styles.select}
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value as FilterStatus)}
          aria-label="Lọc theo trạng thái"
          title="Lọc theo trạng thái"
        >
          <option value="all">Tất cả trạng thái</option>
          <option value="PENDING">Chờ xử lý</option>
          <option value="IN_REVIEW">Đang xem xét</option>
          <option value="RESOLVED">Đã xử lý</option>
          <option value="REJECTED">Đã từ chối</option>
        </select>
        <select
          className={styles.select}
          value={typeFilter}
          onChange={(event) => setTypeFilter(event.target.value as ReportType | 'all')}
          aria-label="Lọc theo loại báo cáo"
          title="Lọc theo loại báo cáo"
        >
          <option value="all">Tất cả loại</option>
          <option value="post">Bài viết</option>
          <option value="comment">Bình luận</option>
          <option value="message">Tin nhắn</option>
          <option value="user">Người dùng</option>
        </select>
        <select
          className={styles.select}
          value={severityFilter}
          onChange={(event) => setSeverityFilter(event.target.value as Severity)}
          aria-label="Lọc theo mức độ"
          title="Lọc theo mức độ"
        >
          <option value="all">Tất cả mức độ</option>
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
      </section>

      <section className={styles.listHeader}>
        <strong>{loading ? 'Đang tải báo cáo...' : `${filtered.length} báo cáo phù hợp`}</strong>
        <span>Sắp xếp theo</span>
        <select
          className={styles.select}
          value={sortMode}
          onChange={(event) => setSortMode(event.target.value as SortMode)}
          aria-label="Sắp xếp báo cáo"
          title="Sắp xếp báo cáo"
        >
          <option value="priority">Priority</option>
          <option value="newest">Newest</option>
        </select>
      </section>

      <section className={styles.list}>
        {loading ? <div className={styles.loadingState}>Đang tải danh sách báo cáo...</div> : null}
        {!loading && visibleReports.length === 0 ? <div className={styles.emptyState}>Không có báo cáo phù hợp với bộ lọc hiện tại.</div> : null}

        {visibleReports.map((report) => (
          <article key={report.reportId} className={styles.card}>
            <div className={styles.cardTop}>
              <div className={styles.cardTitle}>
                <b>#{report.reportId} - {report.targetLabel}</b>
                <small>{report.targetPreview}</small>
              </div>
              <div className={styles.tagRow}>
                <span className={`${styles.tag} ${REPORT_STATUS_CLASS[report.status]}`}>{REPORT_STATUS_LABEL[report.status]}</span>
                <span className={styles.tag}>{report.severity.toUpperCase()}</span>
                <span className={styles.tag}>AI {report.aiScore}%</span>
              </div>
            </div>

            <div className={styles.cardBody}>
              <div>{report.reason}</div>
              <div className={styles.muted}>Người report: {report.reporterLabel} · Tạo lúc: {formatTime(report.createdAt)}</div>
              <div className={styles.muted}>Phân công: {report.assignedTo ? `#${report.assignedTo}` : 'Chưa phân công'} · Cập nhật: {formatTime(report.updatedAt)}</div>
            </div>

            <div className={styles.cardActions}>
              <button type="button" className={styles.actionButton} onClick={() => void openDetail(report.reportId)}>
                <Search size={15} /> Xem xét
              </button>
              <button type="button" className={`${styles.actionButton} ${styles.primaryButton}`} onClick={() => openActionModal(report)}>
                <ShieldAlert size={15} /> Thực thi
              </button>
              <button
                type="button"
                className={styles.actionButton}
                onClick={() => void claimReport(report)}
                disabled={assigningReportId === report.reportId || report.assignedTo === user?.id}
              >
                <UserRound size={15} />
                {report.assignedTo === user?.id ? 'Đã nhận' : assigningReportId === report.reportId ? 'Đang nhận...' : 'Nhận xử lý'}
              </button>
              <Link to={`/moderator/report-detail/${report.reportId}`} className={styles.actionLink}>
                <FileText size={15} /> Mở trang chi tiết
              </Link>
            </div>
          </article>
        ))}
      </section>

      <section className={styles.pagination} aria-label="Phân trang báo cáo">
        <div>
          Trang <strong>{page}</strong> / {totalPages}
        </div>
        <div className={styles.paginationControls}>
          <button type="button" onClick={() => setPage((prev) => Math.max(1, prev - 1))} disabled={page <= 1}>
            <ArrowLeft size={15} /> Trước
          </button>
          <button type="button" onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))} disabled={page >= totalPages}>
            Sau <ArrowRight size={15} />
          </button>
        </div>
      </section>

      <AppDialog
        open={Boolean(selectedReport)}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedReport(null)
            setDetailError('')
          }
        }}
        title={selectedReport ? `Chi tiết báo cáo #${selectedReport.reportId}` : 'Chi tiết báo cáo'}
        description="Xem đầy đủ thông tin report, đối tượng bị báo cáo và lịch sử xử lý gần nhất."
        footer={
          <>
            <DialogButton variant="secondary" onClick={() => setSelectedReport(null)}>
              Đóng
            </DialogButton>
            {selectedReport ? (
              <DialogButton onClick={() => openActionModal(selectedReport)}>
                Thực thi
              </DialogButton>
            ) : null}
          </>
        }
      >
        {detailLoading ? <div className={styles.loadingState}>Đang tải chi tiết báo cáo...</div> : null}
        {detailError ? <div className={styles.emptyState}>{detailError}</div> : null}
        {selectedReport ? (
          <div className={styles.detailGrid}>
            <div className={styles.detailHero}>
              <div className={styles.tagRow}>
                <span className={`${styles.tag} ${REPORT_STATUS_CLASS[selectedReport.status]}`}>{REPORT_STATUS_LABEL[selectedReport.status]}</span>
                <span className={styles.tag}>{REPORT_TYPE_LABEL[selectedReport.reportType]}</span>
                <span className={styles.tag}>AI {selectedReport.aiScore}%</span>
              </div>
              <h2>{selectedReport.reason}</h2>
              <p className={styles.muted}>{selectedReport.description}</p>
            </div>

            <div className={styles.metaGrid}>
              <div className={styles.metaCard}><span>Đối tượng</span><b>{selectedReport.targetLabel} #{selectedReport.targetId || 'Không rõ'}</b></div>
              <div className={styles.metaCard}><span>Người report</span><b>{selectedReport.reporterLabel}</b></div>
              <div className={styles.metaCard}><span>Thời gian tạo</span><b>{formatTime(selectedReport.createdAt)}</b></div>
              <div className={styles.metaCard}><span>Cập nhật cuối</span><b>{formatTime(selectedReport.updatedAt)}</b></div>
              <div className={styles.metaCard}><span>Reviewer</span><b>{selectedReport.reviewerId ? `#${selectedReport.reviewerId}` : 'Chưa có'}</b></div>
              <div className={styles.metaCard}><span>Resolved by</span><b>{selectedReport.resolvedBy ? `#${selectedReport.resolvedBy}` : 'Chưa có'}</b></div>
            </div>

            {selectedReport.mediaUrl ? (
              <div className={styles.mediaPreview}>
                <span className={styles.muted}>Media đính kèm</span>
                <img src={selectedReport.mediaUrl} alt="Report media preview" />
              </div>
            ) : null}

            <div className={styles.metaCard}>
              <span>Nội dung gốc</span>
              <b>{selectedReport.originalContent}</b>
            </div>

            <div className={styles.metaCard}>
              <span>Ghi chú xử lý</span>
              <b>{selectedReport.resolutionNote || 'Chưa có ghi chú xử lý'}</b>
            </div>
          </div>
        ) : null}
      </AppDialog>

      <AppDialog
        open={Boolean(actionReport)}
        onOpenChange={(open) => {
          if (!open) {
            setActionReport(null)
            setActionNote('')
            setActionType('none')
          }
        }}
        title={actionReport ? `Thực thi báo cáo #${actionReport.reportId}` : 'Thực thi báo cáo'}
        description="Chọn hành động phù hợp với đối tượng bị báo cáo và lưu ghi chú để đồng bộ audit log."
        footer={
          <>
            <DialogButton variant="secondary" onClick={() => setActionReport(null)}>
              Hủy
            </DialogButton>
            <DialogButton onClick={() => void performAction()} disabled={submitting}>
              {submitting ? 'Đang xử lý...' : 'Xác nhận'}
            </DialogButton>
          </>
        }
      >
        {actionReport ? (
          <div className={styles.formGrid}>
            <div className={styles.metaCard}>
              <span>Báo cáo</span>
              <b>#{actionReport.reportId} - {actionReport.targetLabel}</b>
              <div className={styles.muted}>{actionReport.reason}</div>
            </div>

            <div className={styles.formRow}>
              <label htmlFor="target-action">Hành động thực thi</label>
              <select
                id="target-action"
                className={styles.select}
                value={actionType}
                onChange={(event) => setActionType(event.target.value as TargetAction)}
              >
                {getTargetActionOptions(actionReport.reportType).map((item) => (
                  <option key={item.value} value={item.value}>{item.label}</option>
                ))}
              </select>
            </div>

            <div className={styles.formRow}>
              <label htmlFor="report-status">Trạng thái báo cáo</label>
              <select
                id="report-status"
                className={styles.select}
                value={actionStatus}
                onChange={(event) => setActionStatus(event.target.value as ReportStatus)}
              >
                <option value="PENDING">Chờ xử lý</option>
                <option value="IN_REVIEW">Đang xem xét</option>
                <option value="RESOLVED">Đã xử lý</option>
                <option value="REJECTED">Đã từ chối</option>
              </select>
            </div>

            <div className={styles.formRow}>
              <label htmlFor="action-note">Ghi chú xử lý</label>
              <textarea
                id="action-note"
                className={styles.textarea}
                value={actionNote}
                onChange={(event) => setActionNote(event.target.value)}
                placeholder="Ghi lý do, bối cảnh hoặc nội dung cảnh báo..."
              />
            </div>
          </div>
        ) : null}
      </AppDialog>
    </main>
  )
}
