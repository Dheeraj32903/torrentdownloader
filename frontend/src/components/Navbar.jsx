import React from 'react';
import { Zap, ArrowDown, ArrowUp, HardDrive, Wifi, WifiOff } from 'lucide-react';

export default function Navbar({ connected, speeds, diskStats, activeCount, onOpenStorage }) {
  const percentUsed = diskStats?.percentUsed || 0;
  const isStorageHigh = percentUsed > 85;

  return (
    <header className="sticky top-4 z-40 max-w-[1200px] mx-auto px-4 w-full">
      <div className="ui-card px-5 py-3.5 flex items-center justify-between gap-4">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#0e52ff] flex items-center justify-center text-white shadow-xs shrink-0">
            <Zap className="w-5 h-5 fill-white text-white" />
          </div>

          <div className="flex items-center gap-2">
            <span className="font-display font-bold text-lg tracking-tight text-slate-900">
              MagnetX
            </span>
            <span className="px-2 py-0.5 text-[11px] font-semibold text-slate-500 bg-slate-100 rounded-md">
              v2.0
            </span>
          </div>
        </div>

        {/* Live Network, Storage & Status */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Global Speed Stats */}
          <div className="flex items-center gap-3 bg-slate-50 border border-slate-200/80 px-3.5 py-1.5 rounded-xl mono-stat text-xs">
            {/* Download */}
            <div className="flex items-center gap-1.5 text-blue-600 font-bold" title="Swarm total download speed">
              <ArrowDown className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>{speeds?.downloadFormatted || '0 B/s'}</span>
            </div>
            <span className="text-slate-200">|</span>
            {/* Upload */}
            <div className="flex items-center gap-1.5 text-slate-600 font-medium" title="Swarm total upload speed">
              <ArrowUp className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>{speeds?.uploadFormatted || '0 B/s'}</span>
            </div>
          </div>

          {/* Disk Space Meter */}
          {diskStats && (
            <button
              type="button"
              onClick={onOpenStorage}
              className="hidden md:flex items-center gap-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200/80 px-3.5 py-1.5 rounded-xl text-xs transition-colors cursor-pointer group"
              title="Click to view disk storage & free space"
            >
              <HardDrive className={`w-3.5 h-3.5 transition-colors ${isStorageHigh ? 'text-amber-500' : 'text-slate-400 group-hover:text-blue-600'}`} />
              <div className="flex flex-col gap-1 w-24 text-left">
                <div className="flex justify-between text-[10px] text-slate-500 mono-stat font-medium">
                  <span className="group-hover:text-slate-800 transition-colors">SSD (C:)</span>
                  <span className={isStorageHigh ? 'text-amber-600 font-bold' : 'text-slate-700'}>
                    {percentUsed}%
                  </span>
                </div>
                <div className="w-full h-1 bg-slate-200 rounded-full overflow-hidden">
                  <div 
                    className={`h-full rounded-full transition-all duration-500 ${isStorageHigh ? 'bg-amber-500' : 'bg-blue-600'}`}
                    style={{ width: `${percentUsed}%` }}
                  />
                </div>
              </div>
            </button>
          )}

          {/* Swarm Status Indicator */}
          <div 
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-semibold ${
              connected 
                ? 'bg-emerald-50 border-emerald-200 text-emerald-700' 
                : 'bg-rose-50 border-rose-200 text-rose-700'
            }`}
          >
            {connected ? (
              <>
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                <span className="hidden sm:inline font-medium">Engine Active</span>
              </>
            ) : (
              <>
                <WifiOff className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Offline</span>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
