import { Loader2 } from 'lucide-react'
import { FormEvent, useEffect, useState } from 'react'

import { AppDialog, DialogButton } from './app-dialog'
import styles from './dialogs.module.css'

const REPORT_REASONS = ['Spam', 'Lừa đảo', 'Quấy rối', 'Nội dung không phù hợp', 'Giả mạo', 'Khác']

export function ReportDialog({
  open,
  onOpenChange,
  title = 'Báo cáo',
  onSubmit,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title?: string
  onSubmit: (payload: { reason: string; details?: string }) => void | Promise<void>
}) {
  const [reason, setReason] = useState(REPORT_REASONS[0])
  const [details, setDetails] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open) return
    setReason(REPORT_REASONS[0])
    setDetails('')
    setError(null)
    setLoading(false)
  }, [open])

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (reason === 'Khác' && !details.trim()) {
      setError('Vui lòng mô tả lý do báo cáo.')
      return
    }

    try {
      setLoading(true)
      await onSubmit({ reason, details: details.trim() || undefined })
      onOpenChange(false)
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Không thể gửi báo cáo.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AppDialog
      open={open}
      onOpenChange={(value) => !loading && onOpenChange(value)}
      title={title}
      description="Báo cáo sẽ được gửi đến quản trị viên để xem xét."
      footer={
        <>
          <DialogButton type="button" variant="secondary" disabled={loading} onClick={() => onOpenChange(false)}>
            Hủy
          </DialogButton>
          <DialogButton type="submit" form="report-dialog-form" disabled={loading}>
            {loading ? <Loader2 size={16} className="animate-spin" /> : null}
            Gửi báo cáo
          </DialogButton>
        </>
      }
    >
      <form id="report-dialog-form" onSubmit={handleSubmit} className={styles.field}>
        <div className={styles.radioList}>
          {REPORT_REASONS.map((item) => (
            <label key={item} className={styles.radioRow}>
              <input type="radio" name="reason" checked={reason === item} onChange={() => setReason(item)} />
              <span>{item}</span>
            </label>
          ))}
        </div>
        {reason === 'Khác' ? (
          <textarea
            className={styles.textarea}
            value={details}
            onChange={(event) => {
              setDetails(event.target.value)
              setError(null)
            }}
            placeholder="Mô tả lý do báo cáo..."
            autoFocus
          />
        ) : null}
        {error ? <span className={styles.error}>{error}</span> : null}
      </form>
    </AppDialog>
  )
}

