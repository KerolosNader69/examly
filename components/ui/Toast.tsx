'use client';

import React, { createContext, useCallback, useContext, useRef, useState } from 'react';

type ToastType = 'success' | 'error' | 'info';

interface Toast {
  id: number;
  message: string;
  type: ToastType;
}

type PushToast = (message: string, type?: ToastType) => void;

const ToastContext = createContext<PushToast>(() => {});

export function useToast(): PushToast {
  return useContext(ToastContext);
}

const toastStyles: Record<ToastType, { icon: string; iconPath: string; border: string }> = {
  success: {
    border: 'border-emerald-200 dark:border-emerald-500/30',
    icon: 'text-emerald-500',
    iconPath: 'M5 13l4 4L19 7',
  },
  error: {
    border: 'border-error/30 dark:border-error/40',
    icon: 'text-error',
    iconPath: 'M6 18L18 6M6 6l12 12',
  },
  info: {
    border: 'border-primary-teal/30',
    icon: 'text-primary-teal',
    iconPath: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  },
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const idRef = useRef(0);

  const push = useCallback<PushToast>((message, type = 'success') => {
    idRef.current += 1;
    const id = idRef.current;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, 3500);
  }, []);

  return (
    <ToastContext.Provider value={push}>
      {children}
      <div
        aria-live="polite"
        className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 max-w-sm w-[calc(100%-2rem)] sm:w-auto"
      >
        {toasts.map((toast) => {
          const style = toastStyles[toast.type];
          return (
            <div
              key={toast.id}
              className={`flex items-center gap-3 px-4 py-3 rounded-card-lg bg-white dark:bg-deep-teal border shadow-lg animate-[fadeInUp_0.3s_ease-out] ${style.border}`}
            >
              <svg className={`w-5 h-5 flex-shrink-0 ${style.icon}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={style.iconPath} />
              </svg>
              <p className="text-sm font-medium text-text-dark dark:text-light-mint">{toast.message}</p>
              <button
                onClick={() => setToasts((prev) => prev.filter((t) => t.id !== toast.id))}
                className="ml-auto text-text-dark/30 hover:text-text-dark dark:text-light-mint/40 dark:hover:text-light-mint transition-colors"
                aria-label="Dismiss notification"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
