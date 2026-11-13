import React, { useState, useRef } from 'react';
import { 
  Link2, UploadCloud, Clipboard, Loader2, 
  ArrowRight, ShieldCheck, Zap, Cpu, X, Film
} from 'lucide-react';

export default function HeroInput({ onAddMagnet, onUploadTorrent, isLoading }) {
  const [activeMode, setActiveMode] = useState('magnet'); // 'magnet' | 'file'
  const [magnetInput, setMagnetInput] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef(null);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!magnetInput.trim() || isLoading) return;
    onAddMagnet(magnetInput.trim());
    setMagnetInput('');
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text && text.trim()) {
        setMagnetInput(text.trim());
      }
    } catch (err) {
      console.warn('Clipboard read error:', err);
    }
  };

  const handleFileDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const files = e.dataTransfer.files;
    if (files && files.length > 0 && files[0].name.endsWith('.torrent')) {
      onUploadTorrent(files[0]);
    }
  };

  const handleFileChange = (e) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      onUploadTorrent(files[0]);
      e.target.value = '';
    }
  };

  return (
    <div className="relative max-w-[1200px] mx-auto px-4 w-full">
      {/* 2026 Bento Command Bar */}
      <div 
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleFileDrop}
        className={`bento-card p-4 sm:p-5 relative transition-all ${
          dragOver ? 'border-emerald-500/60 bg-emerald-950/20 shadow-2xl shadow-emerald-500/20' : ''
        }`}
      >
        {/* Ambient Top Glow */}
        <div className="absolute -top-12 left-1/2 -translate-x-1/2 w-96 h-24 bg-emerald-500/15 rounded-full blur-3xl pointer-events-none" />

        {/* Command Form */}
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="command-input rounded-2xl flex items-center p-2 sm:p-2.5 gap-2.5">
            {/* Left Magnet Icon */}
            <div className="w-10 h-10 rounded-xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center text-emerald-400 shrink-0">
              <Link2 className="w-5 h-5" />
            </div>

            {/* Input field */}
            <input
              type="text"
              value={magnetInput}
              onChange={(e) => setMagnetInput(e.target.value)}
              placeholder="Paste magnet URI (magnet:?xt=urn:btih:...) or drop .torrent file..."
              disabled={isLoading}
              className="w-full bg-transparent text-sm sm:text-base text-white placeholder-slate-500 focus:outline-none font-mono tracking-tight"
            />

            {/* Quick action buttons inside command bar */}
            <div className="flex items-center gap-1.5 shrink-0">
              {magnetInput && (
                <button
                  type="button"
                  onClick={() => setMagnetInput('')}
                  className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/[0.06] transition-colors"
                  title="Clear input"
                >
                  <X className="w-4 h-4" />
                </button>
              )}

              {/* Paste button */}
              <button
                type="button"
                onClick={handlePaste}
                className="btn-glass px-3 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white flex items-center gap-1.5"
                title="Paste from clipboard"
              >
                <Clipboard className="w-3.5 h-3.5 text-emerald-400" />
                <span className="hidden sm:inline">Paste</span>
              </button>

              {/* Upload .torrent ghost button */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="btn-glass px-3 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white flex items-center gap-1.5"
                title="Upload .torrent file"
              >
                <UploadCloud className="w-3.5 h-3.5 text-cyan-400" />
                <span className="hidden sm:inline">.torrent</span>
              </button>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept=".torrent"
                className="hidden"
              />

              {/* High-Contrast Gradient "Fetch Video" CTA Button */}
              <button
                type="submit"
                disabled={isLoading || !magnetInput.trim()}
                className="btn-emerald text-black font-extrabold text-xs sm:text-sm px-5 py-2.5 rounded-xl flex items-center gap-2 disabled:opacity-40 disabled:pointer-events-none"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-black" />
                    <span>Connecting...</span>
                  </>
                ) : (
                  <>
                    <span>Fetch Video</span>
                    <ArrowRight className="w-4 h-4 stroke-[2.5]" />
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Sub-bar feature pills */}
          <div className="flex items-center justify-between text-xs text-slate-400 px-2 flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <span className="flex h-2 w-2 rounded-full bg-emerald-400"></span>
              <span className="text-slate-300 font-medium">Direct Swarm Ingest</span>
              <span className="text-slate-600">•</span>
              <span className="text-slate-400">HTTP 206 Seeking Enabled</span>
              <span className="text-slate-600 hidden sm:inline">•</span>
              <span className="text-slate-400 hidden sm:inline">Auto Archive Unpack</span>
            </div>

            <div className="text-[11px] text-slate-500 mono-stat hidden md:block">
              Drop .torrent anywhere to import
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
