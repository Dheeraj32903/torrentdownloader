import React from 'react';
import { Zap, DownloadCloud, UploadCloud, HardDrive, Wifi, WifiOff } from 'lucide-react';
import { formatBytes } from '../utils/format.js';

export default function Navbar({ connected, speeds, diskStats, activeCount }) {
  const percentUsed = diskStats?.percentUsed || 0;
  const isStorageHigh = percentUsed > 85;

  return (
    <header className="sticky top-0 z-40 backdrop-blur-xl bg-[#090e1a]/80 border-b border-white/10 shadow-lg shadow-black/40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="relative flex items-center justify-center w-11 h-11 rounded-xl bg-gradient-to-tr from-cyan-500 to-indigo-600 shadow-lg shadow-cyan-500/25 border border-white/20">
            <Zap className="w-6 h-6 text-white drop-shadow" />
            <span className="absolute -top-1 -right-1 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-cyan-500"></span>
            </span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-xl tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent">
                Magnet<span className="text-cyan-400">X</span>
              </span>
              <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-cyan-500/10 text-cyan-300 border border-cyan-500/30 rounded-full">
                Pro Cloud
              </span>
            </div>
            <p className="text-xs text-slate-400 font-medium hidden sm:block">
              Direct Torrent & Magnet Extractor
            </p>
          </div>
        </div>

        {/* Live Network & Speeds */}
        <div className="flex items-center gap-3 sm:gap-6">
          {/* Global Speed Stats */}
          <div className="flex items-center gap-2 sm:gap-4 bg-slate-900/60 border border-white/10 px-3.5 py-1.5 rounded-xl shadow-inner font-mono text-xs">
            {/* Download */}
            <div className="flex items-center gap-1.5 text-cyan-400 font-semibold" title="Total swarm download speed">
              <DownloadCloud className="w-4 h-4 animate-pulse" />
              <span>{speeds?.downloadFormatted || '0 B/s'}</span>
            </div>
            <span className="text-white/20">|</span>
            {/* Upload */}
            <div className="flex items-center gap-1.5 text-indigo-300 font-medium" title="Total swarm upload speed">
              <UploadCloud className="w-4 h-4" />
              <span>{speeds?.uploadFormatted || '0 B/s'}</span>
            </div>
          </div>

          {/* Disk Space Meter */}
          {diskStats && (
            <div className="hidden md:flex items-center gap-3 bg-slate-900/60 border border-white/10 px-3.5 py-1.5 rounded-xl text-xs">
              <HardDrive className={`w-4 h-4 ${isStorageHigh ? 'text-amber-400' : 'text-slate-400'}`} />
              <div className="flex flex-col gap-1 w-28">
                <div className="flex justify-between text-[11px] font-medium text-slate-300">
                  <span>Storage</span>
                  <span className={isStorageHigh ? 'text-amber-400 font-bold' : 'text-slate-400'}>
                    {percentUsed}%
                  </span>
                </div>
                <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <div 
                    className={`h-full rounded-full transition-all duration-500 ${isStorageHigh ? 'bg-gradient-to-r from-amber-500 to-rose-500' : 'bg-gradient-to-r from-cyan-500 to-emerald-400'}`}
                    style={{ width: `${percentUsed}%` }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Connection Status Badge */}
          <div 
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-semibold shadow-sm transition-all ${
              connected 
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' 
                : 'bg-rose-500/10 border-rose-500/30 text-rose-400 animate-pulse'
            }`}
            title={connected ? "Connected to MagnetX WebSocket engine" : "Reconnecting to server..."}
          >
            {connected ? (
              <>
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span className="hidden sm:inline">Swarm Live</span>
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
