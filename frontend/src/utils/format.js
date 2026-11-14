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
 * Extracts smart monochrome technical tags (resolution, audio, source, codec)
 */
export function extractMediaTags(name) {
  if (!name) return [];
  const tags = [];
  const n = name.toLowerCase();

  // Resolution
  if (n.includes('2160p') || n.includes('4k') || n.includes('uhd')) {
    tags.push({ label: '4K UHD' });
  } else if (n.includes('1080p') || n.includes('fhd')) {
    tags.push({ label: '1080P FHD' });
  } else if (n.includes('720p') || n.includes('hd')) {
    tags.push({ label: '720P HD' });
  }

  // Source
  if (n.includes('bluray') || n.includes('blu-ray') || n.includes('bdrip') || n.includes('brrip')) {
    tags.push({ label: 'BLURAY' });
  } else if (n.includes('web-dl') || n.includes('webrip') || n.includes('web-rip') || n.includes('web.')) {
    tags.push({ label: 'WEB-DL' });
  } else if (n.includes('hdrip') || n.includes('dvdrip')) {
    tags.push({ label: 'HDRIP' });
  }

  // Codec
  if (n.includes('x265') || n.includes('hevc') || n.includes('h265') || n.includes('h.265')) {
    tags.push({ label: 'HEVC / X265' });
  } else if (n.includes('x264') || n.includes('avc') || n.includes('h264') || n.includes('h.264')) {
    tags.push({ label: 'X264' });
  }

  // Audio
  if (n.includes('atmos')) {
    tags.push({ label: 'DOLBY ATMOS' });
  } else if (n.includes('dd+5.1') || n.includes('ddp5.1') || n.includes('5.1') || n.includes('dts')) {
    tags.push({ label: 'DOLBY 5.1' });
  }

  // Subtitles
  if (n.includes('esub') || n.includes('subs') || n.includes('sub')) {
    tags.push({ label: 'ESUB' });
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
    .replace(/^\[[a-z0-9\-.]+\]\s*/i, '')
    .trim();
}

/**
 * Parses raw scene release names into:
 * - Clean Movie Title (e.g. "Aquaman and the Lost Kingdom")
 * - Release Year (e.g. "2023")
 * - Languages subtitle (e.g. "TEL • TAM • HIN • ENG")
 */
export function parseMovieTitle(rawName) {
  if (!rawName) return { title: '', year: null, languages: null, rawCleaned: '' };

  let cleaned = cleanTorrentName(rawName);

  // Extract bracketed languages like [Tel + Tam + Hin + Eng] or [Hindi + English] or [Dual Audio]
  let languages = null;
  const langMatch = cleaned.match(/\[([a-z\s+•,-]+(?:tel|tam|hin|eng|mal|kan|kor|jap|chi|multi|dual)[a-z\s+•,-]*)\]/i);
  if (langMatch) {
    const rawLang = langMatch[1];
    languages = rawLang
      .split(/[+\/•,-]/)
      .map(l => l.trim().toUpperCase())
      .filter(l => l.length >= 2 && !['AND', 'WITH', 'AUDIO'].includes(l))
      .join(' • ');
    // Remove the bracketed language from the string to help extract title
    cleaned = cleaned.replace(langMatch[0], ' ');
  }

  // Extract year: 19xx or 20xx
  let year = null;
  const yearMatch = cleaned.match(/\b(19\d{2}|20\d{2})\b/);
  if (yearMatch) {
    year = yearMatch[1];
  }

  // Determine title boundary: everything before the year, or before common scene tags
  let title = cleaned;
  if (year) {
    const idx = cleaned.indexOf(year);
    if (idx > 0) {
      title = cleaned.substring(0, idx);
    }
  } else {
    // Cut before common scene tokens
    const sceneTokens = /\b(bluray|blu-ray|1080p|720p|2160p|4k|web-dl|webrip|hdrip|x264|x265|hevc|ddp|dts|aac)\b/i;
    const match = cleaned.match(sceneTokens);
    if (match && match.index > 0) {
      title = cleaned.substring(0, match.index);
    }
  }

  // Clean punctuation from title
  title = title
    .replace(/[._]/g, ' ')
    .replace(/[\(\[\{\)\]\}]/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/[-–—]\s*$/, '')
    .trim();

  if (!title) {
    title = cleanTorrentName(rawName);
  }

  return {
    title,
    year,
    languages,
    rawCleaned: cleanTorrentName(rawName)
  };
}
