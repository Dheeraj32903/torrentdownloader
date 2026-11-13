import React, { useState } from 'react';
import { 
  Film, Music, FileText, Archive, Subtitles, 
  Download, Play, Copy, FolderArchive, Search 
} from 'lucide-react';
import { formatBytes, isMediaFile, isArchiveFile, isSubtitleFile } from '../utils/format.js';

export default function FileTree({ torrent, files, onStreamFile, onExtractSingle, onShowToast }) {
  const [filterType, setFilterType] = useState('all'); // 'all' | 'video' | 'archive' | 'subtitle'
  const [search, setSearch] = useState('');

  if (!files || files.length === 0) {
    return (
      <div className="py-6 text-center text-xs text-slate-500 font-mono">
        Discovering swarm file tree & metadata...
      </div>
    );
  }

  const getIcon = (name) => {
    if (/\.(mp4|mkv|webm|avi|mov)$/i.test(name)) return <Film className="w-4 h-4 text-cyan-400 shrink-0" />;
    if (/\.(mp3|flac|wav|aac|ogg|m4a)$/i.test(name)) return <Music className="w-4 h-4 text-violet-400 shrink-0" />;
    if (isArchiveFile(name)) return <Archive className="w-4 h-4 text-amber-400 shrink-0" />;
    if (isSubtitleFile(name)) return <Subtitles className="w-4 h-4 text-emerald-400 shrink-0" />;
    return <FileText className="w-4 h-4 text-slate-400 shrink-0" />;
  };

  const copyToClipboard = (url, name) => {
    navigator.clipboard.writeText(url);
    onShowToast(`Copied download URL for: ${name}`, 'success');
  };

  // Filter logic
  const filteredFiles = files.filter(f => {
    const name = f.name || f.path || '';
    if (search && !name.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterType === 'video') return isMediaFile(name);
    if (filterType === 'archive') return isArchiveFile(name);
    if (filterType === 'subtitle') return isSubtitleFile(name);
    return true;
  });

  const videoCount = files.filter(f => isMediaFile(f.name || f.path)).length;
  const archiveCount = files.filter(f => isArchiveFile(f.name || f.path)).length;
  const subtitleCount = files.filter(f => isSubtitleFile(f.name || f.path)).length;

  return (
    <div className="mt-4 pt-4 border-t border-white/[0.06] space-y-3">
      {/* Header & Filter Row */}
      <div className="flex items-center justify-between flex-wrap gap-2.5 px-1">
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            type="button"
            onClick={() => setFilterType('all')}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
              filterType === 'all'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                : 'text-slate-400 hover:text-white hover:bg-white/[0.05]'
            }`}
          >
            All Files <span className="mono-stat text-[11px] opacity-70">({files.length})</span>
          </button>

          {videoCount > 0 && (
            <button
              type="button"
              onClick={() => setFilterType('video')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                filterType === 'video'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                  : 'text-slate-400 hover:text-white hover:bg-white/[0.05]'
              }`}
            >
              <Film className="w-3 h-3 text-cyan-400" />
              <span>Videos</span>
              <span className="mono-stat text-[11px] opacity-70">({videoCount})</span>
            </button>
          )}

          {subtitleCount > 0 && (
            <button
              type="button"
              onClick={() => setFilterType('subtitle')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                filterType === 'subtitle'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  : 'text-slate-400 hover:text-white hover:bg-white/[0.05]'
              }`}
            >
              <Subtitles className="w-3 h-3 text-emerald-400" />
              <span>Subtitles</span>
              <span className="mono-stat text-[11px] opacity-70">({subtitleCount})</span>
            </button>
          )}

          {archiveCount > 0 && (
            <button
              type="button"
              onClick={() => setFilterType('archive')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                filterType === 'archive'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                  : 'text-slate-400 hover:text-white hover:bg-white/[0.05]'
              }`}
            >
              <Archive className="w-3 h-3 text-amber-400" />
              <span>Archives</span>
              <span className="mono-stat text-[11px] opacity-70">({archiveCount})</span>
            </button>
          )}
        </div>

        {/* Mini file search if more than 5 files */}
        {files.length > 5 && (
          <div className="relative flex items-center">
            <Search className="w-3 h-3 text-slate-500 absolute left-2.5 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search file in torrent..."
              className="bg-black/30 border border-white/[0.08] text-xs text-white placeholder-slate-500 pl-7 pr-2.5 py-1 rounded-lg focus:outline-none focus:border-emerald-500/40 w-40 sm:w-48 font-mono"
            />
          </div>
        )}
      </div>

      {/* File List Bento Container */}
      <div className="divide-y divide-white/[0.04] bg-black/40 rounded-2xl border border-white/[0.06] overflow-hidden max-h-80 overflow-y-auto">
        {filteredFiles.map((file, idx) => {
          const filePath = file.path || file.name;
          const streamUrl = `/api/stream/${torrent.infoHash}?file=${encodeURIComponent(filePath)}`;
          const downloadUrl = `/api/download/${torrent.infoHash}?file=${encodeURIComponent(filePath)}`;
          const playlistUrl = `/api/stream-playlist/${torrent.infoHash}?file=${encodeURIComponent(filePath)}`;
          const fullDownloadUrl = `${window.location.origin}${downloadUrl}`;
          const isStreamable = isMediaFile(file.name || filePath);
          const isArchive = isArchiveFile(file.name || filePath);

          return (
            <div
              key={idx}
              className="px-3 sm:px-4 py-2.5 flex items-center justify-between gap-3 hover:bg-white/[0.03] transition-colors text-xs"
            >
              {/* File details */}
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                {getIcon(file.name || filePath)}
                <span className="truncate text-slate-200 font-medium text-xs sm:text-[13px]" title={filePath}>
                  {file.name || filePath}
                </span>
                <span className="text-[11px] text-slate-400 mono-stat shrink-0 ml-1">
                  {file.sizeFormatted || formatBytes(file.size || file.length || 0)}
                </span>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1.5 shrink-0">
                {isStreamable && (
                  <>
                    <button
                      type="button"
                      onClick={() => onStreamFile(torrent, file)}
                      className="px-2.5 py-1 rounded-lg bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-300 border border-indigo-500/30 font-semibold text-[11px] flex items-center gap-1 transition-all"
                      title="Stream in VLC or External Media Player"
                    >
                      <Play className="w-3 h-3 fill-current text-indigo-400" />
                      <span>Stream VLC</span>
                    </button>
                    <a
                      href={playlistUrl}
                      download
                      className="px-2 py-1 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] text-slate-300 border border-white/[0.08] font-medium text-[11px] transition-all"
                      title="Download .m3u playlist"
                    >
                      .m3u
                    </a>
                  </>
                )}

                {isArchive && (
                  <button
                    type="button"
                    onClick={() => onExtractSingle(torrent.infoHash, filePath)}
                    className="px-2.5 py-1 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 font-semibold text-[11px] flex items-center gap-1 transition-all"
                    title="Extract compressed archive via background worker"
                  >
                    <FolderArchive className="w-3 h-3 text-amber-400" />
                    <span>Extract</span>
                  </button>
                )}

                <a
                  href={downloadUrl}
                  download
                  className="px-2.5 py-1 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 font-semibold text-[11px] flex items-center gap-1 transition-all"
                  title="Direct download to your computer"
                >
                  <Download className="w-3 h-3 text-emerald-400" />
                  <span>Download</span>
                </a>

                <button
                  type="button"
                  onClick={() => copyToClipboard(fullDownloadUrl, file.name || filePath)}
                  className="p-1 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] text-slate-400 hover:text-white border border-white/[0.08] transition-all"
                  title="Copy direct download link"
                >
                  <Copy className="w-3 h-3" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
