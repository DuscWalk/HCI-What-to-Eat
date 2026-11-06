import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';

export interface ToastOptions {
  text: string;
  action?: string;
  onAction?: () => void;
  duration?: number;
}

interface ToastState extends ToastOptions {
  id: number;
}

interface ToastValue {
  current: ToastState | null;
  show: (options: ToastOptions) => void;
  dismiss: () => void;
}

const ToastContext = createContext<ToastValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [current, setCurrent] = useState<ToastState | null>(null);
  const timer = useRef<number>();
  const seq = useRef(0);

  const dismiss = useCallback(() => {
    window.clearTimeout(timer.current);
    setCurrent(null);
  }, []);

  const show = useCallback((options: ToastOptions) => {
    window.clearTimeout(timer.current);
    const id = ++seq.current;
    setCurrent({ ...options, id });
    timer.current = window.setTimeout(
      () => setCurrent((t) => (t?.id === id ? null : t)),
      options.duration ?? (options.action ? 4500 : 2400),
    );
  }, []);

  const value = useMemo(() => ({ current, show, dismiss }), [current, show, dismiss]);
  return <ToastContext.Provider value={value}>{children}</ToastContext.Provider>;
}

export function useToast() {
  const value = useContext(ToastContext);
  if (!value) throw new Error('useToast must be used inside ToastProvider');
  return value;
}

export function ToastHost() {
  const { current, dismiss } = useToast();
  if (!current) return null;
  return (
    <div className="toast" role="status" key={current.id}>
      <span className="toast-text">{current.text}</span>
      {current.action && (
        <button
          className="toast-action"
          onClick={() => {
            current.onAction?.();
            dismiss();
          }}
        >
          {current.action}
        </button>
      )}
    </div>
  );
}
