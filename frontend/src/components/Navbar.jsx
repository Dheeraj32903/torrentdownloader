import React from 'react';
import { Zap, ArrowDown, ArrowUp, HardDrive, Wifi, WifiOff, Users } from 'lucide-react';

export default function Navbar({ connected, speeds, diskStats, activeCount }) {
  const percentUsed = diskStats?.percentUsed || 0;
  const isStorageHigh = percentUsed > 85;

  return (
    <header className="sticky top-4 z-40 max-w-[1200px] mx-auto px-4 w-full">
      <div className="bento-card px-5 py-3 flex items-center justify-between gap-4 border border-white/[0.08] bg-[#0e111a]/80 backdrop-blur-2xl">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="relative flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-500 to-cyan-500 shadow-md shadow-emerald-500/20">
            <Zap className="w-5 h-5 text-black fill-black" />
            <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-400"></span>
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="font-display font-bold text-lg tracking-tight text-white">
              Magnet<span className="text-emerald-400">X</span>
            </span>
            <span className="px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 rounded-full">
              CINEMA 2026
            </span>
          </div>
        </div>

        {/* Live Network & Speeds */}
        <div className="flex items-center gap-2 sm:gap-4">
          {/* Global Speed Stats in JetBrains Mono */}
          <div className="flex items-center gap-3 bg-black/40 border border-white/[0.06] px-3.5 py-1.5 rounded-xl mono-stat text-xs">
            {/* Download */}
            <div className="flex items-center gap-1.5 text-emerald-400 font-semibold" title="Total swarm download speed">
              <ArrowDown className="w-3.5 h-3.5 text-emerald-400 stroke-[2.5]" />
              <span>{speeds?.downloadFormatted || '0 B/s'}</span>
            </div>
            <span className="text-white/10">|</span>
            {/* Upload */}
            <div className="flex items-center gap-1.5 text-cyan-300 font-medium" title="Total swarm upload speed">
              <ArrowUp className="w-3.5 h-3.5 text-cyan-400 stroke-[2.5]" />
              <span>{speeds?.uploadFormatted || '0 B/s'}</span>
            </div>
          </div>

          {/* Disk Space Meter */}
          {diskStats && (
            <div className="hidden md:flex items-center gap-2.5 bg-black/40 border border-white/[0.06] px-3.5 py-1.5 rounded-xl text-xs">
              <HardDrive className={`w-3.5 h-3.5 ${isStorageHigh ? 'text-amber-400' : 'text-slate-400'}`} />
              <div className="flex flex-col gap-1 w-24">
                <div className="flex justify-between text-[10px] text-slate-400 mono-stat font-medium">
                  <span>SSD</span>
                  <span className={isStorageHigh ? 'text-amber-400 font-bold' : 'text-slate-300'}>
                    {percentUsed}%
                  </span>
                </div>
                <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
                  <div 
                    className={`h-full rounded-full transition-all duration-500 ${isStorageHigh ? 'bg-gradient-to-r from-amber-500 to-rose-500' : 'bg-gradient-to-r from-emerald-500 to-cyan-400'}`}
                    style={{ width: `${percentUsed}%` }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Connection Status Badge */}
          <div 
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all ${
              connected 
                ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400' 
                : 'bg-rose-500/10 border-rose-500/25 text-rose-400 animate-pulse'
            }`}
            title={connected ? "Connected to Swarm Engine" : "Reconnecting to server..."}
          >
            {connected ? (
              <>
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400"></span>
                </span>
                <span className="hidden sm:inline font-medium">Swarm Live</span>
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
