import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { isArchive, isPrimaryArchive } from './extractor.js';

const require = createRequire(import.meta.url);
const archiver = require('archiver');
const mime = require('mime-types');

export function formatBytes(bytes, decimals = 2) {
  if (!+bytes) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

/**
 * Strict Path Traversal / Zip Slip sanitization
 */
export function sanitizePath(baseDir, relativePath) {
  const safeBase = path.resolve(baseDir);
  const cleanRel = (relativePath || '').replace(/^[\\\/]+/, '');
  const resolved = path.resolve(safeBase, cleanRel);
  if (!resolved.startsWith(safeBase)) {
    throw new Error(`Security Violation: Path traversal detected for path "${relativePath}"`);
  }
  return resolved;
}

export function getFileCategory(filename) {
  const ext = path.extname(filename).toLowerCase();
  
  const videoExts = ['.mp4', '.mkv', '.webm', '.avi', '.mov', '.wmv', '.flv', '.m4v', '.ts'];
  const audioExts = ['.mp3', '.flac', '.wav', '.aac', '.ogg', '.m4a', '.wma', '.opus'];
  const imageExts = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.svg', '.bmp'];
  const docExts = ['.pdf', '.epub', '.mobi', '.txt', '.doc', '.docx', '.xls', '.xlsx'];
  const codeExts = ['.js', '.json', '.html', '.css', '.py', '.cpp', '.c', '.java', '.xml', '.yml', '.yaml', '.sh', '.bat', '.ps1', '.nfo', '.md'];

  if (videoExts.includes(ext)) return 'video';
  if (audioExts.includes(ext)) return 'audio';
  if (imageExts.includes(ext)) return 'image';
  if (isArchive(filename)) return 'archive';
  if (docExts.includes(ext)) return 'document';
  if (codeExts.includes(ext)) return 'code';
  return 'file';
}

/**
 * Returns structured file tree / list inside a directory or for a single file
 */
export function listDirectoryContents(dirPath, baseDir = dirPath) {
  if (!fs.existsSync(dirPath)) return [];

  let stat;
  try {
    stat = fs.statSync(dirPath);
  } catch {
    return [];
  }

  // Handle single-file torrents (where dirPath is a file, not a directory)
  if (!stat.isDirectory()) {
    const filename = path.basename(dirPath);
    const category = getFileCategory(filename);
    const relPath = path.relative(baseDir, dirPath).replace(/\\/g, '/') || filename;
    return [{
      name: filename,
      path: relPath,
      isDirectory: false,
      size: stat.size,
      sizeFormatted: formatBytes(stat.size),
      category,
      mime: mime.lookup(filename) || 'application/octet-stream',
      isArchive: !!isArchive(filename),
      isPrimaryArchive: isPrimaryArchive(filename),
      isStreamable: category === 'video' || category === 'audio'
    }];
  }

  const results = [];
  let entries = [];
  try {
    entries = fs.readdirSync(dirPath, { withFileTypes: true });
  } catch {
    return [];
  }

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    const safePath = sanitizePath(baseDir, path.relative(baseDir, fullPath));
    const relPath = path.relative(baseDir, safePath).replace(/\\/g, '/');

    if (entry.isDirectory()) {
      results.push({
        name: entry.name,
        path: relPath,
        isDirectory: true,
        children: listDirectoryContents(fullPath, baseDir)
      });
    } else {
      let entryStat;
      try {
        entryStat = fs.statSync(safePath);
      } catch {
        continue;
      }

      const category = getFileCategory(entry.name);
      const isArch = !!isArchive(entry.name);

      results.push({
        name: entry.name,
        path: relPath,
        isDirectory: false,
        size: entryStat.size,
        sizeFormatted: formatBytes(entryStat.size),
        category,
        mime: mime.lookup(entry.name) || 'application/octet-stream',
        isArchive: isArch,
        isPrimaryArchive: isPrimaryArchive(entry.name),
        isStreamable: category === 'video' || category === 'audio'
      });
    }
  }

  return results;
}

/**
 * Streams direct file download with resume (range) support
 */
export function handleDirectDownload(req, res, filePath, downloadName) {
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'File not found' });
  }

  const stat = fs.statSync(filePath);
  const fileSize = stat.size;
  const range = req.headers.range;
  const fileName = downloadName || path.basename(filePath);
  const safeFilename = encodeURIComponent(fileName).replace(/['()]/g, escape).replace(/\*/g, '%2A');

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
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${fileName}"; filename*=UTF-8''${safeFilename}`
    });

    fileStream.pipe(res);
  } else {
    res.writeHead(200, {
      'Content-Length': fileSize,
      'Accept-Ranges': 'bytes',
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${fileName}"; filename*=UTF-8''${safeFilename}`
    });

    fs.createReadStream(filePath).pipe(res);
  }
}

/**
 * Zero-Buffer Streaming Folder-to-ZIP:
 * Uses { store: true } (level 0 compression) so media folders stream at raw gigabit disk/network
 * speeds without wasting CPU compressing already-compressed video/audio files!
 * Handles client disconnects cleanly with archive.abort().
 */
export function streamFolderAsZip(folderPath, folderName, res) {
  if (!fs.existsSync(folderPath)) {
    return res.status(404).json({ error: 'Folder not found on disk' });
  }

  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(folderName)}.zip"`);

  // Use store: true (level 0) for instant streaming without CPU bottlenecks
  const archive = archiver('zip', { store: true });

  archive.on('error', (err) => {
    console.error('[Archiver] Error creating zip stream:', err.message);
    if (!res.headersSent) res.status(500).json({ error: 'Archive generation failed' });
    else res.destroy(err);
  });

  // Stop reading disk immediately if user cancels download
  res.on('close', () => {
    try {
      archive.abort();
    } catch {}
  });

  archive.pipe(res);

  const targetStat = fs.statSync(folderPath);
  if (targetStat.isDirectory()) {
    archive.directory(folderPath, false);
  } else {
    archive.file(folderPath, { name: path.basename(folderPath) });
  }

  archive.finalize();
}

/**
 * Generates Aria2 control / batch input file (.txt)
 */
export function generateAria2InputFile(hostUrl, infoHash, files) {
  let content = '# Aria2 Batch Download File generated by MagnetX\n\n';
  for (const f of files) {
    const downloadUrl = `${hostUrl}/api/download/${infoHash}?file=${encodeURIComponent(f.path)}`;
    content += `${downloadUrl}\n`;
    content += `  out=${f.name || path.basename(f.path)}\n`;
    content += `  split=16\n`;
    content += `  max-connection-per-server=16\n`;
    content += `  continue=true\n\n`;
  }
  return content;
}

let cachedUsedInDownloads = 0;
let lastUsedCheckTime = 0;

/**
 * Gets disk usage stats and checks quota with a 10s non-blocking cache
 */
export function getDiskStats(downloadDir) {
  let diskFree = 0;
  let diskTotal = 0;

  try {
    const stat = fs.statfsSync(downloadDir || '.');
    diskFree = stat.bavail * stat.bsize;
    diskTotal = stat.blocks * stat.bsize;
  } catch {}

  const now = Date.now();
  if (now - lastUsedCheckTime > 10000) {
    let used = 0;
    function calculateDirSize(dir) {
      if (!fs.existsSync(dir)) return;
      try {
        const list = fs.readdirSync(dir, { withFileTypes: true });
        for (const item of list) {
          const full = path.join(dir, item.name);
          if (item.isDirectory()) {
            calculateDirSize(full);
          } else {
            try {
              used += fs.statSync(full).size;
            } catch {}
          }
        }
      } catch {}
    }

    if (fs.existsSync(downloadDir)) {
      calculateDirSize(downloadDir);
    }
    cachedUsedInDownloads = used;
    lastUsedCheckTime = now;
  }

  const usedInDownloads = cachedUsedInDownloads;

  return {
    diskFree,
    diskFreeFormatted: formatBytes(diskFree),
    diskTotal,
    diskTotalFormatted: formatBytes(diskTotal),
    usedInDownloads,
    usedInDownloadsFormatted: formatBytes(usedInDownloads),
    percentUsed: diskTotal > 0 ? Math.round(((diskTotal - diskFree) / diskTotal) * 100) : 0
  };
}

/**
 * Checks if sufficient disk space is available before downloading/extracting
 */
export function hasSufficientDiskSpace(downloadDir, requiredBytes, minBufferBytes = 500 * 1024 * 1024) {
  try {
    const stat = fs.statfsSync(downloadDir || '.');
    const free = stat.bavail * stat.bsize;
    return free > (requiredBytes + minBufferBytes);
  } catch {
    return true; // if statfs fails, proceed
  }
}

/**
 * Resolves the absolute path of a file inside the downloads directory
 * with path traversal sanitization.
 */
export function resolveFilePath(downloadDir, meta, relPath) {
  if (!meta) return null;
  const cleanRel = (relPath || '').replace(/^[\\\/]+/, '');

  // 1. Direct file in downloads: downloads/<cleanRel>
  try {
    const directPath = sanitizePath(downloadDir, cleanRel);
    if (fs.existsSync(directPath) && !fs.statSync(directPath).isDirectory()) {
      return directPath;
    }
  } catch {}

  // 2. Direct file in downloads by meta.name: downloads/<meta.name>
  if (meta.name) {
    try {
      const directMeta = sanitizePath(downloadDir, meta.name);
      if (fs.existsSync(directMeta) && !fs.statSync(directMeta).isDirectory()) {
        return directMeta;
      }
    } catch {}
  }

  // 3. Multi-file torrent folder: downloads/<meta.name>/<cleanRel>
  if (meta.name) {
    try {
      const inMetaDir = sanitizePath(path.join(downloadDir, meta.name), cleanRel);
      if (fs.existsSync(inMetaDir)) {
        return inMetaDir;
      }
    } catch {}
  }

  // 4. By hash folder: downloads/<meta.infoHash>/<cleanRel>
  if (meta.infoHash) {
    try {
      const inHashDir = sanitizePath(path.join(downloadDir, meta.infoHash), cleanRel);
      if (fs.existsSync(inHashDir)) {
        return inHashDir;
      }
    } catch {}
  }

  // Default fallback
  const dirPath = path.join(downloadDir, meta.name || meta.infoHash);
  if (fs.existsSync(dirPath) && fs.statSync(dirPath).isDirectory()) {
    return sanitizePath(dirPath, cleanRel);
  }

  return sanitizePath(downloadDir, cleanRel);
}

/**
 * Automatically cleans up oldest completed torrents when storage exceeds MAX_STORAGE_GB (LRU eviction)
 */
export async function enforceStorageQuota(downloadDir, torrentManager) {
  const MAX_STORAGE_GB = Number(process.env.MAX_STORAGE_GB) || 15;
  const maxBytes = MAX_STORAGE_GB * 1024 * 1024 * 1024;

  try {
    const stats = getDiskStats(downloadDir);
    let usedBytes = stats.usedInDownloads || 0;

    if (usedBytes <= maxBytes) return;

    console.log(`[Storage] Used storage (${formatBytes(usedBytes)}) exceeds quota (${MAX_STORAGE_GB} GB). Enforcing LRU cleanup...`);

    if (!torrentManager || !torrentManager.torrentsMap) return;

    const completed = Array.from(torrentManager.torrentsMap.values())
      .filter(t => t.status === 'completed' || t.status === 'ready' || t.progress >= 1)
      .sort((a, b) => new Date(a.dateAdded || 0) - new Date(b.dateAdded || 0));

    for (const t of completed) {
      if (usedBytes <= maxBytes) break;
      console.log(`[Storage] Evicting oldest completed torrent: ${t.name} (${t.infoHash})`);
      await torrentManager.deleteTorrent(t.infoHash, true);
      const updated = getDiskStats(downloadDir);
      usedBytes = updated.usedInDownloads || 0;
    }
  } catch (err) {
    console.warn('[Storage] Quota enforcement error:', err.message);
  }
}
