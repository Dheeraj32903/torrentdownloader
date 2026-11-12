// MagnetX - Direct Torrent & Magnet File Extractor

const DEMO_MAGNETS = {
  bigbuck: 'magnet:?xt=urn:btih:dd8255ecdc7ca55fb0bbf81323d87062db1f6d1c&dn=Big+Buck+Bunny&tr=udp%3A%2F%2Fexplodie.org%3A6969&tr=udp%3A%2F%2Ftracker.coppersurfer.tk%3A6969&tr=udp%3A%2F%2Ftracker.empire-js.us%3A1337&tr=udp%3A%2F%2Ftracker.leechers-paradise.org%3A6969&tr=udp%3A%2F%2Ftracker.opentrackr.org%3A1337&tr=wss%3A%2F%2Ftracker.btorrent.xyz&tr=wss%3A%2F%2Ftracker.fastcast.nz&tr=wss%3A%2F%2Ftracker.openwebtorrent.com',
  ubuntu: 'magnet:?xt=urn:btih:3b1445018653f173658d76077596d21469493976&dn=ubuntu-24.04.1-desktop-amd64.iso&tr=https%3A%2F%2Ftorrent.ubuntu.com%2Fannounce',
  sintel: 'magnet:?xt=urn:btih:08ada5a7a6183aae1e09d831df6748d566095a10&dn=Sintel&tr=udp%3A%2F%2Fexplodie.org%3A6969&tr=udp%3A%2F%2Ftracker.coppersurfer.tk%3A6969&tr=udp%3A%2F%2Ftracker.empire-js.us%3A1337&tr=udp%3A%2F%2Ftracker.leechers-paradise.org%3A6969&tr=udp%3A%2F%2Ftracker.opentrackr.org%3A1337'
};

class MagnetXApp {
  constructor() {
    this.torrents = [];
    this.currentFilter = 'all';
    this.searchQuery = '';
    this.ws = null;
    this.openAccordions = new Set(); // Tracks open file lists so ticks don't collapse them

    this.initElements();
    this.initEvents();
    this.initWebSocket();
    this.initTheme();
  }

  initElements() {
    // Nav elements
    this.navDownSpeed = document.getElementById('nav-down-speed');
    this.navUpSpeed = document.getElementById('nav-up-speed');
    this.activeTransfersCount = document.getElementById('active-transfers-count');
    this.wsIndicator = document.getElementById('ws-indicator');
    this.themeBtn = document.getElementById('theme-btn');
    this.themeIcon = document.getElementById('theme-icon');

    // Input form
    this.magnetForm = document.getElementById('magnet-form');
    this.magnetInput = document.getElementById('magnet-input');
    this.btnPaste = document.getElementById('btn-paste');
    this.spinnerExtract = document.getElementById('spinner-extract');
    this.dropzone = document.getElementById('torrent-dropzone');
    this.fileTorrentPicker = document.getElementById('file-torrent-picker');

    // Section controls
    this.torrentsTotalBadge = document.getElementById('torrents-total-badge');
    this.torrentsContainer = document.getElementById('torrents-container');
    this.emptyStateBox = document.getElementById('empty-state');
    this.searchFilter = document.getElementById('search-filter');

    // Player modal
    this.modalPlayer = document.getElementById('modal-player');
    this.playerTitle = document.getElementById('player-title');
    this.playerVideo = document.getElementById('player-video');
    this.subtitlesDropdown = document.getElementById('subtitles-dropdown');
    this.playerRawStreamBtn = document.getElementById('player-raw-stream-btn');
    this.playerDirectDownloadBtn = document.getElementById('player-direct-download-btn');
    this.btnClosePlayer = document.getElementById('btn-close-player');

    // Toast stack
    this.toastStack = document.getElementById('toast-stack');
  }

  initEvents() {
    // Tab switching in hero card
    document.querySelectorAll('.tab-button').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-button').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        btn.classList.add('active');
        const tab = btn.getAttribute('data-tab');
        document.getElementById(`tab-${tab}`).classList.add('active');
      });
    });

    // Magnet submit
    this.magnetForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const magnet = this.magnetInput.value.trim();
      if (!magnet) return;

      this.spinnerExtract.classList.remove('hidden');
      try {
        const res = await fetch('/api/torrents/add-magnet', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ magnet })
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error);

        this.showToast(`Extracted link: ${data.torrent.name || 'Torrent'}`, 'success');
        this.openAccordions.add(data.torrent.infoHash); // auto-expand newly added
        this.magnetInput.value = '';
      } catch (err) {
        this.showToast(err.message, 'error');
      } finally {
        this.spinnerExtract.classList.add('hidden');
      }
    });

    // Paste from clipboard
    this.btnPaste.addEventListener('click', async () => {
      try {
        const text = await navigator.clipboard.readText();
        if (text && text.trim().startsWith('magnet:')) {
          this.magnetInput.value = text.trim();
          this.showToast('Pasted magnet from clipboard', 'info');
        } else {
          this.showToast('Clipboard does not contain a valid magnet link', 'error');
        }
      } catch {
        this.showToast('Please paste manually using Ctrl+V', 'info');
      }
    });

    // Dropzone upload
    this.dropzone.addEventListener('click', () => this.fileTorrentPicker.click());
    this.fileTorrentPicker.addEventListener('change', (e) => {
      if (e.target.files.length > 0) {
        this.uploadTorrent(e.target.files[0]);
      }
    });

    ['dragenter', 'dragover'].forEach(name => {
      this.dropzone.addEventListener(name, (e) => {
        e.preventDefault();
        this.dropzone.classList.add('dragover');
      });
    });

    ['dragleave', 'drop'].forEach(name => {
      this.dropzone.addEventListener(name, (e) => {
        e.preventDefault();
        this.dropzone.classList.remove('dragover');
      });
    });

    this.dropzone.addEventListener('drop', (e) => {
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        this.uploadTorrent(e.dataTransfer.files[0]);
      }
    });

    // Demo sample chips
    document.querySelectorAll('.sample-tag').forEach(tag => {
      tag.addEventListener('click', () => {
        const sampleKey = tag.getAttribute('data-sample');
        if (DEMO_MAGNETS[sampleKey]) {
          this.magnetInput.value = DEMO_MAGNETS[sampleKey];
          this.magnetForm.dispatchEvent(new Event('submit'));
        }
      });
    });

    // Status filter tabs
    document.querySelectorAll('.filter-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        this.currentFilter = tab.getAttribute('data-filter');
        this.renderTorrents();
      });
    });

    // Search filter
    this.searchFilter.addEventListener('input', (e) => {
      this.searchQuery = e.target.value.toLowerCase().trim();
      this.renderTorrents();
    });

    // Player modal close
    this.btnClosePlayer.addEventListener('click', () => this.closePlayerModal());
    this.modalPlayer.addEventListener('click', (e) => {
      if (e.target === this.modalPlayer) this.closePlayerModal();
    });

    // Theme toggle
    this.themeBtn.addEventListener('click', () => {
      const current = document.documentElement.getAttribute('data-theme') || 'dark';
      const next = current === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      localStorage.setItem('magnetx_theme', next);
      this.themeIcon.textContent = next === 'dark' ? '🌙' : '☀️';
    });

    // Subtitle selection change
    this.subtitlesDropdown.addEventListener('change', () => {
      const tracks = this.playerVideo.querySelectorAll('track');
      tracks.forEach(t => t.remove());

      const selected = this.subtitlesDropdown.value;
      if (selected !== 'none') {
        const track = document.createElement('track');
        track.kind = 'subtitles';
        track.label = this.subtitlesDropdown.options[this.subtitlesDropdown.selectedIndex].text;
        track.srclang = 'en';
        track.src = selected;
        track.default = true;
        this.playerVideo.appendChild(track);
        this.showToast(`Subtitles active: ${track.label}`, 'info');
      }
    });
  }

  initTheme() {
    const saved = localStorage.getItem('magnetx_theme') || 'dark';
    document.documentElement.setAttribute('data-theme', saved);
    this.themeIcon.textContent = saved === 'dark' ? '🌙' : '☀️';
  }

  initWebSocket() {
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${location.host}/ws`;

    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      this.wsIndicator.innerHTML = '<span class="status-glow"></span><span class="status-text">Connected</span>';
      this.wsIndicator.style.borderColor = 'rgba(16, 185, 129, 0.2)';
    };

    this.ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'init' || msg.type === 'tick') {
          if (msg.data.torrents) {
            this.torrents = msg.data.torrents;
            this.renderTorrents();
          }
          if (msg.data.speeds) {
            this.navDownSpeed.textContent = msg.data.speeds.downloadFormatted;
            this.navUpSpeed.textContent = msg.data.speeds.uploadFormatted;
          }
          let activeCount = 0;
          for (const t of this.torrents) {
            if (t.status === 'downloading' || t.status === 'extracting') activeCount++;
          }
          this.activeTransfersCount.textContent = `${activeCount} Active`;
        } else if (msg.type === 'torrents_update') {
          this.torrents = msg.data;
          this.renderTorrents();
        }
      } catch (err) {
        console.error('WS parse error:', err);
      }
    };

    this.ws.onclose = () => {
      this.wsIndicator.innerHTML = '<span class="status-glow" style="background:#ef4444;box-shadow:none;"></span><span class="status-text" style="color:#ef4444">Reconnecting...</span>';
      setTimeout(() => this.initWebSocket(), 2000);
    };

    this.ws.onerror = () => {
      this.ws.close();
    };
  }

  async uploadTorrent(file) {
    if (!file.name.endsWith('.torrent')) {
      this.showToast('Please select a valid .torrent file', 'error');
      return;
    }

    const formData = new FormData();
    formData.append('torrent', file);

    try {
      this.showToast(`Extracting ${file.name}...`, 'info');
      const res = await fetch('/api/torrents/upload-torrent', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      this.showToast(`Extracted: ${data.torrent.name}`, 'success');
      this.openAccordions.add(data.torrent.infoHash);
    } catch (err) {
      this.showToast(err.message, 'error');
    }
  }

  renderTorrents() {
    let filtered = this.torrents.filter(t => {
      if (this.currentFilter === 'downloading') return t.status === 'downloading' || t.status === 'extracting';
      if (this.currentFilter === 'completed') return t.status === 'completed';
      return true;
    });

    if (this.searchQuery) {
      filtered = filtered.filter(t => (t.name || '').toLowerCase().includes(this.searchQuery));
    }

    this.torrentsTotalBadge.textContent = `${filtered.length} item${filtered.length === 1 ? '' : 's'}`;

    if (filtered.length === 0) {
      this.torrentsContainer.innerHTML = '';
      this.emptyStateBox.classList.remove('hidden');
      return;
    }

    this.emptyStateBox.classList.add('hidden');

    const html = filtered.map(t => this.createTorrentBlockHTML(t)).join('');
    this.torrentsContainer.innerHTML = html;

    this.attachCardEventListeners();
  }

  createTorrentBlockHTML(t) {
    const pct = Math.round((t.progress || 0) * 100);
    const isExtracting = t.isExtracting || t.status === 'extracting';
    const isCompleted = t.status === 'completed';
    const isDownloading = t.status === 'downloading';
    const isOpen = this.openAccordions.has(t.infoHash) || isCompleted; // default open if ready or user opened

    let statusTag = '';
    if (isExtracting) {
      statusTag = `<span class="status-tag tag-extracting">📦 ${t.extractStatusText || 'Auto-Extracting RAR/ZIP...'}</span>`;
    } else if (isCompleted) {
      statusTag = `<span class="status-tag tag-ready">✓ Ready</span>`;
      if (t.extracted) {
        statusTag += ` <span class="status-tag tag-extracted">⚡ Auto-Unpacked</span>`;
      }
    } else {
      statusTag = `<span class="status-tag tag-downloading">⚡ Extracting (${pct}%)</span>`;
    }

    const files = t.files || [];
    const filesCount = files.length;

    // Files rows HTML
    let filesRows = '';
    if (files.length > 0) {
      filesRows = files.map(f => {
        const isVideo = f.category === 'video' || /\.(mp4|mkv|webm|avi|mov)$/i.test(f.name);
        const isAudio = f.category === 'audio' || /\.(mp3|flac|wav|aac|ogg)$/i.test(f.name);
        const isArch = f.isArchive;

        let icon = '📄';
        if (isVideo) icon = '🎬';
        else if (isAudio) icon = '🎵';
        else if (f.category === 'image') icon = '🖼️';
        else if (isArch) icon = '📦';
        else if (f.category === 'code') icon = '💻';

        const downloadUrl = `/api/download/${t.infoHash}?file=${encodeURIComponent(f.path)}`;
        const streamUrl = `/api/stream/${t.infoHash}?file=${encodeURIComponent(f.path)}`;

        return `
          <div class="file-row">
            <div class="file-col-name" title="${this.escapeHtml(f.displayName || f.name)}">
              <span>${icon}</span>
              <span class="name-text">${this.escapeHtml(f.displayName || f.name)}</span>
            </div>
            <div class="file-col-size">${f.sizeFormatted || '—'}</div>
            <div class="file-col-actions">
              ${(isVideo || isAudio) ? `
                <button class="btn-subtle btn-sm btn-stream-file" data-url="${streamUrl}" data-name="${this.escapeHtml(f.name)}" data-path="${this.escapeHtml(f.path)}" data-hash="${t.infoHash}" title="Stream video/audio directly in browser">
                  ▶ Stream
                </button>
              ` : ''}

              ${isArch ? `
                <button class="btn-subtle btn-sm btn-extract-single" data-hash="${t.infoHash}" data-path="${this.escapeHtml(f.path)}" title="Unpack this archive">
                  📦 Extract
                </button>
              ` : ''}

              ${isCompleted ? `
                <a href="${downloadUrl}" class="btn-subtle btn-sm" style="color:var(--green);font-weight:700;" title="Direct download to your computer">
                  ⬇️ Download
                </a>
                <button class="btn-subtle btn-sm btn-copy-direct-link" data-url="${location.origin}${downloadUrl}" title="Copy direct link for IDM/Download Manager">
                  📋 Link
                </button>
              ` : `
                <button class="btn-subtle btn-sm" style="opacity:0.6;cursor:help;" onclick="alert('Downloading pieces from peers: ${pct}% completed. Please wait until 100% or click Stream to watch now!')" title="Download unlocks at 100% (currently ${pct}%)">
                  ⏳ ${pct}%
                </button>
              `}
            </div>
          </div>
        `;
      }).join('');
    } else {
      filesRows = `<div style="padding:16px;text-align:center;color:var(--text-muted);font-size:13px;">Extracting file list from link...</div>`;
    }

    return `
      <div class="torrent-block" data-hash="${t.infoHash}">
        <div class="torrent-header-row">
          <div class="torrent-meta-left">
            <div class="meta-icon">
              ${isCompleted ? '📁' : '⚡'}
            </div>
            <div class="meta-titles">
              <div class="torrent-name" title="${this.escapeHtml(t.name || 'Fetching link...')}">
                ${this.escapeHtml(t.name || 'Fetching metadata from magnet link...')}
              </div>
              <div class="torrent-pill-row">
                ${statusTag}
                <span class="status-tag tag-info">💾 ${t.totalFormatted || '0 B'}</span>
                <span class="status-tag tag-info">📄 ${filesCount} file${filesCount === 1 ? '' : 's'}</span>
                ${isDownloading ? `<span class="status-tag tag-info">👥 ${t.numPeers || 0} peers</span>` : ''}
              </div>
            </div>
          </div>

          <div class="torrent-actions-right">
            ${isCompleted ? `
              <a href="/api/download-zip/${t.infoHash}" class="btn-subtle btn-sm" title="Download all files in one single ZIP">
                ⬇️ Download All (ZIP)
              </a>
              <button class="btn-subtle btn-sm btn-copy-all-links" data-hash="${t.infoHash}" title="Copy all file download links for IDM batch import">
                📋 Copy All Links
              </button>
              <button class="btn-subtle btn-sm btn-trigger-extract" data-hash="${t.infoHash}" title="Re-extract archives">
                🔄 Re-Extract
              </button>
            ` : `
              <button class="btn-primary btn-sm btn-stream-first" data-hash="${t.infoHash}">
                🎬 Stream Live
              </button>
            `}
            <button class="btn-subtle btn-sm btn-delete-torrent" data-hash="${t.infoHash}" style="color:var(--rose);" title="Remove torrent">
              🗑️
            </button>
          </div>
        </div>

        <div class="torrent-progress-bar">
          <div class="progress-track">
            <div class="progress-thumb" style="width: ${pct}%"></div>
          </div>
          <div class="progress-info-row">
            <span>${pct}% extracted (${t.downloadedFormatted || '0 B'} of ${t.totalFormatted || '0 B'})</span>
            <div class="progress-speeds">
              ${isDownloading ? `
                <span>↓ ${t.downloadSpeedFormatted}</span>
                <span>⏱️ ETA: ${t.timeRemainingFormatted}</span>
              ` : `
                <span>Status: ${isExtracting ? 'Extracting archives...' : 'Ready for download'}</span>
              `}
            </div>
          </div>
        </div>

        <!-- Files Accordion -->
        <div class="torrent-files-accordion">
          <div class="accordion-header ${isOpen ? 'open' : ''}" data-hash="${t.infoHash}">
            <span>📁 Extracted Contents (${filesCount} file${filesCount === 1 ? '' : 's'})</span>
            <span class="accordion-chevron">▾</span>
          </div>
          <div class="files-table ${isOpen ? '' : 'hidden'}" id="files-table-${t.infoHash}">
            <div class="files-table-header">
              <span>File Name</span>
              <span>Size</span>
              <span style="text-align:right;">Direct Actions</span>
            </div>
            ${filesRows}
          </div>
        </div>
      </div>
    `;
  }

  attachCardEventListeners() {
    // Accordion toggle
    document.querySelectorAll('.accordion-header').forEach(header => {
      header.addEventListener('click', () => {
        const hash = header.getAttribute('data-hash');
        const table = document.getElementById(`files-table-${hash}`);
        if (!table) return;

        if (table.classList.contains('hidden')) {
          table.classList.remove('hidden');
          header.classList.add('open');
          this.openAccordions.add(hash);
        } else {
          table.classList.add('hidden');
          header.classList.remove('open');
          this.openAccordions.delete(hash);
        }
      });
    });

    // Copy All Links (for IDM batch download)
    document.querySelectorAll('.btn-copy-all-links').forEach(btn => {
      btn.addEventListener('click', () => {
        const hash = btn.getAttribute('data-hash');
        const torrent = this.torrents.find(t => t.infoHash === hash);
        if (!torrent || !torrent.files || torrent.files.length === 0) {
          this.showToast('No files available to copy', 'error');
          return;
        }

        const links = torrent.files.map(f => `${location.origin}/api/download/${hash}?file=${encodeURIComponent(f.path)}`);
        navigator.clipboard.writeText(links.join('\n')).then(() => {
          this.showToast(`Copied ${links.length} direct links for IDM! Paste into IDM (Tasks -> Add batch download)`, 'success');
        });
      });
    });

    // Copy single file link
    document.querySelectorAll('.btn-copy-direct-link').forEach(btn => {
      btn.addEventListener('click', () => {
        const url = btn.getAttribute('data-url');
        navigator.clipboard.writeText(url).then(() => {
          this.showToast('Direct download link copied to clipboard!', 'success');
        });
      });
    });

    // Stream single file
    document.querySelectorAll('.btn-stream-file').forEach(btn => {
      btn.addEventListener('click', () => {
        const url = btn.getAttribute('data-url');
        const name = btn.getAttribute('data-name');
        const hash = btn.getAttribute('data-hash');
        const filePath = btn.getAttribute('data-path');
        this.openPlayerModal(url, name, hash, filePath);
      });
    });

    // Stream first streamable video in live torrent
    document.querySelectorAll('.btn-stream-first').forEach(btn => {
      btn.addEventListener('click', () => {
        const hash = btn.getAttribute('data-hash');
        const torrent = this.torrents.find(t => t.infoHash === hash);
        if (torrent && torrent.files) {
          const video = torrent.files.find(f => f.isStreamable || /\.(mp4|mkv|webm|mp3)$/i.test(f.name));
          if (video) {
            const streamUrl = `/api/stream/${hash}?file=${encodeURIComponent(video.path)}`;
            this.openPlayerModal(streamUrl, video.name, hash, video.path);
            return;
          }
        }
        this.showToast('Still resolving streamable video file...', 'info');
      });
    });

    // Re-extract archives button
    document.querySelectorAll('.btn-trigger-extract').forEach(btn => {
      btn.addEventListener('click', async () => {
        const hash = btn.getAttribute('data-hash');
        try {
          this.showToast('Unpacking archives in background...', 'info');
          const res = await fetch(`/api/torrents/${hash}/extract`, { method: 'POST' });
          const data = await res.json();
          if (data.error) throw new Error(data.error);
        } catch (err) {
          this.showToast(err.message, 'error');
        }
      });
    });

    // Extract single archive
    document.querySelectorAll('.btn-extract-single').forEach(btn => {
      btn.addEventListener('click', async () => {
        const hash = btn.getAttribute('data-hash');
        const relPath = btn.getAttribute('data-path');
        try {
          this.showToast('Extracting archive...', 'info');
          const res = await fetch('/api/extract-file', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ hash, relativePath: relPath })
          });
          const data = await res.json();
          if (data.error) throw new Error(data.error);
          this.showToast(data.message, 'success');
        } catch (err) {
          this.showToast(err.message, 'error');
        }
      });
    });

    // Delete torrent button
    document.querySelectorAll('.btn-delete-torrent').forEach(btn => {
      btn.addEventListener('click', async () => {
        const hash = btn.getAttribute('data-hash');
        const deleteDisk = confirm('Delete files from disk too? Click OK to permanently delete files, or Cancel to just remove from list.');

        try {
          const res = await fetch(`/api/torrents/${hash}?deleteFiles=${deleteDisk ? 'true' : 'false'}`, {
            method: 'DELETE'
          });
          const data = await res.json();
          if (data.error) throw new Error(data.error);
          this.showToast('Torrent removed', 'info');
        } catch (err) {
          this.showToast(err.message, 'error');
        }
      });
    });
  }

  async openPlayerModal(streamUrl, title, hash, filePath) {
    this.playerTitle.textContent = title;
    this.modalPlayer.classList.remove('hidden');

    this.playerVideo.src = streamUrl;
    this.playerVideo.load();
    this.playerVideo.play().catch(() => {});

    this.playerRawStreamBtn.href = streamUrl;
    this.playerDirectDownloadBtn.href = `/api/download/${hash}?file=${encodeURIComponent(filePath)}`;

    this.subtitlesDropdown.innerHTML = '<option value="none">Off</option>';
    
    // Check for subtitles
    try {
      const res = await fetch(`/api/video-subtitles/${hash}?file=${encodeURIComponent(filePath)}`);
      const data = await res.json();
      if (data.subtitles && data.subtitles.length > 0) {
        for (const sub of data.subtitles) {
          const opt = document.createElement('option');
          opt.value = `/api/subtitles/${hash}?file=${encodeURIComponent(sub.relativePath)}`;
          opt.textContent = sub.name;
          this.subtitlesDropdown.appendChild(opt);
        }
      }
    } catch (e) {
      console.warn('Subtitle fetch error:', e);
    }
  }

  closePlayerModal() {
    this.playerVideo.pause();
    this.playerVideo.src = '';
    const tracks = this.playerVideo.querySelectorAll('track');
    tracks.forEach(t => t.remove());
    this.modalPlayer.classList.add('hidden');
  }

  showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    let icon = 'ℹ️';
    if (type === 'success') icon = '✅';
    if (type === 'error') icon = '⚠️';

    toast.innerHTML = `<span>${icon}</span><span>${this.escapeHtml(message)}</span>`;
    this.toastStack.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(20px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 4500);
  }

  escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>"']/g, (m) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[m]));
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.magnetXApp = new MagnetXApp();
});
