import React, { useState } from 'react';
import { 
  HardDrive, Trash2, X, Sparkles, FolderX 
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
      '⚠️ Are you sure you want to purge all downloads and clear your disk space?\n\nThis will remove all torrents and permanently delete all downloaded video files from your SSD.'
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
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        className="relative w-full max-w-xl bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-2xl overflow-hidden font-sans"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-start justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 border ${
              isStorageHigh 
                ? 'bg-amber-50 border-amber-200 text-amber-600' 
                : 'bg-blue-50 border-blue-100 text-blue-600'
            }`}>
              <HardDrive className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
                Disk Storage & Cache Manager
              </h3>
              <p className="text-xs text-slate-500 font-sans">
                Local Drive (C:\) • Download Cache
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
            title="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Storage Bar Card */}
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-3 mb-6">
          <div className="flex items-center justify-between text-xs font-mono mono-stat">
            <div className="flex items-center gap-2">
              <span className="text-slate-900 font-bold text-sm">{percentUsed}% Used</span>
              <span className="text-slate-300">|</span>
              <span className="text-blue-600 font-semibold">{diskFreeFormatted} Free</span>
            </div>
            <div className="text-slate-500">
              Total: {diskTotalFormatted}
            </div>
          </div>

          {/* Meter */}
          <div className="w-full h-2.5 bg-slate-200 rounded-full overflow-hidden">
            <div 
              className={`h-full rounded-full transition-all duration-500 ${
                isStorageHigh 
                  ? 'bg-amber-500' 
                  : 'bg-blue-600'
              }`}
              style={{ width: `${percentUsed}%` }}
            />
          </div>

          {/* Breakdown summary */}
          <div className="grid grid-cols-2 gap-3 pt-2 text-xs border-t border-slate-200/80">
            <div>
              <span className="text-slate-500 block text-[11px] font-sans">MagnetX Downloads</span>
              <span className="text-blue-600 font-bold font-mono mono-stat text-sm">{usedInDownloadsFormatted}</span>
            </div>
            <div>
              <span className="text-slate-500 block text-[11px] font-sans">Active Transfers</span>
              <span className="text-slate-800 font-bold font-mono mono-stat text-sm">{torrents.length} items</span>
            </div>
          </div>
        </div>

        {/* Informative notice */}
        <div className="bg-blue-50/60 border border-blue-100 rounded-xl p-3.5 mb-6 text-xs text-slate-700 space-y-1">
          <div className="flex items-center gap-1.5 font-semibold text-blue-700">
            <Sparkles className="w-3.5 h-3.5" />
            <span>How Local Storage Works</span>
          </div>
          <p className="text-[11px] text-slate-600 leading-relaxed font-sans">
            MagnetX streams and saves video pieces directly to your local SSD. Once you finish watching a movie, you can delete it below to free up disk space instantly.
          </p>
        </div>

        {/* Torrents List & Cleanup */}
        <div className="space-y-3 mb-6">
          <label className="text-xs font-semibold text-slate-700 flex items-center justify-between font-sans">
            <span>Stored Files ({torrents.length})</span>
            <span className="text-[11px] text-slate-400 font-mono">1-Click Free Space</span>
          </label>

          {torrents.length > 0 ? (
            <div className="divide-y divide-slate-100 bg-white border border-slate-200 rounded-xl max-h-48 overflow-y-auto">
              {torrents.map((t) => (
                <div key={t.infoHash} className="p-3 flex items-center justify-between gap-3 text-xs hover:bg-slate-50">
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-slate-900 truncate font-sans" title={t.name}>
                      {t.name}
                    </div>
                    <div className="text-[11px] text-slate-500 font-mono mono-stat">
                      {formatBytes(t.downloaded || t.total || 0)} • {t.status === 'completed' || t.status === 'ready' ? 'Ready' : `${Math.round((t.progress || 0) * 100)}%`}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => onDeleteTorrent(t.infoHash, t.name)}
                    className="px-3 py-1.5 rounded-lg text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
                    title="Delete files from disk"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>Free Space</span>
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-6 text-center text-xs text-slate-400 bg-slate-50 rounded-xl border border-slate-200 font-sans">
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
            className="w-full py-3 px-4 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 font-sans font-semibold text-xs sm:text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-50"
          >
            <FolderX className="w-4 h-4 text-rose-600" />
            <span>{purging ? 'Purging All Files...' : 'Purge All Downloads & Wipe Cache'}</span>
          </button>
        )}
      </div>
    </div>
  );
}
