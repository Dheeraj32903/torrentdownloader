import React, { useState, useEffect } from 'react';
import { 
  Tv, Download, Copy, Trash2, ChevronDown, ChevronUp, 
  Users, ArrowDownCircle, ArrowUpCircle, Clock, CheckCircle2, 
  Layers
} from 'lucide-react';
import SpeedSparkline from './SpeedSparkline.jsx';
import FileTree from './FileTree.jsx';
import { formatBytes, formatSpeed, formatDuration } from '../utils/format.js';

export default function TorrentCard({ 
  torrent, 
  onOpenStream, 
  onDeleteTorrent, 
  onExtractArchive, 
  onShowToast 
}) {
  const [expanded, setExpanded] = useState(false);
  const [files, setFiles] = useState(torrent.files || []);
  const [loadingFiles, setLoadingFiles] = useState(false);

  const pct = Math.min(Math.round((torrent.progress || 0) * 100), 100);
  const isCompleted = torrent.status === 'completed' || pct === 100;

  // Auto-fetch files when expanded
  useEffect(() => {
    if (expanded && (!files || files.length === 0)) {
      setLoadingFiles(true);
      fetch(`/api/torrents/${torrent.infoHash}/files`)
        .then(res => res.json())
        .then(data => {
          if (data.files) setFiles(data.files);
        })
        .catch(err => console.warn('File fetch error:', err))
        .finally(() => setLoadingFiles(false));
    }
  }, [expanded, torrent.infoHash]);

  // Keep files synced if torrent.files updates
  useEffect(() => {
    if (torrent.files && torrent.files.length > 0) {
      setFiles(torrent.files);
    }
  }, [torrent.files]);

  const copyIdmLink = () => {
    const primaryFile = (files && files[0]) ? (files[0].path || files[0].name) : torrent.name;
    const downloadUrl = `${window.location.origin}/api/download/${torrent.infoHash}?file=${encodeURIComponent(primaryFile)}`;
    navigator.clipboard.writeText(downloadUrl);
    onShowToast(`Copied IDM / Direct Download link!`, 'success');
  };

  const directDownloadUrl = `/api/download/${torrent.infoHash}?file=${encodeURIComponent(
    (files && files[0]) ? (files[0].path || files[0].name) : torrent.name
  )}`;

  return (
    <div 
      className={`rounded-3xl p-5 sm:p-6 transition-all border ${
        isCompleted ? 'glass-card-completed' : 'glass-card'
      }`}
    >
      {/* Top Row: Title, Status Badge, Sparkline, Delete */}
      <div className="flex items-start justify-between gap-4 flex-wrap sm:flex-nowrap mb-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2.5 mb-1.5 flex-wrap">
            {/* Status Pill */}
            {isCompleted ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Ready / 100%</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-600"></span>
                </span>
                <span>Extracting ({pct}%)</span>
              </span>
            )}

            {/* Total Size */}
            <span className="text-xs font-mono font-semibold px-2.5 py-0.5 rounded-lg bg-slate-100 text-slate-700 border border-slate-200">
              {formatBytes(torrent.total || 0)}
            </span>

            {/* Files count */}
            <span className="text-xs text-slate-500 font-medium">
              {(files && files.length > 0) ? `${files.length} file${files.length > 1 ? 's' : ''}` : '1 file'}
            </span>

            {/* Connected Peers */}
            <span className="text-xs text-slate-600 flex items-center gap-1 font-mono">
              <Users className="w-3.5 h-3.5 text-indigo-600" />
              <span>{torrent.numPeers || 0} peers</span>
            </span>
          </div>

          {/* Torrent Name */}
          <h4 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight truncate" title={torrent.name}>
            {torrent.name || torrent.infoHash}
          </h4>
        </div>

        {/* Speed Sparkline & Delete */}
        <div className="flex items-center gap-3 shrink-0">
          <SpeedSparkline currentSpeed={torrent.downloadSpeed} isCompleted={isCompleted} />
          
          <button
            type="button"
            onClick={() => onDeleteTorrent(torrent.infoHash, torrent.name)}
            className="p-2 rounded-xl bg-slate-100 hover:bg-rose-50 text-slate-400 hover:text-rose-600 border border-slate-200 hover:border-rose-200 transition-all"
            title="Delete torrent"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Progress Bar & Stats */}
      <div className="space-y-2 mb-5">
        <div className="flex items-center justify-between text-xs font-mono">
          <div className="flex items-center gap-4 text-slate-600">
            {/* Download speed */}
            <span className="flex items-center gap-1 text-indigo-600 font-semibold">
              <ArrowDownCircle className="w-3.5 h-3.5" />
              {formatSpeed(torrent.downloadSpeed)}
            </span>
            {/* Upload speed */}
            <span className="flex items-center gap-1 text-violet-600 font-medium">
              <ArrowUpCircle className="w-3.5 h-3.5" />
              {formatSpeed(torrent.uploadSpeed)}
            </span>
            {/* ETA */}
            {!isCompleted && torrent.timeRemaining > 0 && (
              <span className="flex items-center gap-1 text-slate-500 hidden sm:flex">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                ETA: {formatDuration(torrent.timeRemaining / 1000)}
              </span>
            )}
          </div>

          <div className="font-semibold text-slate-700">
            {formatBytes(torrent.downloaded || 0)} of {formatBytes(torrent.total || 0)} ({pct}%)
          </div>
        </div>

        {/* The glowing progress track */}
        <div className="relative w-full h-3 bg-slate-100 rounded-full overflow-hidden p-0.5 border border-slate-200 shadow-inner">
          <div 
            className={`h-full rounded-full transition-all duration-300 ${
              isCompleted 
                ? 'bg-gradient-to-r from-emerald-500 to-teal-500 shadow-sm shadow-emerald-500/20' 
                : 'bg-gradient-to-r from-indigo-600 via-violet-500 to-sky-500 shadow-sm shadow-indigo-500/20'
            }`}
            style={{ width: `${Math.max(pct, 1)}%` }}
          />
        </div>
      </div>

      {/* Actions Row */}
      <div className="flex items-center justify-between flex-wrap gap-2 pt-2 border-t border-slate-100">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Stream in VLC */}
          <button
            type="button"
            onClick={() => onOpenStream(torrent)}
            className="px-4 py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 font-bold text-xs sm:text-sm flex items-center gap-2 shadow-xs transition-all"
            title="Stream in VLC, PotPlayer, MPV or Infuse"
          >
            <Tv className="w-4 h-4 text-indigo-600" />
            <span>Stream in VLC</span>
          </button>

          {/* Dual-Mode Direct Download */}
          <a
            href={directDownloadUrl}
            download
            className="px-4 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 font-bold text-xs sm:text-sm flex items-center gap-2 shadow-xs transition-all"
            title={isCompleted ? "Download complete file at gigabit speed" : "Live stream download straight to your computer"}
          >
            <Download className="w-4 h-4 text-emerald-600" />
            <span>Download {isCompleted ? 'File' : `(${pct}%)`}</span>
          </a>

          {/* IDM Copy */}
          <button
            type="button"
            onClick={copyIdmLink}
            className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 font-semibold text-xs flex items-center gap-1.5 transition-all"
            title="Copy download URL for Internet Download Manager"
          >
            <Copy className="w-3.5 h-3.5 text-indigo-600" />
            <span>IDM</span>
          </button>
        </div>

        {/* Toggle File Tree */}
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 text-xs font-medium flex items-center gap-1.5 transition-all ml-auto"
        >
          <Layers className="w-3.5 h-3.5 text-slate-500" />
          <span>{expanded ? 'Hide Files' : 'Browse Files'}</span>
          {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* Expanded File Tree Explorer */}
      {expanded && (
        <FileTree
          torrent={torrent}
          files={files}
          onStreamFile={(t, f) => onOpenStream(t, f)}
          onExtractSingle={onExtractArchive}
          onShowToast={onShowToast}
        />
      )}
    </div>
  );
}
