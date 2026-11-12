import { parentPort, workerData } from 'node:worker_threads';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import AdmZip from 'adm-zip';
import { createExtractorFromFile } from 'node-unrar-js';

const { archivePath, destDir } = workerData;

function sanitizePath(baseDir, targetPath) {
  const resolved = path.resolve(baseDir, targetPath);
  if (!resolved.startsWith(path.resolve(baseDir))) {
    throw new Error(`Path traversal attempt detected: ${targetPath}`);
  }
  return resolved;
}

async function runWorkerExtraction() {
  try {
    fs.mkdirSync(destDir, { recursive: true });
    parentPort.postMessage({ status: 'extracting', log: `Starting extraction for ${path.basename(archivePath)}` });

    const lower = archivePath.toLowerCase();

    // 1. Try 7z CLI if available (best for universal, streaming, low-RAM multi-part RAR/7Z/ZIP)
    const has7z = await checkCommandAvailable('7z');
    if (has7z) {
      parentPort.postMessage({ status: 'extracting', log: `Using native 7z streaming extractor...` });
      await extractWithSpawn('7z', ['x', archivePath, `-o${destDir}`, '-y']);
      return finalizeExtraction();
    }

    // 2. Try bsdtar (built-in on Windows 10/11 & Linux/macOS) for zip, tar, 7z, iso, etc.
    if (!lower.endsWith('.rar') && !/\.part\d+\.rar$/i.test(lower)) {
      const hasTar = await checkCommandAvailable('tar');
      if (hasTar) {
        try {
          parentPort.postMessage({ status: 'extracting', log: `Using native streaming tar extractor...` });
          await extractWithSpawn('tar', ['-xf', archivePath, '-C', destDir]);
          return finalizeExtraction();
        } catch (tarErr) {
          parentPort.postMessage({ status: 'extracting', log: `tar fallback triggered: ${tarErr.message}` });
        }
      }
    }

    // 3. RAR extractor via node-unrar-js inside this background worker thread
    if (lower.endsWith('.rar') || /\.part\d+\.rar$/i.test(lower)) {
      parentPort.postMessage({ status: 'extracting', log: `Extracting RAR archive in worker thread...` });
      const extractor = await createExtractorFromFile({
        filepath: archivePath,
        targetPath: destDir
      });

      const { files } = extractor.extract();
      let count = 0;
      for (const file of files) {
        if (file && file.fileHeader) {
          count++;
          if (count % 25 === 0) {
            parentPort.postMessage({ status: 'extracting', log: `Extracted ${count} files...` });
          }
        }
      }
      return finalizeExtraction();
    }

    // 4. ZIP fallback via AdmZip in this background worker thread
    if (lower.endsWith('.zip')) {
      parentPort.postMessage({ status: 'extracting', log: `Extracting ZIP in worker thread...` });
      const zip = new AdmZip(archivePath);
      // Zip Slip prevention
      const entries = zip.getEntries();
      for (const entry of entries) {
        sanitizePath(destDir, entry.entryName);
      }
      zip.extractAllTo(destDir, true);
      return finalizeExtraction();
    }

    // Default fallback to tar
    await extractWithSpawn('tar', ['-xf', archivePath, '-C', destDir]);
    return finalizeExtraction();

  } catch (err) {
    parentPort.postMessage({ status: 'error', error: err.message });
  }
}

function checkCommandAvailable(cmd) {
  return new Promise((resolve) => {
    const proc = spawn(cmd, ['--help']);
    proc.on('error', () => resolve(false));
    proc.on('close', (code) => resolve(code === 0 || code === 1 || code === 7));
  });
}

function extractWithSpawn(cmd, args) {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args);
    let stderr = '';

    proc.stdout.on('data', (data) => {
      parentPort.postMessage({ status: 'extracting', log: data.toString() });
    });

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${cmd} exited with code ${code}: ${stderr}`));
    });

    proc.on('error', reject);
  });
}

function finalizeExtraction() {
  // Scan destDir and verify Zip Slip safety
  const verified = [];
  function scan(dir) {
    const list = fs.readdirSync(dir, { withFileTypes: true });
    for (const item of list) {
      const full = path.join(dir, item.name);
      sanitizePath(destDir, full);
      if (item.isDirectory()) {
        scan(full);
      } else {
        verified.push(path.relative(destDir, full).replace(/\\/g, '/'));
      }
    }
  }

  scan(destDir);
  parentPort.postMessage({
    status: 'done',
    extractedFiles: verified,
    count: verified.length
  });
}

runWorkerExtraction();
