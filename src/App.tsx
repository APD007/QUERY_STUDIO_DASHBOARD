import { useState } from 'react';
import { Layers, Code2, Sliders, Database, LayoutDashboard, type LucideIcon } from 'lucide-react';

import StudioSql from './pages/StudioSql';
import QueryBuilderPage from './pages/QueryBuilderPage';
import DataSourcesPage from './pages/DataSourcesPage';
import Dashboard from './modules/dashboard/Dashboard';
import { useQueryStore } from './modules/queries/store';
import { useWidgetStore } from './modules/widgets/store';
import { useDashboardStore } from './modules/dashboard/store';
import { C } from './palette';

type Tab = 'studio' | 'builder' | 'sources' | 'dashboard';
const TABS: [Tab, string, LucideIcon][] = [
  ['studio', 'Studio', Code2],
  ['builder', 'Query Builder', Sliders],
  ['sources', 'Data Sources', Database],
  ['dashboard', 'Dashboard', LayoutDashboard],
];

export default function App() {
  const [tab, setTab] = useState<Tab>('studio');

  const queryCount  = useQueryStore(s => s.queries.length);
  const widgetCount = useWidgetStore(s => s.widgets.length);
  const boardCount  = useDashboardStore(s => s.boards.reduce((n, b) => n + b.items.length, 0));

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

        {/* Stats */}
        <div style={{ color: C.mut }} className="text-xs hidden md:flex gap-4">
          <span>{queryCount} {queryCount === 1 ? 'query' : 'queries'}</span>
          <span>{widgetCount} {widgetCount === 1 ? 'widget' : 'widgets'}</span>
        </div>
      </div>

      {/* ── Content ── */}
      {tab === 'studio' && <StudioSql onGoToDashboard={() => setTab('dashboard')} />}
      {tab === 'builder' && (
        <QueryBuilderPage onGoToStudio={() => setTab('studio')} onGoToDashboard={() => setTab('dashboard')} />
      )}
      {tab === 'sources' && <DataSourcesPage />}
      {tab === 'dashboard' && <Dashboard />}
    </div>
  );
}
