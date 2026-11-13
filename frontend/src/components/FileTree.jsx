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
      <div className="py-6 text-center text-xs text-[#646E82] font-mono">
        Discovering swarm file tree & metadata...
      </div>
    );
  }

  const getIcon = (name) => {
    if (/\.(mp4|mkv|webm|avi|mov)$/i.test(name)) return <Film className="w-4 h-4 text-[#0066FF] shrink-0" />;
    if (/\.(mp3|flac|wav|aac|ogg|m4a)$/i.test(name)) return <Music className="w-4 h-4 text-indigo-600 shrink-0" />;
    if (isArchiveFile(name)) return <Archive className="w-4 h-4 text-amber-600 shrink-0" />;
    if (isSubtitleFile(name)) return <Subtitles className="w-4 h-4 text-emerald-600 shrink-0" />;
    return <FileText className="w-4 h-4 text-[#646E82] shrink-0" />;
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
    <div className="mt-4 pt-4 border-t border-[#E0E4EC] space-y-3 font-mono">
      {/* Header & Filter Row */}
      <div className="flex items-center justify-between flex-wrap gap-2.5 px-1">
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            type="button"
            onClick={() => setFilterType('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              filterType === 'all'
                ? 'btn-primary'
                : 'btn-secondary text-[#646E82]'
            }`}
          >
            [ ALL ({files.length}) ]
          </button>

          {videoCount > 0 && (
            <button
              type="button"
              onClick={() => setFilterType('video')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                filterType === 'video'
                  ? 'btn-primary'
                  : 'btn-secondary text-[#646E82]'
              }`}
            >
              <Film className="w-3 h-3" />
              <span>[ VIDEOS ({videoCount}) ]</span>
            </button>
          )}

          {subtitleCount > 0 && (
            <button
              type="button"
              onClick={() => setFilterType('subtitle')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                filterType === 'subtitle'
                  ? 'btn-primary'
                  : 'btn-secondary text-[#646E82]'
              }`}
            >
              <Subtitles className="w-3 h-3" />
              <span>[ SUBS ({subtitleCount}) ]</span>
            </button>
          )}

          {archiveCount > 0 && (
            <button
              type="button"
              onClick={() => setFilterType('archive')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                filterType === 'archive'
                  ? 'btn-primary'
                  : 'btn-secondary text-[#646E82]'
              }`}
            >
              <Archive className="w-3 h-3" />
              <span>[ ARCHIVES ({archiveCount}) ]</span>
            </button>
          )}
        </div>

        {/* Mini file search */}
        {files.length > 5 && (
          <div className="relative flex items-center">
            <Search className="w-3.5 h-3.5 text-[#8F9CAE] absolute left-3 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search files..."
              className="ui-input text-xs text-[#0D0F1C] placeholder-[#8F9CAE] pl-8 pr-3 py-1 w-40 sm:w-48 font-mono"
            />
          </div>
        )}
      </div>

      {/* File List Container */}
      <div className="divide-y divide-[#E0E4EC] bg-[#F8FAFC] rounded-xl border border-[#E0E4EC] overflow-hidden max-h-80 overflow-y-auto">
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
              className="px-3 sm:px-4 py-2.5 flex items-center justify-between gap-3 hover:bg-white transition-colors text-xs"
            >
              {/* File details */}
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                {getIcon(file.name || filePath)}
                <span className="truncate text-[#0D0F1C] font-semibold text-xs sm:text-[13px]" title={filePath}>
                  {file.name || filePath}
                </span>
                <span className="text-[11px] text-[#646E82] mono-stat shrink-0 ml-1">
                  ( {file.sizeFormatted || formatBytes(file.size || file.length || 0)} )
                </span>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1.5 shrink-0">
                {isStreamable && (
                  <>
                    <button
                      type="button"
                      onClick={() => onStreamFile(torrent, file)}
                      className="btn-primary px-2.5 py-1 text-[11px] flex items-center gap-1"
                      title="Stream in VLC or External Media Player"
                    >
                      <Play className="w-3 h-3 fill-current text-white" />
                      <span>[ STREAM ]</span>
                    </button>
                    <a
                      href={playlistUrl}
                      download
                      className="btn-secondary px-2 py-1 text-[11px] font-bold"
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
                    className="btn-secondary px-2.5 py-1 text-amber-600 border-amber-200 hover:bg-amber-50 text-[11px] flex items-center gap-1"
                    title="Extract compressed archive via background worker"
                  >
                    <FolderArchive className="w-3 h-3" />
                    <span>[ EXTRACT ]</span>
                  </button>
                )}

                <a
                  href={downloadUrl}
                  download
                  className="btn-secondary px-2.5 py-1 text-emerald-700 border-emerald-200 hover:bg-emerald-50 text-[11px] flex items-center gap-1 font-bold"
                  title="Direct download to your computer"
                >
                  <Download className="w-3 h-3" />
                  <span>[ DL ]</span>
                </a>

                <button
                  type="button"
                  onClick={() => copyToClipboard(fullDownloadUrl, file.name || filePath)}
                  className="btn-secondary p-1 text-[11px]"
                  title="Copy direct download link"
                >
                  <Copy className="w-3 h-3 text-[#646E82]" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
