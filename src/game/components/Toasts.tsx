'use client';
import { useEffect } from 'react';
import { toastDuration, useGame } from '../state/store';

export default function Toasts() {
  const toasts = useGame((s) => s.toasts);
  const dismiss = useGame((s) => s.dismissToast);
  const mobileToast = toasts.find(t => t.tone === 'alert') ?? toasts[0];
  useEffect(() => {
    if (!mobileToast?.waitForDisplay) return;
    const timer = window.setTimeout(() => dismiss(mobileToast.id), toastDuration(mobileToast.tone));
    return () => window.clearTimeout(timer);
  }, [mobileToast, dismiss]);
  return (
    <div className="toasts">
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast-${t.tone}`} data-mobile-current={t === mobileToast || undefined} onClick={() => dismiss(t.id)}>
          {t.text}
        </div>
      ))}
    </div>
  );
}
