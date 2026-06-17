import type { ReactNode } from 'react';
import { C } from '@/palette';

export default function Panel({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div
      style={{ background: '#fff', border: `1px solid ${C.line}`, borderRadius: 14 }}
      className={`p-4 ${className}`}
    >
      {children}
    </div>
  );
}
