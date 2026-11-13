import React, { useState, useEffect, useRef } from 'react';
import { 
  X, Play, Download, Copy, Check, Tv, ExternalLink, 
  Sparkles, Maximize, PictureInPicture2, RotateCcw, RotateCw 
} from 'lucide-react';

export default function StreamModal({ isOpen, onClose, torrent, file, onShowToast }) {
  const [copied, setCopied] = useState(false);
  const [subtitles, setSubtitles] = useState([]);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const videoRef = useRef(null);

  // Close modal on Escape key, spacebar toggle play
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!isOpen) return;
      if (e.key === 'Escape') onClose();
      if (e.key === ' ' && e.target === document.body && videoRef.current) {
        e.preventDefault();
        if (videoRef.current.paused) videoRef.current.play();
        else videoRef.current.pause();
      }
      if (e.key === 'ArrowRight' && videoRef.current) {
        videoRef.current.currentTime += 5;
      }
      if (e.key === 'ArrowLeft' && videoRef.current) {
        videoRef.current.currentTime -= 5;
      }
      if (e.key.toLowerCase() === 'f' && videoRef.current) {
        if (!document.fullscreenElement) {
          videoRef.current.requestFullscreen?.();
        } else {
          document.exitFullscreen?.();
        }
      }
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

  const handleSpeedChange = (speed) => {
    setPlaybackSpeed(speed);
    if (videoRef.current) {
      videoRef.current.playbackRate = speed;
    }
  };

  const handleSeek = (seconds) => {
    if (videoRef.current) {
      videoRef.current.currentTime = Math.max(0, videoRef.current.currentTime + seconds);
    }
  };

  const handleTogglePiP = async () => {
    try {
      if (videoRef.current) {
        if (document.pictureInPictureElement) {
          await document.exitPictureInPicture();
        } else {
          await videoRef.current.requestPictureInPicture();
        }
      }
    } catch (err) {
      console.warn('PiP not supported or failed:', err);
    }
  };

  const handleToggleFullscreen = () => {
    if (videoRef.current) {
      if (!document.fullscreenElement) {
        videoRef.current.requestFullscreen?.();
      } else {
        document.exitFullscreen?.();
      }
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        className="relative w-full max-w-3xl bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-2xl overflow-hidden max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 shrink-0">
              <Tv className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
                Cinema Stream Player
              </h3>
              <p className="text-xs text-slate-500 truncate max-w-md font-medium mt-0.5" title={targetFile.name}>
                {targetFile.name}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition-all"
            title="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Embedded HTML5 Video Player */}
        <div className="relative rounded-2xl overflow-hidden bg-black border border-slate-800 shadow-md mb-3">
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

        {/* Video Player Quick Toolbar */}
        <div className="flex items-center justify-between flex-wrap gap-2 mb-5 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs">
          {/* Jump seek buttons */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => handleSeek(-10)}
              className="p-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 transition-colors flex items-center gap-1 text-[11px] font-medium"
              title="Rewind 10 seconds (← key)"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>-10s</span>
            </button>
            <button
              type="button"
              onClick={() => handleSeek(10)}
              className="p-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 transition-colors flex items-center gap-1 text-[11px] font-medium"
              title="Fast forward 10 seconds (→ key)"
            >
              <RotateCw className="w-3.5 h-3.5" />
              <span>+10s</span>
            </button>
          </div>

          {/* Speed controls */}
          <div className="flex items-center gap-1">
            {[0.75, 1, 1.25, 1.5, 2].map(speed => (
              <button
                key={speed}
                type="button"
                onClick={() => handleSpeedChange(speed)}
                className={`px-2 py-0.5 rounded-md text-[11px] font-mono transition-all ${
                  playbackSpeed === speed
                    ? 'bg-blue-600 text-white font-bold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                }`}
              >
                {speed}x
              </button>
            ))}
          </div>

          {/* PiP & Fullscreen */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handleTogglePiP}
              className="p-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 transition-colors"
              title="Picture in Picture"
            >
              <PictureInPicture2 className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={handleToggleFullscreen}
              className="p-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 transition-colors"
              title="Fullscreen (F key)"
            >
              <Maximize className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* External Player Launchers Grid */}
        <div className="mb-5 space-y-2">
          <label className="text-xs font-semibold text-slate-700 flex items-center justify-between">
            <span>External Players (Zero Latency & 4K Atmos Decoding)</span>
            <span className="text-[11px] font-semibold text-blue-600">VLC • PotPlayer • MPV</span>
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {/* 1-Click VLC M3U */}
            <a
              href={playlistUrl}
              download
              className="btn-primary text-white font-semibold py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 text-xs group"
            >
              <Play className="w-3.5 h-3.5 fill-current text-white" />
              <span>Download VLC .M3U Playlist</span>
              <ExternalLink className="w-3 h-3 text-blue-200 group-hover:translate-x-0.5 transition-transform" />
            </a>

            {/* Direct VLC Protocol Link */}
            <a
              href={`vlc://${streamUrl}`}
              className="btn-secondary text-slate-700 hover:text-slate-900 font-semibold py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 text-xs transition-all border border-slate-200"
              title="Open stream directly inside VLC player app"
            >
              <Tv className="w-3.5 h-3.5 text-blue-600" />
              <span>Launch VLC App Directly</span>
            </a>
          </div>
        </div>

        {/* Direct HTTP 206 Stream URL bar */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-slate-700 flex items-center justify-between">
            <span>Direct HTTP 206 Stream URL (IDM / PotPlayer / MPV / Infuse)</span>
            <span className="text-[11px] font-mono text-slate-400">Media → Open Network Stream</span>
          </label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={streamUrl}
              className="ui-input w-full text-xs font-mono px-3.5 py-2.5 text-slate-800 select-all"
            />
            <button
              type="button"
              onClick={handleCopy}
              className={`px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all shrink-0 border ${
                copied
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                  : 'btn-secondary'
              }`}
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-slate-500" />
                  <span>Copy URL</span>
                </>
              )}
            </button>
            <a
              href={downloadUrl}
              download
              className="px-3.5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs flex items-center gap-1.5 transition-all shrink-0 shadow-xs"
              title="Download file directly"
            >
              <Download className="w-3.5 h-3.5 text-white" />
              <span>Download</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
