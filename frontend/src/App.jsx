import React, { useState, useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import { 
  Zap, Search, Filter, HardDrive, CheckCircle2, 
  Layers, Sparkles, FolderDown, ArrowUpDown, RefreshCw 
} from 'lucide-react';

import Navbar from './components/Navbar.jsx';
import HeroInput from './components/HeroInput.jsx';
import TorrentCard from './components/TorrentCard.jsx';
import StreamModal from './components/StreamModal.jsx';
import ToastContainer from './components/ToastContainer.jsx';

export default function App() {
  const [torrents, setTorrents] = useState([]);
  const [diskStats, setDiskStats] = useState(null);
  const [speeds, setSpeeds] = useState({ downloadFormatted: '0 B/s', uploadFormatted: '0 B/s' });
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('all'); // 'all' | 'active' | 'completed'
  const [search, setSearch] = useState('');
  
  // Stream modal state
  const [streamModalOpen, setStreamModalOpen] = useState(false);
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
    } catch (err) {
      showToast(err.message || 'Failed to delete torrent', 'error');
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

  // Filtered Torrents
  const filteredTorrents = torrents.filter(t => {
    const matchesSearch = (t.name || t.infoHash || '').toLowerCase().includes(search.toLowerCase());
    if (!matchesSearch) return false;

    const isDone = t.status === 'completed' || t.progress >= 1;
    if (filter === 'active') return !isDone;
    if (filter === 'completed') return isDone;
    return true;
  });

  const activeCount = torrents.filter(t => t.status !== 'completed' && t.progress < 1).length;
  const completedCount = torrents.length - activeCount;

  return (
    <div className="min-h-screen flex flex-col selection:bg-cyan-500/30 selection:text-cyan-200">
      {/* Top Navbar */}
      <Navbar
        connected={connected}
        speeds={speeds}
        diskStats={diskStats}
        activeCount={activeCount}
      />

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-10">
        {/* Hero Input Section */}
        <HeroInput
          onAddMagnet={handleAddMagnet}
          onUploadTorrent={handleUploadTorrent}
          isLoading={loading}
        />

        {/* Section Header & Filters */}
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <h2 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight flex items-center gap-2">
                <span>Extracted Transfers</span>
                <span className="px-2.5 py-0.5 text-xs font-bold rounded-full bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">
                  {torrents.length}
                </span>
              </h2>
            </div>

            {/* Controls: Search & Tabs */}
            <div className="flex items-center gap-3 flex-wrap">
              {/* Search Bar */}
              <div className="relative flex items-center">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 pointer-events-none" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Filter transfers..."
                  className="glass-input pl-9 pr-4 py-2 rounded-xl text-xs sm:text-sm text-slate-200 placeholder-slate-500 w-48 sm:w-60"
                />
              </div>

              {/* Status Filters */}
              <div className="flex bg-slate-900/80 p-1 rounded-xl border border-white/10 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setFilter('all')}
                  className={`px-3 py-1.5 rounded-lg transition-all ${
                    filter === 'all'
                      ? 'bg-cyan-500 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  All ({torrents.length})
                </button>
                <button
                  type="button"
                  onClick={() => setFilter('active')}
                  className={`px-3 py-1.5 rounded-lg transition-all ${
                    filter === 'active'
                      ? 'bg-cyan-500 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Extracting ({activeCount})
                </button>
                <button
                  type="button"
                  onClick={() => setFilter('completed')}
                  className={`px-3 py-1.5 rounded-lg transition-all ${
                    filter === 'completed'
                      ? 'bg-cyan-500 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Ready ({completedCount})
                </button>
              </div>
            </div>
          </div>

          {/* Torrents List */}
          {filteredTorrents.length > 0 ? (
            <div className="grid grid-cols-1 gap-4 sm:gap-6">
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
            <div className="glass-panel rounded-3xl p-12 text-center border border-white/5 max-w-lg mx-auto space-y-4">
              <div className="w-16 h-16 rounded-3xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 mx-auto shadow-lg shadow-cyan-500/10">
                <FolderDown className="w-8 h-8" />
              </div>
              <div className="space-y-1">
                <h3 className="text-lg font-bold text-white">No active transfers</h3>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  Paste any magnet link or drop a .torrent above to instantly extract files, stream in VLC, and generate gigabit direct download links.
                </p>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Stream in External Player Modal */}
      <StreamModal
        isOpen={streamModalOpen}
        onClose={() => setStreamModalOpen(false)}
        torrent={selectedTorrent}
        file={selectedFile}
        onShowToast={showToast}
      />

      {/* Floating Glass Toasts */}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
