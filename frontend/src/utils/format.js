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

/**
 * Extracts smart badges (resolution, audio, source, codec) from media torrent titles
 */
export function extractMediaTags(name) {
  if (!name) return [];
  const tags = [];
  const n = name.toLowerCase();

  // Resolution
  if (n.includes('2160p') || n.includes('4k')) {
    tags.push({ label: '4K UHD', type: 'purple' });
  } else if (n.includes('1080p')) {
    tags.push({ label: '1080p FHD', type: 'indigo' });
  } else if (n.includes('720p')) {
    tags.push({ label: '720p HD', type: 'blue' });
  }

  // Source
  if (n.includes('bluray') || n.includes('blu-ray')) {
    tags.push({ label: 'BluRay', type: 'sky' });
  } else if (n.includes('web-dl') || n.includes('webrip') || n.includes('web-rip')) {
    tags.push({ label: 'WEB-DL', type: 'sky' });
  } else if (n.includes('hdrip')) {
    tags.push({ label: 'HDRip', type: 'sky' });
  }

  // Codec
  if (n.includes('x265') || n.includes('hevc')) {
    tags.push({ label: 'HEVC / x265', type: 'emerald' });
  } else if (n.includes('x264') || n.includes('h.264')) {
    tags.push({ label: 'x264', type: 'emerald' });
  }

  // Audio
  if (n.includes('atmos')) {
    tags.push({ label: 'Dolby Atmos', type: 'amber' });
  } else if (n.includes('dd+5.1') || n.includes('dd+ 5.1') || n.includes('5.1')) {
    tags.push({ label: 'Dolby 5.1', type: 'amber' });
  }

  // Subtitles
  if (n.includes('esub') || n.includes('subs') || n.includes('sub')) {
    tags.push({ label: 'ESub', type: 'teal' });
  }

  return tags;
}

/**
 * Cleans up site prefixes like www.5MovieRulz.company - for display
 */
export function cleanTorrentName(name) {
  if (!name) return '';
  return name
    .replace(/^www\.[a-z0-9\-.]+\.(com|company|org|net|me|in|to|is|cx|cc)\s*-\s*/i, '')
    .trim();
}
