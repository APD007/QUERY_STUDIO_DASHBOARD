import { useState } from 'react';
import { Layers, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Panel from '@/components/Panel';
import { useAuthStore } from '@/store/authStore';
import { C } from '@/palette';

export default function LoginPage() {
  const { login, register, error } = useAuthStore();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === 'login') await login(email, password);
      else await register(email, password);
    } catch {
      // error is surfaced via the store
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ background: C.page, minHeight: '100vh' }} className="flex items-center justify-center p-4">
      <div style={{ width: 380 }}>
        <div className="flex items-center gap-2.5 justify-center mb-5">
          <div style={{ background: C.ink }} className="w-9 h-9 rounded-lg flex items-center justify-center">
            <Layers size={20} color="#fff" />
          </div>
          <div style={{ color: C.ink }} className="font-bold text-lg">Query Studio</div>
        </div>

        <Panel>
          <div className="flex items-center gap-1 p-1 rounded-lg mb-4" style={{ background: C.page }}>
            {(['login', 'register'] as const).map(m => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                style={mode === m ? { background: '#fff', color: C.ink } : { color: C.mut }}
                className="flex-1 px-3 py-1.5 rounded-md text-sm font-semibold"
              >
                {m === 'login' ? 'Log in' : 'Create account'}
              </button>
            ))}
          </div>

          <form onSubmit={submit} className="space-y-3">
            <div>
              <Label>Email</Label>
              <Input className="mt-1" type="email" required value={email} onChange={e => setEmail(e.target.value)} />
            </div>
            <div>
              <Label>Password</Label>
              <Input
                className="mt-1"
                type="password"
                required
                minLength={mode === 'register' ? 8 : undefined}
                value={password}
                onChange={e => setPassword(e.target.value)}
              />
              {mode === 'register' && (
                <div style={{ color: C.mut }} className="text-xs mt-1">At least 8 characters.</div>
              )}
            </div>
            {error && <div style={{ color: '#dc2626' }} className="text-sm">{error}</div>}
            <Button type="submit" disabled={busy} className="w-full justify-center">
              {busy && <Loader2 size={14} className="animate-spin" />}
              {mode === 'login' ? 'Log in' : 'Create account'}
            </Button>
          </form>
        </Panel>
      </div>
    </div>
  );
}
