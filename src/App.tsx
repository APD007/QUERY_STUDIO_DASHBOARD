import { useEffect, useState, Suspense, lazy } from 'react';
import { Layers, Sparkles, Code2, Sliders, Database, LayoutDashboard, LogOut, Loader2, type LucideIcon } from 'lucide-react';

import LoginPage from './pages/LoginPage';
import { useQueryStore } from './modules/queries/store';
import { useWidgetStore } from './modules/widgets/store';
import { useDashboardStore } from './modules/dashboard/store';
import { useAuthStore } from './store/authStore';
import { C } from './palette';

const AiAssistantPage = lazy(() => import('./pages/AiAssistantPage'));
const StudioSql = lazy(() => import('./pages/StudioSql'));
const QueryBuilderPage = lazy(() => import('./pages/QueryBuilderPage'));
const DataSourcesPage = lazy(() => import('./pages/DataSourcesPage'));
const Dashboard = lazy(() => import('./modules/dashboard/Dashboard'));

function PageFallback() {
  return (
    <div className="flex items-center justify-center py-24">
      <Loader2 size={20} className="animate-spin" style={{ color: C.mut }} />
    </div>
  );
}

type Tab = 'ai' | 'studio' | 'builder' | 'sources' | 'dashboard';
const TABS: [Tab, string, LucideIcon][] = [
  ['ai', 'AI Assistant', Sparkles],
  ['studio', 'Studio', Code2],
  ['builder', 'Query Builder', Sliders],
  ['sources', 'Data Sources', Database],
  ['dashboard', 'Dashboard', LayoutDashboard],
];

export default function App() {
  const { status, user, checkSession, logout } = useAuthStore();
  const [tab, setTab] = useState<Tab>('ai');

  const queryCount  = useQueryStore(s => s.queries.length);
  const widgetCount = useWidgetStore(s => s.widgets.length);
  const boardCount  = useDashboardStore(s => s.boards.reduce((n, b) => n + b.items.length, 0));
  const loadQueries = useQueryStore(s => s.load);
  const loadWidgets = useWidgetStore(s => s.load);
  const loadDashboards = useDashboardStore(s => s.load);
  const resetQueries = useQueryStore(s => s.reset);
  const resetWidgets = useWidgetStore(s => s.reset);
  const resetDashboards = useDashboardStore(s => s.reset);

  useEffect(() => { checkSession(); }, [checkSession]);

  useEffect(() => {
    if (status === 'authenticated') {
      Promise.all([loadQueries(), loadWidgets(), loadDashboards()]).catch(err =>
        console.error('Failed to load saved data:', err)
      );
    }
  }, [status, loadQueries, loadWidgets, loadDashboards]);

  const handleLogout = async () => {
    await logout();
    resetQueries();
    resetWidgets();
    resetDashboards();
  };

  if (status === 'checking') {
    return (
      <div style={{ background: C.page, minHeight: '100vh' }} className="flex items-center justify-center">
        <Loader2 size={24} className="animate-spin" style={{ color: C.mut }} />
      </div>
    );
  }

  if (status === 'anonymous') {
    return <LoginPage />;
  }

  return (
    <div style={{ background: C.page, color: C.text, minHeight: '100vh' }}>
      {/* ── Top bar ── */}
      <div
        style={{ background: '#fff', borderBottom: `1px solid ${C.line}` }}
        className="px-5 py-3 flex items-center justify-between sticky top-0 z-20"
      >
        {/* Logo */}
        <div className="flex items-center gap-2.5">
          <div style={{ background: C.ink }} className="w-8 h-8 rounded-lg flex items-center justify-center">
            <Layers size={18} color="#fff" />
          </div>
          <div>
            <div style={{ color: C.ink }} className="font-bold leading-tight">Query Studio</div>
            <div style={{ color: C.mut }} className="text-xs">data source → query → widget → dashboard</div>
          </div>
        </div>

        {/* Tab switcher */}
        <div className="flex items-center gap-1 p-1 rounded-xl" style={{ background: C.page }}>
          {TABS.map(([k, label, I]) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              type="button"
              style={
                tab === k
                  ? { background: '#fff', color: C.ink, boxShadow: '0 1px 3px rgba(14,42,71,.12)' }
                  : { color: C.mut }
              }
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-sm font-semibold"
            >
              <I size={15} /> {label}
              {k === 'dashboard' && boardCount > 0 && (
                <span style={{ background: C.blue, color: '#fff' }} className="ml-1 text-xs rounded-full px-1.5">
                  {boardCount}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Stats + account */}
        <div className="flex items-center gap-4">
          <div style={{ color: C.mut }} className="text-xs hidden md:flex gap-4">
            <span>{queryCount} {queryCount === 1 ? 'query' : 'queries'}</span>
            <span>{widgetCount} {widgetCount === 1 ? 'widget' : 'widgets'}</span>
          </div>
          <div className="flex items-center gap-2">
            <span style={{ color: C.mut }} className="text-xs hidden sm:inline truncate max-w-40">{user?.email}</span>
            <button onClick={handleLogout} type="button" title="Log out">
              <LogOut size={15} style={{ color: C.mut }} />
            </button>
          </div>
        </div>
      </div>

      {/* ── Content ── */}
      <Suspense fallback={<PageFallback />}>
        {tab === 'ai' && (
          <AiAssistantPage onGoToStudio={() => setTab('studio')} onGoToDashboard={() => setTab('dashboard')} />
        )}
        {tab === 'studio' && (
          <StudioSql onGoToDashboard={() => setTab('dashboard')} onGoToBuilder={() => setTab('builder')} />
        )}
        {tab === 'builder' && (
          <QueryBuilderPage onGoToStudio={() => setTab('studio')} onGoToDashboard={() => setTab('dashboard')} />
        )}
        {tab === 'sources' && <DataSourcesPage />}
        {tab === 'dashboard' && <Dashboard />}
      </Suspense>
    </div>
  );
}
