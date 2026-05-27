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
import { AlertCircle, CheckCircle2, Info, Loader2, TriangleAlert } from 'lucide-react'

const icons = {
  success: <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-600" />,
  error: <AlertCircle className="mt-0.5 h-5 w-5 text-red-600" />,
  warning: <TriangleAlert className="mt-0.5 h-5 w-5 text-amber-600" />,
  info: <Info className="mt-0.5 h-5 w-5 text-sky-600" />,
  loading: <Loader2 className="mt-0.5 h-5 w-5 animate-spin text-slate-600" />,
}

export function Toaster() {
  const { toasts } = useToast()

  return (
    <ToastProvider>
      {toasts.map(function ({ id, title, description, action, type, variant, ...props }) {
        const toastType = type || (variant === 'destructive' ? 'error' : 'info')
        return (
          <Toast key={id} variant={variant || toastType} {...props}>
            {icons[toastType]}
            <div className="grid gap-1">
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
      <ToastViewport />
    </ToastProvider>
  )
}
