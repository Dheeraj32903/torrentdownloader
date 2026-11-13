import React from 'react';
import { CheckCircle2, AlertCircle, Info, AlertTriangle, X } from 'lucide-react';

export default function ToastContainer({ toasts, onDismiss }) {
  if (!toasts || toasts.length === 0) return null;

  const getToastConfig = (type) => {
    switch (type) {
      case 'success':
        return {
          icon: <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />,
          classes: 'border-emerald-500/30 bg-[#0e1416]/95 text-emerald-200 shadow-lg shadow-emerald-500/10'
        };
      case 'error':
        return {
          icon: <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />,
          classes: 'border-rose-500/30 bg-[#160d10]/95 text-rose-200 shadow-lg shadow-rose-500/10'
        };
      case 'warning':
        return {
          icon: <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />,
          classes: 'border-amber-500/30 bg-[#16130d]/95 text-amber-200 shadow-lg shadow-amber-500/10'
        };
      default:
        return {
          icon: <Info className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />,
          classes: 'border-cyan-500/30 bg-[#0c131c]/95 text-cyan-200 shadow-lg shadow-cyan-500/10'
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
            className={`pointer-events-auto flex items-start gap-3 p-3.5 rounded-2xl border backdrop-blur-2xl transition-all duration-300 animate-in slide-in-from-bottom-5 ${config.classes}`}
          >
            {config.icon}
            <div className="flex-1 text-xs font-medium leading-relaxed text-slate-200">
              {toast.message}
            </div>
            <button
              type="button"
              onClick={() => onDismiss(toast.id)}
              className="p-1 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors shrink-0"
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
