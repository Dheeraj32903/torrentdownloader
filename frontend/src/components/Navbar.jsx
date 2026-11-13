import React from 'react';
import { Zap, ArrowDown, ArrowUp, HardDrive, Wifi, WifiOff } from 'lucide-react';

export default function Navbar({ connected, speeds, diskStats, activeCount, onOpenStorage }) {
  const percentUsed = diskStats?.percentUsed || 0;
  const isStorageHigh = percentUsed > 85;

  return (
    <header className="sticky top-4 z-40 max-w-[1200px] mx-auto px-4 w-full">
      <div className="ui-card px-5 py-3 flex items-center justify-between gap-4 bg-white/95 backdrop-blur-md">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="relative flex items-center justify-center w-9 h-9 rounded-xl bg-blue-600 shadow-sm shadow-blue-500/20 text-white">
            <Zap className="w-5 h-5 fill-white" />
            <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-500"></span>
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="font-display font-bold text-lg tracking-tight text-slate-900">
              Magnet<span className="text-blue-600">X</span>
            </span>
            <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-blue-50 text-blue-700 border border-blue-200/80 rounded-full">
              PRO
            </span>
          </div>
        </div>

        {/* Live Network & Speeds */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Global Speed Stats in JetBrains Mono */}
          <div className="flex items-center gap-3 bg-slate-50 border border-slate-200/80 px-3.5 py-1.5 rounded-xl mono-stat text-xs">
            {/* Download */}
            <div className="flex items-center gap-1.5 text-blue-600 font-bold" title="Total swarm download speed">
              <ArrowDown className="w-3.5 h-3.5 text-blue-600 stroke-[2.5]" />
              <span>{speeds?.downloadFormatted || '0 B/s'}</span>
            </div>
            <span className="text-slate-300">|</span>
            {/* Upload */}
            <div className="flex items-center gap-1.5 text-slate-600 font-medium" title="Total swarm upload speed">
              <ArrowUp className="w-3.5 h-3.5 text-slate-500 stroke-[2.5]" />
              <span>{speeds?.uploadFormatted || '0 B/s'}</span>
            </div>
          </div>

          {/* Clickable Interactive Disk Space Meter */}
          {diskStats && (
            <button
              type="button"
              onClick={onOpenStorage}
              className="hidden md:flex items-center gap-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200/80 px-3.5 py-1.5 rounded-xl text-xs transition-all cursor-pointer group shadow-2xs"
              title="Click to view disk storage & free space"
            >
              <HardDrive className={`w-3.5 h-3.5 transition-colors ${isStorageHigh ? 'text-amber-500' : 'text-slate-500 group-hover:text-blue-600'}`} />
              <div className="flex flex-col gap-1 w-24 text-left">
                <div className="flex justify-between text-[10px] text-slate-500 mono-stat font-medium">
                  <span className="group-hover:text-slate-900 transition-colors">SSD (C:)</span>
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

          {/* Connection Status Badge */}
          <div 
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all ${
              connected 
                ? 'bg-emerald-50 border-emerald-200 text-emerald-700' 
                : 'bg-rose-50 border-rose-200 text-rose-700 animate-pulse'
            }`}
            title={connected ? "Connected to Swarm Engine" : "Reconnecting to server..."}
          >
            {connected ? (
              <>
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span className="hidden sm:inline font-medium">Live</span>
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
