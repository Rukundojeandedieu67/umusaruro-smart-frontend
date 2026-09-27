import type { ReactNode } from 'react'
import { AlertCircle, ArrowRight, LoaderCircle, RefreshCw } from 'lucide-react'

export function PageHeading({ eyebrow, title, description, action }: {
  eyebrow?: string
  title: string
  description?: string
  action?: ReactNode
}) {
  return <div className="page-heading"><div>
    {eyebrow && <p className="eyebrow">{eyebrow}</p>}
    <h1>{title}</h1>
    {description && <p className="page-description">{description}</p>}
  </div>{action && <div className="heading-action">{action}</div>}</div>
}

export function EmptyState({ title, detail, action }: { title: string; detail: string; action?: ReactNode }) {
  return <div className="empty-state"><span className="empty-icon"><ArrowRight size={18} aria-hidden="true" /></span>
    <h3>{title}</h3><p>{detail}</p>{action}</div>
}

export function ErrorState({ message, retry }: { message: string; retry?: () => void }) {
  return <div className="error-state" role="alert"><AlertCircle size={18} aria-hidden="true" />
    <span>{message}</span>{retry && <button className="icon-button" type="button" onClick={retry} aria-label="Retry"><RefreshCw size={16} /></button>}</div>
}

export function LoadingState({ label = 'Loading' }: { label?: string }) {
  return <div className="loading-state" role="status"><LoaderCircle className="spin" size={18} />{label}</div>
}

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`skeleton ${className}`} aria-hidden="true" />
}

export function RiskBadge({ level, label }: { level: 'green' | 'yellow' | 'orange' | 'red' | 'muted'; label: string }) {
  return <span className={`risk-badge risk-${level}`}><span className="risk-dot" />{label}</span>
}

export function StatusBadge({ status }: { status: string }) {
  return <span className={`status-badge status-${status.replaceAll('_', '-')}`}>{status.replaceAll('_', ' ')}</span>
}

export function RelativeDate({ value }: { value: string | null }) {
  if (!value) return <span className="muted">Date unavailable</span>
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return <span className="muted">Date unavailable</span>
  return <time dateTime={value}>{new Intl.DateTimeFormat('en', { dateStyle: 'medium' }).format(date)}</time>
}

