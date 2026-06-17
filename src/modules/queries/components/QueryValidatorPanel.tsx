import { Check, AlertCircle } from 'lucide-react';
import type { ValidationResult } from '@/types/expr';
import { C } from '@/palette';

export default function QueryValidatorPanel({ result }: { result: ValidationResult | null }) {
  if (!result) return null;

  if (result.ok) {
    return (
      <span style={{ color: C.good }} className="inline-flex items-center gap-1 text-sm font-semibold">
        <Check size={15} /> Query is valid
      </span>
    );
  }

  return (
    <div>
      <span style={{ color: C.red }} className="inline-flex items-center gap-1 text-sm font-semibold">
        <AlertCircle size={15} /> {result.errors[0]?.message}
      </span>
      {result.errors.length > 1 && (
        <ul className="mt-2 space-y-0.5">
          {result.errors.slice(1).map((e, i) => (
            <li key={i} style={{ color: C.red }} className="text-xs">· {e.message}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
