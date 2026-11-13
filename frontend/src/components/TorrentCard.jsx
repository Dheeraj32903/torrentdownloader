import React, { useState, useEffect } from 'react';
import { 
  Tv, Download, Copy, Trash2, ChevronDown, ChevronUp, 
  Users, ArrowDownCircle, ArrowUpCircle, Clock, CheckCircle2, 
  Layers, Zap, Loader2, Film
} from 'lucide-react';
import SpeedSparkline from './SpeedSparkline.jsx';
import FileTree from './FileTree.jsx';
import { 
  formatBytes, formatSpeed, formatDuration, 
  extractMediaTags, cleanTorrentName 
} from '../utils/format.js';

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
  const [turboActive, setTurboActive] = useState(false);
  const [turboProgress, setTurboProgress] = useState(0);
  const [turboSpeed, setTurboSpeed] = useState('');

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

  const primaryFile = (files && files[0]) ? (files[0].path || files[0].name) : torrent.name;
  const directDownloadUrl = `/api/download/${torrent.infoHash}?file=${encodeURIComponent(primaryFile)}`;

  // Smart media tags & clean title
  const mediaTags = extractMediaTags(torrent.name);
  const cleanTitle = cleanTorrentName(torrent.name) || torrent.name || torrent.infoHash;

  // In-Browser Multi-Threaded Turbo Downloader (4 Parallel Streams)
  const startTurboDownload = async () => {
    if (turboActive) return;
    setTurboActive(true);
    setTurboProgress(0);
    setTurboSpeed('');
    onShowToast('Starting 4-stream Turbo Download in browser...', 'info');

    const totalBytes = torrent.total || (files && files[0] && files[0].size) || 0;
    const NUM_THREADS = 4;
    const chunkSize = Math.ceil(totalBytes / NUM_THREADS);
    let downloadedSoFar = 0;
    const startTime = Date.now();

    try {
      const promises = Array.from({ length: NUM_THREADS }).map(async (_, i) => {
        const start = i * chunkSize;
        const end = Math.min((i + 1) * chunkSize - 1, totalBytes - 1);
        
        const response = await fetch(directDownloadUrl, {
          headers: { Range: `bytes=${start}-${end}` }
        });
        
        if (!response.body) throw new Error('ReadableStream not supported');
        const reader = response.body.getReader();
        const threadChunks = [];
        
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          threadChunks.push(value);
          downloadedSoFar += value.length;
          
          const currentPct = Math.min(Math.round((downloadedSoFar / totalBytes) * 100), 100);
          setTurboProgress(currentPct);
          
          const elapsed = (Date.now() - startTime) / 1000;
          if (elapsed > 0.5) {
            const spd = downloadedSoFar / elapsed;
            setTurboSpeed(formatSpeed(spd));
          }
        }
        
        return { index: i, blob: new Blob(threadChunks) };
      });

      const results = await Promise.all(promises);
      results.sort((a, b) => a.index - b.index);
      
      const mergedBlob = new Blob(results.map(r => r.blob), { type: 'application/octet-stream' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(mergedBlob);
      a.download = primaryFile;
      document.body.appendChild(a);
      a.click();
      a.remove();
      
      onShowToast(`Turbo Download completed: ${primaryFile}`, 'success');
    } catch (err) {
      console.warn('Turbo download fallback to direct:', err);
      window.location.href = directDownloadUrl;
    } finally {
      setTurboActive(false);
    }
  };

  const getTagStyle = (type) => {
    switch (type) {
      case 'purple':
        return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'indigo':
        return 'bg-indigo-50 text-indigo-700 border-indigo-200';
      case 'sky':
        return 'bg-sky-50 text-sky-700 border-sky-200';
      case 'emerald':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'amber':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  return (
    <div 
      className={`rounded-3xl p-5 sm:p-6 transition-all border ${
        isCompleted ? 'glass-card-completed' : 'glass-card'
      }`}
    >
      {/* Top Media Header Row */}
      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="flex items-start gap-3.5 min-w-0 flex-1">
          {/* Media Icon Badge */}
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-50 via-slate-50 to-violet-50 border border-indigo-200/70 flex items-center justify-center text-indigo-600 shrink-0 shadow-2xs">
            <Film className="w-6 h-6" />
          </div>

          <div className="min-w-0 flex-1 space-y-1.5">
            {/* Tag chips & Status */}
            <div className="flex items-center gap-2 flex-wrap">
              {/* Status Pill */}
              {isCompleted ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Ready (100%)</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 shadow-2xs">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-600 ring-2 ring-white"></span>
                  </span>
                  <span>Extracting ({pct}%)</span>
                </span>
              )}

              {/* Total Size */}
              <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded-lg bg-slate-100 text-slate-700 border border-slate-200 shadow-2xs">
                {formatBytes(torrent.total || 0)}
              </span>

              {/* Smart Extracted Tags */}
              {mediaTags.map((tag, i) => (
                <span
                  key={i}
                  className={`text-[11px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-md border ${getTagStyle(tag.type)}`}
                >
                  {tag.label}
                </span>
              ))}

              {/* Connected Peers */}
              <span className="text-xs text-slate-600 font-semibold flex items-center gap-1 font-mono ml-auto sm:ml-0">
                <Users className="w-3.5 h-3.5 text-indigo-600" />
                <span>{torrent.numPeers || 0} peers</span>
              </span>
            </div>

            {/* Cleaned Movie Title */}
            <h3 
              className="text-base sm:text-lg font-extrabold text-slate-900 tracking-tight leading-snug truncate" 
              title={torrent.name}
            >
              {cleanTitle}
            </h3>
          </div>
        </div>

        {/* Speed Sparkline & Delete */}
        <div className="flex items-center gap-3 shrink-0">
          <SpeedSparkline currentSpeed={torrent.downloadSpeed} isCompleted={isCompleted} />
          
          <button
            type="button"
            onClick={() => onDeleteTorrent(torrent.infoHash, torrent.name)}
            className="p-2 rounded-xl bg-slate-100 hover:bg-rose-50 text-slate-400 hover:text-rose-600 border border-slate-200 hover:border-rose-200 transition-all shadow-2xs"
            title="Delete transfer"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Progress Track & Live Speed Data */}
      <div className="space-y-2 mb-5">
        <div className="flex items-center justify-between text-xs font-mono">
          <div className="flex items-center gap-4 text-slate-600">
            {/* Download speed */}
            <span className="flex items-center gap-1 text-indigo-600 font-bold">
              <ArrowDownCircle className="w-3.5 h-3.5" />
              {formatSpeed(torrent.downloadSpeed)}
            </span>
            {/* Upload speed */}
            <span className="flex items-center gap-1 text-violet-600 font-medium hidden sm:flex">
              <ArrowUpCircle className="w-3.5 h-3.5" />
              {formatSpeed(torrent.uploadSpeed)}
            </span>
            {/* ETA */}
            {!isCompleted && torrent.timeRemaining > 0 && (
              <span className="flex items-center gap-1 text-slate-500 hidden md:flex font-medium">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                ETA: {formatDuration(torrent.timeRemaining / 1000)}
              </span>
            )}
          </div>

          <div className="font-bold text-slate-700">
            {formatBytes(torrent.downloaded || 0)} of {formatBytes(torrent.total || 0)} ({pct}%)
          </div>
        </div>

        {/* Glowing Progress Bar */}
        <div className="relative w-full h-3.5 bg-slate-100 rounded-full overflow-hidden p-0.5 border border-slate-200 shadow-inner">
          <div 
            className={`h-full rounded-full transition-all duration-300 progress-shine ${
              isCompleted 
                ? 'bg-gradient-to-r from-emerald-500 to-teal-500 shadow-xs' 
                : 'bg-gradient-to-r from-indigo-600 via-violet-500 to-sky-500 shadow-xs'
            }`}
            style={{ width: `${Math.max(pct, 1)}%` }}
          />
        </div>
      </div>

      {/* Turbo Active Banner */}
      {turboActive && (
        <div className="mb-4 bg-gradient-to-r from-indigo-50 to-violet-50 border border-indigo-200 rounded-2xl p-3.5 space-y-2 animate-in fade-in shadow-2xs">
          <div className="flex items-center justify-between text-xs font-bold text-indigo-900">
            <span className="flex items-center gap-1.5">
              <Zap className="w-4 h-4 text-indigo-600 fill-current animate-pulse" />
              <span>Multi-Threaded Turbo Download Active (4 Parallel Streams)</span>
            </span>
            <span className="font-mono text-indigo-600">{turboSpeed || 'Pipelining...'} • {turboProgress}%</span>
          </div>
          <div className="w-full h-2 bg-indigo-100 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-indigo-600 to-violet-600 transition-all duration-200"
              style={{ width: `${turboProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* Action Buttons Row */}
      <div className="flex items-center justify-between flex-wrap gap-2 pt-3 border-t border-slate-100">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Stream in VLC */}
          <button
            type="button"
            onClick={() => onOpenStream(torrent)}
            className="px-4.5 py-2.5 rounded-2xl bg-gradient-to-r from-indigo-600 via-indigo-700 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white font-extrabold text-xs sm:text-sm flex items-center gap-2 shadow-md shadow-indigo-500/25 transition-all hover:scale-102"
            title="Stream in VLC, PotPlayer, MPV or Infuse"
          >
            <Tv className="w-4 h-4" />
            <span>Stream in VLC</span>
          </button>

          {/* In-Browser Turbo Download */}
          <button
            type="button"
            onClick={startTurboDownload}
            disabled={turboActive}
            className="px-4 py-2.5 rounded-2xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200/90 font-extrabold text-xs sm:text-sm flex items-center gap-2 shadow-2xs transition-all disabled:opacity-50"
            title="High-speed multi-threaded download (4 parallel streams directly in browser)"
          >
            {turboActive ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
                <span>Downloading ({turboProgress}%)</span>
              </>
            ) : (
              <>
                <Zap className="w-4 h-4 fill-current text-indigo-600" />
                <span>Turbo Download</span>
              </>
            )}
          </button>

          {/* Standard Download */}
          <a
            href={directDownloadUrl}
            download
            className="px-3.5 py-2.5 rounded-2xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 font-bold text-xs sm:text-sm flex items-center gap-1.5 shadow-2xs transition-all"
            title="Direct single-stream download"
          >
            <Download className="w-4 h-4 text-emerald-600" />
            <span>Download {isCompleted ? 'File' : `(${pct}%)`}</span>
          </a>

          {/* IDM Copy */}
          <button
            type="button"
            onClick={copyIdmLink}
            className="px-3.5 py-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 font-bold text-xs flex items-center gap-1.5 transition-all shadow-2xs"
            title="Copy download URL for external download managers"
          >
            <Copy className="w-3.5 h-3.5 text-indigo-600" />
            <span>IDM</span>
          </button>
        </div>

        {/* Explore Files Toggle */}
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="px-3.5 py-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 text-xs font-bold flex items-center gap-1.5 transition-all ml-auto shadow-2xs"
        >
          <Layers className="w-3.5 h-3.5 text-slate-500" />
          <span>{expanded ? 'Hide Files' : 'Explore Files'}</span>
          {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* Expanded File Explorer */}
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
