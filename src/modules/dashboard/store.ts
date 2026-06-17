import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const DEFAULT_W = 6;
const DEFAULT_H = 5;

export interface DashboardItem {
  id: string;
  widgetId: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface LayoutPatch {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface DashboardBoard {
  id: string;
  name: string;
  items: DashboardItem[];
}

function emptyBoard(name: string): DashboardBoard {
  return { id: 'board_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6), name, items: [] };
}

interface DashboardStoreState {
  boards: DashboardBoard[];
  activeBoardId: string;
  createBoard(name: string): string;
  renameBoard(id: string, name: string): void;
  deleteBoard(id: string): void;
  setActiveBoard(id: string): void;
  addItem(widgetId: string): string;
  removeItem(id: string): void;
  updateLayout(layouts: LayoutPatch[]): void;
}

const DEFAULT_BOARD = emptyBoard('Alarms Dashboard');

export const useDashboardStore = create<DashboardStoreState>()(
  persist(
    (set, get) => ({
      boards: [DEFAULT_BOARD],
      activeBoardId: DEFAULT_BOARD.id,

      createBoard(name) {
        const board = emptyBoard(name);
        set(s => ({ boards: [...s.boards, board], activeBoardId: board.id }));
        return board.id;
      },

      renameBoard(id, name) {
        set(s => ({ boards: s.boards.map(b => (b.id === id ? { ...b, name } : b)) }));
      },

      deleteBoard(id) {
        set(s => {
          const remaining = s.boards.filter(b => b.id !== id);
          const boards = remaining.length ? remaining : [emptyBoard('Dashboard')];
          const activeBoardId = s.activeBoardId === id ? boards[0].id : s.activeBoardId;
          return { boards, activeBoardId };
        });
      },

      setActiveBoard(id) {
        set({ activeBoardId: id });
      },

      addItem(widgetId) {
        const id = 'di_' + Date.now();
        const cols = 12;
        set(s => {
          const board = s.boards.find(b => b.id === s.activeBoardId);
          if (!board) return s;
          const maxRowBottom = board.items.reduce((m, x) => Math.max(m, x.y + x.h), 0);
          const lastX = board.items.reduce((acc, it) => {
            if (it.y + it.h >= maxRowBottom) return Math.max(acc, it.x + it.w);
            return acc;
          }, 0);
          const x = lastX + DEFAULT_W > cols ? 0 : lastX;
          const newItem: DashboardItem = { id, widgetId, x, y: Infinity, w: DEFAULT_W, h: DEFAULT_H };
          return {
            boards: s.boards.map(b => (b.id === board.id ? { ...b, items: [...b.items, newItem] } : b)),
          };
        });
        return id;
      },

      removeItem(id) {
        set(s => ({
          boards: s.boards.map(b =>
            b.id === s.activeBoardId ? { ...b, items: b.items.filter(it => it.id !== id) } : b
          ),
        }));
      },

      updateLayout(layouts) {
        set(s => ({
          boards: s.boards.map(b => {
            if (b.id !== s.activeBoardId) return b;
            return {
              ...b,
              items: b.items.map(item => {
                const l = layouts.find(l => l.i === item.id);
                return l ? { ...item, x: l.x, y: l.y, w: l.w, h: l.h } : item;
              }),
            };
          }),
        }));
      },
    }),
    { name: 'qs-dashboard-v3' }
  )
);

export function useActiveBoard(): DashboardBoard {
  return useDashboardStore(s => s.boards.find(b => b.id === s.activeBoardId) ?? s.boards[0]);
}
