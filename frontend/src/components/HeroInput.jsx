import React, { useState, useRef } from 'react';
import { 
  Link2, UploadCloud, Clipboard, Loader2, 
  ArrowRight, X, Plus
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
    <div className="relative max-w-[1200px] mx-auto px-4 w-full font-mono">
      <form 
        onSubmit={handleSubmit}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleFileDrop}
        className={`ui-card p-2 sm:p-2.5 transition-all flex items-center gap-2 ${
          dragOver ? 'border-[#0066FF] bg-[#EBF2FF]/30 shadow-[0_0_0_3px_#B8D0FF]' : ''
        }`}
      >
        {/* Left Link Icon */}
        <div className="w-9 h-9 rounded-xl bg-[#EBF2FF] text-[#0066FF] border border-[#B8D0FF] flex items-center justify-center shrink-0 ml-1">
          <Link2 className="w-4 h-4" />
        </div>

        {/* Text Input */}
        <input
          type="text"
          value={magnetInput}
          onChange={(e) => setMagnetInput(e.target.value)}
          placeholder="[ Paste magnet URI (magnet:?xt=...) or drop .torrent ]"
          disabled={isLoading}
          className="w-full bg-transparent text-xs sm:text-sm text-[#0D0F1C] placeholder-[#8F9CAE] focus:outline-none px-2 font-mono"
        />

        {/* Action Buttons */}
        <div className="flex items-center gap-1.5 shrink-0 pr-1">
          {magnetInput && (
            <button
              type="button"
              onClick={() => setMagnetInput('')}
              className="p-1.5 text-[#646E82] hover:bg-slate-100 rounded-lg transition-colors"
              title="Clear"
            >
              <X className="w-4 h-4" />
            </button>
          )}

          <button
            type="button"
            onClick={handlePaste}
            className="btn-secondary px-3.5 py-2 text-xs flex items-center gap-1.5 hidden sm:flex"
            title="Paste from clipboard"
          >
            <Clipboard className="w-3.5 h-3.5 text-[#646E82]" />
            <span>[ PASTE ]</span>
          </button>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="btn-secondary px-3.5 py-2 text-xs flex items-center gap-1.5"
            title="Upload .torrent file"
          >
            <UploadCloud className="w-3.5 h-3.5 text-[#646E82]" />
            <span className="hidden sm:inline">[ .TORRENT ]</span>
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
            className="btn-primary px-4 sm:px-5 py-2 text-xs sm:text-sm flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
                <span>[ ADDING... ]</span>
              </>
            ) : (
              <>
                <Plus className="w-3.5 h-3.5 text-white" />
                <span>[ + ADD ]</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
