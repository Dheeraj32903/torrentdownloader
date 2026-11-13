import React from 'react';
import { Zap, DownloadCloud, UploadCloud, HardDrive, Wifi, WifiOff, Activity } from 'lucide-react';
import { formatBytes } from '../utils/format.js';

export default function Navbar({ connected, speeds, diskStats, activeCount }) {
  const percentUsed = diskStats?.percentUsed || 0;
  const isStorageHigh = percentUsed > 85;

  return (
    <header className="sticky top-0 z-40 backdrop-blur-xl bg-white/85 border-b border-slate-200/80 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center gap-3.5">
          <div className="relative flex items-center justify-center w-11 h-11 rounded-2xl bg-gradient-to-tr from-indigo-600 via-indigo-700 to-violet-600 shadow-md shadow-indigo-500/25 border border-indigo-400/20 group cursor-pointer transition-transform hover:scale-105">
            <Zap className="w-5 h-5 text-white drop-shadow fill-white/20" />
            <span className="absolute -top-1 -right-1 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-indigo-600 ring-2 ring-white"></span>
            </span>
          </div>

          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-xl tracking-tight text-slate-900">
                Magnet<span className="bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent">X</span>
              </span>
              <span className="px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-widest bg-gradient-to-r from-indigo-50 to-violet-50 text-indigo-700 border border-indigo-200/80 rounded-full shadow-2xs">
                PRO ENGINE
              </span>
            </div>
            <p className="text-[11px] text-slate-500 font-medium tracking-wide hidden sm:block">
              High-Speed Cloud Torrent & Live Stream Hub
            </p>
          </div>
        </div>

        {/* Live Network & Speeds */}
        <div className="flex items-center gap-3 sm:gap-5">
          {/* Global Speed Stats */}
          <div className="flex items-center gap-2 sm:gap-4 bg-slate-50/90 border border-slate-200/90 px-3.5 py-2 rounded-2xl shadow-2xs font-mono text-xs">
            {/* Download */}
            <div className="flex items-center gap-1.5 text-indigo-600 font-bold" title="Total swarm download speed">
              <DownloadCloud className="w-4 h-4 animate-bounce" />
              <span>{speeds?.downloadFormatted || '0 B/s'}</span>
            </div>
            <span className="text-slate-300">|</span>
            {/* Upload */}
            <div className="flex items-center gap-1.5 text-slate-500 font-medium" title="Total swarm upload speed">
              <UploadCloud className="w-4 h-4" />
              <span>{speeds?.uploadFormatted || '0 B/s'}</span>
            </div>
          </div>

          {/* Disk Space Meter */}
          {diskStats && (
            <div className="hidden lg:flex items-center gap-3 bg-slate-50/90 border border-slate-200/90 px-3.5 py-2 rounded-2xl text-xs shadow-2xs">
              <HardDrive className={`w-4 h-4 ${isStorageHigh ? 'text-amber-500' : 'text-slate-500'}`} />
              <div className="flex flex-col gap-1 w-28">
                <div className="flex justify-between text-[11px] font-semibold text-slate-700">
                  <span>SSD Storage</span>
                  <span className={isStorageHigh ? 'text-amber-600 font-bold' : 'text-slate-500'}>
                    {percentUsed}%
                  </span>
                </div>
                <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                  <div 
                    className={`h-full rounded-full transition-all duration-500 ${isStorageHigh ? 'bg-gradient-to-r from-amber-500 to-rose-500' : 'bg-gradient-to-r from-indigo-500 to-sky-500'}`}
                    style={{ width: `${percentUsed}%` }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Connection Status Badge */}
          <div 
            className={`flex items-center gap-2 px-3 py-2 rounded-2xl border text-xs font-bold shadow-2xs transition-all ${
              connected 
                ? 'bg-emerald-50/90 border-emerald-200 text-emerald-700' 
                : 'bg-rose-50/90 border-rose-200 text-rose-700 animate-pulse'
            }`}
            title={connected ? "Connected to MagnetX 74+ Trackers Swarm Engine" : "Reconnecting to server..."}
          >
            {connected ? (
              <>
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-600 ring-2 ring-white"></span>
                </span>
                <span className="hidden sm:inline">Swarm Ready</span>
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
