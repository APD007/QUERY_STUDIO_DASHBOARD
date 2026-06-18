import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';
import { useToastStore, type ToastKind } from './store';
import { C } from '@/palette';

const ICONS: Record<ToastKind, typeof CheckCircle2> = { success: CheckCircle2, error: AlertCircle, info: Info };
const COLORS: Record<ToastKind, string> = { success: '#16a34a', error: '#dc2626', info: C.blue };

export default function ToastHost() {
  const toasts = useToastStore(s => s.toasts);
  const dismiss = useToastStore(s => s.dismiss);

  if (!toasts.length) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 space-y-2" style={{ width: 320 }}>
      {toasts.map(t => {
        const Icon = ICONS[t.kind];
        return (
          <div
            key={t.id}
            style={{ background: '#fff', border: `1px solid ${C.line}`, borderRadius: 10, boxShadow: '0 8px 24px rgba(15,23,42,0.12)' }}
            className="flex items-start gap-2 p-3"
          >
            <Icon size={16} style={{ color: COLORS[t.kind] }} className="shrink-0 mt-0.5" />
            <span style={{ color: C.ink }} className="text-sm flex-1">{t.message}</span>
            <button type="button" onClick={() => dismiss(t.id)}>
              <X size={14} style={{ color: C.mut }} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
