import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useConfirmStore } from './store';
import { C } from '@/palette';

export default function ConfirmHost() {
  const request = useConfirmStore(s => s.request);
  const resolve = useConfirmStore(s => s.resolve);

  if (!request) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(15, 23, 42, 0.45)' }}
      onClick={() => resolve(false)}
    >
      <div
        style={{ background: '#fff', borderRadius: 14 }}
        className="w-full max-w-sm p-5"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 mb-2">
          <AlertTriangle size={18} style={{ color: request.danger ? '#dc2626' : C.blue }} />
          <span style={{ color: C.ink }} className="font-semibold">{request.title}</span>
        </div>
        <div style={{ color: C.mut }} className="text-sm mb-4">{request.message}</div>
        <div className="flex items-center justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => resolve(false)}>Cancel</Button>
          <Button variant={request.danger ? 'danger' : 'default'} size="sm" onClick={() => resolve(true)}>
            {request.confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
