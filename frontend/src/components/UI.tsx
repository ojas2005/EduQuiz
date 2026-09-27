import { useEffect, useRef, type ReactNode } from 'react';
import { ArrowRight, BookOpen, Check, LoaderCircle, X } from 'lucide-react';

export function Brand() {
  return <span className="brand"><span className="brand-mark"><BookOpen size={22} aria-hidden="true" /></span>eduquiz<span className="brand-period">.</span></span>;
}
export function Button({ children, onClick, disabled, variant = 'primary', type = 'button', className = '' }: {
  children: ReactNode; onClick?: () => void; disabled?: boolean; variant?: 'primary' | 'secondary' | 'ghost' | 'dark'; type?: 'button' | 'submit'; className?: string;
}) {
  return <button type={type} className={`button button-${variant} ${className}`} onClick={onClick} disabled={disabled}>{children}</button>;
}
export function Progress({ value, label }: { value: number; label: string }) {
  return <div className="progress-track" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(value)}><span style={{ width: `${Math.max(0, Math.min(value, 100))}%` }} /></div>;
}
export function Loading({ label = 'Loading your learning space…' }: { label?: string }) {
  return <div className="loading-state" role="status"><LoaderCircle className="spin" size={24} aria-hidden="true"/><span>{label}</span></div>;
}
export function Empty({ title, children, action, actionLabel = 'Start learning' }: { title: string; children: ReactNode; action?: () => void; actionLabel?: string }) {
  return <div className="empty-state"><div className="empty-symbol"><BookOpen size={30} aria-hidden="true" /></div><h2>{title}</h2><p>{children}</p>{action && <Button onClick={action}>{actionLabel}<ArrowRight size={17} aria-hidden="true"/></Button>}</div>;
}
export function Alert({ children, error = false, onDismiss }: { children: ReactNode; error?: boolean; onDismiss?: () => void }) {
  return <div className={`alert ${error ? 'alert-error' : ''}`} role={error ? 'alert' : 'status'}><span>{children}</span>{onDismiss && <button className="icon-button" onClick={onDismiss} aria-label="Dismiss message"><X size={18}/></button>}</div>;
}
export function Modal({ title, children, onClose, busy = false, subtitle }: { title: string; subtitle?: string; children: ReactNode; onClose: () => void; busy?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  const closeRef = useRef(onClose); closeRef.current = onClose;
  const busyRef = useRef(busy); busyRef.current = busy;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const dialog = ref.current!; dialog.showModal();
    const oldOverflow = document.body.style.overflow; document.body.style.overflow = 'hidden';
    return () => { dialog.close(); document.body.style.overflow = oldOverflow; previous?.focus(); };
  }, []);
  return <dialog ref={ref} className="modal" aria-labelledby="dialog-heading" onCancel={event => { event.preventDefault(); if (!busyRef.current) closeRef.current(); }}>
    <button className="icon-button modal-close" aria-label="Close dialog" disabled={busy} onClick={onClose}><X size={20}/></button>
    <span className="eyebrow">YOUR LEARNING, YOUR WAY</span><h2 id="dialog-heading">{title}</h2>{subtitle && <p>{subtitle}</p>}{children}
  </dialog>;
}
export function PageHeading({ eyebrow, title, description, action }: { eyebrow: string; title: string; description?: string; action?: ReactNode }) {
  return <div className="page-heading"><div><span className="eyebrow">{eyebrow}</span><h1>{title}</h1>{description && <p>{description}</p>}</div>{action}</div>;
}
export function Status({ complete }: { complete: boolean }) { return <span className={`status-badge ${complete ? 'status-success' : ''}`}>{complete && <Check size={13} aria-hidden="true"/>}{complete ? 'Completed' : 'In progress'}</span>; }
