import fs from 'fs';
import path from 'path';
import WebTorrent from 'webtorrent';
import { enhanceMagnet, parseMagnetQuick } from './trackers.js';
import { autoExtractTorrent } from './extractor.js';
import { formatBytes, listDirectoryContents, getFileCategory } from './fileManager.js';
import { isArchive } from './extractor.js';

export class TorrentManager {
  constructor(options = {}) {
    this.downloadDir = options.downloadDir || path.resolve('./downloads');
    this.stateFile = path.join(this.downloadDir, '.torrents_state.json');
    this.client = null;
    this.torrentsMap = new Map(); // infoHash -> metadata & status
    this.broadcastCallback = null;

    if (!fs.existsSync(this.downloadDir)) {
      fs.mkdirSync(this.downloadDir, { recursive: true });
    }

    this.initClient();
    this.loadState();
  }

  initClient() {
    this.client = new WebTorrent({
      maxConns: 200,
      dht: true,
      tracker: true,
      utp: false, // Use stable TCP to avoid Windows UTP_ECONNRESET native crashes
      webSeeds: true
    });

    this.client.on('error', (err) => {
      console.warn('[WebTorrent Engine Error]:', err.message);
    });
  }

  setBroadcastCallback(fn) {
    this.broadcastCallback = fn;
  }

  notifyUpdate() {
    if (this.broadcastCallback) {
      this.broadcastCallback(this.getAllTorrents());
    }
  }

  loadState() {
    if (fs.existsSync(this.stateFile)) {
      try {
        const raw = fs.readFileSync(this.stateFile, 'utf8');
        const saved = JSON.parse(raw);
        for (const item of saved) {
          const meta = {
            ...item,
            downloadSpeed: 0,
            uploadSpeed: 0,
            numPeers: 0
          };
          this.torrentsMap.set(item.infoHash, meta);

          // Re-add to active client so download and seeding resume immediately
          if (item.magnetURI) {
            try {
              const torrent = this.client.add(item.magnetURI, {
                path: this.downloadDir,
                destroyStoreOnDestroy: false
              });
              this.hookTorrentEvents(torrent, item.infoHash, meta);
            } catch (e) {
              console.warn('[TorrentManager] Could not resume torrent in client:', e.message);
            }
          }
        }
      } catch (err) {
        console.warn('[TorrentManager] Failed to read state file:', err.message);
      }
    }
  }

  saveState() {
    try {
      const items = Array.from(this.torrentsMap.values()).map(t => ({
        infoHash: t.infoHash,
        name: t.name,
        magnetURI: t.magnetURI,
        total: t.total,
        downloaded: t.downloaded,
        status: t.status,
        dateAdded: t.dateAdded,
        extracted: t.extracted || false,
        extractedFiles: t.extractedFiles || [],
        files: t.files || []
      }));
      fs.writeFileSync(this.stateFile, JSON.stringify(items, null, 2), 'utf8');
    } catch (err) {
      console.warn('[TorrentManager] Failed to save state:', err.message);
    }
  }

  /**
   * Adds a torrent via Magnet link or torrent file Buffer with instant optimistic response
   */
  async addTorrent(source, customName = null) {
    let torrentId = source;
    let magnetURI = null;
    let infoHash = null;
    let defaultName = customName;

    let parsedSize = 0;

    if (typeof source === 'string' && source.startsWith('magnet:')) {
      torrentId = enhanceMagnet(source);
      magnetURI = torrentId;
      const parsed = parseMagnetQuick(source);
      infoHash = parsed.infoHash;
      if (!defaultName) defaultName = parsed.name;
      parsedSize = parsed.size || 0;
    }

    // If already in map, update details and return immediately
    if (infoHash && this.torrentsMap.has(infoHash)) {
      const existing = this.torrentsMap.get(infoHash);
      if (defaultName && (!existing.name || existing.name.length < defaultName.length)) {
        existing.name = defaultName;
      }
      if (parsedSize > 0 && (!existing.total || existing.total === 0)) {
        existing.total = parsedSize;
      }
      if (parsedSize > 0 && (!existing.files || existing.files.length === 0)) {
        const cat = getFileCategory(existing.name);
        existing.files = [{
          name: existing.name,
          path: existing.name,
          displayName: existing.name,
          size: parsedSize,
          sizeFormatted: formatBytes(parsedSize),
          category: cat,
          isArchive: !!isArchive(existing.name),
          isStreamable: cat === 'video' || cat === 'audio',
          progress: 0
        }];
      }
      this.saveState();
      this.notifyUpdate();
      return existing;
    }

    // Check if already active in client
    if (infoHash) {
      const active = this.getActiveTorrent(infoHash);
      if (active) {
        if (!this.torrentsMap.has(infoHash)) {
          this.torrentsMap.set(infoHash, {
            infoHash,
            name: active.name || defaultName || 'Torrent',
            magnetURI,
            total: active.length || parsedSize || 0,
            downloaded: active.downloaded || 0,
            progress: active.progress || 0,
            status: active.done ? 'completed' : 'downloading',
            dateAdded: new Date().toISOString()
          });
          this.saveState();
        }
        return this.torrentsMap.get(infoHash);
      }
    }

    const tempHash = infoHash || ('id_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6));
    const isDirectFile = defaultName && /\.[a-z0-9]{2,5}$/i.test(defaultName);
    const initialFiles = [];
    if (isDirectFile && parsedSize > 0) {
      const cat = getFileCategory(defaultName);
      initialFiles.push({
        name: defaultName,
        path: defaultName,
        displayName: defaultName,
        size: parsedSize,
        sizeFormatted: formatBytes(parsedSize),
        category: cat,
        isArchive: !!isArchive(defaultName),
        isStreamable: cat === 'video' || cat === 'audio',
        progress: 0
      });
    }

    const initialMeta = {
      infoHash: tempHash,
      name: defaultName || 'Fetching metadata from peers...',
      magnetURI: magnetURI,
      total: parsedSize || 0,
      downloaded: 0,
      progress: 0,
      downloadSpeed: 0,
      uploadSpeed: 0,
      numPeers: 0,
      timeRemaining: 0,
      status: 'downloading',
      dateAdded: new Date().toISOString(),
      extracted: false,
      extractedFiles: [],
      files: initialFiles
    };

    this.torrentsMap.set(tempHash, initialMeta);
    this.saveState();
    this.notifyUpdate();

    const options = {
      path: this.downloadDir,
      destroyStoreOnDestroy: false
    };

    try {
      let torrent;
      try {
        torrent = this.client.add(torrentId, options);
      } catch (err) {
        if (err.message && err.message.includes('Cannot add duplicate torrent')) {
          const active = this.getActiveTorrent(infoHash);
          if (active) {
            initialMeta.name = active.name || initialMeta.name;
            initialMeta.total = active.length || initialMeta.total;
          }
          return initialMeta;
        }
        throw err;
      }

      this.hookTorrentEvents(torrent, tempHash, initialMeta);
      return initialMeta;
    } catch (err) {
      console.error(`[TorrentManager] Add torrent error:`, err.message);
      this.torrentsMap.delete(tempHash);
      this.saveState();
      this.notifyUpdate();
      throw err;
    }
  }

  hookTorrentEvents(torrent, tempHash, metaRef) {
    const updateTargetHash = (realHash) => {
      if (realHash && realHash !== tempHash && this.torrentsMap.has(tempHash)) {
        this.torrentsMap.delete(tempHash);
        metaRef.infoHash = realHash;
        this.torrentsMap.set(realHash, metaRef);
        this.saveState();
        this.notifyUpdate();
      }
    };

    torrent.on('infoHash', () => {
      if (torrent.infoHash) {
        updateTargetHash(torrent.infoHash);
      }
    });

    torrent.on('metadata', () => {
      console.log(`[TorrentManager] Metadata resolved: ${torrent.name} (${torrent.infoHash})`);
      const key = torrent.infoHash || tempHash;
      const meta = this.torrentsMap.get(key) || metaRef;
      meta.infoHash = torrent.infoHash || meta.infoHash;
      
      if (!meta.name || meta.name.includes('Fetching metadata')) {
        meta.name = torrent.name || meta.name;
      }
      meta.total = torrent.length || 0;

      if (torrent.files && torrent.files.length > 0) {
        meta.files = torrent.files.map(f => {
          const cat = getFileCategory(f.name);
          return {
            name: f.name,
            path: f.path.replace(/\\/g, '/'),
            displayName: f.name,
            size: f.length,
            sizeFormatted: formatBytes(f.length),
            category: cat,
            isArchive: !!isArchive(f.name),
            isStreamable: cat === 'video' || cat === 'audio',
            progress: f.progress
          };
        });
      }

      this.saveState();
      this.notifyUpdate();
    });

    torrent.on('wire', () => {
      const key = torrent.infoHash || tempHash;
      const meta = this.torrentsMap.get(key) || metaRef;
      if (meta) {
        meta.numPeers = torrent.numPeers;
        this.notifyUpdate();
      }
    });

    torrent.on('download', () => {
      const key = torrent.infoHash || tempHash;
      const meta = this.torrentsMap.get(key) || metaRef;
      if (meta) {
        meta.downloaded = torrent.downloaded;
        meta.progress = torrent.progress;
        meta.downloadSpeed = torrent.downloadSpeed;
        meta.uploadSpeed = torrent.uploadSpeed;
        meta.numPeers = torrent.numPeers;
        meta.timeRemaining = torrent.timeRemaining;
        meta.total = torrent.length;
        if (!meta.name || meta.name.includes('Fetching metadata')) {
          meta.name = torrent.name || meta.name;
        }
        if (torrent.done && meta.status === 'downloading') {
          meta.status = 'completed';
        }
      }
    });

    torrent.on('done', async () => {
      console.log(`[TorrentManager] Download COMPLETE: ${torrent.name}`);
      const key = torrent.infoHash || tempHash;
      const meta = this.torrentsMap.get(key) || metaRef;
      meta.status = 'completed';
      meta.progress = 1;
      meta.downloadSpeed = 0;
      this.saveState();
      this.notifyUpdate();

      // Trigger Auto-Extraction
      await this.triggerExtraction(torrent.infoHash || key, torrent.path, torrent.name);
    });

    torrent.on('error', (err) => {
      console.error(`[Torrent] Error on ${torrent.name || tempHash}:`, err.message);
      const key = torrent.infoHash || tempHash;
      const meta = this.torrentsMap.get(key) || metaRef;
      if (meta) {
        meta.errorMessage = err.message;
        this.notifyUpdate();
      }
    });
  }

  /**
   * Executes archive auto-extraction for a completed torrent
   */
  async triggerExtraction(infoHash, torrentPath, torrentName) {
    const meta = this.torrentsMap.get(infoHash);
    if (!meta) return;

    const targetDir = path.join(this.downloadDir, torrentName || meta.name);
    console.log(`[TorrentManager] Checking for archives to extract in: ${targetDir}`);
    
    meta.isExtracting = true;
    meta.status = 'extracting';
    this.notifyUpdate();

    try {
      const result = await autoExtractTorrent(targetDir, (progress) => {
        meta.extractStatusText = `Extracting ${progress.file}...`;
        this.notifyUpdate();
      });

      meta.isExtracting = false;
      meta.status = 'completed';
      meta.extracted = result.extractedCount > 0;
      meta.extractedFiles = result.extractedArchives;
      meta.extractionErrors = result.errors;
      delete meta.extractStatusText;

      console.log(`[TorrentManager] Extraction finished for ${meta.name}. Extracted ${result.extractedCount} archives.`);
      this.saveState();
      this.notifyUpdate();
      return result;
    } catch (err) {
      console.error(`[TorrentManager] Extraction failed:`, err);
      meta.isExtracting = false;
      meta.status = 'completed';
      meta.extractionErrors = [{ error: err.message }];
      this.notifyUpdate();
      throw err;
    }
  }

  /**
   * Synchronously finds an active torrent in the WebTorrent client by infoHash
   */
  getActiveTorrent(infoHash) {
    if (!this.client || !this.client.torrents || !infoHash) return null;
    const lower = infoHash.toLowerCase();
    return this.client.torrents.find(t => t.infoHash === infoHash || (t.infoHash && t.infoHash.toLowerCase() === lower)) || null;
  }

  /**
   * Prioritizes pieces of a specific file for streaming while downloading
   */
  prioritizeForStreaming(infoHash, filePath) {
    const torrent = this.getActiveTorrent(infoHash);
    if (!torrent || !torrent.files) return null;

    // Normalize path separators
    const normPath = filePath.replace(/\\/g, '/');
    const file = torrent.files.find(f => f.path.replace(/\\/g, '/') === normPath || f.name === path.basename(filePath));

    if (file) {
      // Select file pieces with highest priority
      file.select();
      console.log(`[TorrentManager] Prioritizing file pieces for streaming: ${file.name}`);
      return file;
    }
    return null;
  }

  /**
   * Deletes a torrent and optionally removes files
   */
  async deleteTorrent(infoHash, deleteFiles = false) {
    const meta = this.torrentsMap.get(infoHash);
    const activeTorrent = this.getActiveTorrent(infoHash);

    if (activeTorrent) {
      try {
        await this.client.remove(activeTorrent, { destroyStore: deleteFiles });
      } catch (err) {
        console.warn('[TorrentManager] Error removing torrent from client:', err.message);
      }
    }

    if (deleteFiles && meta) {
      const torrentPath = path.join(this.downloadDir, meta.name || infoHash);
      if (fs.existsSync(torrentPath)) {
        try {
          fs.rmSync(torrentPath, { recursive: true, force: true });
          console.log(`[TorrentManager] Deleted files at: ${torrentPath}`);
        } catch (err) {
          console.warn(`[TorrentManager] Error deleting files: ${err.message}`);
        }
      }
    }

    this.torrentsMap.delete(infoHash);
    this.saveState();
    this.notifyUpdate();
    return true;
  }

  /**
   * Returns list of all torrents with current real-time stats
   */
  getAllTorrents() {
    const results = [];
    for (const [hash, meta] of this.torrentsMap.entries()) {
      const activeTorrent = this.getActiveTorrent(hash);

      let progress = meta.progress || 0;
      let downloadSpeed = 0;
      let uploadSpeed = 0;
      let numPeers = 0;
      let timeRemaining = 0;
      let total = meta.total || 0;
      let downloaded = meta.downloaded || 0;
      let files = [];

      if (activeTorrent) {
        progress = activeTorrent.progress;
        downloadSpeed = activeTorrent.downloadSpeed;
        uploadSpeed = activeTorrent.uploadSpeed;
        numPeers = activeTorrent.numPeers;
        timeRemaining = activeTorrent.timeRemaining;
        total = activeTorrent.length;
        downloaded = activeTorrent.downloaded;
      }

      // Check if downloaded files or extracted files exist on disk
      const torrentFolder = path.join(this.downloadDir, meta.name || hash);
      let foundOnDisk = false;

      if (fs.existsSync(torrentFolder)) {
        const diskFiles = listDirectoryContents(torrentFolder, torrentFolder);
        if (diskFiles.length > 0) {
          foundOnDisk = true;
          const flat = [];
          const walk = (items, prefix = '') => {
            for (const it of items) {
              if (it.isDirectory) {
                if (it.children) walk(it.children, `${prefix}${it.name}/`);
              } else {
                flat.push({
                  name: it.name,
                  path: it.path.replace(/\\/g, '/'),
                  displayName: `${prefix}${it.name}`,
                  size: it.size,
                  sizeFormatted: it.sizeFormatted,
                  category: it.category,
                  isArchive: it.isArchive,
                  isStreamable: it.isStreamable
                });
              }
            }
          };
          walk(diskFiles);
          files = flat;
        }
      }

      // If not on disk yet or folder empty, populate from active torrent metadata
      if (!foundOnDisk && activeTorrent && activeTorrent.files && activeTorrent.files.length > 0) {
        files = activeTorrent.files.map(f => {
          const cat = getFileCategory(f.name);
          return {
            name: f.name,
            path: f.path.replace(/\\/g, '/'),
            displayName: f.name,
            size: f.length,
            sizeFormatted: formatBytes(f.length),
            category: cat,
            isArchive: !!isArchive(f.name),
            isStreamable: cat === 'video' || cat === 'audio',
            progress: f.progress
          };
        });
      }

      if (files.length === 0 && meta.files && meta.files.length > 0) {
        files = meta.files;
      }
      meta.files = files;

      results.push({
        ...meta,
        progress,
        downloadSpeed,
        uploadSpeed,
        downloadSpeedFormatted: `${formatBytes(downloadSpeed)}/s`,
        uploadSpeedFormatted: `${formatBytes(uploadSpeed)}/s`,
        numPeers,
        timeRemaining,
        timeRemainingFormatted: timeRemaining ? formatEta(timeRemaining) : 'Done',
        total,
        totalFormatted: formatBytes(total),
        downloaded,
        downloadedFormatted: formatBytes(downloaded),
        filesCount: files.length,
        files: files // Full list of extracted files
      });
    }

    // Sort newest first
    return results.sort((a, b) => new Date(b.dateAdded || 0) - new Date(a.dateAdded || 0));
  }
}

function formatEta(ms) {
  if (!ms || ms === Infinity || ms <= 0) return '0s';
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ${seconds % 60}s`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}

