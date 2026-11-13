import React from 'react';
import { CheckCircle2, AlertCircle, Info, AlertTriangle, X } from 'lucide-react';

export default function ToastContainer({ toasts, onDismiss }) {
  if (!toasts || toasts.length === 0) return null;

  const getToastConfig = (type) => {
    switch (type) {
      case 'success':
        return {
          icon: <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />,
          classes: 'bg-emerald-50 border-emerald-200 text-emerald-900 shadow-sm'
        };
      case 'error':
        return {
          icon: <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />,
          classes: 'bg-rose-50 border-rose-200 text-rose-900 shadow-sm'
        };
      case 'warning':
        return {
          icon: <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />,
          classes: 'bg-amber-50 border-amber-200 text-amber-900 shadow-sm'
        };
      default:
        return {
          icon: <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />,
          classes: 'bg-blue-50 border-blue-200 text-blue-900 shadow-sm'
        };
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none px-4 sm:px-0">
      {toasts.map((toast) => {
        const config = getToastConfig(toast.type);
        return (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-start gap-3 p-3.5 rounded-xl border backdrop-blur-md transition-all duration-300 animate-in slide-in-from-bottom-5 ${config.classes}`}
          >
            {config.icon}
            <div className="flex-1 text-xs font-semibold leading-relaxed">
              {toast.message}
            </div>
            <button
              type="button"
              onClick={() => onDismiss(toast.id)}
              className="p-1 rounded-lg hover:bg-black/5 text-slate-500 hover:text-slate-800 transition-colors shrink-0"
              title="Dismiss notification"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
