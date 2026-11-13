import React, { useState, useRef } from 'react';
import { 
  Link2, UploadCloud, Clipboard, Sparkles, Loader2, 
  ArrowRight, ShieldCheck, Zap, Cpu, X, Radio
} from 'lucide-react';

export default function HeroInput({ onAddMagnet, onUploadTorrent, isLoading }) {
  const [activeTab, setActiveTab] = useState('magnet'); // 'magnet' | 'file'
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
    <div className="relative glass-panel rounded-3xl p-6 sm:p-8 max-w-4xl mx-auto shadow-xl shadow-slate-900/5 border border-slate-200/90 overflow-hidden">
      {/* Ambient background glows */}
      <div className="absolute -top-24 -left-24 w-72 h-72 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-24 -right-24 w-72 h-72 bg-violet-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Tabs & Tech Indicators */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
        <div className="flex bg-slate-100/90 p-1 rounded-2xl border border-slate-200/90 shadow-2xs">
          <button
            type="button"
            onClick={() => setActiveTab('magnet')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all ${
              activeTab === 'magnet'
                ? 'bg-gradient-to-r from-indigo-600 via-indigo-700 to-violet-600 text-white shadow-md shadow-indigo-500/25 scale-[1.02]'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Link2 className="w-4 h-4" />
            <span>Magnet Link</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('file')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all ${
              activeTab === 'file'
                ? 'bg-gradient-to-r from-indigo-600 via-indigo-700 to-violet-600 text-white shadow-md shadow-indigo-500/25 scale-[1.02]'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <UploadCloud className="w-4 h-4" />
            <span>Upload .torrent</span>
          </button>
        </div>

        {/* Feature Highlights */}
        <div className="flex items-center gap-2 text-xs text-slate-600 font-semibold flex-wrap">
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white border border-slate-200/80 shadow-2xs">
            <Radio className="w-3.5 h-3.5 text-indigo-600" />
            <span>74+ Trackers</span>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white border border-slate-200/80 shadow-2xs">
            <Zap className="w-3.5 h-3.5 text-violet-600" />
            <span>HTTP 206 Seeking</span>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white border border-slate-200/80 shadow-2xs">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>Zero Caps</span>
          </div>
        </div>
      </div>

      {/* Tab 1: Magnet Form */}
      {activeTab === 'magnet' && (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative flex items-center">
            <div className="absolute left-4.5 pointer-events-none text-slate-400">
              <Link2 className="w-5 h-5 text-indigo-500" />
            </div>

            <input
              type="text"
              value={magnetInput}
              onChange={(e) => setMagnetInput(e.target.value)}
              placeholder="Paste magnet URI (magnet:?xt=urn:btih:...) to extract files..."
              disabled={isLoading}
              className="w-full glass-input text-slate-900 placeholder-slate-400 text-sm sm:text-base pl-12 sm:pl-13 pr-28 sm:pr-32 py-4 sm:py-4.5 rounded-2xl font-mono text-[13px] sm:text-sm"
            />

            <div className="absolute right-2.5 flex items-center gap-1.5">
              {magnetInput && (
                <button
                  type="button"
                  onClick={() => setMagnetInput('')}
                  className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-all"
                  title="Clear input"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
              <button
                type="button"
                onClick={handlePaste}
                className="px-3 py-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition-all flex items-center gap-1.5 shadow-2xs"
                title="Paste magnet link from clipboard"
              >
                <Clipboard className="w-3.5 h-3.5 text-indigo-600" />
                <span className="hidden sm:inline">Paste</span>
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between flex-wrap gap-3 pt-1">
            <div className="text-xs text-slate-500 flex items-center gap-1.5 font-medium">
              <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
              <span>Connects directly to global DHT routers & BitTorrent swarm</span>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading || !magnetInput.trim()}
              className="glow-btn-indigo text-white font-extrabold text-sm sm:text-base px-7 py-3.5 rounded-2xl flex items-center gap-2.5 disabled:opacity-50 disabled:pointer-events-none transition-all ml-auto shadow-md shadow-indigo-500/25"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Connecting to Swarm...</span>
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4 fill-current" />
                  <span>Extract Swarm</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </form>
      )}

      {/* Tab 2: File Upload */}
      {activeTab === 'file' && (
        <div>
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleFileDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-8 sm:p-12 text-center cursor-pointer transition-all ${
              dragOver
                ? 'border-indigo-500 bg-indigo-50/50 scale-[1.01]'
                : 'border-slate-300 bg-slate-50/70 hover:border-indigo-400 hover:bg-indigo-50/20'
            }`}
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".torrent"
              className="hidden"
            />
            <div className="flex flex-col items-center gap-3">
              <div className="w-14 h-14 rounded-2xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600 shadow-sm">
                <UploadCloud className="w-7 h-7" />
              </div>
              <div className="text-slate-800 font-extrabold text-base">
                Click to browse or drop your <span className="text-indigo-600">.torrent</span> file here
              </div>
              <p className="text-xs text-slate-500 max-w-sm">
                Instant peer discovery, zero byte limits, and streaming enabled automatically upon upload
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
