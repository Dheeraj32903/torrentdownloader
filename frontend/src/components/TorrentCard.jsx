import React, { useState, useEffect } from 'react';
import { 
  Tv, Download, Copy, Trash2, ChevronDown, ChevronUp, 
  Users, ArrowDownCircle, ArrowUpCircle, Clock, CheckCircle2, 
  Layers, Zap, Loader2, Film, Play, FileDown
} from 'lucide-react';
import SpeedSparkline from './SpeedSparkline.jsx';
import FileTree from './FileTree.jsx';
import { 
  formatBytes, formatSpeed, formatDuration, 
  extractMediaTags, cleanTorrentName, isMediaFile 
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
  const [boosting, setBoosting] = useState(false);

  const pct = Math.min(Math.round((torrent.progress || 0) * 100), 100);
  const isCompleted = torrent.status === 'completed' || pct === 100;

  // Handle 1-Click Swarm Boost (Re-announce to 70+ Trackers)
  const handleBoost = async () => {
    if (boosting) return;
    setBoosting(true);
    try {
      const res = await fetch(`/api/torrents/${torrent.infoHash}/boost`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        onShowToast(`Swarm Boosted! Re-announced to 70+ trackers (${data.numPeers || 0} peers connected)`, 'success');
      } else {
        onShowToast(data.message || 'Swarm re-announced', 'info');
      }
    } catch (err) {
      onShowToast('Could not boost swarm: ' + err.message, 'warning');
    } finally {
      setTimeout(() => setBoosting(false), 2000);
    }
  };

  // Auto-fetch files when expanded or on initial mount if empty
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

  // Find the primary (largest) video file inside the torrent
  const getPrimaryVideoFile = () => {
    if (!files || files.length === 0) return null;
    const videoFiles = files.filter(f => isMediaFile(f.name || f.path));
    if (videoFiles.length === 0) return null;
    return videoFiles.reduce((prev, curr) => ((curr.size || 0) > (prev.size || 0) ? curr : prev));
  };

  const primaryVideo = getPrimaryVideoFile();
  const primaryFileName = primaryVideo ? (primaryVideo.path || primaryVideo.name) : (files[0]?.path || files[0]?.name || torrent.name);
  const directDownloadUrl = `/api/download/${torrent.infoHash}?file=${encodeURIComponent(primaryFileName)}`;
  const playlistUrl = `/api/stream-playlist/${torrent.infoHash}?file=${encodeURIComponent(primaryFileName)}`;

  const copyIdmLink = () => {
    const downloadUrl = `${window.location.origin}${directDownloadUrl}`;
    navigator.clipboard.writeText(downloadUrl);
    onShowToast(`Copied IDM / Direct Download URL to clipboard!`, 'success');
  };

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

    const totalBytes = (primaryVideo?.size) || torrent.total || 0;
    const NUM_THREADS = 6;
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
      a.download = primaryFileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      
      onShowToast(`Turbo Download completed: ${primaryFileName}`, 'success');
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
        return 'bg-purple-500/10 text-purple-300 border-purple-500/30';
      case 'indigo':
        return 'bg-indigo-500/10 text-indigo-300 border-indigo-500/30';
      case 'blue':
      case 'sky':
        return 'bg-sky-500/10 text-sky-300 border-sky-500/30';
      case 'emerald':
        return 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30';
      case 'amber':
        return 'bg-amber-500/10 text-amber-300 border-amber-500/30';
      case 'teal':
        return 'bg-teal-500/10 text-teal-300 border-teal-500/30';
      default:
        return 'bg-white/[0.05] text-slate-300 border-white/[0.08]';
    }
  };

  return (
    <div 
      className={`bento-card p-5 sm:p-6 transition-all duration-300 relative overflow-hidden ${
        isCompleted ? 'bento-card-highlight' : ''
      }`}
    >
      {/* Top Media Header Row */}
      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="flex items-start gap-3.5 min-w-0 flex-1">
          {/* Media Icon Badge */}
          <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-gradient-to-tr from-cyan-500/20 via-indigo-500/15 to-violet-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shrink-0 shadow-lg shadow-cyan-500/10">
            <Film className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>

          <div className="min-w-0 flex-1 space-y-1.5">
            {/* Tag chips & Status */}
            <div className="flex items-center gap-2 flex-wrap">
              {/* Status Pill */}
              {isCompleted ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Ready (100%)</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-400 ring-2 ring-black"></span>
                  </span>
                  <span>Extracting ({pct}%)</span>
                </span>
              )}

              {/* Total Size */}
              <span className="text-xs font-bold px-2.5 py-0.5 rounded-lg bg-black/40 text-slate-300 border border-white/[0.08] mono-stat">
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

              {/* Connected Peers & Swarm Boost */}
              <div className="flex items-center gap-1.5 ml-auto sm:ml-0">
                <span className="text-xs text-slate-300 font-semibold flex items-center gap-1 mono-stat px-2 py-0.5 rounded-md bg-black/40 border border-white/[0.06]">
                  <Users className="w-3.5 h-3.5 text-cyan-400" />
                  <span>{torrent.numPeers || 0} peers</span>
                </span>

                {!isCompleted && (
                  <button
                    type="button"
                    onClick={handleBoost}
                    disabled={boosting}
                    className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 border transition-all cursor-pointer ${
                      boosting
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/30 animate-pulse'
                        : 'bg-emerald-500/10 hover:bg-emerald-500/25 text-emerald-400 border-emerald-500/25 hover:border-emerald-500/40'
                    }`}
                    title="Boost swarm: re-announce to 70+ tier-1 trackers and discover fast seeders"
                  >
                    <Zap className="w-2.5 h-2.5 fill-current" />
                    <span>{boosting ? 'Boosting...' : '⚡ Boost'}</span>
                  </button>
                )}
              </div>
            </div>

            {/* Cleaned Movie Title */}
            <h3 
              className="text-base sm:text-lg font-bold text-white tracking-tight leading-snug truncate" 
              title={torrent.name}
            >
              {cleanTitle}
            </h3>
          </div>
        </div>

        {/* Speed Sparkline & Delete */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <SpeedSparkline currentSpeed={torrent.downloadSpeed} isCompleted={isCompleted} />
          
          <button
            type="button"
            onClick={() => onDeleteTorrent(torrent.infoHash, torrent.name)}
            className="p-2 rounded-xl bg-white/[0.05] hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 border border-white/[0.08] hover:border-rose-500/30 transition-all"
            title="Delete transfer and wipe cache"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Primary Video Hero Quick-Action Bar */}
      <div className="mb-4 bg-gradient-to-r from-indigo-950/40 via-[#0f1422] to-cyan-950/30 border border-white/[0.08] rounded-2xl p-3 sm:p-3.5 flex items-center justify-between flex-wrap gap-2.5">
        <div className="flex items-center gap-2 flex-wrap">
          {/* 1-Click Stream in VLC / Cinema Player */}
          <button
            type="button"
            onClick={() => onOpenStream(torrent, primaryVideo)}
            className="btn-cinema px-4 py-2 rounded-xl text-white font-bold text-xs sm:text-sm flex items-center gap-2 shadow-md shadow-indigo-500/25 transition-all"
            title="Play movie in Cinema player or stream via VLC / PotPlayer"
          >
            <Tv className="w-4 h-4 text-white" />
            <span>Play Movie Now</span>
          </button>

          {/* 4-Stream Turbo Download */}
          <button
            type="button"
            onClick={startTurboDownload}
            disabled={turboActive}
            className="btn-emerald px-3.5 py-2 rounded-xl text-white font-bold text-xs sm:text-sm flex items-center gap-2 shadow-md shadow-emerald-500/25 transition-all disabled:opacity-50"
            title="High-speed multi-threaded download (4 parallel streams in browser)"
          >
            {turboActive ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-white" />
                <span>Turbo ({turboProgress}%)</span>
              </>
            ) : (
              <>
                <Zap className="w-4 h-4 fill-white text-white" />
                <span>⚡ Turbo Download</span>
              </>
            )}
          </button>

          {/* Direct Stream Download */}
          <a
            href={directDownloadUrl}
            download
            className="btn-glass px-3 py-2 rounded-xl text-slate-200 hover:text-white font-semibold text-xs flex items-center gap-1.5 transition-all"
            title="Direct HTTP download"
          >
            <Download className="w-3.5 h-3.5 text-cyan-400" />
            <span>Direct DL {isCompleted ? '' : `(${pct}%)`}</span>
          </a>

          {/* IDM Link Copy */}
          <button
            type="button"
            onClick={copyIdmLink}
            className="btn-glass px-3 py-2 rounded-xl text-slate-300 hover:text-white font-semibold text-xs flex items-center gap-1.5 transition-all"
            title="Copy download link for IDM, FDM, or Aria2"
          >
            <Copy className="w-3.5 h-3.5 text-indigo-400" />
            <span>IDM Link</span>
          </button>

          {/* 1-Click VLC M3U Playlist */}
          <a
            href={playlistUrl}
            download
            className="btn-glass px-2.5 py-2 rounded-xl text-slate-400 hover:text-slate-200 font-mono text-xs transition-all hidden md:flex items-center gap-1"
            title="Download .m3u playlist file for instant VLC streaming"
          >
            <Play className="w-3 h-3 text-cyan-400 fill-cyan-400" />
            <span>.m3u</span>
          </a>
        </div>

        {/* Explore Files Drawer Toggle */}
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="btn-glass px-3 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white flex items-center gap-1.5 transition-all ml-auto"
        >
          <Layers className="w-3.5 h-3.5 text-cyan-400" />
          <span>{expanded ? 'Hide Files' : `Files (${files.length || '...'})`}</span>
          {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* Turbo Active Banner */}
      {turboActive && (
        <div className="mb-4 bg-emerald-950/20 border border-emerald-500/30 rounded-2xl p-3.5 space-y-2 animate-in fade-in">
          <div className="flex items-center justify-between text-xs font-bold text-emerald-300">
            <span className="flex items-center gap-1.5">
              <Zap className="w-4 h-4 text-emerald-400 fill-emerald-400 animate-pulse" />
              <span>Multi-Threaded Turbo Download Active (4 Parallel Streams)</span>
            </span>
            <span className="mono-stat text-emerald-400 font-bold">{turboSpeed || 'Pipelining...'} • {turboProgress}%</span>
          </div>
          <div className="w-full h-2 bg-black/40 rounded-full overflow-hidden border border-white/[0.06]">
            <div 
              className="h-full bg-gradient-to-r from-emerald-500 to-cyan-400 transition-all duration-200"
              style={{ width: `${turboProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* Progress Track & Live Speed Data in Tabular Mono */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs mono-stat">
          <div className="flex items-center gap-4 text-slate-400">
            {/* Download speed */}
            <span className="flex items-center gap-1.5 text-emerald-400 font-bold">
              <ArrowDownCircle className="w-3.5 h-3.5 text-emerald-400" />
              {formatSpeed(torrent.downloadSpeed)}
            </span>
            {/* Upload speed */}
            <span className="flex items-center gap-1.5 text-cyan-300 font-medium hidden sm:flex">
              <ArrowUpCircle className="w-3.5 h-3.5 text-cyan-400" />
              {formatSpeed(torrent.uploadSpeed)}
            </span>
            {/* ETA */}
            {!isCompleted && torrent.timeRemaining > 0 && (
              <span className="flex items-center gap-1.5 text-slate-400 hidden md:flex font-medium">
                <Clock className="w-3.5 h-3.5 text-slate-500" />
                ETA: {formatDuration(torrent.timeRemaining / 1000)}
              </span>
            )}
          </div>

          <div className="font-semibold text-slate-300">
            {formatBytes(torrent.downloaded || 0)} <span className="text-slate-500">/</span> {formatBytes(torrent.total || 0)} <span className="text-emerald-400">({pct}%)</span>
          </div>
        </div>

        {/* Glowing Progress Bar */}
        <div className="relative w-full h-2.5 bg-black/50 rounded-full overflow-hidden p-0.5 border border-white/[0.08]">
          <div 
            className={`h-full rounded-full transition-all duration-300 ${
              isCompleted 
                ? 'bg-gradient-to-r from-emerald-500 to-teal-400 shadow-sm shadow-emerald-500/50' 
                : 'bg-gradient-to-r from-indigo-500 via-cyan-400 to-emerald-400 shadow-sm shadow-cyan-500/50'
            }`}
            style={{ width: `${Math.max(pct, 1)}%` }}
          />
        </div>
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
