import React, { useState } from 'react';
import { 
  Film, Music, FileText, Archive, Subtitles, 
  Download, Play, Copy, FolderArchive, Search 
} from 'lucide-react';
import { formatBytes, isMediaFile, isArchiveFile, isSubtitleFile } from '../utils/format.js';
import { apiUrl } from '../utils/api.js';

export default function FileTree({ torrent, files, onStreamFile, onExtractSingle, onShowToast }) {
  const [filterType, setFilterType] = useState('all'); // 'all' | 'video' | 'archive' | 'subtitle'
  const [search, setSearch] = useState('');

  if (!files || files.length === 0) {
    return (
      <div className="py-6 text-center text-xs text-slate-400 font-mono">
        Discovering swarm file tree & metadata...
      </div>
    );
  }

  const getIcon = (name) => {
    if (/\.(mp4|mkv|webm|avi|mov)$/i.test(name)) return <Film className="w-4 h-4 text-blue-600 shrink-0" />;
    if (/\.(mp3|flac|wav|aac|ogg|m4a)$/i.test(name)) return <Music className="w-4 h-4 text-cyan-600 shrink-0" />;
    if (isArchiveFile(name)) return <Archive className="w-4 h-4 text-amber-600 shrink-0" />;
    if (isSubtitleFile(name)) return <Subtitles className="w-4 h-4 text-slate-500 shrink-0" />;
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
    <div className="mt-4 pt-4 border-t border-slate-100 space-y-3 font-sans">
      {/* Header & Filter Row */}
      <div className="flex items-center justify-between flex-wrap gap-2.5 px-0.5">
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            type="button"
            onClick={() => setFilterType('all')}
            className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors cursor-pointer ${
              filterType === 'all'
                ? 'bg-blue-50 text-blue-700 border border-blue-200'
                : 'text-slate-600 hover:text-slate-900 bg-slate-100 border border-slate-200'
            }`}
          >
            All Files ({files.length})
          </button>

          {videoCount > 0 && (
            <button
              type="button"
              onClick={() => setFilterType('video')}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 ${
                filterType === 'video'
                  ? 'bg-blue-50 text-blue-700 border border-blue-200'
                  : 'text-slate-600 hover:text-slate-900 bg-slate-100 border border-slate-200'
              }`}
            >
              <Film className="w-3.5 h-3.5 text-blue-600" />
              <span>Videos ({videoCount})</span>
            </button>
          )}

          {subtitleCount > 0 && (
            <button
              type="button"
              onClick={() => setFilterType('subtitle')}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 ${
                filterType === 'subtitle'
                  ? 'bg-blue-50 text-blue-700 border border-blue-200'
                  : 'text-slate-600 hover:text-slate-900 bg-slate-100 border border-slate-200'
              }`}
            >
              <Subtitles className="w-3.5 h-3.5 text-slate-500" />
              <span>Subtitles ({subtitleCount})</span>
            </button>
          )}

          {archiveCount > 0 && (
            <button
              type="button"
              onClick={() => setFilterType('archive')}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 ${
                filterType === 'archive'
                  ? 'bg-blue-50 text-blue-700 border border-blue-200'
                  : 'text-slate-600 hover:text-slate-900 bg-slate-100 border border-slate-200'
              }`}
            >
              <Archive className="w-3.5 h-3.5 text-amber-600" />
              <span>Archives ({archiveCount})</span>
            </button>
          )}
        </div>

        {/* Mini file search */}
        {files.length > 5 && (
          <div className="relative flex items-center">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search files..."
              className="bg-white border border-slate-200 focus:border-blue-500 text-xs text-slate-800 placeholder:text-slate-400 rounded-lg pl-8 pr-3 py-1 w-40 sm:w-48 font-sans transition-colors outline-none"
            />
          </div>
        )}
      </div>

      {/* File List Container */}
      <div className="divide-y divide-slate-100 bg-slate-50/60 rounded-xl border border-slate-200 overflow-hidden max-h-80 overflow-y-auto">
        {filteredFiles.map((file, idx) => {
          const filePath = file.path || file.name;
          const fileIdx = file.index !== undefined ? file.index : idx;
          const streamUrl = apiUrl(`/api/stream/${torrent.infoHash}/${fileIdx}?file=${encodeURIComponent(filePath)}`);
          const downloadUrl = apiUrl(`/api/download/${torrent.infoHash}/${fileIdx}?file=${encodeURIComponent(filePath)}`);
          const playlistUrl = apiUrl(`/api/stream-playlist/${torrent.infoHash}?file=${encodeURIComponent(filePath)}`);
          const fullDownloadUrl = downloadUrl.startsWith('http') ? downloadUrl : `${window.location.origin}${downloadUrl}`;
          const isStreamable = isMediaFile(file.name || filePath);
          const isArchive = isArchiveFile(file.name || filePath);

          return (
            <div
              key={idx}
              className="px-3 sm:px-4 py-2.5 flex items-center justify-between gap-3 hover:bg-white transition-colors text-xs"
            >
              {/* File details */}
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                {getIcon(file.name || filePath)}
                <span className="truncate text-slate-800 font-medium text-xs sm:text-[13px]" title={filePath}>
                  {file.name || filePath}
                </span>
                <span className="text-[11px] text-slate-400 font-mono mono-stat shrink-0 ml-1">
                  ({file.sizeFormatted || formatBytes(file.size || file.length || 0)})
                </span>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1.5 shrink-0">
                {isStreamable && (
                  <>
                    <button
                      type="button"
                      onClick={() => onStreamFile(torrent, file)}
                      className="btn-primary py-1 px-2.5 text-[11px]"
                      title="Stream in VLC or External Media Player"
                    >
                      <Play className="w-3 h-3 fill-white text-white" />
                      <span>Stream</span>
                    </button>
                    <a
                      href={playlistUrl}
                      download
                      className="btn-secondary py-1 px-2 text-[11px] font-mono text-slate-600"
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
                    className="px-2.5 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 text-[11px] font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                    title="Extract compressed archive via background worker"
                  >
                    <FolderArchive className="w-3 h-3" />
                    <span>Extract</span>
                  </button>
                )}

                <a
                  href={downloadUrl}
                  download={file.name || filePath}
                  className="btn-secondary py-1 px-2.5 text-[11px] font-semibold text-slate-700"
                  title="Direct download to your computer"
                >
                  <Download className="w-3 h-3 text-blue-600" />
                  <span>Download</span>
                </a>

                <button
                  type="button"
                  onClick={() => copyToClipboard(fullDownloadUrl, file.name || filePath)}
                  className="p-1 rounded-lg hover:bg-slate-200 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
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
