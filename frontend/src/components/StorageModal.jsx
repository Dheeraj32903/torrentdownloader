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
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        className="relative w-full max-w-xl bg-white border border-[#E0E4EC] rounded-3xl p-6 sm:p-8 shadow-2xl overflow-hidden font-mono"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-start justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 border ${
              isStorageHigh 
                ? 'bg-amber-50 border-amber-200 text-amber-600' 
                : 'bg-[#EBF2FF] border-[#B8D0FF] text-[#0066FF]'
            }`}>
              <HardDrive className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg sm:text-xl font-bold text-[#0D0F1C] tracking-tight">
                Disk Storage & Cache Manager
              </h3>
              <p className="text-xs text-[#646E82] font-medium">
                Local Drive (C:\) • Download Cache
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="btn-secondary p-2 text-[#646E82] hover:text-[#0D0F1C]"
            title="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Storage Bar Card */}
        <div className="bg-[#F8FAFC] border border-[#E0E4EC] rounded-2xl p-4 sm:p-5 space-y-3 mb-6">
          <div className="flex items-center justify-between text-xs mono-stat">
            <div className="flex items-center gap-2">
              <span className="text-[#0D0F1C] font-bold text-sm">{percentUsed}% Used</span>
              <span className="text-[#E0E4EC]">|</span>
              <span className="text-[#0066FF] font-semibold">{diskFreeFormatted} Free</span>
            </div>
            <div className="text-[#646E82] font-medium">
              Total: {diskTotalFormatted}
            </div>
          </div>

          {/* Meter */}
          <div className="w-full h-3 bg-slate-200/80 rounded-full overflow-hidden p-0.5 border border-slate-200">
            <div 
              className={`h-full rounded-full transition-all duration-500 ${
                isStorageHigh 
                  ? 'bg-amber-500' 
                  : 'bg-[#0066FF]'
              }`}
              style={{ width: `${percentUsed}%` }}
            />
          </div>

          {/* Breakdown summary */}
          <div className="grid grid-cols-2 gap-3 pt-2 text-xs border-t border-[#E0E4EC]">
            <div>
              <span className="text-[#646E82] block text-[11px]">MagnetX Downloads</span>
              <span className="text-[#0066FF] font-bold mono-stat text-sm">{usedInDownloadsFormatted}</span>
            </div>
            <div>
              <span className="text-[#646E82] block text-[11px]">Active Transfers</span>
              <span className="text-[#0D0F1C] font-bold mono-stat text-sm">{torrents.length} items</span>
            </div>
          </div>
        </div>

        {/* Informative notice */}
        <div className="bg-[#EBF2FF] border border-[#B8D0FF] rounded-xl p-3.5 mb-6 text-xs text-[#0D0F1C] space-y-1">
          <div className="flex items-center gap-1.5 font-bold text-[#0066FF]">
            <Sparkles className="w-3.5 h-3.5" />
            <span>How Local Storage Works</span>
          </div>
          <p className="text-[11px] text-[#646E82] leading-relaxed">
            MagnetX saves video chunks to your SSD so you can stream them without internet buffer lag. Once you finish watching a movie, you can delete it below to keep your disk 100% clean.
          </p>
        </div>

        {/* Torrents List & Cleanup */}
        <div className="space-y-3 mb-6">
          <label className="text-xs font-semibold text-[#0D0F1C] flex items-center justify-between">
            <span>Stored Files ({torrents.length})</span>
            <span className="text-[11px] text-[#646E82] font-mono">[ 1-Click Free Space ]</span>
          </label>

          {torrents.length > 0 ? (
            <div className="divide-y divide-[#E0E4EC] bg-white border border-[#E0E4EC] rounded-xl max-h-48 overflow-y-auto">
              {torrents.map((t) => (
                <div key={t.infoHash} className="p-3 flex items-center justify-between gap-3 text-xs hover:bg-slate-50/60">
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-[#0D0F1C] truncate" title={t.name}>
                      {t.name}
                    </div>
                    <div className="text-[11px] text-[#646E82] mono-stat">
                      {formatBytes(t.downloaded || t.total || 0)} • {t.status === 'completed' ? 'Ready' : `${Math.round((t.progress || 0) * 100)}%`}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => onDeleteTorrent(t.infoHash, t.name)}
                    className="btn-secondary px-3 py-1.5 text-rose-600 border-rose-200 hover:bg-rose-50 text-xs font-semibold flex items-center gap-1 shrink-0"
                    title="Delete files from disk"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>[ FREE SPACE ]</span>
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-6 text-center text-xs text-[#646E82] bg-[#F8FAFC] rounded-xl border border-[#E0E4EC]">
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
            className="btn-secondary w-full py-3 px-4 text-rose-600 border-rose-200 hover:bg-rose-50 text-xs sm:text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <FolderX className="w-4 h-4 text-rose-600" />
            <span>{purging ? '[ PURGING ALL FILES... ]' : '[ ⚠️ PURGE ALL DOWNLOADS & WIPE CACHE ]'}</span>
          </button>
        )}
      </div>
    </div>
  );
}
