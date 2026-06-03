'use client'

import { useToast } from '@/hooks/use-toast'
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from '@/components/ui/toast'
import { cn } from '@/utils'
import { AlertCircle, CheckCircle2, Info, Loader2, ShieldCheck, TriangleAlert } from 'lucide-react'

const icons = {
  success: { icon: <CheckCircle2 className="h-5 w-5" />, tone: 'bg-emerald-100 text-emerald-700 ring-emerald-200' },
  error: { icon: <AlertCircle className="h-5 w-5" />, tone: 'bg-rose-100 text-rose-700 ring-rose-200' },
  warning: { icon: <TriangleAlert className="h-5 w-5" />, tone: 'bg-amber-100 text-amber-700 ring-amber-200' },
  info: { icon: <Info className="h-5 w-5" />, tone: 'bg-sky-100 text-sky-700 ring-sky-200' },
  loading: { icon: <Loader2 className="h-5 w-5 animate-spin" />, tone: 'bg-slate-100 text-slate-700 ring-slate-200' },
}

type ToasterMode = 'default' | 'operator'

export function Toaster({ mode = 'default' }: { mode?: ToasterMode }) {
  const { toasts } = useToast()
  const isOperator = mode === 'operator'

  return (
    <ToastProvider duration={4000} swipeDirection="right">
      {toasts.map(function ({ id, title, description, action, type, variant, ...props }) {
        const toastType =
          type ||
          (variant === 'success'
            ? 'success'
            : variant === 'destructive'
              ? 'error'
              : variant === 'warning'
                ? 'warning'
                : variant === 'loading'
                  ? 'loading'
                  : 'info')
        const tone = icons[toastType]
        return (
          <Toast
            key={id}
            variant={variant || toastType}
            className={cn(
              isOperator && 'min-h-[86px] rounded-2xl border-white/70 bg-white/95 p-5 pl-6 shadow-[0_24px_70px_rgba(15,23,42,0.22)] ring-1 ring-slate-900/5',
            )}
            {...props}
          >
            <div className={cn('mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1', tone.tone)}>
              {tone.icon}
            </div>
            <div className="grid min-w-0 gap-1 pr-2">
              {isOperator ? (
                <div className="mb-0.5 inline-flex w-fit items-center gap-1.5 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold uppercase tracking-[0.08em] text-slate-500">
                  <ShieldCheck className="h-3 w-3" />
                  Admin
                </div>
              ) : null}
              {title && <ToastTitle>{title}</ToastTitle>}
              {description && (
                <ToastDescription>{description}</ToastDescription>
              )}
            </div>
            {action}
            <ToastClose />
          </Toast>
        )
      })}
      <ToastViewport
        className={
          isOperator
            ? 'bottom-auto left-1/2 right-auto top-5 w-[min(100vw-1rem,560px)] -translate-x-1/2 sm:left-1/2 sm:right-auto sm:top-6 sm:w-[560px] sm:-translate-x-1/2'
            : undefined
        }
      />
    </ToastProvider>
  )
}
