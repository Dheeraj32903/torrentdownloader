// MagnetX - Direct Torrent & Magnet File Extractor
// Advanced Cloud Download Engine with Targeted DOM Diffing, Sparklines & Media Player

const DEMO_MAGNETS = {
  bigbuck: 'magnet:?xt=urn:btih:dd8255ecdc7ca55fb0bbf81323d87062db1f6d1c&dn=Big+Buck+Bunny&tr=udp%3A%2F%2Fexplodie.org%3A6969&tr=udp%3A%2F%2Ftracker.coppersurfer.tk%3A6969&tr=udp%3A%2F%2Ftracker.empire-js.us%3A1337&tr=udp%3A%2F%2Ftracker.leechers-paradise.org%3A6969&tr=udp%3A%2F%2Ftracker.opentrackr.org%3A1337&tr=wss%3A%2F%2Ftracker.btorrent.xyz&tr=wss%3A%2F%2Ftracker.fastcast.nz&tr=wss%3A%2F%2Ftracker.openwebtorrent.com',
  ubuntu: 'magnet:?xt=urn:btih:3b1445018653f173658d76077596d21469493976&dn=ubuntu-24.04.1-desktop-amd64.iso&tr=https%3A%2F%2Ftorrent.ubuntu.com%2Fannounce',
  sintel: 'magnet:?xt=urn:btih:08ada5a7a6183aae1e09d831df6748d566095a10&dn=Sintel&tr=udp%3A%2F%2Fexplodie.org%3A6969&tr=udp%3A%2F%2Ftracker.coppersurfer.tk%3A6969&tr=udp%3A%2F%2Ftracker.empire-js.us%3A1337&tr=udp%3A%2F%2Ftracker.leechers-paradise.org%3A6969&tr=udp%3A%2F%2Ftracker.opentrackr.org%3A1337'
};

function formatBytes(bytes, decimals = 2) {
  if (!+bytes) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

function formatDuration(ms) {
  if (!ms || ms <= 0 || !isFinite(ms)) return 'Done';
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}

class MagnetXApp {
  constructor() {
    this.torrents = [];
    this.currentFilter = 'all';
    this.searchQuery = '';
    this.ws = null;
    this.openAccordions = new Set();
    this.speedHistories = new Map(); // hash -> array of last 60 speeds
    this.diskStats = { diskFree: 0, diskFreeFormatted: '—' };
    
    // File selection modal state
    this.selectingTorrentHash = null;
    this.tempSelectedIndices = new Set();

    // Media player
    this.plyr = null;
    this.currentPlayingHash = null;
    this.currentPlayingFile = null;
    this.currentStreamUrl = null;

    this.initElements();
    this.initPlyr();
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
    this.playerCopyVlcBtn = document.getElementById('player-copy-vlc-btn');
    this.playerRemuxBtn = document.getElementById('player-remux-btn');
    this.playerRawStreamBtn = document.getElementById('player-raw-stream-btn');
    this.playerDirectDownloadBtn = document.getElementById('player-direct-download-btn');
    this.btnClosePlayer = document.getElementById('btn-close-player');

    // File selection modal
    this.modalFileSelect = document.getElementById('modal-file-select');
    this.selectModalTitle = document.getElementById('select-modal-title');
    this.selectModalSubtitle = document.getElementById('select-modal-subtitle');
    this.btnCloseFileSelect = document.getElementById('btn-close-file-select');
    this.btnCancelFileSelect = document.getElementById('btn-cancel-file-select');
    this.btnApplyFileSelect = document.getElementById('btn-apply-file-select');
    this.fileSelectTree = document.getElementById('file-select-tree');
    this.selectTotalSize = document.getElementById('select-total-size');
    this.selectFreeDisk = document.getElementById('select-free-disk');
    this.btnSelectAll = document.getElementById('btn-select-all');
    this.btnDeselectAll = document.getElementById('btn-deselect-all');
    this.btnSelectVideoOnly = document.getElementById('btn-select-video-only');
    this.btnSkipSamplesNfo = document.getElementById('btn-skip-samples-nfo');

    // Toast stack
    this.toastStack = document.getElementById('toast-stack');
  }

  initPlyr() {
    if (window.Plyr) {
      try {
        this.plyr = new Plyr(this.playerVideo, {
          controls: [
            'play-large', 'restart', 'rewind', 'play', 'fast-forward', 'progress', 'current-time', 'duration',
            'mute', 'volume', 'captions', 'settings', 'pip', 'fullscreen'
          ],
          seekTime: 10,
          settings: ['captions', 'quality', 'speed'],
          speed: { selected: 1, options: [0.5, 0.75, 1, 1.25, 1.5, 2] }
        });

        // Codec error detection helper
        this.playerVideo.addEventListener('error', (e) => {
          console.warn('[Player] Video element error:', e);
          this.showToast('Playback hint: If audio is silent or unsupported (Dolby AC3/EAC3), click "Fix Audio (AAC)" or use "Copy VLC Stream Link"!', 'info');
        });
      } catch (e) {
        console.warn('Plyr initialization fallback:', e);
      }
    }
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
        this.openAccordions.add(data.torrent.infoHash);
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
        this.fullRenderTorrents();
      });
    });

    // Search filter
    this.searchFilter.addEventListener('input', (e) => {
      this.searchQuery = e.target.value.toLowerCase().trim();
      this.fullRenderTorrents();
    });

    // Player modal close
    this.btnClosePlayer.addEventListener('click', () => this.closePlayerModal());
    this.modalPlayer.addEventListener('click', (e) => {
      if (e.target === this.modalPlayer) this.closePlayerModal();
    });

    // Copy VLC Stream link button
    this.playerCopyVlcBtn.addEventListener('click', () => {
      if (this.currentStreamUrl) {
        const vlcUrl = `${location.origin}${this.currentStreamUrl}`;
        navigator.clipboard.writeText(vlcUrl).then(() => {
          this.showToast('Copied direct HTTP 206 stream URL for VLC / PotPlayer / MPV!', 'success');
        });
      }
    });

    // Audio Remux AAC Transcode button
    this.playerRemuxBtn.addEventListener('click', () => {
      if (this.currentStreamUrl) {
        const remuxUrl = this.currentStreamUrl.includes('?') 
          ? `${this.currentStreamUrl}&remux=true` 
          : `${this.currentStreamUrl}?remux=true`;
        
        this.showToast('Transcoding audio track to AAC for in-browser playback...', 'info');
        if (this.plyr) {
          this.plyr.source = {
            type: 'video',
            sources: [{ src: remuxUrl, type: 'video/mp4' }]
          };
          this.plyr.play();
        } else {
          this.playerVideo.src = remuxUrl;
          this.playerVideo.load();
          this.playerVideo.play().catch(() => {});
        }
      }
    });

    // Subtitle selection change
    this.subtitlesDropdown.addEventListener('change', () => {
      const selected = this.subtitlesDropdown.value;
      const tracks = this.playerVideo.querySelectorAll('track');
      tracks.forEach(t => t.remove());

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

    // File selection modal controls
    this.btnCloseFileSelect.addEventListener('click', () => this.closeFileSelectModal());
    this.btnCancelFileSelect.addEventListener('click', () => this.closeFileSelectModal());
    this.modalFileSelect.addEventListener('click', (e) => {
      if (e.target === this.modalFileSelect) this.closeFileSelectModal();
    });

    this.btnSelectAll.addEventListener('click', () => {
      const boxes = this.fileSelectTree.querySelectorAll('.file-tree-checkbox');
      boxes.forEach(b => {
        b.checked = true;
        this.tempSelectedIndices.add(parseInt(b.getAttribute('data-index'), 10));
      });
      this.updateFileSelectModalStats();
    });

    this.btnDeselectAll.addEventListener('click', () => {
      const boxes = this.fileSelectTree.querySelectorAll('.file-tree-checkbox');
      boxes.forEach(b => {
        b.checked = false;
      });
      this.tempSelectedIndices.clear();
      this.updateFileSelectModalStats();
    });

    this.btnSelectVideoOnly.addEventListener('click', () => {
      const boxes = this.fileSelectTree.querySelectorAll('.file-tree-checkbox');
      this.tempSelectedIndices.clear();
      boxes.forEach(b => {
        const isVideo = b.getAttribute('data-isvideo') === 'true';
        b.checked = isVideo;
        if (isVideo) this.tempSelectedIndices.add(parseInt(b.getAttribute('data-index'), 10));
      });
      this.updateFileSelectModalStats();
    });

    this.btnSkipSamplesNfo.addEventListener('click', () => {
      const boxes = this.fileSelectTree.querySelectorAll('.file-tree-checkbox');
      boxes.forEach(b => {
        const name = (b.getAttribute('data-name') || '').toLowerCase();
        if (name.includes('sample') || name.endsWith('.nfo') || name.endsWith('.txt') || name.endsWith('.jpg')) {
          b.checked = false;
          this.tempSelectedIndices.delete(parseInt(b.getAttribute('data-index'), 10));
        }
      });
      this.updateFileSelectModalStats();
    });

    this.btnApplyFileSelect.addEventListener('click', async () => {
      if (!this.selectingTorrentHash) return;
      const selected = Array.from(this.tempSelectedIndices);
      if (selected.length === 0) {
        this.showToast('Please select at least one file to download!', 'error');
        return;
      }

      try {
        const res = await fetch(`/api/torrents/${this.selectingTorrentHash}/select`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ selectedIndices: selected })
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error);

        this.showToast(`Updated! Downloading ${selected.length} selected files.`, 'success');
        this.closeFileSelectModal();
      } catch (err) {
        this.showToast(err.message, 'error');
      }
    });

    // Theme toggle
    this.themeBtn.addEventListener('click', () => {
      const current = document.documentElement.getAttribute('data-theme') || 'dark';
      const next = current === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      localStorage.setItem('magnetx_theme', next);
      this.themeIcon.textContent = next === 'dark' ? '🌙' : '☀️';
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
          if (msg.data.disk) {
            this.diskStats = msg.data.disk;
          }
          if (msg.data.speeds) {
            this.navDownSpeed.textContent = msg.data.speeds.downloadFormatted;
            this.navUpSpeed.textContent = msg.data.speeds.uploadFormatted;
          }
          if (msg.data.torrents) {
            this.torrents = msg.data.torrents;
            this.syncTorrentsDOM(msg.data.torrents);
          }
          let activeCount = 0;
          for (const t of this.torrents) {
            if (t.status === 'downloading' || t.status === 'extracting') activeCount++;
          }
          this.activeTransfersCount.textContent = `${activeCount} Active`;
        } else if (msg.type === 'torrents_update') {
          this.torrents = msg.data;
          this.syncTorrentsDOM(msg.data);
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

  /**
   * High-Performance Targeted DOM Diffing / Synchronization:
   * Prevents layout thrashing, flickering, and accordion closures by mutating only
   * changed properties in-place.
   */
  syncTorrentsDOM(torrents) {
    let filtered = torrents.filter(t => {
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

    const incomingHashes = new Set(filtered.map(t => t.infoHash));

    // 1. Remove obsolete cards
    const existingCards = this.torrentsContainer.querySelectorAll('.torrent-block');
    existingCards.forEach(card => {
      const hash = card.getAttribute('data-hash');
      if (!incomingHashes.has(hash)) {
        card.remove();
        this.speedHistories.delete(hash);
      }
    });

    // 2. Update existing cards or append new cards
    filtered.forEach(t => {
      const hash = t.infoHash;
      let card = this.torrentsContainer.querySelector(`.torrent-block[data-hash="${hash}"]`);

      if (!card) {
        // Create new card and append
        const temp = document.createElement('div');
        temp.innerHTML = this.createTorrentBlockHTML(t);
        card = temp.firstElementChild;
        this.torrentsContainer.appendChild(card);
        this.attachCardEventListeners(card);
      } else {
        // Targeted in-place mutation
        this.updateCardInPlace(card, t);
      }

      // Update speed sparkline history (last 60 seconds)
      this.recordSpeedAndDrawSparkline(card, t);
    });
  }

  /**
   * Mutates only dynamic elements of an existing card without rebuilding DOM
   */
  updateCardInPlace(card, t) {
    const pct = Math.round((t.progress || 0) * 100);
    const isCompleted = t.status === 'completed';
    const isExtracting = t.isExtracting || t.status === 'extracting';
    const isDownloading = t.status === 'downloading';

    // Update name if changed
    const nameEl = card.querySelector('.torrent-name');
    if (nameEl && t.name && nameEl.textContent.trim() !== t.name) {
      nameEl.textContent = t.name;
      nameEl.title = t.name;
    }

    // Update progress bar
    const progressThumb = card.querySelector('.progress-thumb');
    if (progressThumb) {
      progressThumb.style.width = `${pct}%`;
    }

    // Update progress summary text
    const progressInfoText = card.querySelector('.progress-info-text');
    if (progressInfoText) {
      const downloadedFormatted = formatBytes(t.downloaded || 0);
      const totalFormatted = formatBytes(t.total || 0);
      progressInfoText.textContent = `${pct}% extracted (${downloadedFormatted} of ${totalFormatted})`;
    }

    // Update speeds & ETA
    const speedInfo = card.querySelector('.progress-speeds');
    if (speedInfo) {
      if (isDownloading) {
        const dlFormatted = formatBytes(t.downloadSpeed || 0) + '/s';
        const etaFormatted = formatDuration(t.timeRemaining || 0);
        speedInfo.innerHTML = `<span>↓ ${dlFormatted}</span><span>⏱️ ETA: ${etaFormatted}</span>`;
      } else {
        speedInfo.innerHTML = `<span>Status: ${isExtracting ? (t.extractStatusText || 'Extracting archives...') : 'Ready for download'}</span>`;
      }
    }

    // Update peers count
    const peersEl = card.querySelector('.torrent-peers-count');
    if (peersEl) {
      peersEl.textContent = `👥 ${t.numPeers || 0} peers`;
      peersEl.style.display = isDownloading ? 'inline-flex' : 'none';
    }

    // Update status badge
    const badgeEl = card.querySelector('.torrent-status-badge');
    if (badgeEl) {
      if (isExtracting) {
        badgeEl.className = 'status-tag tag-extracting torrent-status-badge';
        badgeEl.innerHTML = `📦 ${t.extractStatusText || 'Auto-Extracting RAR/ZIP...'}`;
      } else if (isCompleted) {
        badgeEl.className = 'status-tag tag-ready torrent-status-badge';
        badgeEl.innerHTML = `✓ Ready`;
      } else {
        badgeEl.className = 'status-tag tag-downloading torrent-status-badge';
        badgeEl.innerHTML = `⚡ Extracting (${pct}%)`;
      }
    }
  }

  /**
   * Records 60s speed window and draws glowing bezier sparkline on HTML5 Canvas
   */
  recordSpeedAndDrawSparkline(card, t) {
    const hash = t.infoHash;
    if (!this.speedHistories.has(hash)) {
      this.speedHistories.set(hash, new Array(60).fill(0));
    }

    const history = this.speedHistories.get(hash);
    history.push(t.downloadSpeed || 0);
    if (history.length > 60) history.shift();

    const canvas = card.querySelector('.speed-sparkline');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    ctx.clearRect(0, 0, width, height);

    const maxSpeed = Math.max(...history, 500 * 1024); // at least 500 KB scale
    const step = width / (history.length - 1);

    // Gradient fill under curve
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, 'rgba(6, 182, 212, 0.35)');
    gradient.addColorStop(1, 'rgba(6, 182, 212, 0.0)');

    ctx.beginPath();
    ctx.moveTo(0, height);

    for (let i = 0; i < history.length; i++) {
      const x = i * step;
      const y = height - (history[i] / maxSpeed) * (height - 4);
      ctx.lineTo(x, y);
    }

    ctx.lineTo(width, height);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();

    // Top stroke line
    ctx.beginPath();
    for (let i = 0; i < history.length; i++) {
      const x = i * step;
      const y = height - (history[i] / maxSpeed) * (height - 4);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = '#06b6d4';
    ctx.lineWidth = 1.8;
    ctx.stroke();
  }

  fullRenderTorrents() {
    this.torrentsContainer.innerHTML = '';
    this.syncTorrentsDOM(this.torrents);
  }

  createTorrentBlockHTML(t) {
    const pct = Math.round((t.progress || 0) * 100);
    const isExtracting = t.isExtracting || t.status === 'extracting';
    const isCompleted = t.status === 'completed';
    const isDownloading = t.status === 'downloading';
    const isOpen = this.openAccordions.has(t.infoHash) || isCompleted;

    let statusTag = '';
    if (isExtracting) {
      statusTag = `<span class="status-tag tag-extracting torrent-status-badge">📦 ${t.extractStatusText || 'Auto-Extracting RAR/ZIP...'}</span>`;
    } else if (isCompleted) {
      statusTag = `<span class="status-tag tag-ready torrent-status-badge">✓ Ready</span>`;
      if (t.extracted) {
        statusTag += ` <span class="status-tag tag-extracted">⚡ Auto-Unpacked</span>`;
      }
    } else {
      statusTag = `<span class="status-tag tag-downloading torrent-status-badge">⚡ Extracting (${pct}%)</span>`;
    }

    const files = t.files || [];
    const filesCount = files.length;
    const totalFormatted = formatBytes(t.total || 0);
    const downloadedFormatted = formatBytes(t.downloaded || 0);

    // Files rows HTML
    let filesRows = '';
    if (files.length > 0) {
      filesRows = files.map((f, idx) => {
        const isVideo = f.category === 'video' || /\.(mp4|mkv|webm|avi|mov)$/i.test(f.name);
        const isAudio = f.category === 'audio' || /\.(mp3|flac|wav|aac|ogg)$/i.test(f.name);
        const isArch = f.isArchive;
        const isSelected = f.selected !== false;

        let icon = '📄';
        if (isVideo) icon = '🎬';
        else if (isAudio) icon = '🎵';
        else if (f.category === 'image') icon = '🖼️';
        else if (isArch) icon = '📦';
        else if (f.category === 'code') icon = '💻';

        const downloadUrl = `/api/download/${t.infoHash}?file=${encodeURIComponent(f.path)}`;
        const streamUrl = `/api/stream/${t.infoHash}?file=${encodeURIComponent(f.path)}`;

        return `
          <div class="file-row" style="${isSelected ? '' : 'opacity: 0.45;'}">
            <div class="file-col-name" title="${this.escapeHtml(f.displayName || f.name)}">
              <span>${icon}</span>
              <span class="name-text">${this.escapeHtml(f.displayName || f.name)}</span>
              ${!isSelected ? '<span class="status-tag" style="font-size:10px;padding:1px 6px;">Deselected</span>' : ''}
            </div>
            <div class="file-col-size">${f.sizeFormatted || formatBytes(f.size || 0)}</div>
            <div class="file-col-actions">
              ${(isVideo || isAudio) ? `
                <button class="btn-subtle btn-sm btn-stream-file" data-url="${streamUrl}" data-name="${this.escapeHtml(f.name)}" data-path="${this.escapeHtml(f.path)}" data-hash="${t.infoHash}" title="Stream video/audio directly in browser">
                  ▶ Stream
                </button>
                <button class="btn-subtle btn-sm btn-copy-vlc-link" data-url="${location.origin}${streamUrl}" title="Copy direct stream URL for VLC, PotPlayer, or MPV (instant playback & 5.1 sound)">
                  ⚡ VLC
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
                <span class="status-tag tag-info">💾 ${totalFormatted}</span>
                <span class="status-tag tag-info">📄 ${filesCount} file${filesCount === 1 ? '' : 's'}</span>
                <span class="status-tag tag-info torrent-peers-count" style="${isDownloading ? '' : 'display:none;'}">👥 ${t.numPeers || 0} peers</span>
              </div>
            </div>
          </div>

          <div class="torrent-actions-right">
            <!-- Sparkline Speed History -->
            <div class="sparkline-wrapper" title="60-second real-time speed curve">
              <canvas class="speed-sparkline" width="140" height="28"></canvas>
            </div>

            <!-- File selection button -->
            <button class="btn-subtle btn-sm btn-open-file-select" data-hash="${t.infoHash}" title="Choose which files to download or skip">
              🗂️ Files
            </button>

            <!-- Aria2 Export -->
            <a href="/api/torrents/${t.infoHash}/aria2" download class="btn-subtle btn-sm" title="Export Aria2/ADM batch control file (.aria2.txt)">
              📥 Aria2
            </a>

            ${isCompleted ? `
              <a href="/api/download-zip/${t.infoHash}" class="btn-subtle btn-sm" title="Download all files in one single ZIP stream">
                ⬇️ ZIP All
              </a>
              <button class="btn-subtle btn-sm btn-copy-all-links" data-hash="${t.infoHash}" title="Copy all file download links for IDM batch import">
                📋 All Links
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
            <span class="progress-info-text">${pct}% extracted (${downloadedFormatted} of ${totalFormatted})</span>
            <div class="progress-speeds">
              ${isDownloading ? `
                <span>↓ ${formatBytes(t.downloadSpeed || 0)}/s</span>
                <span>⏱️ ETA: ${formatDuration(t.timeRemaining || 0)}</span>
              ` : `
                <span>Status: ${isExtracting ? (t.extractStatusText || 'Extracting archives...') : 'Ready for download'}</span>
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

  attachCardEventListeners(parent = document) {
    // Accordion toggle
    parent.querySelectorAll('.accordion-header').forEach(header => {
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

    // File selection modal trigger
    parent.querySelectorAll('.btn-open-file-select').forEach(btn => {
      btn.addEventListener('click', () => {
        const hash = btn.getAttribute('data-hash');
        this.openFileSelectModal(hash);
      });
    });

    // Copy All Links (for IDM batch download)
    parent.querySelectorAll('.btn-copy-all-links').forEach(btn => {
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
    parent.querySelectorAll('.btn-copy-direct-link').forEach(btn => {
      btn.addEventListener('click', () => {
        const url = btn.getAttribute('data-url');
        navigator.clipboard.writeText(url).then(() => {
          this.showToast('Direct download link copied to clipboard!', 'success');
        });
      });
    });

    // Copy VLC stream link for single file
    parent.querySelectorAll('.btn-copy-vlc-link').forEach(btn => {
      btn.addEventListener('click', () => {
        const url = btn.getAttribute('data-url');
        navigator.clipboard.writeText(url).then(() => {
          this.showToast('Copied VLC Stream Link! Open VLC -> Press Ctrl+N -> Paste & Play (5.1 Dolby surround & instant seek!)', 'success');
        });
      });
    });

    // Stream single file
    parent.querySelectorAll('.btn-stream-file').forEach(btn => {
      btn.addEventListener('click', () => {
        const url = btn.getAttribute('data-url');
        const name = btn.getAttribute('data-name');
        const hash = btn.getAttribute('data-hash');
        const filePath = btn.getAttribute('data-path');
        this.openPlayerModal(url, name, hash, filePath);
      });
    });

    // Stream first streamable video in live torrent
    parent.querySelectorAll('.btn-stream-first').forEach(btn => {
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
    parent.querySelectorAll('.btn-trigger-extract').forEach(btn => {
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
    parent.querySelectorAll('.btn-extract-single').forEach(btn => {
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
    parent.querySelectorAll('.btn-delete-torrent').forEach(btn => {
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

  /**
   * Pre-Download File Selection Modal
   */
  openFileSelectModal(hash) {
    const torrent = this.torrents.find(t => t.infoHash === hash);
    if (!torrent) return;

    this.selectingTorrentHash = hash;
    this.tempSelectedIndices.clear();

    const files = torrent.files || [];
    this.selectModalTitle.textContent = torrent.name || 'Select Files';
    this.selectModalSubtitle.textContent = `Choose which files to allocate disk space and bandwidth for (${files.length} total files)`;

    if (files.length === 0) {
      this.fileSelectTree.innerHTML = `<div style="padding:24px;text-align:center;color:var(--text-muted);">Fetching file list from peers...</div>`;
      this.modalFileSelect.classList.remove('hidden');
      return;
    }

    // Populate checkboxes
    const html = files.map((f, idx) => {
      const isSelected = f.selected !== false;
      if (isSelected) this.tempSelectedIndices.add(idx);

      const isVideo = f.category === 'video' || /\.(mp4|mkv|webm|avi|mov)$/i.test(f.name);
      let icon = '📄';
      if (isVideo) icon = '🎬';
      else if (f.category === 'audio') icon = '🎵';
      else if (f.isArchive) icon = '📦';

      return `
        <div class="file-tree-item">
          <div class="file-tree-left">
            <input 
              type="checkbox" 
              class="file-tree-checkbox" 
              id="file-chk-${idx}" 
              data-index="${idx}" 
              data-size="${f.size || 0}"
              data-isvideo="${isVideo}"
              data-name="${this.escapeHtml(f.name)}"
              ${isSelected ? 'checked' : ''} 
            />
            <label for="file-chk-${idx}" class="file-tree-name">
              <span>${icon}</span>
              <span>${this.escapeHtml(f.name)}</span>
            </label>
          </div>
          <div class="file-tree-right">
            <span class="file-tree-size">${f.sizeFormatted || formatBytes(f.size || 0)}</span>
          </div>
        </div>
      `;
    }).join('');

    this.fileSelectTree.innerHTML = html;

    // Attach checkbox change events
    this.fileSelectTree.querySelectorAll('.file-tree-checkbox').forEach(box => {
      box.addEventListener('change', (e) => {
        const idx = parseInt(e.target.getAttribute('data-index'), 10);
        if (e.target.checked) {
          this.tempSelectedIndices.add(idx);
        } else {
          this.tempSelectedIndices.delete(idx);
        }
        this.updateFileSelectModalStats();
      });
    });

    this.updateFileSelectModalStats();
    this.modalFileSelect.classList.remove('hidden');
  }

  updateFileSelectModalStats() {
    const torrent = this.torrents.find(t => t.infoHash === this.selectingTorrentHash);
    if (!torrent || !torrent.files) return;

    let selectedBytes = 0;
    this.tempSelectedIndices.forEach(idx => {
      const f = torrent.files[idx];
      if (f && f.size) selectedBytes += f.size;
    });

    this.selectTotalSize.textContent = `Selected: ${this.tempSelectedIndices.size} files (${formatBytes(selectedBytes)})`;
    this.selectFreeDisk.textContent = `Free Disk: ${this.diskStats.diskFreeFormatted || 'Unlimited'}`;
  }

  closeFileSelectModal() {
    this.modalFileSelect.classList.add('hidden');
    this.selectingTorrentHash = null;
    this.tempSelectedIndices.clear();
  }

  /**
   * Media Player with Plyr.io, Subtitle Auto-Attach & VLC Stream URL
   */
  async openPlayerModal(streamUrl, title, hash, filePath) {
    this.playerTitle.textContent = title;
    this.currentPlayingHash = hash;
    this.currentPlayingFile = filePath;
    this.currentStreamUrl = streamUrl;

    this.modalPlayer.classList.remove('hidden');

    const lower = (filePath || '').toLowerCase();
    const isMkv = lower.endsWith('.mkv');
    const mimeType = isMkv ? 'video/x-matroska' : 'video/mp4';

    if (this.plyr) {
      this.plyr.source = {
        type: 'video',
        title: title,
        sources: [{ src: streamUrl, type: mimeType }]
      };
      this.plyr.play().catch(() => {});
    } else {
      this.playerVideo.src = streamUrl;
      this.playerVideo.load();
      this.playerVideo.play().catch(() => {});
    }

    this.playerRawStreamBtn.href = streamUrl;
    this.playerDirectDownloadBtn.href = `/api/download/${hash}?file=${encodeURIComponent(filePath)}`;

    this.subtitlesDropdown.innerHTML = '<option value="none">Off</option>';
    
    // Auto-scan subtitles
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
    if (this.plyr) {
      this.plyr.stop();
    } else {
      this.playerVideo.pause();
      this.playerVideo.src = '';
    }
    const tracks = this.playerVideo.querySelectorAll('track');
    tracks.forEach(t => t.remove());
    this.modalPlayer.classList.add('hidden');
    this.currentStreamUrl = null;
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
