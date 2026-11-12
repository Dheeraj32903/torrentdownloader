import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
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
    const relPath = path.relative(baseDir, fullPath).replace(/\\/g, '/');

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
        entryStat = fs.statSync(fullPath);
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
 * Streams an entire folder or torrent as a ZIP archive on-the-fly
 */
export function handleZipFolder(res, folderPath, zipFilename) {
  if (!fs.existsSync(folderPath)) {
    return res.status(404).json({ error: 'Directory not found' });
  }

  const archive = archiver('zip', {
    zlib: { level: 1 } // Fast compression for high transfer speed
  });

  const safeFilename = encodeURIComponent(zipFilename).replace(/['()]/g, escape).replace(/\*/g, '%2A');

  res.writeHead(200, {
    'Content-Type': 'application/zip',
    'Content-Disposition': `attachment; filename="${zipFilename}"; filename*=UTF-8''${safeFilename}`
  });

  archive.on('error', (err) => {
    console.error('[Archiver] Error creating zip stream:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Archive generation failed' });
    }
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
 * Gets disk usage stats
 */
export function getDiskStats(downloadDir) {
  let diskFree = 0;
  let diskTotal = 0;

  try {
    const stat = fs.statfsSync(downloadDir || '.');
    diskFree = stat.bavail * stat.bsize;
    diskTotal = stat.blocks * stat.bsize;
  } catch {}

  let usedInDownloads = 0;
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
            usedInDownloads += fs.statSync(full).size;
          } catch {}
        }
      }
    } catch {}
  }

  if (fs.existsSync(downloadDir)) {
    calculateDirSize(downloadDir);
  }

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
 * Resolves the absolute path of a file inside the downloads directory
 * whether the torrent is a single-file or multi-file directory.
 */
export function resolveFilePath(downloadDir, meta, relPath) {
  if (!meta) return null;
  const cleanRel = (relPath || '').replace(/^[\\\/]+/, '');

  // 1. Direct file in downloads: downloads/<cleanRel>
  const directPath = path.join(downloadDir, cleanRel);
  if (fs.existsSync(directPath) && !fs.statSync(directPath).isDirectory()) {
    return directPath;
  }

  // 2. Direct file in downloads by meta.name: downloads/<meta.name>
  if (meta.name) {
    const directMeta = path.join(downloadDir, meta.name);
    if (fs.existsSync(directMeta) && !fs.statSync(directMeta).isDirectory()) {
      return directMeta;
    }
  }

  // 3. Multi-file torrent folder: downloads/<meta.name>/<cleanRel>
  if (meta.name) {
    const inMetaDir = path.resolve(path.join(downloadDir, meta.name), cleanRel);
    if (fs.existsSync(inMetaDir)) {
      return inMetaDir;
    }
  }

  // 4. By hash folder: downloads/<meta.infoHash>/<cleanRel>
  if (meta.infoHash) {
    const inHashDir = path.resolve(path.join(downloadDir, meta.infoHash), cleanRel);
    if (fs.existsSync(inHashDir)) {
      return inHashDir;
    }
  }

  // Default fallback: if meta is a directory, resolve inside it; else return direct
  const dirPath = path.join(downloadDir, meta.name || meta.infoHash);
  if (fs.existsSync(dirPath) && fs.statSync(dirPath).isDirectory()) {
    return path.resolve(dirPath, cleanRel);
  }

  return directPath;
}

