import React, { useState, useRef } from 'react';
import { 
  Link2, UploadCloud, Clipboard, Loader2, 
  X, Plus, Zap
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
        className={`bg-white border rounded-2xl p-2 sm:p-2.5 transition-all flex items-center gap-2 shadow-sm focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-blue-500/15 ${
          dragOver 
            ? 'border-blue-500 bg-blue-50/50 ring-4 ring-blue-500/15' 
            : 'border-slate-200/90 hover:border-slate-300'
        }`}
      >
        {/* Left Link Icon */}
        <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 border border-blue-100 flex items-center justify-center shrink-0 ml-1">
          <Link2 className="w-4 h-4" />
        </div>

        {/* Text Input with Human-Friendly Placeholder */}
        <input
          type="text"
          value={magnetInput}
          onChange={(e) => setMagnetInput(e.target.value)}
          placeholder="Paste magnet URI (magnet:?xt=...) or drop .torrent file..."
          disabled={isLoading}
          className="w-full bg-transparent text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none px-3 font-sans"
        />

        {/* Action Buttons */}
        <div className="flex items-center gap-1.5 shrink-0 pr-1">
          {magnetInput && (
            <button
              type="button"
              onClick={() => setMagnetInput('')}
              className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              title="Clear input"
            >
              <X className="w-4 h-4" />
            </button>
          )}

          <button
            type="button"
            onClick={handlePaste}
            className="btn-secondary text-xs py-2 px-3 hidden sm:inline-flex"
            title="Paste from clipboard (Ctrl+V)"
          >
            <Clipboard className="w-3.5 h-3.5 text-slate-500" />
            <span>Paste</span>
          </button>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="btn-secondary text-xs py-2 px-3"
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
            className="btn-primary text-xs sm:text-sm py-2 px-4 sm:px-5 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-white" />
                <span>Adding...</span>
              </>
            ) : (
              <>
                <Plus className="w-4 h-4 text-white" />
                <span>Add Torrent</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
