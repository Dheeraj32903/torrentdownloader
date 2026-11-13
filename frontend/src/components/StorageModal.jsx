import React, { useState } from 'react';
import { 
  HardDrive, Trash2, X, AlertTriangle, CheckCircle2, 
  Sparkles, RefreshCw, FolderX, ShieldCheck, Zap 
} from 'lucide-react';
import { formatBytes } from '../utils/format.js';

export default function StorageModal({ 
  isOpen, 
  onClose, 
  diskStats, 
  torrents, 
  onDeleteTorrent, 
  onPurgeAll,
  onShowToast 
}) {
  const [purging, setPurging] = useState(false);

  if (!isOpen) return null;

  const percentUsed = diskStats?.percentUsed || 0;
  const isStorageHigh = percentUsed > 85;
  const usedInDownloadsFormatted = diskStats?.usedInDownloadsFormatted || '0 B';
  const diskFreeFormatted = diskStats?.diskFreeFormatted || '0 B';
  const diskTotalFormatted = diskStats?.diskTotalFormatted || '0 B';

  const handlePurgeAllClick = async () => {
    const confirmed = window.confirm(
      '⚠️ Are you sure you want to purge all downloads and clear your disk space?\n\nThis will remove all torrents and permanently delete all downloaded video pieces from your SSD.'
    );
    if (!confirmed) return;

    setPurging(true);
    try {
      await onPurgeAll();
      onClose();
    } catch (err) {
      console.warn('Purge error:', err);
    } finally {
      setPurging(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/85 backdrop-blur-xl animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        className="relative w-full max-w-xl bg-[#0c0e17]/95 border border-white/[0.1] rounded-3xl p-6 sm:p-8 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Glow corners */}
        <div className="absolute -top-24 -right-24 w-60 h-60 bg-emerald-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-60 h-60 bg-cyan-500/15 rounded-full blur-3xl pointer-events-none" />

        {/* Modal Header */}
        <div className="flex items-start justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 border ${
              isStorageHigh 
                ? 'bg-amber-500/20 border-amber-500/30 text-amber-400' 
                : 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400'
            }`}>
              <HardDrive className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg sm:text-xl font-display font-bold text-white tracking-tight">
                Disk Storage & Cache Manager
              </h3>
              <p className="text-xs text-slate-400 font-medium">
                Local Drive (C:\) • Download Cache
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] text-slate-400 hover:text-white border border-white/[0.08] transition-all"
            title="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Storage Bar Card */}
        <div className="bg-black/50 border border-white/[0.08] rounded-2xl p-4 sm:p-5 space-y-3 mb-6">
          <div className="flex items-center justify-between text-xs mono-stat">
            <div className="flex items-center gap-2">
              <span className="text-white font-bold text-sm">{percentUsed}% Used</span>
              <span className="text-slate-500">|</span>
              <span className="text-emerald-400 font-semibold">{diskFreeFormatted} Free</span>
            </div>
            <div className="text-slate-400">
              Total: {diskTotalFormatted}
            </div>
          </div>

          {/* Meter */}
          <div className="w-full h-3 bg-black/60 rounded-full overflow-hidden p-0.5 border border-white/[0.08]">
            <div 
              className={`h-full rounded-full transition-all duration-500 ${
                isStorageHigh 
                  ? 'bg-gradient-to-r from-amber-500 to-rose-500' 
                  : 'bg-gradient-to-r from-emerald-500 via-cyan-400 to-indigo-500'
              }`}
              style={{ width: `${percentUsed}%` }}
            />
          </div>

          {/* Breakdown summary */}
          <div className="grid grid-cols-2 gap-3 pt-2 text-xs border-t border-white/[0.06]">
            <div>
              <span className="text-slate-400 block text-[11px]">MagnetX Downloads</span>
              <span className="text-cyan-400 font-bold mono-stat text-sm">{usedInDownloadsFormatted}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[11px]">Active Transfers</span>
              <span className="text-white font-bold mono-stat text-sm">{torrents.length} items</span>
            </div>
          </div>
        </div>

        {/* Why this is here notice */}
        <div className="bg-indigo-950/30 border border-indigo-500/20 rounded-2xl p-3.5 mb-6 text-xs text-slate-300 space-y-1">
          <div className="flex items-center gap-1.5 font-bold text-indigo-300">
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
            <span>How Local Storage Works in MagnetX</span>
          </div>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            MagnetX runs on your machine and saves video chunks to your SSD so you can stream them without internet buffer lag. Once you finish watching a movie, you can delete it below to keep your disk 100% clean.
          </p>
        </div>

        {/* Torrents List & Cleanup */}
        <div className="space-y-3 mb-6">
          <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
            <span>Stored Files ({torrents.length})</span>
            <span className="text-[11px] text-slate-500 font-mono">1-Click Free Space</span>
          </label>

          {torrents.length > 0 ? (
            <div className="divide-y divide-white/[0.04] bg-black/30 border border-white/[0.06] rounded-2xl max-h-48 overflow-y-auto">
              {torrents.map((t) => (
                <div key={t.infoHash} className="p-3 flex items-center justify-between gap-3 text-xs hover:bg-white/[0.02]">
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-slate-200 truncate" title={t.name}>
                      {t.name}
                    </div>
                    <div className="text-[11px] text-slate-400 mono-stat">
                      {formatBytes(t.downloaded || t.total || 0)} • {t.status === 'completed' ? 'Ready' : `${Math.round((t.progress || 0) * 100)}%`}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => onDeleteTorrent(t.infoHash, t.name)}
                    className="btn-glass px-2.5 py-1.5 rounded-xl text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 border-white/[0.08] hover:border-rose-500/30 text-xs font-semibold flex items-center gap-1 transition-all shrink-0"
                    title="Delete files from disk"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>Free Space</span>
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-6 text-center text-xs text-slate-500 bg-black/20 rounded-2xl border border-white/[0.06]">
              No active files stored on disk. Your drive is clean!
            </div>
          )}
        </div>

        {/* Big Purge All Button */}
        {torrents.length > 0 && (
          <button
            type="button"
            onClick={handlePurgeAllClick}
            disabled={purging}
            className="w-full py-3 px-4 rounded-2xl bg-gradient-to-r from-rose-500/20 to-amber-500/20 hover:from-rose-500/30 hover:to-amber-500/30 text-rose-300 border border-rose-500/30 font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-rose-500/10 transition-all disabled:opacity-50"
          >
            <FolderX className="w-4 h-4 text-rose-400" />
            <span>{purging ? 'Purging All Files...' : 'Purge All Downloads & Wipe Cache'}</span>
          </button>
        )}
      </div>
    </div>
  );
}
