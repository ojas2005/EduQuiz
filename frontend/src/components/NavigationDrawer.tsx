import { useEffect, useRef, useState, type ReactNode } from 'react';
import { X } from 'lucide-react';
export function NavigationDrawer({ children, footer, onClose }: { children: (close: (after?: () => void) => void) => ReactNode; footer: ReactNode; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null), timer = useRef<number | undefined>(undefined);
  const [closing, setClosing] = useState(false);
  const opener = useRef(document.activeElement as HTMLElement | null);
  useEffect(() => {
    const previous = opener.current;
    const dialog = ref.current!; dialog.showModal();
    const overflow = document.body.style.overflow; document.body.style.overflow = 'hidden';
    return () => { window.clearTimeout(timer.current); dialog.close(); document.body.style.overflow = overflow; if (previous?.isConnected) previous.focus(); };
  }, []);
  function close(after?: () => void) {
    if (closing) return;
    setClosing(true);
    timer.current = window.setTimeout(() => { onClose(); after?.(); }, window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 260);
  }
  return <dialog id="workspace-navigation" ref={ref} className={`sidebar navigation-drawer ${closing ? 'is-closing' : ''}`} aria-label="Your workspace" onCancel={event => { event.preventDefault(); close(); }} onClick={event => {
    if (event.target === event.currentTarget) { const box = event.currentTarget.getBoundingClientRect(); if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) close(); }
    const target = (event.target as HTMLElement).closest<HTMLAnchorElement>('a[href^="#"]');
    if (target) { event.preventDefault(); const hash = target.getAttribute('href')!; close(() => { window.location.hash = hash; }); }
  }}>
    <button autoFocus className="icon-button drawer-close" aria-label="Close navigation" onClick={() => close()}><X size={21}/></button>
    <div className="drawer-scroll">{children(close)}</div><div className="drawer-footer">{footer}</div>
  </dialog>;
}
