import React, { useState, useEffect } from 'react';
import { 
  Tv, Download, Copy, Trash2, ChevronDown, ChevronUp, 
  Users, ArrowDownCircle, ArrowUpCircle, Clock, CheckCircle2, 
  Layers, Zap, Loader2, Film, Play, Pause
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
  const isPaused = torrent.status === 'paused';

  // Toggle Pause/Resume
  const handleTogglePause = async () => {
    try {
      const endpoint = isPaused ? `/api/torrents/${torrent.infoHash}/resume` : `/api/torrents/${torrent.infoHash}/pause`;
      const res = await fetch(endpoint, { method: 'POST' });
      const data = await res.json();
      onShowToast(data.message || (isPaused ? 'Resumed transfer' : 'Paused transfer'), 'info');
    } catch (e) {
      onShowToast('Action failed: ' + e.message, 'warning');
    }
  };

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

  // Handle 1-Click Swarm Boost
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

  // Smart media tags & clean title
  const mediaTags = extractMediaTags(torrent.name);
  const cleanTitle = cleanTorrentName(torrent.name) || torrent.name || torrent.infoHash;

  // In-Browser Multi-Threaded Turbo Downloader (6 Parallel Streams)
  const startTurboDownload = async () => {
    if (turboActive) return;
    setTurboActive(true);
    setTurboProgress(0);
    setTurboSpeed('');
    onShowToast('Starting 6-stream Turbo Download in browser...', 'info');

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

  return (
    <div 
      className={`ui-card p-5 sm:p-6 transition-all relative font-mono ${
        isCompleted ? 'ui-card-highlight' : ''
      }`}
    >
      {/* Top Media Header Row */}
      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="flex items-start gap-3 min-w-0 flex-1">
          {/* Media Icon Badge */}
          <div className="w-10 h-10 rounded-xl bg-[#EBF2FF] text-[#0066FF] border border-[#B8D0FF] flex items-center justify-center shrink-0 shadow-xs">
            <Film className="w-5 h-5" />
          </div>

          <div className="min-w-0 flex-1 space-y-2">
            {/* Tag chips matching Product UI Styleguide & Monospace standard */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {/* Status Chip */}
              {isCompleted ? (
                <span className="chip-retro-green px-2.5 py-0.5 text-[11px] flex items-center gap-1">
                  <span>( READY 100% )</span>
                </span>
              ) : isPaused ? (
                <span className="chip-retro px-2.5 py-0.5 text-[11px] text-slate-500 flex items-center gap-1">
                  <span>( PAUSED {pct}% )</span>
                </span>
              ) : (
                <span className="chip-retro-amber px-2.5 py-0.5 text-[11px] flex items-center gap-1">
                  <span>( EXTRACTING {pct}% )</span>
                </span>
              )}

              {/* Total Size */}
              <span className="chip-retro px-2.5 py-0.5 text-[11px]">
                ( {formatBytes(torrent.total || 0)} )
              </span>

              {/* Smart Extracted Tags */}
              {mediaTags.map((tag, i) => (
                <span
                  key={i}
                  className="chip-retro px-2 py-0.5 text-[10px] uppercase font-bold"
                >
                  ( {tag.label} )
                </span>
              ))}

              {/* Connected Peers & Boost */}
              <div className="flex items-center gap-1 ml-auto sm:ml-0">
                <span className="chip-retro px-2.5 py-0.5 text-[11px]">
                  ( {torrent.numPeers || 0} peers )
                </span>

                {!isCompleted && (
                  <button
                    type="button"
                    onClick={handleBoost}
                    disabled={boosting}
                    className="btn-primary px-2.5 py-0.5 text-[10px] flex items-center gap-1"
                    title="Boost swarm: re-announce to 70+ trackers"
                  >
                    <Zap className="w-2.5 h-2.5 fill-current" />
                    <span>{boosting ? '[ BOOSTING ]' : '[ BOOST ]'}</span>
                  </button>
                )}
              </div>
            </div>

            {/* Cleaned Movie Title */}
            <h3 
              className="text-base sm:text-lg font-bold text-[#0D0F1C] tracking-tight leading-snug truncate" 
              title={torrent.name}
            >
              {cleanTitle}
            </h3>
          </div>
        </div>

        {/* Speed Sparkline, Pause & Delete */}
        <div className="flex items-center gap-2 shrink-0">
          <SpeedSparkline currentSpeed={torrent.downloadSpeed} isCompleted={isCompleted} />
          
          {!isCompleted && (
            <button
              type="button"
              onClick={handleTogglePause}
              className="btn-secondary p-2 text-[#0D0F1C]"
              title={isPaused ? "Resume transfer" : "Pause transfer"}
            >
              {isPaused ? (
                <Play className="w-4 h-4 fill-current text-[#0066FF]" />
              ) : (
                <Pause className="w-4 h-4 text-[#646E82]" />
              )}
            </button>
          )}

          <button
            type="button"
            onClick={() => onDeleteTorrent(torrent.infoHash, torrent.name)}
            className="btn-secondary p-2 text-[#646E82] hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200"
            title="Delete transfer from disk"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Primary Video Action Bar */}
      <div className="mb-4 bg-[#F8FAFC] border border-[#E0E4EC] rounded-xl p-3 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          {/* 1-Click Stream in VLC */}
          <button
            type="button"
            onClick={() => onOpenStream(torrent, primaryVideo)}
            className="btn-primary px-4 py-2 text-xs flex items-center gap-1.5"
            title="Play movie immediately or stream via VLC / PotPlayer"
          >
            <Tv className="w-3.5 h-3.5 text-white" />
            <span>[ PLAY MOVIE ]</span>
          </button>

          {/* 6-Stream Turbo Download */}
          <button
            type="button"
            onClick={startTurboDownload}
            disabled={turboActive}
            className="btn-secondary px-3.5 py-2 text-xs flex items-center gap-1.5"
            title="High-speed multi-threaded download (6 parallel streams in browser)"
          >
            {turboActive ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin text-[#0066FF]" />
                <span className="text-[#0066FF]">[ TURBO: {turboProgress}% ]</span>
              </>
            ) : (
              <>
                <Zap className="w-3.5 h-3.5 fill-[#0066FF] text-[#0066FF]" />
                <span>[ ⚡ TURBO DL ]</span>
              </>
            )}
          </button>

          {/* Standard Direct Download (IDM Ready) */}
          <a
            href={directDownloadUrl}
            download
            className="btn-secondary px-3.5 py-2 text-xs flex items-center gap-1.5"
            title="Standard direct download file (browser/IDM download manager)"
          >
            <Download className="w-3.5 h-3.5 text-[#646E82]" />
            <span>[ DIRECT DL ]</span>
          </a>

          {/* Quick Copy Link for IDM */}
          <button
            type="button"
            onClick={copyIdmLink}
            className="btn-secondary px-2.5 py-2 text-xs"
            title="Copy HTTP 206 URL for IDM / aria2 / curl"
          >
            <Copy className="w-3.5 h-3.5 text-[#646E82]" />
          </button>

          {/* Quick .M3U */}
          <a
            href={playlistUrl}
            download
            className="btn-secondary px-2.5 py-2 text-xs text-[11px] font-bold"
            title="Download .m3u playlist for external player"
          >
            .m3u
          </a>
        </div>

        {/* Expand Files Button */}
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="btn-secondary px-3 py-2 text-xs flex items-center gap-1 ml-auto"
        >
          <span>[ FILES ({files.length || torrent.files?.length || 0}) ]</span>
          {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* Progress Bar & Numerical Metrics */}
      <div className="space-y-2">
        {/* Progress Bar */}
        <div className="h-2 bg-slate-100 rounded-full overflow-hidden border border-slate-200/60 p-[1px]">
          <div 
            className={`h-full rounded-full transition-all duration-300 ${
              isCompleted 
                ? 'bg-emerald-500' 
                : 'bg-[#0066FF]'
            }`}
            style={{ width: `${pct}%` }}
          />
        </div>

        {/* Metrics Row */}
        <div className="flex items-center justify-between text-xs text-[#646E82] pt-1 flex-wrap gap-2 mono-stat">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1 text-[#059669] font-bold">
              <span>↓</span>
              <span>{formatSpeed(torrent.downloadSpeed || 0)}</span>
            </span>

            <span>•</span>

            <span className="flex items-center gap-1 text-[#646E82]">
              <span>↑</span>
              <span>{formatSpeed(torrent.uploadSpeed || 0)}</span>
            </span>
          </div>

          <div className="flex items-center gap-3">
            {!isCompleted && torrent.timeRemaining ? (
              <span className="flex items-center gap-1 text-[#646E82]">
                <Clock className="w-3 h-3" />
                <span>ETA: {formatDuration(torrent.timeRemaining)}</span>
              </span>
            ) : null}

            <span>•</span>

            <span className="flex items-center gap-1 font-bold text-[#0D0F1C]">
              <span>{formatBytes(torrent.downloaded || 0)}</span>
              <span>/</span>
              <span>{formatBytes(torrent.total || 0)}</span>
            </span>
          </div>
        </div>
      </div>

      {/* Expandable File Tree Component */}
      {expanded && (
        <FileTree
          torrent={torrent}
          files={files}
          onStreamFile={onOpenStream}
          onExtractSingle={onExtractArchive}
          onShowToast={onShowToast}
        />
      )}
    </div>
  );
}
