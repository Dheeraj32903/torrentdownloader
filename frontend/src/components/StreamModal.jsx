import React, { useState, useEffect, useRef } from 'react';
import { X, Play, Download, Copy, Check, Tv, ExternalLink, Sparkles, Film } from 'lucide-react';

export default function StreamModal({ isOpen, onClose, torrent, file, onShowToast }) {
  const [copied, setCopied] = useState(false);
  const [subtitles, setSubtitles] = useState([]);
  const videoRef = useRef(null);

  // Close modal on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Discover subtitles if available
  useEffect(() => {
    if (isOpen && torrent?.infoHash) {
      fetch(`/api/video-subtitles/${torrent.infoHash}`)
        .then(res => res.json())
        .then(data => {
          if (data?.subtitles && Array.isArray(data.subtitles)) {
            setSubtitles(data.subtitles);
          }
        })
        .catch(() => {});
    }
  }, [isOpen, torrent?.infoHash]);

  if (!isOpen || !torrent) return null;

  const targetFile = file || (torrent.files || []).find(f => /\.(mp4|mkv|webm|avi|mov)$/i.test(f.name || f.path)) || { name: torrent.name, path: torrent.name };
  const relPath = targetFile.path || targetFile.name;
  const streamUrl = `${window.location.origin}/api/stream/${torrent.infoHash}?file=${encodeURIComponent(relPath)}`;
  const playlistUrl = `/api/stream-playlist/${torrent.infoHash}?file=${encodeURIComponent(relPath)}`;
  const downloadUrl = `/api/download/${torrent.infoHash}?file=${encodeURIComponent(relPath)}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(streamUrl);
    setCopied(true);
    onShowToast('Stream link copied to clipboard!', 'success');
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/85 backdrop-blur-xl animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        className="relative w-full max-w-3xl bg-[#0c0e17]/95 border border-white/[0.1] rounded-3xl p-6 sm:p-8 shadow-2xl overflow-hidden max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Ambient Top Glow */}
        <div className="absolute -top-24 -right-24 w-72 h-72 bg-indigo-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-72 h-72 bg-cyan-500/15 rounded-full blur-3xl pointer-events-none" />

        {/* Modal Header */}
        <div className="flex items-start justify-between gap-4 mb-5">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-indigo-500/20 to-violet-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shrink-0 shadow-lg shadow-indigo-500/10">
              <Tv className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-lg sm:text-xl font-display font-bold text-white tracking-tight">
                Cinema Stream Player
              </h3>
              <p className="text-xs text-slate-400 truncate max-w-md font-mono mt-0.5" title={targetFile.name}>
                {targetFile.name}
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

        {/* Embedded HTML5 Video Player */}
        <div className="relative rounded-2xl overflow-hidden bg-black border border-white/[0.08] shadow-2xl mb-6">
          <video
            ref={videoRef}
            controls
            playsInline
            preload="metadata"
            className="w-full aspect-video bg-black"
            src={streamUrl}
          >
            {subtitles.map((sub, i) => (
              <track
                key={i}
                kind="subtitles"
                label={sub.label || `Track ${i + 1}`}
                srcLang={sub.lang || 'en'}
                src={sub.url}
                default={i === 0}
              />
            ))}
            Your browser does not support HTML5 video streaming. Please use the VLC button below.
          </video>
        </div>

        {/* Highlight Banner */}
        <div className="bg-indigo-950/30 border border-indigo-500/20 rounded-2xl p-4 mb-6">
          <div className="flex items-center gap-2 text-xs font-semibold text-indigo-300 mb-1">
            <Sparkles className="w-4 h-4 text-cyan-400" />
            <span>Instant HTTP 206 Streaming & Multi-Audio Playback</span>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            Streaming decodes instantly with sliding critical-piece prioritization. For uncompressed 4K HDR, Dolby Atmos, or EAC3 5.1 passthrough, click the 1-Click VLC button below.
          </p>
        </div>

        {/* Primary Action 1: 1-Click VLC Playlist */}
        <div className="mb-6 space-y-2">
          <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
            <span>Recommended for Best Quality: Desktop Player</span>
            <span className="text-[11px] font-normal text-emerald-400">VLC • PotPlayer • MPV • IINA</span>
          </label>
          <a
            href={playlistUrl}
            download
            className="w-full btn-cinema text-white font-bold py-3 px-5 rounded-2xl flex items-center justify-center gap-2.5 transition-all text-xs sm:text-sm group"
          >
            <Play className="w-4 h-4 fill-current text-white" />
            <span>Download .M3U Playlist (Auto-Opens in VLC)</span>
            <ExternalLink className="w-3.5 h-3.5 text-indigo-200 group-hover:translate-x-0.5 transition-transform" />
          </a>
        </div>

        {/* Primary Action 2: Direct HTTP Stream URL for External Players */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
            <span>Direct HTTP 206 Stream URL</span>
            <span className="text-[11px] font-mono text-slate-500">VLC → Media → Open Network Stream</span>
          </label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={streamUrl}
              className="w-full bg-black/40 border border-white/[0.08] text-xs font-mono px-3.5 py-2.5 rounded-xl text-slate-200 select-all focus:outline-none focus:border-cyan-500/40"
            />
            <button
              type="button"
              onClick={handleCopy}
              className={`px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all shrink-0 border ${
                copied
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                  : 'bg-white/[0.06] hover:bg-white/[0.1] text-slate-200 border-white/[0.08]'
              }`}
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Copy Link</span>
                </>
              )}
            </button>
            <a
              href={downloadUrl}
              download
              className="px-3.5 py-2.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 font-bold text-xs flex items-center gap-1.5 transition-all shrink-0"
              title="Download file directly"
            >
              <Download className="w-3.5 h-3.5 text-emerald-400" />
              <span>Download</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
