import React from 'react';
import { Zap, HardDrive, ArrowDown, ArrowUp } from 'lucide-react';

export default function Navbar({ connected, speeds, diskStats, activeCount, onOpenStorage }) {
  const percentUsed = diskStats?.percentUsed || 0;
  const isStorageHigh = percentUsed > 85;

  return (
    <header className="sticky top-4 z-40 max-w-[1200px] mx-auto px-4 w-full">
      <div className="bg-white/95 backdrop-blur-md border border-slate-200/90 rounded-2xl px-5 py-3 flex items-center justify-between gap-4 shadow-sm">
        {/* Brand - Matches Image 4 exactly */}
        <div className="flex items-center gap-3">
          <div className="relative w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center text-white shrink-0 shadow-sm shadow-blue-500/20">
            <Zap className="w-5 h-5 fill-white text-white" />
            {/* Top-right indicator dot from logo design */}
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-blue-400 border-2 border-white" />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xl font-bold tracking-tight">
              <span className="text-slate-900 font-extrabold">Magnet</span>
              <span className="text-blue-600 font-extrabold">X</span>
            </span>
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-200">
              PRO
            </span>
          </div>
        </div>

        {/* Live Network & Speeds */}
        <div className="flex items-center gap-2.5 sm:gap-3">
          {/* Global Speed Stats */}
          <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 px-3.5 py-1.5 rounded-xl text-xs font-mono shadow-xs">
            <div className="flex items-center gap-1 text-blue-600 font-semibold mono-stat" title="Total swarm download speed">
              <ArrowDown className="w-3.5 h-3.5" />
              <span>{speeds?.downloadFormatted || '0 B/s'}</span>
            </div>
            <span className="text-slate-300">|</span>
            <div className="flex items-center gap-1 text-slate-500 font-medium mono-stat" title="Total swarm upload speed">
              <ArrowUp className="w-3.5 h-3.5" />
              <span>{speeds?.uploadFormatted || '0 B/s'}</span>
            </div>
          </div>

          {/* Clean SSD Storage Meter - Fixed, clean text, no green box */}
          {diskStats && (
            <button
              type="button"
              onClick={onOpenStorage}
              className="hidden md:flex items-center gap-2.5 bg-slate-50 hover:bg-slate-100/80 border border-slate-200 hover:border-slate-300 px-3.5 py-1.5 rounded-xl text-xs font-mono transition-colors cursor-pointer group"
              title="Click to view disk storage & free space"
            >
              <HardDrive className={`w-3.5 h-3.5 ${isStorageHigh ? 'text-amber-500' : 'text-slate-500'}`} />
              <span className="text-slate-700 font-semibold">SSD</span>
              
              {/* Progress track */}
              <div className="w-14 h-1.5 bg-slate-200 rounded-full overflow-hidden flex items-center">
                <div 
                  className={`h-full rounded-full transition-all duration-300 ${
                    isStorageHigh ? 'bg-amber-500' : 'bg-blue-600'
                  }`}
                  style={{ width: `${Math.min(percentUsed, 100)}%` }}
                />
              </div>

              {/* Clean percentage: Crisp text, NO green square background */}
              <span className={`mono-stat font-semibold ${isStorageHigh ? 'text-amber-600' : 'text-slate-700'}`}>
                {percentUsed}%
              </span>
            </button>
          )}

          {/* Connection Status Indicator */}
          <div 
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-medium transition-colors ${
              connected 
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                : 'bg-rose-50 text-rose-700 border-rose-200'
            }`}
          >
            {connected && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />}
            <span>{connected ? 'Live' : 'Offline'}</span>
          </div>
        </div>
      </div>
    </header>
  );
}
