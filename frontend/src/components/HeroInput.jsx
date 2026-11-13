import React, { useState, useRef } from 'react';
import { 
  Link2, UploadCloud, Clipboard, Loader2, 
  ArrowRight, X, Sparkles, Plus
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
      <form 
        onSubmit={handleSubmit}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleFileDrop}
        className={`ui-card p-2 sm:p-2.5 transition-all flex items-center gap-2 ${
          dragOver ? 'border-[#0e52ff] bg-blue-50/30 ring-4 ring-[#0e52ff]/10' : ''
        }`}
      >
        {/* Left Link Icon */}
        <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-[#0e52ff] shrink-0 ml-1">
          <Link2 className="w-5 h-5" />
        </div>

        {/* Text Input */}
        <input
          type="text"
          value={magnetInput}
          onChange={(e) => setMagnetInput(e.target.value)}
          placeholder="Paste magnet link (magnet:?xt=...) or drop .torrent here..."
          disabled={isLoading}
          className="w-full bg-transparent text-sm sm:text-base text-slate-900 placeholder-slate-400 focus:outline-none px-2"
        />

        {/* Action Buttons on Right */}
        <div className="flex items-center gap-1.5 shrink-0 pr-1">
          {magnetInput && (
            <button
              type="button"
              onClick={() => setMagnetInput('')}
              className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
              title="Clear"
            >
              <X className="w-4 h-4" />
            </button>
          )}

          <button
            type="button"
            onClick={handlePaste}
            className="btn-secondary px-3 py-2 text-xs text-slate-700 hover:text-slate-900 flex items-center gap-1.5 hidden sm:flex"
            title="Paste from clipboard"
          >
            <Clipboard className="w-3.5 h-3.5 text-slate-500" />
            <span>Paste</span>
          </button>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="btn-secondary px-3 py-2 text-xs text-slate-700 hover:text-slate-900 flex items-center gap-1.5"
            title="Upload .torrent file"
          >
            <UploadCloud className="w-3.5 h-3.5 text-slate-500" />
            <span className="hidden sm:inline">.torrent</span>
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept=".torrent"
            onChange={handleFileChange}
            className="hidden"
          />

          <button
            type="submit"
            disabled={!magnetInput.trim() || isLoading}
            className="btn-primary px-4 sm:px-5 py-2.5 text-xs sm:text-sm flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-white" />
                <span>Resolving...</span>
              </>
            ) : (
              <>
                <span>Add Link</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
