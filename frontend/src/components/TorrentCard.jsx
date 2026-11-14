import React, { useState, useEffect } from 'react';
import { 
  Play, Pause, ArrowDownToLine, Copy, Tv, 
  ChevronDown, ChevronUp, Trash2, Clock, Film, Zap 
} from 'lucide-react';
import SpeedSparkline from './SpeedSparkline.jsx';
import FileTree from './FileTree.jsx';
import { 
  formatBytes, formatSpeed, formatDuration, 
  extractMediaTags, parseMovieTitle, isMediaFile 
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
  const [boosting, setBoosting] = useState(false);

  const pct = Math.min(Math.round((torrent.progress || 0) * 100), 100);
  const isCompleted = torrent.status === 'completed' || torrent.status === 'ready' || pct === 100;
  const isPaused = torrent.status === 'paused';
  const isExtracting = torrent.status === 'extracting';

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
    const list = files && files.length > 0 ? files : (torrent.files || []);
    if (!list || list.length === 0) return null;
    const videoFiles = list.filter(f => isMediaFile(f.name || f.path));
    if (videoFiles.length === 0) return list[0] || null;
    return videoFiles.reduce((prev, curr) => ((curr.size || curr.length || 0) > (prev.size || prev.length || 0) ? curr : prev));
  };

  const primaryVideo = getPrimaryVideoFile();
  const primaryVideoIndex = primaryVideo?.index !== undefined 
    ? primaryVideo.index 
    : (files.findIndex(f => (f.path || f.name) === (primaryVideo?.path || primaryVideo?.name)) >= 0 
      ? files.findIndex(f => (f.path || f.name) === (primaryVideo?.path || primaryVideo?.name)) 
      : 0);

  const primaryFileName = primaryVideo ? (primaryVideo.path || primaryVideo.name) : torrent.name;
  
  // Direct endpoints (Index-based with query param fallback)
  const directDownloadUrl = `/api/download/${torrent.infoHash}/${primaryVideoIndex}?file=${encodeURIComponent(primaryFileName)}`;
  const playlistUrl = `/api/stream-playlist/${torrent.infoHash}?file=${encodeURIComponent(primaryFileName)}`;

  const copyDirectLink = () => {
    const fullUrl = `${window.location.origin}${directDownloadUrl}`;
    navigator.clipboard.writeText(fullUrl);
    onShowToast(`Copied Direct Download URL (IDM / 1DM / curl ready)`, 'success');
  };

  // Swarm Boost
  const handleBoost = async () => {
    if (boosting) return;
    setBoosting(true);
    try {
      const res = await fetch(`/api/torrents/${torrent.infoHash}/boost`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        onShowToast(`Swarm Boosted! Re-announced to 70+ trackers (${data.numPeers || 0} peers)`, 'success');
      } else {
        onShowToast(data.message || 'Swarm re-announced', 'info');
      }
    } catch (err) {
      onShowToast('Could not boost swarm: ' + err.message, 'warning');
    } finally {
      setTimeout(() => setBoosting(false), 2000);
    }
  };

  // Parse Movie Scene Title
  const movieMeta = parseMovieTitle(torrent.name);
  const mediaTags = extractMediaTags(torrent.name);

  const handleDownloadClick = (e) => {
    if (!isCompleted && (torrent.numPeers === 0 || !files || files.length === 0)) {
      onShowToast('Connecting to peer swarm. Download will begin streaming once peers connect.', 'info');
    }
  };

  const handlePlayClick = () => {
    if (!isCompleted && (torrent.numPeers === 0 || !files || files.length === 0)) {
      onShowToast('Connecting to peer swarm. Video will start buffering once initial pieces arrive.', 'info');
    }
    onOpenStream(torrent, primaryVideo);
  };

  return (
    <div className="bg-white border border-slate-200/90 hover:border-slate-300 rounded-2xl p-5 sm:p-6 shadow-sm hover:shadow-md transition-all duration-200">
      {/* Top Header Row */}
      <div className="flex items-start justify-between gap-4 mb-3.5">
        <div className="flex items-start gap-3.5 min-w-0 flex-1">
          {/* Cinema Media Icon */}
          <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center shrink-0 text-blue-600 shadow-xs">
            <Film className="w-5 h-5 text-blue-600" />
          </div>

          <div className="min-w-0 flex-1 space-y-1.5">
            {/* Tag Pills & Status Row */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {/* Status Badge */}
              {isCompleted ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-sans font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  <span>Ready to Stream</span>
                </span>
              ) : isExtracting ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-sans font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                  <span>Unpacking Archive</span>
                </span>
              ) : isPaused ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-sans font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                  <span>Paused • {pct}%</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-sans font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse" />
                  <span>Downloading • {pct}%</span>
                </span>
              )}

              {/* Total Size */}
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-mono font-medium text-slate-700 bg-slate-100 border border-slate-200">
                {formatBytes(torrent.total || 0)}
              </span>

              {/* Technical Media Badges */}
              {mediaTags.map((tag, i) => (
                <span
                  key={i}
                  className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-mono font-medium text-slate-700 bg-slate-100 border border-slate-200"
                >
                  {tag.label}
                </span>
              ))}

              {/* Connected Peers & Boost */}
              <div className="flex items-center gap-1.5 ml-auto sm:ml-0">
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-mono text-slate-600 bg-slate-50 border border-slate-200">
                  {torrent.numPeers || 0} peers
                </span>

                {!isCompleted && (
                  <button
                    type="button"
                    onClick={handleBoost}
                    disabled={boosting}
                    className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 transition-colors cursor-pointer"
                    title="Re-announce swarm to 70+ global trackers"
                  >
                    <Zap className="w-2.5 h-2.5 fill-current" />
                    <span>{boosting ? 'Boosting' : 'Boost'}</span>
                  </button>
                )}
              </div>
            </div>

            {/* Smart Parsed Title Heading */}
            <div className="flex items-baseline flex-wrap gap-2">
              <h3 
                className="text-base sm:text-lg font-bold text-slate-900 tracking-tight leading-snug truncate" 
                title={torrent.name}
              >
                {movieMeta.title}
              </h3>
              {movieMeta.year && (
                <span className="text-sm font-sans font-medium text-slate-400">
                  ({movieMeta.year})
                </span>
              )}
            </div>

            {/* Audio / Languages Subtitle Row */}
            {movieMeta.languages && (
              <p className="text-[11px] font-sans font-semibold text-slate-500 tracking-wider">
                {movieMeta.languages}
              </p>
            )}
          </div>
        </div>

        {/* Speed Sparkline & Secondary Controls */}
        <div className="flex items-center gap-2 shrink-0">
          <SpeedSparkline 
            currentSpeed={torrent.downloadSpeed} 
            isCompleted={isCompleted} 
            infoHash={torrent.infoHash}
          />
          
          {!isCompleted && (
            <button
              type="button"
              onClick={handleTogglePause}
              className="p-2 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-600 hover:text-slate-900 border border-slate-200 transition-colors cursor-pointer"
              title={isPaused ? "Resume transfer" : "Pause transfer"}
            >
              {isPaused ? <Play className="w-3.5 h-3.5 fill-current text-blue-600" /> : <Pause className="w-3.5 h-3.5" />}
            </button>
          )}

          <button
            type="button"
            onClick={() => onDeleteTorrent(torrent.infoHash, torrent.name)}
            className="p-2 rounded-xl bg-slate-50 hover:bg-rose-50 text-slate-400 hover:text-rose-600 border border-slate-200 hover:border-rose-200 transition-colors cursor-pointer"
            title="Delete transfer and files"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="space-y-1.5 mb-4">
        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
          <div 
            className={`h-full rounded-full transition-all duration-300 ${
              isCompleted 
                ? 'bg-emerald-500' 
                : 'bg-blue-600'
            }`}
            style={{ width: `${pct}%` }}
          />
        </div>

        {/* Real-time Metrics in Tabular Space Mono */}
        <div className="flex items-center justify-between text-xs text-slate-500 font-mono mono-stat pt-0.5">
          <div className="flex items-center gap-2.5">
            <span className="text-blue-600 font-semibold">
              ↓ {formatSpeed(torrent.downloadSpeed || 0)}
            </span>
            <span className="text-slate-300">/</span>
            <span className="text-slate-500 font-medium">
              ↑ {formatSpeed(torrent.uploadSpeed || 0)}
            </span>
          </div>

          <div className="flex items-center gap-2.5">
            {!isCompleted && torrent.timeRemaining ? (
              <span className="flex items-center gap-1 text-slate-500">
                <Clock className="w-3 h-3 text-slate-400" />
                <span>ETA: {formatDuration(torrent.timeRemaining)}</span>
              </span>
            ) : null}

            <span className="text-slate-300 hidden sm:inline">•</span>

            <span className="text-slate-700 font-semibold">
              {formatBytes(torrent.downloaded || 0)} / {formatBytes(torrent.total || 0)}
            </span>
          </div>
        </div>
      </div>

      {/* Consolidated Action Bar (Zero Conflicts, Native Gigabit Download) */}
      <div className="flex items-center justify-between flex-wrap gap-2.5 pt-1">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Action 1: Play Movie (Primary Royal Blue Button) */}
          <button
            type="button"
            onClick={handlePlayClick}
            className="btn-primary text-xs py-2 px-4 shadow-sm shadow-blue-500/20"
            title="Instant HTTP 206 Cinema playback in browser or external player"
          >
            <Play className="w-3.5 h-3.5 fill-white text-white" />
            <span>Play Movie</span>
          </button>

          {/* Action 2: Direct Download (Clean Secondary Button with Blue Arrow) */}
          <a
            href={directDownloadUrl}
            download={primaryFileName}
            onClick={handleDownloadClick}
            className="btn-secondary text-xs py-2 px-3.5"
            title="Direct native download at raw gigabit disk / swarm speed (IDM ready)"
          >
            <ArrowDownToLine className="w-3.5 h-3.5 text-blue-600" />
            <span>Download</span>
          </a>

          {/* Action 3: Copy Link (Secondary Ghost Button) */}
          <button
            type="button"
            onClick={copyDirectLink}
            className="btn-secondary text-xs py-2 px-3 text-slate-600 hover:text-slate-900"
            title="Copy direct HTTP 206 URL for IDM / 1DM / curl"
          >
            <Copy className="w-3.5 h-3.5 text-slate-500" />
            <span>Copy Link</span>
          </button>

          {/* Action 4: VLC / .m3u (Secondary Ghost Button) */}
          <a
            href={playlistUrl}
            download
            className="btn-secondary text-xs py-2 px-3 text-slate-600 hover:text-slate-900"
            title="Download .m3u playlist for VLC, PotPlayer, MPV, or IINA"
          >
            <Tv className="w-3.5 h-3.5 text-slate-500" />
            <span>VLC / .m3u</span>
          </a>
        </div>

        {/* Action 5: Files (N) Toggle (Right-aligned) */}
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="btn-ghost text-xs py-2 px-3 text-slate-600 hover:text-slate-900 ml-auto"
        >
          <span>Files ({files.length || torrent.files?.length || 0})</span>
          {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
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
