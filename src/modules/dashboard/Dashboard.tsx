import { useState } from 'react';
import { ResponsiveGridLayout, useContainerWidth, type Layout } from 'react-grid-layout';
import {
  GripVertical, Plus, Trash2, X, LayoutDashboard, Copy, Pencil, RefreshCw, Check,
} from 'lucide-react';

import Panel from '@/components/Panel';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem as SelectOption } from '@/components/ui/select';
import ChartView from '@/modules/widgets/ChartView';

import { useDashboardStore, useActiveBoard } from './store';
import { useWidgetStore } from '@/modules/widgets/store';
import { useQueryStore } from '@/modules/queries/store';
import { useDataStore } from '@/store/dataStore';
import { confirmDialog } from '@/components/confirm/store';
import { toast } from '@/components/toast/store';
import { C } from '@/palette';

export default function Dashboard() {
  const { boards, activeBoardId, setActiveBoard, createBoard, renameBoard, deleteBoard, addItem, removeItem, updateLayout } =
    useDashboardStore();
  const board = useActiveBoard();
  const { widgets, deleteWidget, duplicateWidget, renameWidget } = useWidgetStore();
  const { queries } = useQueryStore();
  const { data, schema } = useDataStore();
  const { width, containerRef, mounted } = useContainerWidth();

  const [editingBoardName, setEditingBoardName] = useState(false);
  const [boardNameDraft, setBoardNameDraft] = useState('');
  const [renamingWidgetId, setRenamingWidgetId] = useState<string | null>(null);
  const [widgetNameDraft, setWidgetNameDraft] = useState('');
  const [refreshTick, setRefreshTick] = useState(0);

  const handleDeleteWidget = async (id: string, name: string) => {
    const ok = await confirmDialog({ message: `Delete widget "${name}"? This also removes it from any dashboard it's on.` });
    if (!ok) return;
    deleteWidget(id);
    toast.success(`"${name}" deleted`);
  };

  const handleDeleteBoard = async () => {
    if (boards.length <= 1) return;
    const ok = await confirmDialog({ message: `Delete dashboard "${board.name}"? This cannot be undone.` });
    if (!ok) return;
    deleteBoard(board.id);
    toast.success(`"${board.name}" deleted`);
  };

  const items = board.items;
  const layout: Layout = items.map(it => ({
    i: it.id,
    x: it.x ?? 0,
    y: it.y ?? Infinity,
    w: it.w ?? 6,
    h: it.h ?? 5,
    minW: 3,
    minH: 3,
  }));

  return (
    <div className="flex flex-col lg:flex-row gap-4 p-4 mx-auto" style={{ maxWidth: 1400 }}>
      {/* ===== WIDGET LIBRARY (left) ===== */}
      <div className="lg:w-72 shrink-0">
        <Panel>
          <Label>Widget library</Label>
          <div style={{ color: C.mut }} className="text-xs mb-2">
            Build widgets in Studio or Query Builder, then add them here.
          </div>
          {widgets.length === 0
            ? <div style={{ color: C.mut }} className="text-sm py-3">No widgets yet. Run a query, then "Create widget".</div>
            : (
              <div className="space-y-3">
                {widgets.map(w => (
                  <div
                    key={w.id}
                    style={{ border: `1px solid ${C.line}`, borderRadius: 10 }}
                    className="p-2.5"
                  >
                    <div className="flex items-center justify-between gap-1">
                      {renamingWidgetId === w.id ? (
                        <div className="flex items-center gap-1 flex-1">
                          <Input
                            autoFocus
                            value={widgetNameDraft}
                            onChange={e => setWidgetNameDraft(e.target.value)}
                            onKeyDown={e => {
                              if (e.key === 'Enter') { renameWidget(w.id, widgetNameDraft); setRenamingWidgetId(null); }
                            }}
                            className="h-7 text-sm"
                          />
                          <button onClick={() => { renameWidget(w.id, widgetNameDraft); setRenamingWidgetId(null); }} type="button">
                            <Check size={14} style={{ color: C.blue }} />
                          </button>
                        </div>
                      ) : (
                        <span style={{ color: C.ink }} className="text-sm font-semibold truncate">{w.name}</span>
                      )}
                      <span style={{ color: C.mut }} className="text-xs uppercase ml-1 shrink-0">{w.chart}</span>
                    </div>
                    <div className="my-1">
                      <ChartView key={`${w.id}_${refreshTick}`} widget={w} queries={queries} data={data} schema={schema} height={90} />
                    </div>
                    <div className="flex items-center gap-2">
                      <Button size="sm" onClick={() => addItem(w.id)}>
                        <Plus size={12} /> Add to board
                      </Button>
                      <button onClick={() => { setRenamingWidgetId(w.id); setWidgetNameDraft(w.name); }} type="button" title="Rename">
                        <Pencil size={13} style={{ color: C.mut }} />
                      </button>
                      <button onClick={() => duplicateWidget(w.id)} type="button" title="Duplicate">
                        <Copy size={13} style={{ color: C.mut }} />
                      </button>
                      <button onClick={() => setRefreshTick(t => t + 1)} type="button" title="Refresh">
                        <RefreshCw size={13} style={{ color: C.mut }} />
                      </button>
                      <button onClick={() => handleDeleteWidget(w.id, w.name)} type="button" title="Delete widget">
                        <Trash2 size={13} style={{ color: C.mut }} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )
          }
        </Panel>
      </div>

      {/* ===== BOARD ===== */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Select value={activeBoardId} onValueChange={setActiveBoard}>
              <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
              <SelectContent>
                {boards.map(b => <SelectOption key={b.id} value={b.id}>{b.name}</SelectOption>)}
              </SelectContent>
            </Select>
            {editingBoardName ? (
              <>
                <Input
                  autoFocus
                  value={boardNameDraft}
                  onChange={e => setBoardNameDraft(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') { renameBoard(board.id, boardNameDraft); setEditingBoardName(false); }
                  }}
                  className="h-8 w-40"
                />
                <button onClick={() => { renameBoard(board.id, boardNameDraft); setEditingBoardName(false); }} type="button">
                  <Check size={15} style={{ color: C.blue }} />
                </button>
              </>
            ) : (
              <button onClick={() => { setEditingBoardName(true); setBoardNameDraft(board.name); }} type="button" title="Rename dashboard">
                <Pencil size={14} style={{ color: C.mut }} />
              </button>
            )}
            <button
              onClick={handleDeleteBoard}
              type="button"
              title="Delete dashboard"
              disabled={boards.length <= 1}
            >
              <Trash2 size={14} style={{ color: boards.length > 1 ? C.mut : C.line }} />
            </button>
          </div>
          <Button variant="ghost" size="sm" onClick={() => createBoard('New dashboard')}>
            <Plus size={13} /> New dashboard
          </Button>
        </div>

        {items.length === 0 ? (
          <div
            style={{ border: `2px dashed ${C.line}`, borderRadius: 16, color: C.mut }}
            className="flex flex-col items-center justify-center py-24 text-center"
          >
            <LayoutDashboard size={32} style={{ color: C.line }} />
            <div className="mt-3 font-semibold" style={{ color: C.ink }}>This dashboard is empty</div>
            <div className="text-sm mt-1">Add a widget from the library to start assembling.</div>
          </div>
        ) : (
          <div ref={containerRef} style={{ minHeight: 400 }}>
          {mounted && (
          <ResponsiveGridLayout
            width={width}
            layouts={{ lg: layout, md: layout, sm: layout }}
            breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
            cols={{ lg: 12, md: 12, sm: 12, xs: 12, xxs: 12 }}
            rowHeight={60}
            dragConfig={{ handle: '.drag-handle' }}
            onLayoutChange={currentLayout => updateLayout(currentLayout.map(l => ({ i: l.i, x: l.x, y: l.y, w: l.w, h: l.h })))}
          >
            {items.map(item => {
              const w = widgets.find(x => x.id === item.widgetId);
              if (!w) return null;
              return (
                <div
                  key={item.id}
                  style={{ background: '#fff', border: `1px solid ${C.line}`, borderRadius: 14 }}
                  className="flex flex-col overflow-hidden"
                >
                  {/* tile header */}
                  <div className="flex items-center justify-between px-3 pt-2 pb-1 shrink-0">
                    <div className="flex items-center gap-1.5">
                      <div
                        className="drag-handle flex items-center cursor-grab active:cursor-grabbing"
                        title="Drag to reposition"
                      >
                        <GripVertical size={15} style={{ color: C.line }} />
                      </div>
                      <span style={{ color: C.ink }} className="font-semibold text-sm">{w.name}</span>
                      <span style={{ color: C.mut }} className="text-xs uppercase">{w.chart}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => setRefreshTick(t => t + 1)} type="button" title="Refresh">
                        <RefreshCw size={13} style={{ color: C.mut }} />
                      </button>
                      <button onClick={() => removeItem(item.id)} type="button" title="Remove from board">
                        <X size={15} style={{ color: C.mut }} />
                      </button>
                    </div>
                  </div>

                  {/* chart */}
                  <div className="flex-1 min-h-0 px-2 pb-2">
                    <ChartView
                      key={`${item.id}_${refreshTick}`}
                      widget={w}
                      queries={queries}
                      data={data}
                      schema={schema}
                      height={(item.h ?? 5) * 60 - 44}
                    />
                  </div>
                </div>
              );
            })}
          </ResponsiveGridLayout>
          )}
          </div>
        )}
      </div>
    </div>
  );
}
