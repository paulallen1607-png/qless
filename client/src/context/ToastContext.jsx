import { createContext, useCallback, useContext, useState } from 'react';
import { Icon } from '../components/Icon.jsx';

const ToastCtx = createContext(() => {});

const STYLE = {
  success: { icon: 'check', cls: 'text-ok' },
  error: { icon: 'alert', cls: 'text-bad' },
  info: { icon: 'bell', cls: 'text-peri' },
  ready: { icon: 'bell', cls: 'text-lime' },
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const toast = useCallback((message, type = 'success', ms = 3200) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((t) => [...t.slice(-2), { id, message, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), ms);
  }, []);

  return (
    <ToastCtx.Provider value={toast}>
      {children}
      <div className="no-print pointer-events-none fixed inset-x-0 top-3 z-[100] flex flex-col items-center gap-2 px-4">
        {toasts.map((t) => {
          const s = STYLE[t.type] || STYLE.info;
          return (
            <div
              key={t.id}
              role="status"
              className="animate-toast pointer-events-auto flex w-full max-w-[420px] items-start gap-3 rounded-2xl border border-stroke bg-surface2/95 px-4 py-3 text-sm shadow-2xl shadow-black/50 backdrop-blur"
            >
              <Icon name={s.icon} className={`mt-0.5 h-4 w-4 shrink-0 ${s.cls}`} />
              <span className="leading-snug">{t.message}</span>
            </div>
          );
        })}
      </div>
    </ToastCtx.Provider>
  );
}

export const useToast = () => useContext(ToastCtx);
