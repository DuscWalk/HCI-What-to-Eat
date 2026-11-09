import { createContext, useContext, useEffect, useReducer, type Dispatch, type ReactNode } from 'react';
import { DEMO_EDITS, demoEvents } from '../api/mockData';
import type {
  AppEvent,
  Candidate,
  Cart,
  Conditions,
  Platform,
  RecordEdit,
  Settings,
  TrashItem,
  TrashReason,
} from '../types';

const STORAGE_KEY = 'what-to-eat-prototype';
/** 数据结构或店铺数据变了（v3：换成 VitaBench 等来源的店铺），旧版本保存的数据直接作废 */
const STORAGE_VERSION = 3;
const TRASH_LIMIT = 12;
export const MAX_QTY = 9;

export interface PersistedState {
  candidates: Candidate[];
  trash: TrashItem[];
  carts: Cart[];
  settings: Settings;
  edits: Record<string, RecordEdit>;
  events: AppEvent[];
  mealShift: number;
  /** 浮窗的首次使用提示是否已看过 */
  dockHintSeen: boolean;
}

export interface State extends PersistedState {
  conditions: Conditions;
}

export const DEFAULT_SETTINGS: Settings = {
  likes: ['清淡', '酸辣'],
  avoids: ['香菜'],
  autoPopupSec: 60,
  recommendCount: 4,
  candidateLimit: 5,
  retention: 'meal',
  showRandom: true,
  useHistory: true,
  useTastePrefs: true,
  useCoupons: true,
};

export const EMPTY_CONDITIONS: Conditions = { budget: null, maxMinutes: null, tastes: [] };

/** 候选上限 3–5（白板：候选页 3–5 个）。 */
export const CANDIDATE_LIMIT_RANGE = [3, 5] as const;

function clampSettings(settings: Settings): Settings {
  const [min, max] = CANDIDATE_LIMIT_RANGE;
  return { ...settings, candidateLimit: Math.min(max, Math.max(min, settings.candidateLimit)) };
}

/** 演示用的初始记录：让记录页一开始就有三类状态。 */
function seed(): PersistedState {
  const now = Date.now();
  return {
    candidates: [],
    trash: [],
    carts: [],
    settings: DEFAULT_SETTINGS,
    edits: structuredClone(DEMO_EDITS),
    events: demoEvents(now),
    mealShift: 0,
    dockHintSeen: false,
  };
}

function load(): State {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as { v: number; data: PersistedState };
      if (parsed?.v === STORAGE_VERSION && parsed.data) {
        return {
          ...seed(),
          ...parsed.data,
          settings: clampSettings({ ...DEFAULT_SETTINGS, ...parsed.data.settings }),
          conditions: EMPTY_CONDITIONS,
        };
      }
    }
  } catch {
    /* 存储不可用时使用初始数据 */
  }
  return { ...seed(), conditions: EMPTY_CONDITIONS };
}

export type Action =
  | { type: 'add'; candidate: Candidate }
  | { type: 'remove'; dishIds: string[]; reason: TrashReason; at: number }
  | { type: 'restore'; dishIds: string[]; mealKey: string; at: number }
  | { type: 'replace'; oldDishId: string; candidate: Candidate }
  | { type: 'cartAdd'; shopId: string; dishId: string; at: number }
  | { type: 'cartSetQty'; shopId: string; dishId: string; qty: number; at: number }
  | { type: 'cartClear'; shopId: string }
  | { type: 'cartPut'; cart: Cart }
  | { type: 'settings'; patch: Partial<Settings> }
  | { type: 'conditions'; conditions: Conditions }
  | { type: 'editRecord'; shopId: string; patch: RecordEdit }
  | { type: 'chosen'; shopId: string; dishId?: string; platform?: Platform; at: number }
  | { type: 'shiftMeal' }
  | { type: 'dockHintSeen' }
  | { type: 'reset' };

function removeInto(state: State, dishIds: string[], reason: TrashReason, at: number): State {
  const removed = state.candidates.filter((c) => dishIds.includes(c.dishId));
  if (!removed.length) return state;
  const trash = [
    ...removed.map((c) => ({ ...c, deletedAt: at, reason })),
    ...state.trash.filter((t) => !dishIds.includes(t.dishId)),
  ].slice(0, TRASH_LIMIT);
  return { ...state, candidates: state.candidates.filter((c) => !dishIds.includes(c.dishId)), trash };
}

function addInto(state: State, candidate: Candidate): State {
  if (state.candidates.some((c) => c.dishId === candidate.dishId)) return state;
  return {
    ...state,
    candidates: [...state.candidates, candidate],
    trash: state.trash.filter((t) => t.dishId !== candidate.dishId),
    events: [
      ...state.events,
      { type: 'candidate', shopId: candidate.shopId, dishId: candidate.dishId, at: candidate.addedAt },
    ],
  };
}

/** 修改某家店的购物车；空购物车自动删除，最近改动的排在前面。 */
function updateCart(state: State, shopId: string, at: number, fn: (lines: Cart['lines']) => Cart['lines']): State {
  const current = state.carts.find((c) => c.shopId === shopId);
  const lines = fn(current?.lines ?? []).filter((l) => l.qty > 0);
  const others = state.carts.filter((c) => c.shopId !== shopId);
  return { ...state, carts: lines.length ? [{ shopId, lines, updatedAt: at }, ...others] : others };
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'add':
      return addInto(state, action.candidate);
    case 'remove':
      return removeInto(state, action.dishIds, action.reason, action.at);
    case 'restore': {
      const back = state.trash.filter(
        (t) => action.dishIds.includes(t.dishId) && !state.candidates.some((c) => c.dishId === t.dishId),
      );
      if (!back.length) return state;
      return {
        ...state,
        candidates: [
          ...state.candidates,
          ...back.map(({ shopId, dishId }) => ({ shopId, dishId, addedAt: action.at, mealKey: action.mealKey })),
        ],
        trash: state.trash.filter((t) => !action.dishIds.includes(t.dishId)),
      };
    }
    case 'replace': {
      const index = state.candidates.findIndex((c) => c.dishId === action.oldDishId);
      if (index < 0) return addInto(state, action.candidate);
      const next = addInto(removeInto(state, [action.oldDishId], 'replaced', action.candidate.addedAt), action.candidate);
      // 新候选放回被替换项的位置，列表不跳动
      const candidates = next.candidates.filter((c) => c.dishId !== action.candidate.dishId);
      candidates.splice(index, 0, action.candidate);
      return { ...next, candidates };
    }
    case 'cartAdd':
      return updateCart(state, action.shopId, action.at, (lines) =>
        lines.some((l) => l.dishId === action.dishId)
          ? lines.map((l) => (l.dishId === action.dishId ? { ...l, qty: Math.min(MAX_QTY, l.qty + 1) } : l))
          : [...lines, { dishId: action.dishId, qty: 1 }],
      );
    case 'cartSetQty':
      return updateCart(state, action.shopId, action.at, (lines) =>
        lines.map((l) => (l.dishId === action.dishId ? { ...l, qty: Math.min(MAX_QTY, action.qty) } : l)),
      );
    case 'cartClear':
      return { ...state, carts: state.carts.filter((c) => c.shopId !== action.shopId) };
    case 'cartPut':
      return { ...state, carts: [action.cart, ...state.carts.filter((c) => c.shopId !== action.cart.shopId)] };
    case 'settings':
      return { ...state, settings: { ...state.settings, ...action.patch } };
    case 'conditions':
      return { ...state, conditions: action.conditions };
    case 'editRecord':
      return {
        ...state,
        edits: { ...state.edits, [action.shopId]: { ...state.edits[action.shopId], ...action.patch } },
      };
    case 'chosen':
      return {
        ...state,
        events: [
          ...state.events,
          { type: 'chosen', shopId: action.shopId, dishId: action.dishId, platform: action.platform, at: action.at },
        ],
      };
    case 'shiftMeal':
      return { ...state, mealShift: state.mealShift + 1 };
    case 'dockHintSeen':
      return state.dockHintSeen ? state : { ...state, dockHintSeen: true };
    case 'reset':
      return { ...seed(), conditions: EMPTY_CONDITIONS };
  }
}

const StoreContext = createContext<{ state: State; dispatch: Dispatch<Action> } | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, load);

  useEffect(() => {
    const { conditions: _session, ...data } = state;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ v: STORAGE_VERSION, data }));
    } catch {
      /* 隐私模式等情况下不保存 */
    }
  }, [state]);

  return <StoreContext.Provider value={{ state, dispatch }}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const value = useContext(StoreContext);
  if (!value) throw new Error('useStore must be used inside StoreProvider');
  return value;
}
