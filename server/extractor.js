import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import AdmZip from 'adm-zip';
import { createExtractorFromFile } from 'node-unrar-js';

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
 * For example:
 * - `.part1.rar` or `.part01.rar` -> true
 * - `.part2.rar` or `.part02.rar` -> false (secondary)
 * - `.r00` or `.r01` -> false (secondary to .rar)
 * - standalone `.rar`, `.zip`, `.tar.gz` -> true
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

  // Standard archives
  return !!isArchive(filename);
}

/**
 * Extracts a ZIP archive
 */
async function extractZip(archivePath, targetDir) {
  try {
    const zip = new AdmZip(archivePath);
    zip.extractAllTo(targetDir, true);
    return { success: true, method: 'adm-zip' };
  } catch (err) {
    // Fallback to bsdtar
    return extractWithTar(archivePath, targetDir);
  }
}

/**
 * Extracts a RAR archive using node-unrar-js with tar fallback
 */
async function extractRar(archivePath, targetDir) {
  try {
    const extractor = await createExtractorFromFile({
      filepath: archivePath,
      targetPath: targetDir
    });
    
    const { files } = extractor.extract();
    let extractedCount = 0;
    // Iterate generator to perform disk writes
    for (const file of files) {
      if (file && file.fileHeader) {
        extractedCount++;
      }
    }
    return { success: true, method: 'node-unrar-js', filesCount: extractedCount };
  } catch (err) {
    console.warn(`[Extractor] node-unrar-js error for ${archivePath}, trying tar fallback:`, err.message);
    return extractWithTar(archivePath, targetDir);
  }
}

/**
 * Extracts using bsdtar (built-in Windows 10/11 & Linux/macOS)
 */
function extractWithTar(archivePath, targetDir) {
  return new Promise((resolve, reject) => {
    fs.mkdirSync(targetDir, { recursive: true });
    const proc = spawn('tar', ['-xf', archivePath, '-C', targetDir]);

    let stderr = '';
    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      if (code === 0) {
        resolve({ success: true, method: 'tar' });
      } else {
        reject(new Error(`Extraction failed with exit code ${code}: ${stderr || 'Unknown error'}`));
      }
    });

    proc.on('error', (err) => {
      reject(err);
    });
  });
}

/**
 * Extracts any supported archive into a destination directory
 */
export async function extractArchive(archivePath, targetDir) {
  if (!fs.existsSync(archivePath)) {
    throw new Error(`File does not exist: ${archivePath}`);
  }

  fs.mkdirSync(targetDir, { recursive: true });
  const lower = archivePath.toLowerCase();

  if (lower.endsWith('.zip')) {
    return await extractZip(archivePath, targetDir);
  }

  if (lower.endsWith('.rar') || /\.part\d+\.rar$/i.test(lower)) {
    return await extractRar(archivePath, targetDir);
  }

  // For tar, tar.gz, tgz, 7z, bz2, xz, etc.
  return await extractWithTar(archivePath, targetDir);
}

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
    // Create an extracted subfolder matching the archive's name without extension
    const cleanName = baseName.replace(/\.(part\d+\.rar|tar\.[a-z0-9]+|[a-z0-9]+)$/i, '');
    const outDir = path.join(dirName, `${cleanName}_extracted`);

    if (onProgress) {
      onProgress({ status: 'extracting', file: baseName, outDir });
    }

    try {
      console.log(`[Extractor] Extracting ${baseName} -> ${outDir}...`);
      await extractArchive(archiveFile, outDir);
      extractedArchives.push({
        archive: baseName,
        archivePath: archiveFile,
        extractedTo: outDir
      });
      console.log(`[Extractor] Successfully extracted ${baseName}!`);
    } catch (err) {
      console.error(`[Extractor] Failed to extract ${baseName}:`, err.message);
      errors.push({ archive: baseName, error: err.message });
    }
  }

  return {
    extractedCount: extractedArchives.length,
    extractedArchives,
    errors
  };
}

