import React from 'react';
import { Film, Music, FileText, Archive, Subtitles, Download, Play, Copy, FolderArchive } from 'lucide-react';
import { formatBytes, isMediaFile, isArchiveFile, isSubtitleFile } from '../utils/format.js';

export default function FileTree({ torrent, files, onStreamFile, onExtractSingle, onShowToast }) {
  if (!files || files.length === 0) {
    return (
      <div className="py-6 text-center text-xs text-slate-500">
        Discovering file structure from swarm peers...
      </div>
    );
  }

  const getIcon = (name) => {
    if (/\.(mp4|mkv|webm|avi|mov)$/i.test(name)) return <Film className="w-4 h-4 text-indigo-600 shrink-0" />;
    if (/\.(mp3|flac|wav|aac|ogg|m4a)$/i.test(name)) return <Music className="w-4 h-4 text-violet-600 shrink-0" />;
    if (isArchiveFile(name)) return <Archive className="w-4 h-4 text-amber-600 shrink-0" />;
    if (isSubtitleFile(name)) return <Subtitles className="w-4 h-4 text-emerald-600 shrink-0" />;
    return <FileText className="w-4 h-4 text-slate-500 shrink-0" />;
  };

  const copyToClipboard = (url, name) => {
    navigator.clipboard.writeText(url);
    onShowToast(`Copied download link for: ${name}`, 'success');
  };

  return (
    <div className="mt-4 border-t border-slate-100 pt-4 space-y-2">
      <div className="flex items-center justify-between text-xs text-slate-500 font-semibold px-2 mb-2">
        <span>Files in Torrent ({files.length})</span>
        <span className="text-[11px] font-normal text-slate-400">Dual-Mode Direct Stream & Download</span>
      </div>

      <div className="divide-y divide-slate-100 bg-slate-50/70 rounded-xl border border-slate-200 overflow-hidden max-h-80 overflow-y-auto">
        {files.map((file, idx) => {
          const filePath = file.path || file.name;
          const streamUrl = `/api/stream/${torrent.infoHash}?file=${encodeURIComponent(filePath)}`;
          const downloadUrl = `/api/download/${torrent.infoHash}?file=${encodeURIComponent(filePath)}`;
          const playlistUrl = `/api/stream-playlist/${torrent.infoHash}?file=${encodeURIComponent(filePath)}`;
          const fullDownloadUrl = `${window.location.origin}${downloadUrl}`;
          const isStreamable = isMediaFile(file.name);
          const isArchive = isArchiveFile(file.name);

          return (
            <div
              key={idx}
              className="px-3 sm:px-4 py-2.5 flex items-center justify-between gap-3 hover:bg-slate-100/60 transition-colors text-xs"
            >
              {/* File details */}
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                {getIcon(file.name)}
                <span className="truncate text-slate-800 font-medium text-[13px]" title={file.name}>
                  {file.name}
                </span>
                <span className="text-[11px] text-slate-500 font-mono shrink-0 ml-1">
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
                      className="px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 font-semibold text-[11px] flex items-center gap-1 transition-all"
                      title="Stream in VLC or External Media Player"
                    >
                      <Play className="w-3 h-3 fill-current" />
                      <span>Stream VLC</span>
                    </button>
                    <a
                      href={playlistUrl}
                      download
                      className="px-2 py-1 rounded-lg bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 font-medium text-[11px] transition-all"
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
                    className="px-2.5 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 font-semibold text-[11px] flex items-center gap-1 transition-all"
                    title="Extract compressed archive via background worker"
                  >
                    <FolderArchive className="w-3 h-3" />
                    <span>Extract</span>
                  </button>
                )}

                <a
                  href={downloadUrl}
                  download
                  className="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 font-semibold text-[11px] flex items-center gap-1 transition-all"
                  title="Direct download to your computer"
                >
                  <Download className="w-3 h-3" />
                  <span>Download</span>
                </a>

                <button
                  type="button"
                  onClick={() => copyToClipboard(fullDownloadUrl, file.name)}
                  className="p-1 rounded-lg bg-white hover:bg-slate-100 text-slate-500 hover:text-slate-700 border border-slate-200 transition-all"
                  title="Copy direct IDM link"
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
