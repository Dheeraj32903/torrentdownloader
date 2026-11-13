import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const mime = require('mime-types');

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
 * Prioritizes first 15 pieces (headers/moov atom/EBML), last 15 pieces (EBML cues/SeekHead/moof index),
 * and dynamic seek pieces so that video playback and duration bar seeking start immediately!
 */
export function prioritizeStreamPieces(torrent, file, byteStart = 0) {
  if (!torrent || !file || !torrent.pieceLength) return;

  const pieceLength = torrent.pieceLength;
  const fileOffset = file.offset || 0;
  const startPiece = Math.floor(fileOffset / pieceLength);
  const endPiece = Math.floor((fileOffset + file.length - 1) / pieceLength);

  if (typeof torrent.critical === 'function') {
    // 1. Mark container header pieces (first 15 pieces) as critical
    const headerEnd = Math.min(startPiece + 15, endPiece);
    torrent.critical(startPiece, headerEnd);

    // 2. Mark footer index/cues pieces (last 15 pieces) as critical so duration & seek map load immediately
    const footerStart = Math.max(startPiece, endPiece - 15);
    torrent.critical(footerStart, endPiece);

    // 3. Dynamic Seek: If user skipped to a specific byte in the duration bar, prioritize target pieces!
    if (byteStart > 0) {
      const seekOffset = fileOffset + byteStart;
      const seekPiece = Math.floor(seekOffset / pieceLength);
      const seekPieceEnd = Math.min(seekPiece + 15, endPiece);
      torrent.critical(seekPiece, seekPieceEnd);
      console.log(`[Stream] Seek priority applied for piece ${seekPiece}..${seekPieceEnd} (offset ${byteStart})`);
    }
  }
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
 * Returns accurate browser-friendly video/audio MIME type
 */
export function getMediaMimeType(filePath) {
  const lower = (filePath || '').toLowerCase();
  if (lower.endsWith('.mkv')) return 'video/x-matroska';
  if (lower.endsWith('.mp4') || lower.endsWith('.m4v')) return 'video/mp4';
  if (lower.endsWith('.webm')) return 'video/webm';
  if (lower.endsWith('.avi')) return 'video/x-msvideo';
  if (lower.endsWith('.mov')) return 'video/quicktime';
  if (lower.endsWith('.ogg') || lower.endsWith('.ogv')) return 'video/ogg';
  if (lower.endsWith('.mp3')) return 'audio/mpeg';
  if (lower.endsWith('.wav')) return 'audio/wav';
  if (lower.endsWith('.flac')) return 'audio/flac';
  if (lower.endsWith('.aac')) return 'audio/aac';
  if (lower.endsWith('.m4a')) return 'audio/mp4';
  return mime.lookup(filePath) || 'application/octet-stream';
}

/**
 * Handles HTTP 206 Partial Content streaming for disk video and audio
 * with bounded chunk slicing, low latency, and graceful abort on client seek.
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

    if (isNaN(start) || start >= fileSize) {
      res.status(416).set('Content-Range', `bytes */${fileSize}`);
      return res.end();
    }

    // Bounded chunk slicing (16MB max per range request) for instant seeking and low RAM footprint
    const MAX_CHUNK_SIZE = 16 * 1024 * 1024;
    let end = parts[1] ? parseInt(parts[1], 10) : (start + MAX_CHUNK_SIZE - 1);
    if (isNaN(end) || end >= fileSize) {
      end = fileSize - 1;
    }
    if (end < start) end = start;

    const chunkSize = (end - start) + 1;
    const fileStream = fs.createReadStream(filePath, { start, end });

    res.writeHead(206, {
      'Content-Range': `bytes ${start}-${end}/${fileSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunkSize,
      'Content-Type': contentType,
      'Cache-Control': 'no-cache, no-store',
      'Connection': 'keep-alive'
    });

    fileStream.pipe(res);

    // Cancel disk stream immediately if user seeks or closes tab
    res.on('close', () => {
      try {
        fileStream.destroy();
      } catch {}
    });

    fileStream.on('error', (err) => {
      console.error('[Stream] Disk stream error:', err.message);
      try {
        if (!res.headersSent) res.status(500).end();
        else res.end();
      } catch {}
    });
  } else {
    // Non-range request: serve initial 16MB slice with HTTP 206 so player knows range seeking is supported
    const end = Math.min(16 * 1024 * 1024 - 1, fileSize - 1);
    const chunkSize = end + 1;

    res.writeHead(206, {
      'Content-Range': `bytes 0-${end}/${fileSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunkSize,
      'Content-Type': contentType,
      'Cache-Control': 'no-cache, no-store'
    });

    const fileStream = fs.createReadStream(filePath, { start: 0, end });
    fileStream.on('error', (err) => {
      if (err?.code === 'PREMATURE_CLOSE' || err?.code === 'ECONNRESET' || err?.code === 'EPIPE') return;
      console.warn('[Stream] Disk stream error:', err.message);
    });
    fileStream.pipe(res);

    res.on('close', () => {
      try {
        fileStream.destroy();
      } catch {}
    });
  }
}

/**
 * Streams directly from active WebTorrent swarm pieces before/during download
 * with on-demand piece prioritization, bounded chunk requests, and zero-latency seeking.
 */
export function handleWebTorrentStream(req, res, file, torrent = null) {
  const torrentObj = torrent || file._torrent;
  const fileSize = file.length;
  const range = req.headers.range;
  const contentType = getMediaMimeType(file.name);

  // Guard response object against aborted sockets
  res.on('error', () => {});

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

    if (isNaN(start) || start >= fileSize) {
      res.status(416).set('Content-Range', `bytes */${fileSize}`);
      return res.end();
    }

    // Dynamic Chunk Slicing for Low Latency and Fast Seeking:
    // Cap unbounded requests to 12MB so WebTorrent doesn't choke trying to download gigabytes at once
    const MAX_CHUNK_SIZE = 12 * 1024 * 1024;
    let end = parts[1] ? parseInt(parts[1], 10) : (start + MAX_CHUNK_SIZE - 1);
    if (isNaN(end) || end >= fileSize) {
      end = fileSize - 1;
    }
    if (end < start) end = start;

    // Prioritize swarm pieces for the exact requested seek offset!
    if (torrentObj) {
      prioritizeStreamPieces(torrentObj, file, start);
    }

    const chunkSize = (end - start) + 1;
    res.writeHead(206, {
      'Content-Range': `bytes ${start}-${end}/${fileSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunkSize,
      'Content-Type': contentType,
      'Cache-Control': 'no-cache, no-store',
      'Connection': 'keep-alive'
    });

    const stream = file.createReadStream({ start, end });
    
    // Attach error handler BEFORE pipe to catch premature close safely
    stream.on('error', (err) => {
      if (err?.code === 'PREMATURE_CLOSE' || err?.code === 'ECONNRESET' || err?.code === 'EPIPE' || err?.message?.includes('closed')) {
        return; // Normal client seek or connection termination
      }
      console.warn('[Stream] WebTorrent stream error:', err.message);
      try {
        if (!res.headersSent) res.status(500).end();
        else res.end();
      } catch {}
    });

    stream.pipe(res);

    // Abort stream cleanly when client seeks or closes socket
    res.on('close', () => {
      try {
        if (stream && typeof stream.destroy === 'function') {
          stream.destroy();
        }
      } catch {}
    });
  } else {
    // Initial probe or non-range request: serve first chunk (first 12MB)
    const end = Math.min(12 * 1024 * 1024 - 1, fileSize - 1);
    if (torrentObj) {
      prioritizeStreamPieces(torrentObj, file, 0);
    }

    res.writeHead(206, {
      'Content-Range': `bytes 0-${end}/${fileSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': end + 1,
      'Content-Type': contentType,
      'Cache-Control': 'no-cache, no-store'
    });

    const stream = file.createReadStream({ start: 0, end });
    
    stream.on('error', (err) => {
      if (err?.code === 'PREMULTURE_CLOSE' || err?.code === 'PREMATURE_CLOSE' || err?.code === 'ECONNRESET' || err?.message?.includes('closed')) {
        return;
      }
      console.warn('[Stream] WebTorrent initial stream error:', err.message);
    });

    stream.pipe(res);

    res.on('close', () => {
      try {
        if (stream && typeof stream.destroy === 'function') {
          stream.destroy();
        }
      } catch {}
    });
  }
}

/**
 * Optional FFmpeg transcode pipeline for .mkv with AC3/DTS audio to AAC
 * Copies video stream (-c:v copy) with zero CPU overhead, only transcoding audio to AAC.
 * Supports seeking via ?ss=<seconds> or ?start=<seconds>.
 */
export async function handleFfmpegRemuxStream(req, res, inputPath) {
  const ffmpegOk = await checkFfmpeg();
  if (!ffmpegOk) {
    // Fallback to standard range stream
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

  proc.stderr.on('data', () => {}); // silence verbose logs
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
