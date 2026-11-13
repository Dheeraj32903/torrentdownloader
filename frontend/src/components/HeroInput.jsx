import React, { useState, useRef } from 'react';
import { 
  Link2, UploadCloud, Clipboard, Loader2, 
  ArrowRight, X, Sparkles
} from 'lucide-react';

export default function HeroInput({ onAddMagnet, onUploadTorrent, isLoading }) {
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
      <div 
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleFileDrop}
        className={`ui-card p-4 sm:p-5 relative transition-all ${
          dragOver ? 'border-blue-500 bg-blue-50/40 ring-4 ring-blue-500/10' : ''
        }`}
      >
        {/* Command Form */}
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="ui-input flex items-center p-2 sm:p-2.5 gap-2.5 bg-white">
            {/* Left Magnet Icon */}
            <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 shrink-0">
              <Link2 className="w-5 h-5" />
            </div>

            {/* Input field */}
            <input
              type="text"
              value={magnetInput}
              onChange={(e) => setMagnetInput(e.target.value)}
              placeholder="Paste magnet URI (magnet:?xt=urn:btih:...) or drop .torrent file..."
              disabled={isLoading}
              className="w-full bg-transparent text-sm sm:text-base text-slate-900 placeholder-slate-400 focus:outline-none font-sans"
            />

            {/* Quick action buttons inside command bar */}
            <div className="flex items-center gap-1.5 shrink-0">
              {magnetInput && (
                <button
                  type="button"
                  onClick={() => setMagnetInput('')}
                  className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                  title="Clear input"
                >
                  <X className="w-4 h-4" />
                </button>
              )}

              {/* Paste button */}
              <button
                type="button"
                onClick={handlePaste}
                className="btn-secondary px-3 py-2 text-xs text-slate-700 hover:text-slate-900 flex items-center gap-1.5"
                title="Paste from clipboard"
              >
                <Clipboard className="w-3.5 h-3.5 text-blue-600" />
                <span className="hidden sm:inline">Paste</span>
              </button>

              {/* Upload file trigger */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="btn-secondary px-3 py-2 text-xs text-slate-700 hover:text-slate-900 flex items-center gap-1.5"
                title="Upload .torrent file"
              >
                <UploadCloud className="w-3.5 h-3.5 text-slate-600" />
                <span className="hidden sm:inline">.torrent</span>
              </button>

              <input
                ref={fileInputRef}
                type="file"
                accept=".torrent"
                onChange={handleFileChange}
                className="hidden"
              />

              {/* Submit CTA */}
              <button
                type="submit"
                disabled={!magnetInput.trim() || isLoading}
                className="btn-primary px-5 py-2.5 text-xs sm:text-sm flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                    <span>Resolving...</span>
                  </>
                ) : (
                  <>
                    <span>Add Transfer</span>
                    <ArrowRight className="w-3.5 h-3.5 text-blue-100" />
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Subtitle helper info matching Styleguide */}
          <div className="flex items-center justify-between text-xs text-slate-500 px-1 pt-1">
            <span className="flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-blue-600" />
              <span>Zero-waiting HTTP 206 stream prioritizer & multi-tracker DHT engine</span>
            </span>
            <span className="hidden sm:inline text-slate-400">
              Supports .mp4, .mkv, .zip, .rar
            </span>
          </div>
        </form>
      </div>
    </div>
  );
}
