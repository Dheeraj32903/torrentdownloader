import React, { useState, useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import { 
  Zap, Search, Filter, HardDrive, CheckCircle2, 
  Layers, Sparkles, FolderDown, ArrowUpDown, RefreshCw, 
  Film, ArrowDownUp 
} from 'lucide-react';

import Navbar from './components/Navbar.jsx';
import HeroInput from './components/HeroInput.jsx';
import TorrentCard from './components/TorrentCard.jsx';
import StreamModal from './components/StreamModal.jsx';
import StorageModal from './components/StorageModal.jsx';
import ToastContainer from './components/ToastContainer.jsx';
import { isMediaFile } from './utils/format.js';

export default function App() {
  const [torrents, setTorrents] = useState([]);
  const [diskStats, setDiskStats] = useState(null);
  const [speeds, setSpeeds] = useState({ downloadFormatted: '0 B/s', uploadFormatted: '0 B/s' });
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('all'); // 'all' | 'active' | 'completed' | 'video'
  const [sortBy, setSortBy] = useState('date'); // 'date' | 'speed' | 'size' | 'progress'
  const [search, setSearch] = useState('');
  
  // Modals state
  const [streamModalOpen, setStreamModalOpen] = useState(false);
  const [storageModalOpen, setStorageModalOpen] = useState(false);
  const [selectedTorrent, setSelectedTorrent] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);

  // Toast notifications
  const [toasts, setToasts] = useState([]);
  const wsRef = useRef(null);
  const prevCompletedHashes = useRef(new Set());

  // Show Toast helper
  const showToast = (message, type = 'info') => {
    const id = Date.now() + Math.random().toString(36).substring(2, 5);
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4500);
  };

  const dismissToast = (id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  // WebSocket Connection
  useEffect(() => {
    let reconnectTimeout = null;

    const connectWs = () => {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws`;
      
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setConnected(true);
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'init' || msg.type === 'tick') {
            const data = msg.data;
            if (data.torrents) {
              setTorrents(data.torrents);

              // Check if any torrent just reached 100% completed
              data.torrents.forEach(t => {
                const isDone = t.status === 'completed' || t.progress >= 1;
                if (isDone && !prevCompletedHashes.current.has(t.infoHash)) {
                  prevCompletedHashes.current.add(t.infoHash);
                  showToast(`Extraction complete: "${t.name || 'Torrent'}" is ready!`, 'success');
                  try {
                    confetti({ particleCount: 70, spread: 60, origin: { y: 0.8 } });
                  } catch {}
                }
              });
            }
            if (data.disk) setDiskStats(data.disk);
            if (data.speeds) setSpeeds(data.speeds);
          }
        } catch (e) {
          console.warn('WS parse error:', e);
        }
      };

      ws.onclose = () => {
        setConnected(false);
        reconnectTimeout = setTimeout(connectWs, 3000);
      };

      ws.onerror = () => {
        ws.close();
      };
    };

    connectWs();

    // Fallback polling every 5s if WS disconnects
    const pollInterval = setInterval(() => {
      if (!connected) {
        fetch('/api/torrents')
          .then(res => res.json())
          .then(data => { if (Array.isArray(data)) setTorrents(data); })
          .catch(() => {});
        fetch('/api/system/stats')
          .then(res => res.json())
          .then(data => { if (data.disk) setDiskStats(data.disk); })
          .catch(() => {});
      }
    }, 5000);

    return () => {
      if (wsRef.current) wsRef.current.close();
      clearTimeout(reconnectTimeout);
      clearInterval(pollInterval);
    };
  }, [connected]);

  // Handle Add Magnet Link
  const handleAddMagnet = async (magnet) => {
    setLoading(true);
    try {
      const res = await fetch('/api/torrents/add-magnet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ magnet })
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      showToast(`Added to swarm: ${data.torrent?.name || 'Torrent'}`, 'success');
    } catch (err) {
      showToast(err.message || 'Failed to add magnet link', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Handle Upload .torrent File
  const handleUploadTorrent = async (file) => {
    setLoading(true);
    const formData = new FormData();
    formData.append('torrent', file);

    try {
      const res = await fetch('/api/torrents/upload-torrent', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      showToast(`Uploaded: ${data.torrent?.name || file.name}`, 'success');
    } catch (err) {
      showToast(err.message || 'Failed to upload .torrent file', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Handle Delete Torrent
  const handleDeleteTorrent = async (hash, name) => {
    const deleteFiles = window.confirm(
      `Delete "${name || hash}"?\n\nClick OK to permanently delete the files from your server disk, or Cancel to just remove it from the list.`
    );

    try {
      const res = await fetch(`/api/torrents/${hash}?deleteFiles=${deleteFiles ? 'true' : 'false'}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      setTorrents(prev => prev.filter(t => t.infoHash !== hash));
      showToast(`Torrent removed successfully`, 'info');
      // Update disk stats
      fetch('/api/system/stats').then(r => r.json()).then(d => { if (d.disk) setDiskStats(d.disk); });
    } catch (err) {
      showToast(err.message || 'Failed to delete torrent', 'error');
    }
  };

  // Handle Purge All Storage & Downloads
  const handlePurgeAll = async () => {
    try {
      const res = await fetch('/api/storage/purge-all', { method: 'POST' });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      setTorrents([]);
      showToast('All downloaded files and cache have been purged! Your SSD is free.', 'success');
      // Refresh disk stats
      fetch('/api/system/stats').then(r => r.json()).then(d => { if (d.disk) setDiskStats(d.disk); });
    } catch (err) {
      showToast(err.message || 'Failed to purge storage', 'error');
    }
  };

  // Handle Single Archive Extraction
  const handleExtractArchive = async (hash, relativePath) => {
    try {
      showToast('Starting background archive extraction...', 'info');
      const res = await fetch('/api/extract-file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hash, relativePath })
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      showToast(data.message || 'Extracted successfully!', 'success');
    } catch (err) {
      showToast(err.message || 'Extraction failed', 'error');
    }
  };

  // Open Stream Modal
  const handleOpenStream = (torrent, file = null) => {
    setSelectedTorrent(torrent);
    setSelectedFile(file);
    setStreamModalOpen(true);
  };

  // Filtered & Sorted Torrents
  const filteredTorrents = torrents
    .filter(t => {
      const matchesSearch = (t.name || t.infoHash || '').toLowerCase().includes(search.toLowerCase());
      if (!matchesSearch) return false;

      const isDone = t.status === 'completed' || t.progress >= 1;
      if (filter === 'active') return !isDone;
      if (filter === 'completed') return isDone;
      if (filter === 'video') {
        const hasVideo = (t.files || []).some(f => isMediaFile(f.name || f.path)) || isMediaFile(t.name);
        return hasVideo;
      }
      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'speed') return (b.downloadSpeed || 0) - (a.downloadSpeed || 0);
      if (sortBy === 'size') return (b.total || 0) - (a.total || 0);
      if (sortBy === 'progress') return (b.progress || 0) - (a.progress || 0);
      return 0; // Default order
    });

  const activeCount = torrents.filter(t => t.status !== 'completed' && t.progress < 1).length;
  const completedCount = torrents.length - activeCount;

  return (
    <div className="min-h-screen flex flex-col selection:bg-[#0066FF] selection:text-white pb-12 font-mono">
      {/* Top Floating White Navbar */}
      <Navbar
        connected={connected}
        speeds={speeds}
        diskStats={diskStats}
        activeCount={activeCount}
        onOpenStorage={() => setStorageModalOpen(true)}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-[1200px] w-full mx-auto px-4 py-8 sm:py-10 space-y-8">
        {/* Command Bar Hero Input */}
        <HeroInput
          onAddMagnet={handleAddMagnet}
          onUploadTorrent={handleUploadTorrent}
          isLoading={loading}
        />

        {/* Section Header & Tabs */}
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <h2 className="text-xl sm:text-2xl font-bold text-[#0D0F1C] tracking-tight flex items-center gap-2.5">
                <span>Active Transfers</span>
                <span className="px-2.5 py-0.5 text-xs font-bold rounded-md bg-[#EBF2FF] text-[#0066FF] border border-[#B8D0FF] mono-stat">
                  {torrents.length}
                </span>
              </h2>
            </div>

            {/* Controls: Search, Sort & Tabs */}
            <div className="flex items-center gap-2.5 flex-wrap">
              {/* Search Bar */}
              <div className="relative flex items-center">
                <Search className="w-3.5 h-3.5 text-[#8F9CAE] absolute left-3 pointer-events-none" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Filter transfers..."
                  className="ui-input text-xs sm:text-sm text-[#0D0F1C] placeholder-[#8F9CAE] pl-9 pr-3.5 py-2 w-40 sm:w-56 font-mono"
                />
              </div>

              {/* Sort Selector */}
              <div className="flex items-center gap-1.5 bg-white border border-[#E0E4EC] px-3 py-2 rounded-xl text-xs shadow-xs">
                <ArrowDownUp className="w-3.5 h-3.5 text-[#0066FF]" />
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="bg-transparent text-[#0D0F1C] font-semibold focus:outline-none text-xs cursor-pointer font-mono"
                >
                  <option value="date">Latest</option>
                  <option value="speed">Fastest Speed</option>
                  <option value="size">Largest Size</option>
                  <option value="progress">Progress</option>
                </select>
              </div>

              {/* Status Filters - Bracketed Monospace Tabs */}
              <div className="flex bg-[#E0E4EC]/60 p-1 rounded-xl border border-[#E0E4EC] text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setFilter('all')}
                  className={`px-3 py-1.5 rounded-lg transition-all ${
                    filter === 'all'
                      ? 'btn-primary text-xs shadow-xs'
                      : 'text-[#646E82] hover:text-[#0D0F1C]'
                  }`}
                >
                  [ ALL ({torrents.length}) ]
                </button>
                <button
                  type="button"
                  onClick={() => setFilter('active')}
                  className={`px-3 py-1.5 rounded-lg transition-all ${
                    filter === 'active'
                      ? 'btn-primary text-xs shadow-xs'
                      : 'text-[#646E82] hover:text-[#0D0F1C]'
                  }`}
                >
                  [ EXTRACTING ({activeCount}) ]
                </button>
                <button
                  type="button"
                  onClick={() => setFilter('completed')}
                  className={`px-3 py-1.5 rounded-lg transition-all ${
                    filter === 'completed'
                      ? 'btn-primary text-xs shadow-xs'
                      : 'text-[#646E82] hover:text-[#0D0F1C]'
                  }`}
                >
                  [ READY ({completedCount}) ]
                </button>
              </div>
            </div>
          </div>

          {/* Torrents List */}
          {filteredTorrents.length > 0 ? (
            <div className="grid grid-cols-1 gap-4">
              {filteredTorrents.map((t) => (
                <TorrentCard
                  key={t.infoHash}
                  torrent={t}
                  onOpenStream={handleOpenStream}
                  onDeleteTorrent={handleDeleteTorrent}
                  onExtractArchive={handleExtractArchive}
                  onShowToast={showToast}
                />
              ))}
            </div>
          ) : (
            /* Empty State */
            <div className="ui-card p-12 text-center max-w-lg mx-auto space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-[#EBF2FF] border border-[#B8D0FF] flex items-center justify-center text-[#0066FF] mx-auto shadow-xs">
                <FolderDown className="w-8 h-8" />
              </div>
              <div className="space-y-1.5">
                <h3 className="text-lg font-bold text-[#0D0F1C]">No active transfers</h3>
                <p className="text-xs text-[#646E82] max-w-sm mx-auto leading-relaxed">
                  Paste any magnet link or drop a .torrent above to extract files, watch movies instantly in VLC, and generate gigabit direct download links.
                </p>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Stream in Cinema Player / VLC Modal */}
      <StreamModal
        isOpen={streamModalOpen}
        onClose={() => setStreamModalOpen(false)}
        torrent={selectedTorrent}
        file={selectedFile}
        onShowToast={showToast}
      />

      {/* Storage & Disk Cache Manager Modal */}
      <StorageModal
        isOpen={storageModalOpen}
        onClose={() => setStorageModalOpen(false)}
        diskStats={diskStats}
        torrents={torrents}
        onDeleteTorrent={handleDeleteTorrent}
        onPurgeAll={handlePurgeAll}
        onShowToast={showToast}
      />

      {/* Floating Alerts matching Styleguide */}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
