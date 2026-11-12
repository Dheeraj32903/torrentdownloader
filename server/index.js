import express from 'express';
import http from 'http';
import path from 'path';
import fs from 'fs';
import cors from 'cors';
import multer from 'multer';
import { WebSocketServer, WebSocket } from 'ws';
import { TorrentManager } from './torrentManager.js';
import { handleMediaStream, handleWebTorrentStream, srtToVtt, findSubtitles } from './streamHandler.js';
import { handleDirectDownload, handleZipFolder, listDirectoryContents, getDiskStats, formatBytes, resolveFilePath } from './fileManager.js';
import { extractArchive } from './extractor.js';

const PORT = process.env.PORT || 3000;
const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

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

// Stream Video / Audio with HTTP 206 Partial Content (Disk + Live WebTorrent Pieces)
app.get('/api/stream/:hash', (req, res) => {
  const { hash } = req.params;
  const relPath = req.query.file;
  if (!relPath) return res.status(400).json({ error: 'Query param "file" is required' });

  const meta = torrentManager.torrentsMap.get(hash);
  if (!meta) {
    return res.status(404).json({ error: 'Torrent not found' });
  }

  // Prioritize piece download if it is actively downloading
  torrentManager.prioritizeForStreaming(hash, relPath);

  // 1. Check if file is available on disk
  const targetFile = resolveFilePath(DOWNLOADS_DIR, meta, relPath);
  if (targetFile && fs.existsSync(targetFile) && fs.statSync(targetFile).size > 0) {
    return handleMediaStream(req, res, targetFile);
  }

  // 2. If not on disk yet or actively downloading, stream live from WebTorrent pieces
  const activeTorrent = torrentManager.getActiveTorrent(hash);
  if (activeTorrent && activeTorrent.files && activeTorrent.files.length > 0) {
    const file = activeTorrent.files.find(f => 
      f.path.replace(/\\/g, '/') === relPath.replace(/\\/g, '/') ||
      f.name === path.basename(relPath)
    );
    if (file) {
      return handleWebTorrentStream(req, res, file);
    }
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

// Direct Download File
app.get('/api/download/:hash', (req, res) => {
  const { hash } = req.params;
  const relPath = req.query.file;
  if (!relPath) return res.status(400).json({ error: 'Query param "file" is required' });

  const meta = torrentManager.torrentsMap.get(hash);
  if (!meta) return res.status(404).json({ error: 'Torrent not found' });

  // Prevent downloading incomplete 0% pre-allocated sparse files
  const activeTorrent = torrentManager.getActiveTorrent(hash);
  const isComplete = meta.status === 'completed' || (activeTorrent && activeTorrent.done);
  if (!isComplete) {
    const pct = Math.round((meta.progress || 0) * 100);
    return res.status(409).json({
      error: `Download is still in progress (${pct}% completed). Please wait until it reaches 100% to save the complete file, or use 'Stream' to watch live!`
    });
  }

  const targetFile = resolveFilePath(DOWNLOADS_DIR, meta, relPath);
  if (!targetFile || !fs.existsSync(targetFile)) {
    return res.status(404).json({ error: 'File not found on disk' });
  }

  handleDirectDownload(req, res, targetFile, path.basename(targetFile));
});

// Download entire Torrent/Folder as ZIP (On-the-fly streaming)
app.get('/api/download-zip/:hash', (req, res) => {
  const { hash } = req.params;
  const meta = torrentManager.torrentsMap.get(hash);

  if (!meta) return res.status(404).json({ error: 'Torrent not found' });

  const torrentDir = path.join(DOWNLOADS_DIR, meta.name || hash);

  if (!fs.existsSync(torrentDir)) {
    return res.status(400).json({ error: 'Download has not finished or folder does not exist yet' });
  }

  handleZipFolder(res, torrentDir, `${meta.name || 'torrent'}.zip`);
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
