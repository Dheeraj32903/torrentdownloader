import React from 'react';
import { Zap, HardDrive } from 'lucide-react';

export default function Navbar({ connected, speeds, diskStats, activeCount, onOpenStorage }) {
  const percentUsed = diskStats?.percentUsed || 0;
  const isStorageHigh = percentUsed > 85;

  return (
    <header className="sticky top-4 z-40 max-w-[1200px] mx-auto px-4 w-full font-mono">
      <div className="ui-card px-5 py-3.5 flex items-center justify-between gap-4">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#0066FF] flex items-center justify-center text-white shadow-sm shadow-blue-500/30 shrink-0">
            <Zap className="w-5 h-5 fill-white text-white" />
          </div>

          <div className="flex items-center gap-2">
            <span className="font-bold text-base sm:text-lg tracking-tight text-[#0D0F1C]">
              MAGNETX
            </span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-[#EBF2FF] text-[#0066FF] border border-[#B8D0FF]">
              [ PRO ]
            </span>
          </div>
        </div>

        {/* Live Network & Speeds */}
        <div className="flex items-center gap-2.5 sm:gap-3">
          {/* Global Speed Stats */}
          <div className="flex items-center gap-2.5 bg-white border border-[#E0E4EC] px-3.5 py-1.5 rounded-xl text-xs shadow-xs">
            <div className="flex items-center gap-1 text-[#059669] font-bold mono-stat" title="Swarm download speed">
              <span>↓</span>
              <span>{speeds?.downloadFormatted || '0 B/s'}</span>
            </div>
            <span className="text-[#E0E4EC] font-bold">/</span>
            <div className="flex items-center gap-1 text-[#646E82] font-semibold mono-stat" title="Swarm upload speed">
              <span className="text-slate-400">↑</span>
              <span>{speeds?.uploadFormatted || '0 B/s'}</span>
            </div>
          </div>

          {/* Clean SSD Storage Meter - No text highlight, no green box */}
          {diskStats && (
            <button
              type="button"
              onClick={onOpenStorage}
              className="hidden md:flex items-center gap-2.5 bg-white hover:bg-[#F8FAFC] border border-[#E0E4EC] hover:border-[#B8D0FF] px-3.5 py-1.5 rounded-xl text-xs shadow-xs transition-all cursor-pointer group"
              title="Click to view disk storage & free space"
            >
              <HardDrive className={`w-3.5 h-3.5 ${isStorageHigh ? 'text-amber-500' : 'text-[#0066FF]'}`} />
              <span className="text-[#0D0F1C] font-bold">SSD</span>
              
              {/* Progress bar */}
              <div className="w-14 h-2 bg-slate-100 rounded-full overflow-hidden border border-slate-200/60 p-[1px] flex items-center">
                <div 
                  className={`h-full rounded-full transition-all duration-300 ${
                    isStorageHigh ? 'bg-amber-500' : 'bg-[#0066FF]'
                  }`}
                  style={{ width: `${Math.min(percentUsed, 100)}%` }}
                />
              </div>

              {/* Clean percentage label */}
              <span className={`mono-stat font-bold ${isStorageHigh ? 'text-amber-600' : 'text-[#0D0F1C]'}`}>
                {percentUsed}%
              </span>
            </button>
          )}

          {/* Status Indicator */}
          <div 
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold font-mono shadow-xs ${
              connected 
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                : 'bg-rose-50 text-rose-700 border-rose-200'
            }`}
          >
            {connected && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />}
            <span>{connected ? '[ LIVE ]' : '[ OFFLINE ]'}</span>
          </div>
        </div>
      </div>
    </header>
  );
}
