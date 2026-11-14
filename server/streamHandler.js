import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const mime = require('mime-types');

const MIME_TYPES = {
  '.mp4': 'video/mp4',
  '.m4v': 'video/mp4',
  '.mkv': 'video/x-matroska',
  '.webm': 'video/webm',
  '.avi': 'video/x-msvideo',
  '.mov': 'video/quicktime',
  '.mp3': 'audio/mpeg',
  '.flac': 'audio/flac',
  '.wav': 'audio/wav',
  '.aac': 'audio/aac',
  '.ogg': 'audio/ogg',
  '.srt': 'text/plain; charset=utf-8',
  '.vtt': 'text/vtt; charset=utf-8'
};

let ffmpegChecked = false;
let hasFfmpeg = false;

export function checkFfmpeg() {
  if (ffmpegChecked) return Promise.resolve(hasFfmpeg);
  return new Promise((resolve) => {
    const proc = spawn('ffmpeg', ['-version']);
    proc.on('error', () => {
      ffmpegChecked = true;
      hasFfmpeg = false;
      resolve(false);
    });
    proc.on('close', (code) => {
      ffmpegChecked = true;
      hasFfmpeg = code === 0;
      resolve(hasFfmpeg);
    });
  });
}

/**
 * Returns accurate browser-friendly video/audio MIME type
 */
export function getMediaMimeType(filePath) {
  const ext = path.extname(filePath || '').toLowerCase();
  return MIME_TYPES[ext] || mime.lookup(filePath) || 'application/octet-stream';
}

/**
 * Converts SRT subtitle text to WebVTT format
 */
export function srtToVtt(srtContent) {
  return 'WEBVTT\n\n' + srtContent
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2');
}

/**
 * Prioritizes first 20 pieces (headers/moov atom/EBML), last 3 pieces (EBML cues/SeekHead/moof index),
 * and dynamic seek pieces so that video playback and duration bar seeking start immediately!
 */
export function prioritizeStreamPieces(torrent, file, byteStart = 0) {
  if (!torrent || !file || !torrent.pieceLength) return;

  const pieceLength = torrent.pieceLength;
  const fileOffset = file.offset || 0;
  const startPiece = Math.floor(fileOffset / pieceLength);
  const endPiece = Math.floor((fileOffset + file.length - 1) / pieceLength);

  if (typeof torrent.critical === 'function') {
    // 1. Mark container header pieces (first 20 pieces) as critical for instant metadata load
    const headerEnd = Math.min(startPiece + 20, endPiece);
    torrent.critical(startPiece, headerEnd);

    // 2. Mark footer index/cues pieces (last 3 pieces) as critical so duration & seek map load immediately
    const footerStart = Math.max(startPiece, endPiece - 3);
    torrent.critical(footerStart, endPiece);

    // 3. Dynamic Seek: If user skipped to a specific byte in the duration bar, prioritize target pieces!
    if (byteStart > 0) {
      const seekOffset = fileOffset + byteStart;
      const seekPiece = Math.floor(seekOffset / pieceLength);
      const seekPieceEnd = Math.min(seekPiece + 25, endPiece);
      torrent.critical(seekPiece, seekPieceEnd);
      console.log(`[Stream] Seek priority applied for piece ${seekPiece}..${seekPieceEnd} (offset ${byteStart})`);
    }
  }
}

/**
 * Rock-solid Dual-Path Streaming + HEAD Request + Range Prioritization engine
 * Serves both /api/download and /api/stream endpoints with zero memory leaks and maximum disk/swarm throughput.
 */
export function handleFileStream(req, res, torrent, fileIdentifier, isDownload = false) {
  if (!torrent) {
    return res.status(404).json({ error: 'Torrent not found' });
  }

  // Resolve file by index or relative path
  let file = null;
  const files = torrent.files || [];

  if (typeof fileIdentifier === 'number' || (!isNaN(parseInt(fileIdentifier, 10)) && String(parseInt(fileIdentifier, 10)) === String(fileIdentifier))) {
    const idx = parseInt(fileIdentifier, 10);
    file = files[idx];
  } else if (typeof fileIdentifier === 'string' && fileIdentifier.trim()) {
    const norm = fileIdentifier.replace(/\\/g, '/');
    file = files.find(f => 
      f.path.replace(/\\/g, '/') === norm ||
      f.name === path.basename(norm) ||
      norm.endsWith(f.name)
    );
  }

  // Fallback: If no identifier or not found, select largest video or first file
  if (!file && files.length > 0) {
    const videoFiles = files.filter(f => /\.(mp4|mkv|webm|avi|mov)$/i.test(f.name));
    if (videoFiles.length > 0) {
      file = videoFiles.reduce((prev, curr) => (curr.length > prev.length ? curr : prev));
    } else {
      file = files[0];
    }
  }

  if (!file) {
    return res.status(404).json({ error: 'File not found in torrent' });
  }

  const totalSize = file.length;
  const ext = path.extname(file.name).toLowerCase();
  const contentType = isDownload
    ? 'application/octet-stream'
    : (MIME_TYPES[ext] || 'application/octet-stream');

  const safeAsciiName = file.name.replace(/[^\x20-\x7E]/g, '_').replace(/"/g, '');
  const dispositionType = isDownload ? 'attachment' : 'inline';

  // Parse Range header for HTTP 206 Partial Content (Used by video players & IDM)
  const range = req.headers.range;
  let start = 0;
  let end = totalSize - 1;

  if (range) {
    const parts = range.replace(/bytes=/, '').split('-');
    start = parseInt(parts[0], 10);
    end = parts[1] ? parseInt(parts[1], 10) : totalSize - 1;

    if (isNaN(start) || isNaN(end) || start >= totalSize || end >= totalSize || start > end) {
      res.setHeader('Content-Range', `bytes */${totalSize}`);
      return res.status(416).end();
    }
  }

  // Handle HEAD requests immediately without opening stream
  if (req.method === 'HEAD') {
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader(
      'Content-Disposition',
      `${dispositionType}; filename="${safeAsciiName}"; filename*=UTF-8''${encodeURIComponent(file.name)}`
    );
    if (range) {
      res.status(206);
      res.setHeader('Content-Range', `bytes ${start}-${end}/${totalSize}`);
      res.setHeader('Content-Length', end - start + 1);
    } else {
      res.status(200);
      res.setHeader('Content-Length', totalSize);
    }
    return res.end();
  }

  // Check if file is 100% downloaded on disk for native high-speed fs streaming
  const diskFilePath = path.join(torrent.path || '', file.path || file.name);
  const isCompleteOnDisk = (torrent.done || (file.progress !== undefined && file.progress >= 1)) && fs.existsSync(diskFilePath);

  let stream;
  try {
    if (isCompleteOnDisk) {
      // PATH A: Fast native OS disk stream (1MB chunks, zero WebTorrent overhead)
      stream = fs.createReadStream(diskFilePath, {
        start,
        end,
        highWaterMark: 1024 * 1024
      });
    } else {
      // PATH B: Live swarm stream — prioritize the exact pieces requested!
      if (typeof file.createReadStream !== 'function') {
        return res.status(503).json({ error: 'File stream is not ready yet. Please wait for swarm peers to connect.' });
      }
      if (torrent.pieceLength) {
        const absStart = (file.offset || 0) + start;
        const absEnd = (file.offset || 0) + end;
        const startPiece = Math.floor(absStart / torrent.pieceLength);
        const endPiece = Math.floor(absEnd / torrent.pieceLength);

        // Mark next 25 pieces from current playback/download point as critical
        if (typeof torrent.critical === 'function') {
          torrent.critical(startPiece, Math.min(endPiece, startPiece + 25));
        }
      }
      file.select();
      stream = file.createReadStream({ start, end });
    }
  } catch (err) {
    console.warn('[Stream] Stream creation error:', err.message);
    return res.status(503).json({ error: 'File stream is not ready yet: ' + err.message });
  }

  if (!stream) {
    return res.status(503).json({ error: 'Unable to initialize stream for file' });
  }

  // Set response headers only AFTER stream has been created successfully
  res.setHeader('Accept-Ranges', 'bytes');
  res.setHeader('Content-Type', contentType);
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader(
    'Content-Disposition',
    `${dispositionType}; filename="${safeAsciiName}"; filename*=UTF-8''${encodeURIComponent(file.name)}`
  );

  if (range) {
    res.status(206);
    res.setHeader('Content-Range', `bytes ${start}-${end}/${totalSize}`);
    res.setHeader('Content-Length', end - start + 1);
  } else {
    res.status(200);
    res.setHeader('Content-Length', totalSize);
  }

  // Prevent memory/descriptor leaks when user seeks or cancels download
  let closed = false;
  const cleanup = () => {
    if (!closed) {
      closed = true;
      if (stream && typeof stream.destroy === 'function') {
        try { stream.destroy(); } catch {}
      }
    }
  };

  req.on('close', cleanup);
  res.on('close', cleanup);

  stream.on('error', (err) => {
    cleanup();
    if (err?.code === 'PREMATURE_CLOSE' || err?.code === 'ECONNRESET' || err?.code === 'EPIPE' || err?.message?.includes('closed')) {
      return;
    }
    console.warn('[Stream] Stream error:', err.message);
    if (!res.headersSent) {
      res.status(500).end();
    } else {
      res.end();
    }
  });

  stream.pipe(res);
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

  if (req.method === 'HEAD') {
    res.writeHead(200, {
      'Accept-Ranges': 'bytes',
      'Content-Length': fileSize,
      'Content-Type': contentType,
      'Cache-Control': 'no-cache'
    });
    return res.end();
  }

  if (range) {
    const parts = range.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

    if (isNaN(start) || isNaN(end) || start >= fileSize || end >= fileSize || start > end) {
      res.status(416).set('Content-Range', `bytes */${fileSize}`);
      return res.end();
    }

    const chunkSize = (end - start) + 1;
    const fileStream = fs.createReadStream(filePath, { start, end, highWaterMark: 1024 * 1024 });

    res.writeHead(206, {
      'Content-Range': `bytes ${start}-${end}/${fileSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunkSize,
      'Content-Type': contentType,
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    });

    fileStream.pipe(res);

    res.on('close', () => {
      try { fileStream.destroy(); } catch {}
    });

    fileStream.on('error', (err) => {
      try {
        if (!res.headersSent) res.status(500).end();
        else res.end();
      } catch {}
    });
  } else {
    res.writeHead(200, {
      'Accept-Ranges': 'bytes',
      'Content-Length': fileSize,
      'Content-Type': contentType,
      'Cache-Control': 'no-cache'
    });

    const fileStream = fs.createReadStream(filePath, { highWaterMark: 1024 * 1024 });
    fileStream.pipe(res);

    res.on('close', () => {
      try { fileStream.destroy(); } catch {}
    });
  }
}

/**
 * Streams directly from active WebTorrent swarm pieces
 */
export function handleWebTorrentStream(req, res, file, torrent = null) {
  const torrentObj = torrent || file._torrent;
  return handleFileStream(req, res, torrentObj, file.path || file.name, false);
}

/**
 * Optional FFmpeg transcode pipeline for .mkv with AC3/DTS audio to AAC
 */
export async function handleFfmpegRemuxStream(req, res, inputPath) {
  const ffmpegOk = await checkFfmpeg();
  if (!ffmpegOk) {
    return handleMediaStream(req, res, inputPath);
  }

  const seekSeconds = parseFloat(req.query.ss || req.query.start || 0);

  res.writeHead(200, {
    'Content-Type': 'video/mp4',
    'Cache-Control': 'no-cache, no-store',
    'Connection': 'keep-alive'
  });

  const ffmpegArgs = [];
  if (seekSeconds > 0) {
    ffmpegArgs.push('-ss', seekSeconds.toString());
  }

  ffmpegArgs.push(
    '-i', inputPath,
    '-c:v', 'copy',
    '-c:a', 'aac',
    '-b:a', '192k',
    '-f', 'mp4',
    '-movflags', 'frag_keyframe+empty_moov+default_base_moof',
    'pipe:1'
  );

  const proc = spawn('ffmpeg', ffmpegArgs);
  proc.stdout.pipe(res);

  proc.stderr.on('data', () => {});
  res.on('close', () => {
    try {
      proc.kill('SIGKILL');
    } catch {}
  });
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
