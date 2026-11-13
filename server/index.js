import express from 'express';
import http from 'http';
import path from 'path';
import fs from 'fs';
import cors from 'cors';
import multer from 'multer';
import { WebSocketServer, WebSocket } from 'ws';
import { TorrentManager } from './torrentManager.js';
import { handleMediaStream, handleWebTorrentStream, handleFfmpegRemuxStream, srtToVtt, findSubtitles } from './streamHandler.js';
import { handleDirectDownload, streamFolderAsZip, generateAria2InputFile, listDirectoryContents, getDiskStats, formatBytes, resolveFilePath } from './fileManager.js';
import { extractArchive } from './extractor.js';

// Global error handlers to prevent premature client disconnects (VLC seeking / browser aborts) from crashing the server
process.on('uncaughtException', (err) => {
  if (err?.code === 'PREMATURE_CLOSE' || err?.code === 'ECONNRESET' || err?.code === 'EPIPE' || err?.message?.includes('closed')) {
    return; // Safe to ignore client socket termination
  }
  console.error('[Process] Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason) => {
  if (reason?.code === 'PREMATURE_CLOSE' || reason?.code === 'ECONNRESET') return;
  console.warn('[Process] Unhandled Rejection:', reason);
});

const PORT = process.env.PORT || 3000;
const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

// Optional Password Authentication Middleware
const MAGNETX_PASSWORD = process.env.MAGNETX_PASSWORD;
if (MAGNETX_PASSWORD) {
  app.use((req, res, next) => {
    if (req.path.startsWith('/api')) {
      const customHeader = req.headers['x-magnetx-password'];
      const queryToken = req.query.token;
      const authHeader = req.headers['authorization'];

      if (customHeader === MAGNETX_PASSWORD || queryToken === MAGNETX_PASSWORD) {
        return next();
      }
      if (authHeader) {
        if (authHeader.startsWith('Bearer ') && authHeader.slice(7).trim() === MAGNETX_PASSWORD) {
          return next();
        }
        if (authHeader.startsWith('Basic ')) {
          const creds = Buffer.from(authHeader.slice(6), 'base64').toString().split(':');
          if (creds[1] === MAGNETX_PASSWORD || creds[0] === MAGNETX_PASSWORD) {
            return next();
          }
        }
      }
      res.setHeader('WWW-Authenticate', 'Basic realm="MagnetX Protected"');
      return res.status(401).json({ error: 'Unauthorized: Valid MAGNETX_PASSWORD required' });
    }
    next();
  });
}

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.resolve('./public')));

// Downloads directory
const DOWNLOADS_DIR = path.resolve('./downloads');
if (!fs.existsSync(DOWNLOADS_DIR)) {
  fs.mkdirSync(DOWNLOADS_DIR, { recursive: true });
}

// Multer for .torrent file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB max torrent file
});

// Initialize Torrent Manager
const torrentManager = new TorrentManager({ downloadDir: DOWNLOADS_DIR });

// Broadcast helper for WebSockets
function broadcast(data) {
  const msg = JSON.stringify(data);
  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) {
      try {
        client.send(msg);
      } catch (err) {
        console.error('[WS] Send error:', err);
      }
    }
  }
}

torrentManager.setBroadcastCallback((torrents) => {
  broadcast({ type: 'torrents_update', data: torrents });
});

// Interval broadcast for live download & upload speed counters
setInterval(() => {
  if (wss.clients.size > 0) {
    const torrents = torrentManager.getAllTorrents();
    const disk = getDiskStats(DOWNLOADS_DIR);
    
    let totalDownSpeed = 0;
    let totalUpSpeed = 0;
    for (const t of torrents) {
      totalDownSpeed += (t.downloadSpeed || 0);
      totalUpSpeed += (t.uploadSpeed || 0);
    }

    broadcast({
      type: 'tick',
      data: {
        torrents,
        disk,
        speeds: {
          download: totalDownSpeed,
          downloadFormatted: `${formatBytes(totalDownSpeed)}/s`,
          upload: totalUpSpeed,
          uploadFormatted: `${formatBytes(totalUpSpeed)}/s`
        }
      }
    });
  }
}, 1000);

wss.on('connection', (ws) => {
  console.log('[WS] Client connected');
  // Send immediate state
  const torrents = torrentManager.getAllTorrents();
  const disk = getDiskStats(DOWNLOADS_DIR);
  ws.send(JSON.stringify({ type: 'init', data: { torrents, disk } }));

  ws.on('close', () => {
    // client disconnected
  });
});

// ==================== REST API ====================

// Add torrent by Magnet URI
app.post('/api/torrents/add-magnet', async (req, res) => {
  const { magnet } = req.body;
  if (!magnet || !magnet.trim()) {
    return res.status(400).json({ error: 'Magnet URI is required' });
  }

  try {
    const meta = await torrentManager.addTorrent(magnet.trim());
    res.json({ success: true, torrent: meta });
  } catch (err) {
    console.error('[API] Add magnet error:', err.message);
    res.status(500).json({ error: err.message || 'Failed to add magnet' });
  }
});

// Upload .torrent file
app.post('/api/torrents/upload-torrent', upload.single('torrent'), async (req, res) => {
  if (!req.file || !req.file.buffer) {
    return res.status(400).json({ error: 'No .torrent file provided' });
  }

  try {
    const meta = await torrentManager.addTorrent(req.file.buffer, req.file.originalname.replace(/\.torrent$/i, ''));
    res.json({ success: true, torrent: meta });
  } catch (err) {
    console.error('[API] Upload torrent error:', err.message);
    res.status(500).json({ error: err.message || 'Failed to parse .torrent file' });
  }
});

// List all torrents
app.get('/api/torrents', (req, res) => {
  res.json(torrentManager.getAllTorrents());
});

// Delete torrent
app.delete('/api/torrents/:hash', async (req, res) => {
  const { hash } = req.params;
  const deleteFiles = req.query.deleteFiles === 'true';

  try {
    await torrentManager.deleteTorrent(hash, deleteFiles);
    res.json({ success: true, message: 'Torrent deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Manual Archive Extraction trigger for whole torrent
app.post('/api/torrents/:hash/extract', async (req, res) => {
  const { hash } = req.params;
  const meta = torrentManager.torrentsMap.get(hash);

  if (!meta) {
    return res.status(404).json({ error: 'Torrent not found' });
  }

  try {
    torrentManager.triggerExtraction(hash, null, meta.name);
    res.json({ success: true, message: 'Extraction started' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Manual Archive Extraction for a specific file
app.post('/api/extract-file', async (req, res) => {
  const { hash, relativePath } = req.body;
  const meta = torrentManager.torrentsMap.get(hash);
  if (!meta) return res.status(404).json({ error: 'Torrent not found' });

  const torrentDir = path.join(DOWNLOADS_DIR, meta.name || hash);
  const archivePath = path.join(torrentDir, relativePath);

  if (!fs.existsSync(archivePath)) {
    return res.status(404).json({ error: 'Archive file not found' });
  }

  const baseName = path.basename(archivePath);
  const cleanName = baseName.replace(/\.(part\d+\.rar|tar\.[a-z0-9]+|[a-z0-9]+)$/i, '');
  const outDir = path.join(path.dirname(archivePath), `${cleanName}_extracted`);

  try {
    console.log(`[API] Extracting single archive: ${archivePath} -> ${outDir}`);
    const result = await extractArchive(archivePath, outDir);
    torrentManager.notifyUpdate();
    res.json({ success: true, message: `Successfully extracted ${baseName}`, result });
  } catch (err) {
    console.error('[API] Single archive extract error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Browse Files inside a torrent (including extracted folders!)
app.get('/api/torrents/:hash/files', (req, res) => {
  const { hash } = req.params;
  const meta = torrentManager.torrentsMap.get(hash);

  if (!meta) {
    return res.status(404).json({ error: 'Torrent not found' });
  }

  const torrentDir = path.join(DOWNLOADS_DIR, meta.name || hash);

  if (!fs.existsSync(torrentDir)) {
    // If not completed yet or single file, list from active torrent files
    const active = torrentManager.getActiveTorrent(hash);
    if (active && active.files) {
      const files = active.files.map(f => ({
        name: f.name,
        path: f.path.replace(/\\/g, '/'),
        size: f.length,
        sizeFormatted: formatBytes(f.length),
        isDirectory: false,
        isStreamable: /\.(mp4|mkv|webm|mp3|flac|wav|ogg)$/i.test(f.name)
      }));
      return res.json({ files, isComplete: false });
    }
    return res.json({ files: [], isComplete: false });
  }

  const tree = listDirectoryContents(torrentDir, torrentDir);
  res.json({ files: tree, isComplete: meta.status === 'completed', name: meta.name });
});

// Update selective file choices
app.post('/api/torrents/:hash/select', (req, res) => {
  const { hash } = req.params;
  const { selectedIndices } = req.body;
  if (!Array.isArray(selectedIndices)) {
    return res.status(400).json({ error: 'selectedIndices must be an array of numbers' });
  }
  const meta = torrentManager.torrentsMap.get(hash);
  if (!meta) return res.status(404).json({ error: 'Torrent not found' });

  torrentManager.updateSelections(hash, selectedIndices);
  res.json({ success: true, message: 'File selections updated', selectedCount: selectedIndices.length });
});

// Aria2 input file export (.txt)
app.get('/api/torrents/:hash/aria2', (req, res) => {
  const { hash } = req.params;
  const meta = torrentManager.torrentsMap.get(hash);
  if (!meta) return res.status(404).json({ error: 'Torrent not found' });

  const hostUrl = `${req.protocol}://${req.get('host')}`;
  const files = meta.files && meta.files.length > 0 ? meta.files : [{ name: meta.name, path: meta.name }];
  const content = generateAria2InputFile(hostUrl, hash, files);

  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(meta.name || hash)}.aria2.txt"`);
  res.send(content);
});

// Stream Playlist (.m3u) for VLC, PotPlayer, MPV, IINA & Network Players
app.get('/api/stream-playlist/:hash', (req, res) => {
  const { hash } = req.params;
  const relPath = req.query.file;
  const meta = torrentManager.torrentsMap.get(hash);
  if (!meta) return res.status(404).json({ error: 'Torrent not found' });

  const hostUrl = `${req.protocol}://${req.get('host')}`;
  let content = '#EXTM3U\n\n';

  if (relPath) {
    const fileName = path.basename(relPath);
    const streamUrl = `${hostUrl}/api/stream/${hash}?file=${encodeURIComponent(relPath)}`;
    content += `#EXTINF:-1,${fileName}\n${streamUrl}\n`;
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileName)}.m3u"`);
  } else {
    const streamableFiles = (meta.files || []).filter(f => f.isStreamable);
    if (streamableFiles.length > 0) {
      for (const f of streamableFiles) {
        const streamUrl = `${hostUrl}/api/stream/${hash}?file=${encodeURIComponent(f.path)}`;
        content += `#EXTINF:-1,${f.name}\n${streamUrl}\n\n`;
      }
    } else {
      const streamUrl = `${hostUrl}/api/stream/${hash}?file=${encodeURIComponent(meta.name)}`;
      content += `#EXTINF:-1,${meta.name}\n${streamUrl}\n`;
    }
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(meta.name || hash)}.m3u"`);
  }

  res.setHeader('Content-Type', 'audio/x-mpegurl; charset=utf-8');
  res.send(content);
});

// Stream Video / Audio with HTTP 206 Partial Content (WebTorrent Swarm + Disk Cache)
app.get('/api/stream/:hash', async (req, res) => {
  const { hash } = req.params;
  const relPath = req.query.file;
  if (!relPath) return res.status(400).json({ error: 'Query param "file" is required' });

  const meta = torrentManager.torrentsMap.get(hash);
  if (!meta) {
    return res.status(404).json({ error: 'Torrent not found' });
  }

  // Parse byte offset if range header is present
  let seekByte = 0;
  if (req.headers.range) {
    const parts = req.headers.range.replace(/bytes=/, '').split('-');
    seekByte = parseInt(parts[0], 10) || 0;
  }

  const activeTorrent = torrentManager.getActiveTorrent(hash);

  // If active torrent is still discovering peers & resolving metadata, wait up to 12s for handshake
  if (activeTorrent && (!activeTorrent.files || activeTorrent.files.length === 0)) {
    console.log(`[Stream] Waiting for swarm metadata for ${meta.name || hash}...`);
    await new Promise((resolve) => {
      const onMeta = () => { cleanup(); resolve(true); };
      const timer = setTimeout(() => { cleanup(); resolve(false); }, 12000);
      const cleanup = () => {
        clearTimeout(timer);
        activeTorrent.off('metadata', onMeta);
      };
      activeTorrent.once('metadata', onMeta);
    });
  }

  const isComplete = meta.status === 'completed' || (activeTorrent && activeTorrent.done);

  // 1. If torrent is actively downloading in WebTorrent swarm:
  // MUST stream through WebTorrent so pieces at seek location are downloaded on-demand from peers!
  if (!isComplete && activeTorrent && activeTorrent.files && activeTorrent.files.length > 0) {
    const norm = relPath.replace(/\\/g, '/');
    const file = activeTorrent.files.find(f => 
      f.path.replace(/\\/g, '/') === norm ||
      f.name === path.basename(norm) ||
      norm.endsWith(f.name)
    );

    if (file) {
      torrentManager.prioritizeForStreaming(hash, file.path, seekByte);
      return handleWebTorrentStream(req, res, file, activeTorrent);
    }
  }

  // 2. If completed or extracted file on disk:
  const targetFile = resolveFilePath(DOWNLOADS_DIR, meta, relPath);
  if (targetFile && fs.existsSync(targetFile) && fs.statSync(targetFile).size > 0) {
    if (req.query.remux === 'true') {
      return handleFfmpegRemuxStream(req, res, targetFile);
    }
    return handleMediaStream(req, res, targetFile);
  }

  // 3. Fallback: stream through active swarm if file exists
  if (activeTorrent && activeTorrent.files && activeTorrent.files.length > 0) {
    const norm = relPath.replace(/\\/g, '/');
    const file = activeTorrent.files.find(f => 
      f.path.replace(/\\/g, '/') === norm ||
      f.name === path.basename(norm)
    );
    if (file) {
      torrentManager.prioritizeForStreaming(hash, file.path, seekByte);
      return handleWebTorrentStream(req, res, file, activeTorrent);
    }
  }

  // If still resolving metadata from swarm
  if (activeTorrent && (!activeTorrent.files || activeTorrent.files.length === 0)) {
    return res.status(503).json({
      error: 'Connecting to swarm peers to fetch metadata... Please wait a few moments and try again.',
      retryAfter: 5
    });
  }

  return res.status(404).json({ error: 'File not found on disk or in active stream' });
});

// Subtitles list & WebVTT conversion
app.get('/api/subtitles/:hash', (req, res) => {
  const { hash } = req.params;
  const relPath = req.query.file;
  if (!relPath) return res.status(400).json({ error: 'Query param "file" is required' });

  const meta = torrentManager.torrentsMap.get(hash);
  if (!meta) return res.status(404).json({ error: 'Torrent not found' });

  const targetFile = resolveFilePath(DOWNLOADS_DIR, meta, relPath);
  if (!targetFile || !fs.existsSync(targetFile)) {
    return res.status(404).json({ error: 'Subtitle file not found' });
  }

  try {
    const rawContent = fs.readFileSync(targetFile, 'utf8');
    const vtt = srtToVtt(rawContent);
    res.setHeader('Content-Type', 'text/vtt; charset=utf-8');
    res.send(vtt);
  } catch (err) {
    res.status(500).json({ error: 'Failed to convert subtitle' });
  }
});

// Get subtitles for a video
app.get('/api/video-subtitles/:hash', (req, res) => {
  const { hash } = req.params;
  const videoRelPath = req.query.file;
  if (!videoRelPath) return res.status(400).json({ error: 'Query param "file" is required' });

  const meta = torrentManager.torrentsMap.get(hash);
  if (!meta) return res.status(404).json({ error: 'Torrent not found' });

  const targetFile = resolveFilePath(DOWNLOADS_DIR, meta, videoRelPath);
  if (!targetFile || !fs.existsSync(targetFile)) {
    return res.json({ subtitles: [] });
  }

  const subs = findSubtitles(targetFile, DOWNLOADS_DIR);
  res.json({ subtitles: subs });
});

// Direct Download File (Dual-Mode: Maximum Gigabit speed from disk if complete, or Live Swarm streaming)
app.get('/api/download/:hash', (req, res) => {
  const { hash } = req.params;
  const relPath = req.query.file;
  if (!relPath) return res.status(400).json({ error: 'Query param "file" is required' });

  const meta = torrentManager.torrentsMap.get(hash);
  if (!meta) return res.status(404).json({ error: 'Torrent not found' });

  const activeTorrent = torrentManager.getActiveTorrent(hash);
  const isComplete = meta.status === 'completed' || (activeTorrent && activeTorrent.done);

  // 1. If completed or extracted on disk: Serve directly from disk with instant gigabit speed & Range resume
  if (isComplete) {
    const targetFile = resolveFilePath(DOWNLOADS_DIR, meta, relPath);
    if (targetFile && fs.existsSync(targetFile)) {
      return handleDirectDownload(req, res, targetFile, path.basename(targetFile));
    }
  }

  // 2. If actively downloading in swarm: Stream download directly from WebTorrent pieces
  if (activeTorrent && activeTorrent.files && activeTorrent.files.length > 0) {
    const norm = relPath.replace(/\\/g, '/');
    const file = activeTorrent.files.find(f => 
      f.path.replace(/\\/g, '/') === norm ||
      f.name === path.basename(norm) ||
      norm.endsWith(f.name)
    );

    if (file) {
      const fileName = file.name || path.basename(relPath);
      const safeFilename = encodeURIComponent(fileName).replace(/['()]/g, escape).replace(/\*/g, '%2A');
      const fileSize = file.length;
      const range = req.headers.range;

      if (range) {
        const parts = range.replace(/bytes=/, '').split('-');
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

        if (isNaN(start) || start >= fileSize) {
          res.status(416).set('Content-Range', `bytes */${fileSize}`);
          return res.end();
        }

        const chunkSize = (end - start) + 1;
        res.writeHead(206, {
          'Content-Range': `bytes ${start}-${end}/${fileSize}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': chunkSize,
          'Content-Type': 'application/octet-stream',
          'Content-Disposition': `attachment; filename="${fileName}"; filename*=UTF-8''${safeFilename}`,
          'Cache-Control': 'no-cache'
        });

        res.on('error', () => {});

        const stream = file.createReadStream({ start, end });
        stream.on('error', (err) => {
          if (err?.code === 'PREMATURE_CLOSE' || err?.code === 'ECONNRESET' || err?.message?.includes('closed')) return;
          console.warn('[Download] Swarm stream error:', err.message);
        });
        stream.pipe(res);
        res.on('close', () => { try { stream.destroy(); } catch {} });
        return;
      } else {
        res.writeHead(200, {
          'Content-Length': fileSize,
          'Accept-Ranges': 'bytes',
          'Content-Type': 'application/octet-stream',
          'Content-Disposition': `attachment; filename="${fileName}"; filename*=UTF-8''${safeFilename}`,
          'Cache-Control': 'no-cache'
        });

        res.on('error', () => {});

        const stream = file.createReadStream();
        stream.on('error', (err) => {
          if (err?.code === 'PREMATURE_CLOSE' || err?.code === 'ECONNRESET' || err?.message?.includes('closed')) return;
          console.warn('[Download] Swarm stream error:', err.message);
        });
        stream.pipe(res);
        res.on('close', () => { try { stream.destroy(); } catch {} });
        return;
      }
    }
  }

  // 3. Fallback: Check if file exists on disk
  const targetFile = resolveFilePath(DOWNLOADS_DIR, meta, relPath);
  if (targetFile && fs.existsSync(targetFile)) {
    return handleDirectDownload(req, res, targetFile, path.basename(targetFile));
  }

  // 4. If metadata is still resolving
  if (activeTorrent && (!activeTorrent.files || activeTorrent.files.length === 0)) {
    return res.status(503).json({
      error: 'Connecting to swarm peers to fetch metadata... Please wait a few seconds and try downloading again.'
    });
  }

  return res.status(404).json({ error: 'File not found on disk or in active stream' });
});

// Download entire Torrent/Folder as ZIP (On-the-fly streaming)
app.get('/api/download-zip/:hash', (req, res) => {
  const { hash } = req.params;
  const meta = torrentManager.torrentsMap.get(hash);

  if (!meta) return res.status(404).json({ error: 'Torrent not found' });

  const torrentDir = path.join(DOWNLOADS_DIR, meta.name || hash);

  if (fs.existsSync(torrentDir)) {
    return streamFolderAsZip(torrentDir, meta.name || 'torrent', res);
  }

  // Check if it's a single file saved directly in DOWNLOADS_DIR
  const singleFilePath = resolveFilePath(DOWNLOADS_DIR, meta, meta.name);
  if (singleFilePath && fs.existsSync(singleFilePath)) {
    return streamFolderAsZip(singleFilePath, meta.name || 'torrent', res);
  }

  return res.status(400).json({ error: 'Download has not finished or folder does not exist yet' });
});

// System storage & statistics
app.get('/api/system/stats', (req, res) => {
  const disk = getDiskStats(DOWNLOADS_DIR);
  const torrents = torrentManager.getAllTorrents();
  
  let totalDownSpeed = 0;
  let totalUpSpeed = 0;
  let activeCount = 0;

  for (const t of torrents) {
    totalDownSpeed += (t.downloadSpeed || 0);
    totalUpSpeed += (t.uploadSpeed || 0);
    if (t.status === 'downloading') activeCount++;
  }

  res.json({
    disk,
    torrentsCount: torrents.length,
    activeDownloads: activeCount,
    downloadSpeed: totalDownSpeed,
    downloadSpeedFormatted: `${formatBytes(totalDownSpeed)}/s`,
    uploadSpeed: totalUpSpeed,
    uploadSpeedFormatted: `${formatBytes(totalUpSpeed)}/s`
  });
});

// Fallback to index.html for SPA
app.use((req, res) => {
  res.sendFile(path.resolve('./public/index.html'));
});

// Start server
server.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`🚀 MagnetX Direct Extractor is LIVE!`);
  console.log(`🌐 Web UI: http://localhost:${PORT}`);
  console.log(`📁 Workspace: ${DOWNLOADS_DIR}`);
  console.log(`=======================================================`);
});
