import React, { useState } from 'react';
import { X, Play, Download, Copy, Check, Tv, ExternalLink, Sparkles } from 'lucide-react';

export default function StreamModal({ isOpen, onClose, torrent, file, onShowToast }) {
  const [copied, setCopied] = useState(false);

  if (!isOpen || !torrent) return null;

  const targetFile = file || (torrent.files || []).find(f => /\.(mp4|mkv|webm|avi|mov)$/i.test(f.name || f.path)) || { name: torrent.name, path: torrent.name };
  const relPath = targetFile.path || targetFile.name;
  const streamUrl = `${window.location.origin}/api/stream/${torrent.infoHash}?file=${encodeURIComponent(relPath)}`;
  const playlistUrl = `/api/stream-playlist/${torrent.infoHash}?file=${encodeURIComponent(relPath)}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(streamUrl);
    setCopied(true);
    onShowToast('Stream link copied to clipboard!', 'success');
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-2xl bg-white/95 backdrop-blur-2xl rounded-3xl p-6 sm:p-8 shadow-2xl border border-slate-200 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Glow corner */}
        <div className="absolute -top-20 -right-20 w-60 h-60 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Modal Header */}
        <div className="flex items-start justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600 shadow-sm">
              <Tv className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
                Stream in External Media Player
              </h3>
              <p className="text-xs text-slate-500 truncate max-w-md font-medium" title={targetFile.name}>
                {targetFile.name}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Highlight Banner */}
        <div className="bg-gradient-to-r from-indigo-50/80 via-sky-50/80 to-slate-50 border border-indigo-100 rounded-2xl p-4 mb-6">
          <div className="flex items-center gap-2 text-xs font-semibold text-indigo-900 mb-1">
            <Sparkles className="w-4 h-4 text-indigo-600" />
            <span>Zero-Latency 4K HDR & Dolby Atmos Playback</span>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            Streaming via desktop players like VLC, PotPlayer, or MPV decodes every audio format natively (Dolby Digital Plus EAC3 5.1, DTS, HEVC 10-bit) with instant timeline scrubbing and zero browser lag.
          </p>
        </div>

        {/* Option 1: One-Click M3U Download */}
        <div className="mb-6 space-y-2">
          <label className="text-xs font-semibold text-slate-700">
            Recommended: 1-Click VLC Playlist
          </label>
          <a
            href={playlistUrl}
            download
            className="w-full glow-btn-indigo text-white font-bold py-3.5 px-6 rounded-2xl flex items-center justify-center gap-3 shadow-md shadow-indigo-500/25 transition-all text-sm sm:text-base group"
          >
            <Play className="w-5 h-5 fill-current" />
            <span>Download .M3U Playlist (Auto-Opens in VLC)</span>
            <ExternalLink className="w-4 h-4 text-indigo-200 group-hover:translate-x-0.5 transition-transform" />
          </a>
        </div>

        {/* Option 2: Direct HTTP Stream URL */}
        <div className="mb-6 space-y-2">
          <label className="text-xs font-semibold text-slate-700 flex items-center justify-between">
            <span>Direct HTTP 206 Stream URL (VLC / PotPlayer / MPV / Infuse)</span>
            <span className="text-[11px] font-normal text-slate-500">Media → Open Network Stream</span>
          </label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={streamUrl}
              className="w-full bg-slate-50 border border-slate-200 text-xs font-mono px-4 py-3 rounded-xl text-slate-800 select-all"
            />
            <button
              type="button"
              onClick={handleCopy}
              className={`px-4 py-3 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all shrink-0 border ${
                copied
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
              }`}
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 text-emerald-600" />
                  <span>Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 text-indigo-600" />
                  <span>Copy</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Player Quick Steps */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-center text-xs">
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
            <div className="font-bold text-orange-600 mb-0.5">VLC Player</div>
            <div className="text-[11px] text-slate-500">Ctrl + N → Paste</div>
          </div>
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
            <div className="font-bold text-amber-600 mb-0.5">PotPlayer</div>
            <div className="text-[11px] text-slate-500">Ctrl + U → Paste</div>
          </div>
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
            <div className="font-bold text-purple-600 mb-0.5">MPV</div>
            <div className="text-[11px] text-slate-500">mpv &lt;url&gt;</div>
          </div>
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
            <div className="font-bold text-sky-600 mb-0.5">Infuse / Apple</div>
            <div className="text-[11px] text-slate-500">Add Direct URL</div>
          </div>
        </div>
      </div>
    </div>
  );
}
