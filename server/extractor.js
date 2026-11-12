import fs from 'node:fs';
import path from 'node:path';
import { Worker } from 'node:worker_threads';

const ARCHIVE_EXTENSIONS = [
  '.zip',
  '.rar',
  '.7z',
  '.tar',
  '.tar.gz',
  '.tgz',
  '.tar.bz2',
  '.tbz2',
  '.tar.xz',
  '.txz',
  '.gz',
  '.bz2',
  '.xz',
  '.iso'
];

/**
 * Checks if a filename has an archive extension
 */
export function isArchive(filename) {
  if (!filename) return false;
  const lower = filename.toLowerCase();
  for (const ext of ARCHIVE_EXTENSIONS) {
    if (lower.endsWith(ext)) return ext;
  }
  // Check for split RAR extensions (.r00, .r01, etc.)
  if (/\.r\d{2}$/i.test(lower)) return '.rar';
  return false;
}

/**
 * Determines whether this file is the primary file of an archive set.
 */
export function isPrimaryArchive(filename) {
  const lower = filename.toLowerCase();
  
  // If it's a split part like .part02.rar or .part2.rar
  const partMatch = lower.match(/\.part(\d+)\.rar$/i);
  if (partMatch) {
    const partNum = parseInt(partMatch[1], 10);
    return partNum === 1; // Only part 1 is the entry point
  }

  // If it's old split rar style (.r00, .r01...)
  if (/\.r\d{2}$/i.test(lower)) {
    return false;
  }

  // If it's split zip (.z01, .z02...)
  if (/\.z\d{2}$/i.test(lower)) {
    return false;
  }

  return !!isArchive(filename);
}

/**
 * Offloads archive extraction to a background Worker Thread.
 * The Node.js main event loop never freezes, and WebSockets/HTTP remain 100% responsive!
 */
export function extractArchiveAsync(archivePath, destDir, onProgress) {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(archivePath)) {
      return reject(new Error(`Archive file does not exist: ${archivePath}`));
    }

    const workerUrl = new URL('./extractorWorker.js', import.meta.url);
    const worker = new Worker(workerUrl, {
      workerData: { archivePath, destDir }
    });

    worker.on('message', (msg) => {
      if (msg.status === 'extracting' && onProgress) {
        onProgress(msg.log);
      }
      if (msg.status === 'done') {
        resolve(msg);
      }
      if (msg.status === 'error') {
        reject(new Error(`Extraction failed: ${msg.error}`));
      }
    });

    worker.on('error', reject);
    worker.on('exit', (code) => {
      if (code !== 0) {
        // worker stopped
      }
    });
  });
}

export const extractArchive = extractArchiveAsync;

/**
 * Recursively scans a directory for files
 */
export function getAllFiles(dirPath, arrayOfFiles = []) {
  if (!fs.existsSync(dirPath)) return arrayOfFiles;
  
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      getAllFiles(fullPath, arrayOfFiles);
    } else {
      arrayOfFiles.push(fullPath);
    }
  }
  return arrayOfFiles;
}

/**
 * Automatically scans a downloaded torrent folder and extracts all primary archives
 * using Worker Threads.
 */
export async function autoExtractTorrent(torrentPath, onProgress) {
  if (!fs.existsSync(torrentPath)) {
    return { extractedCount: 0, extractedArchives: [], errors: [] };
  }

  const allFiles = fs.statSync(torrentPath).isDirectory()
    ? getAllFiles(torrentPath)
    : [torrentPath];

  // Find candidate archives
  const primaryArchives = allFiles.filter(f => isPrimaryArchive(path.basename(f)));
  
  if (primaryArchives.length === 0) {
    return { extractedCount: 0, extractedArchives: [], errors: [] };
  }

  const extractedArchives = [];
  const errors = [];

  for (const archiveFile of primaryArchives) {
    const dirName = path.dirname(archiveFile);
    const baseName = path.basename(archiveFile);
    const cleanName = baseName.replace(/\.(part\d+\.rar|tar\.[a-z0-9]+|[a-z0-9]+)$/i, '');
    const outDir = path.join(dirName, `${cleanName}_extracted`);

    if (onProgress) {
      onProgress({ status: 'extracting', file: baseName, outDir });
    }

    try {
      console.log(`[ExtractorWorker] Offloading ${baseName} to Worker Thread -> ${outDir}...`);
      const result = await extractArchiveAsync(archiveFile, outDir, (log) => {
        if (onProgress) onProgress({ status: 'extracting', file: baseName, log });
      });

      extractedArchives.push({
        archive: baseName,
        archivePath: archiveFile,
        extractedTo: outDir,
        count: result.count || 0
      });
      console.log(`[ExtractorWorker] Extraction finished for ${baseName}!`);
    } catch (err) {
      console.error(`[ExtractorWorker] Extraction failed for ${baseName}:`, err.message);
      errors.push({ archive: baseName, error: err.message });
    }
  }

  return {
    extractedCount: extractedArchives.length,
    extractedArchives,
    errors
  };
}
