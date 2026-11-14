import express from 'express';
import http from 'http';
import path from 'path';
import fs from 'fs';
import cors from 'cors';
import multer from 'multer';
import { WebSocketServer, WebSocket } from 'ws';
import { TorrentManager } from './torrentManager.js';
import { handleFileStream, handleMediaStream, handleWebTorrentStream, handleFfmpegRemuxStream, srtToVtt, findSubtitles } from './streamHandler.js';
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

// 15-second WebSocket ping/pong keep-alive to prevent silent timeouts
const pingInterval = setInterval(() => {
  for (const client of wss.clients) {
    if (client.isAlive === false) {
      client.terminate();
      continue;
    }
    client.isAlive = false;
    client.ping();
  }
}, 15000);

wss.on('close', () => {
  clearInterval(pingInterval);
});

wss.on('connection', (ws) => {
  ws.isAlive = true;
  ws.on('pong', () => {
    ws.isAlive = true;
  });

  console.log('[WS] Client connected');
  // Send immediate state on connection
  const torrents = torrentManager.getAllTorrents();
  const disk = getDiskStats(DOWNLOADS_DIR);
  let totalDownSpeed = 0;
  let totalUpSpeed = 0;
  for (const t of torrents) {
    totalDownSpeed += (t.downloadSpeed || 0);
    totalUpSpeed += (t.uploadSpeed || 0);
  }

  ws.send(JSON.stringify({ 
    type: 'init', 
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
  }));

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

// Pause an active torrent download
app.post('/api/torrents/:hash/pause', (req, res) => {
  const result = torrentManager.pauseTorrent(req.params.hash);
  res.json(result);
});

// Resume a paused torrent download
app.post('/api/torrents/:hash/resume', (req, res) => {
  const result = torrentManager.resumeTorrent(req.params.hash);
  res.json(result);
});

// Get real-time connected swarm peers list
app.get('/api/torrents/:hash/peers', (req, res) => {
  const peers = torrentManager.getTorrentPeers(req.params.hash);
  res.json({ peers, count: peers.length });
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

// Helper to resolve torrent object and stream file via dual-path engine
async function resolveAndStream(req, res, isDownload) {
  const { hash, fileIndex } = req.params;
  const fileIdentifier = fileIndex !== undefined ? fileIndex : req.query.file;

  const meta = torrentManager.torrentsMap.get(hash);
  const activeTorrent = torrentManager.getActiveTorrent(hash);

  if (!meta && !activeTorrent) {
    return res.status(404).json({ error: 'Torrent not found' });
  }

  // If active torrent is still discovering peers & resolving metadata, wait up to 10s
  if (activeTorrent && (!activeTorrent.files || activeTorrent.files.length === 0)) {
    console.log(`[Stream] Waiting for swarm metadata for ${meta?.name || hash}...`);
    await new Promise((resolve) => {
      const onMeta = () => { cleanup(); resolve(true); };
      const timer = setTimeout(() => { cleanup(); resolve(false); }, 10000);
      const cleanup = () => {
        clearTimeout(timer);
        activeTorrent.off('metadata', onMeta);
      };
      activeTorrent.once('metadata', onMeta);
    });
  }

  // Build unified torrent object
  let torrentObj = activeTorrent;
  // If activeTorrent has no files yet, but meta has files, fallback to meta.files!
  if ((!torrentObj || !torrentObj.files || torrentObj.files.length === 0) && meta && meta.files && meta.files.length > 0) {
    const isDone = meta.status === 'completed' || meta.status === 'ready' || (meta.progress >= 1);
    torrentObj = {
      path: path.join(DOWNLOADS_DIR, meta.name || hash),
      done: isDone,
      pieceLength: activeTorrent?.pieceLength || 1024 * 1024,
      files: (meta.files || []).map((f, i) => ({
        index: i,
        name: f.name,
        path: f.path || f.name,
        length: f.size || f.length || 0,
        progress: isDone ? 1 : (f.progress || 0),
        select: () => {},
        deselect: () => {},
        createReadStream: (opts) => {
          const filePath = resolveFilePath(DOWNLOADS_DIR, meta, f.path || f.name);
          if (fs.existsSync(filePath)) {
            return fs.createReadStream(filePath, opts);
          }
          if (activeTorrent && activeTorrent.files && activeTorrent.files[i]) {
            return activeTorrent.files[i].createReadStream(opts);
          }
          return fs.createReadStream(filePath, opts);
        }
      }))
    };
  }

  return handleFileStream(req, res, torrentObj, fileIdentifier, isDownload);
}

// Stream Video / Audio with HTTP 206 Partial Content (Supports Range, HEAD, Swarm & Disk)
app.all(['/api/stream/:hash/:fileIndex', '/api/stream/:hash'], async (req, res) => {
  if (req.query.remux === 'true') {
    const { hash } = req.params;
    const meta = torrentManager.torrentsMap.get(hash);
    const targetFile = resolveFilePath(DOWNLOADS_DIR, meta, req.query.file || '');
    if (targetFile && fs.existsSync(targetFile)) {
      return handleFfmpegRemuxStream(req, res, targetFile);
    }
  }
  return resolveAndStream(req, res, false);
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

// Direct Download File (Dual-Path: Maximum Gigabit disk speed or Live Swarm Range Streaming)
app.all(['/api/download/:hash/:fileIndex', '/api/download/:hash'], async (req, res) => {
  return resolveAndStream(req, res, true);
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

// Boost torrent swarm discovery & announce to all trackers
app.post('/api/torrents/:hash/boost', (req, res) => {
  const result = torrentManager.boostTorrent(req.params.hash);
  if (!result.success) {
    return res.status(400).json(result);
  }
  res.json(result);
});

// Purge all downloaded files and clear storage
app.post('/api/storage/purge-all', async (req, res) => {
  try {
    const result = await torrentManager.purgeAllStorage();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to purge storage' });
  }
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
