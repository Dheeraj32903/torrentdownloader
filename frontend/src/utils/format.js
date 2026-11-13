export function formatBytes(bytes, decimals = 2) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  if (i < 0) return `${bytes} B`;
  const val = parseFloat((bytes / Math.pow(k, i)).toFixed(dm));
  return `${val} ${sizes[i] || 'B'}`;
}

export function formatSpeed(bytesPerSec) {
  if (!bytesPerSec || bytesPerSec < 1) return '0 B/s';
  return `${formatBytes(bytesPerSec)}/s`;
}

export function formatDuration(seconds) {
  if (!seconds || seconds <= 0 || !isFinite(seconds)) return 'Done';
  if (seconds < 60) return `${Math.ceil(seconds)}s`;
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  if (mins < 60) return `${mins}m ${secs}s`;
  const hours = Math.floor(mins / 60);
  const remMins = mins % 60;
  return `${hours}h ${remMins}m`;
}

export function isMediaFile(filename) {
  return /\.(mp4|mkv|webm|avi|mov|mp3|flac|wav|aac|m4a|ogg)$/i.test(filename || '');
}

export function isArchiveFile(filename) {
  return /\.(zip|rar|7z|tar|gz|bz2|xz|iso)$/i.test(filename || '');
}

export function isSubtitleFile(filename) {
  return /\.(srt|vtt|sub|ass)$/i.test(filename || '');
}

