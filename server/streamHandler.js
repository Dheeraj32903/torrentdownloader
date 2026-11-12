import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const mime = require('mime-types');

/**
 * Converts SRT subtitle text to WebVTT format
 */
export function srtToVtt(srtContent) {
  let vtt = 'WEBVTT\n\n' + srtContent
    // Normalize newlines
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    // Replace comma in timestamps with period
    .replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2');

  return vtt;
}

/**
 * Returns browser-friendly video/audio MIME type
 */
export function getMediaMimeType(filePath) {
  const lower = filePath.toLowerCase();
  if (lower.endsWith('.mkv')) return 'video/mp4; codecs="avc1.42E01E, mp4a.40.2"'; // Chromium compatible or x-matroska
  if (lower.endsWith('.mp4')) return 'video/mp4';
  if (lower.endsWith('.webm')) return 'video/webm';
  if (lower.endsWith('.ogg') || lower.endsWith('.ogv')) return 'video/ogg';
  if (lower.endsWith('.mp3')) return 'audio/mpeg';
  if (lower.endsWith('.wav')) return 'audio/wav';
  if (lower.endsWith('.flac')) return 'audio/flac';
  if (lower.endsWith('.aac')) return 'audio/aac';
  return mime.lookup(filePath) || 'application/octet-stream';
}

/**
 * Handles HTTP 206 Partial Content streaming for disk video and audio
 */
export function handleMediaStream(req, res, filePath) {
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'File not found on disk' });
  }

  const stat = fs.statSync(filePath);
  const fileSize = stat.size;
  const range = req.headers.range;
  const contentType = getMediaMimeType(filePath);

  if (range) {
    const parts = range.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

    if (start >= fileSize) {
      res.status(416).set('Content-Range', `bytes */${fileSize}`);
      return res.end();
    }

    const chunkSize = (end - start) + 1;
    const fileStream = fs.createReadStream(filePath, { start, end });

    res.writeHead(206, {
      'Content-Range': `bytes ${start}-${end}/${fileSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunkSize,
      'Content-Type': contentType,
      'Cache-Control': 'no-cache'
    });

    fileStream.pipe(res);
    fileStream.on('error', (err) => {
      console.error('[Stream] Stream error:', err);
      if (!res.headersSent) res.status(500).end();
    });
  } else {
    res.writeHead(200, {
      'Content-Length': fileSize,
      'Accept-Ranges': 'bytes',
      'Content-Type': contentType,
      'Cache-Control': 'no-cache'
    });

    fs.createReadStream(filePath).pipe(res);
  }
}

/**
 * Streams directly from active WebTorrent swarm pieces before disk write
 */
export function handleWebTorrentStream(req, res, file) {
  const fileSize = file.length;
  const range = req.headers.range;
  const contentType = getMediaMimeType(file.name);

  if (range) {
    const parts = range.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

    if (start >= fileSize) {
      res.status(416).set('Content-Range', `bytes */${fileSize}`);
      return res.end();
    }

    const chunkSize = (end - start) + 1;
    res.writeHead(206, {
      'Content-Range': `bytes ${start}-${end}/${fileSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunkSize,
      'Content-Type': contentType,
      'Cache-Control': 'no-cache'
    });

    const stream = file.createReadStream({ start, end });
    stream.pipe(res);
    stream.on('error', (err) => {
      console.warn('[Stream] WebTorrent stream error:', err.message);
    });
  } else {
    res.writeHead(200, {
      'Content-Length': fileSize,
      'Accept-Ranges': 'bytes',
      'Content-Type': contentType,
      'Cache-Control': 'no-cache'
    });

    const stream = file.createReadStream();
    stream.pipe(res);
  }
}

/**
 * Finds subtitle files (.srt, .vtt) in the same directory or 'Subs' folder
 */
export function findSubtitles(videoFilePath, baseDir) {
  const subtitles = [];
  const videoDir = path.dirname(videoFilePath);

  function scanDir(dir) {
    if (!fs.existsSync(dir)) return;
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory() && (entry.name.toLowerCase() === 'subs' || entry.name.toLowerCase() === 'subtitles')) {
          scanDir(full);
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name).toLowerCase();
          if (ext === '.srt' || ext === '.vtt') {
            const relPath = path.relative(baseDir, full).replace(/\\/g, '/');
            subtitles.push({
              name: entry.name,
              relativePath: relPath,
              isVtt: ext === '.vtt'
            });
          }
        }
      }
    } catch {}
  }

  scanDir(videoDir);
  return subtitles;
}

