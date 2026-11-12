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
 * Prioritizes first 10 pieces (headers/moov atom) and last 2 pieces (EBML cues)
 * so that video playback in browsers and media players starts immediately!
 */
export function prioritizeStreamPieces(torrent, file) {
  if (!torrent || !file || !torrent.pieceLength) return;

  const pieceLength = torrent.pieceLength;
  const startPiece = Math.floor(file.offset / pieceLength);
  const endPiece = Math.floor((file.offset + file.length - 1) / pieceLength);

  // Mark container header pieces as critical
  const headerEnd = Math.min(startPiece + 10, endPiece);
  if (typeof torrent.critical === 'function') {
    torrent.critical(startPiece, headerEnd);
    // Mark footer index/cues pieces as critical
    torrent.critical(Math.max(startPiece, endPiece - 2), endPiece);
    console.log(`[Stream] Critical pieces prioritized: ${startPiece}..${headerEnd} and ${Math.max(startPiece, endPiece - 2)}..${endPiece}`);
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
 * Returns browser-friendly video/audio MIME type
 */
export function getMediaMimeType(filePath) {
  const lower = filePath.toLowerCase();
  if (lower.endsWith('.mkv')) return 'video/mp4; codecs="avc1.42E01E, mp4a.40.2"';
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
export function handleWebTorrentStream(req, res, file, torrent = null) {
  if (torrent) {
    prioritizeStreamPieces(torrent, file);
  }

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
 * Optional FFmpeg transcode pipeline for .mkv with AC3/DTS audio to AAC
 * Copies video stream (-c:v copy) with zero CPU overhead, only transcoding audio to AAC.
 */
export async function handleFfmpegRemuxStream(req, res, inputPath) {
  const ffmpegOk = await checkFfmpeg();
  if (!ffmpegOk) {
    // Fallback to standard range stream
    return handleMediaStream(req, res, inputPath);
  }

  res.writeHead(200, {
    'Content-Type': 'video/mp4',
    'Cache-Control': 'no-cache'
  });

  const proc = spawn('ffmpeg', [
    '-re',
    '-i', inputPath,
    '-c:v', 'copy',
    '-c:a', 'aac',
    '-b:a', '192k',
    '-f', 'mp4',
    '-movflags', 'frag_keyframe+empty_moov+default_base_moof',
    'pipe:1'
  ]);

  proc.stdout.pipe(res);

  proc.stderr.on('data', () => {}); // silence verbose logs
  res.on('close', () => proc.kill('SIGKILL'));
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
