import React, { useRef, useState, useCallback } from 'react';

interface CameraCaptureProps {
  onCapture: (base64Image: string) => void;
  isProcessing: boolean;
}

export default function CameraCapture({ onCapture, isProcessing }: CameraCaptureProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const processFile = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      if (result) onCapture(result);
    };
    reader.readAsDataURL(file);
  }, [onCapture]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }, [processFile]);

  return (
    <div className="flex flex-col items-center gap-6 px-4 pt-8 pb-4">
      {/* Hero text */}
      <div className="text-center">
        <h1 className="text-3xl font-black tracking-tight">
          <span className="text-brand">Snap</span>
          <span className="text-white">Merch</span>
        </h1>
        <p className="text-neutral-400 text-sm mt-1">Snap a car. Make merch. 60 seconds.</p>
      </div>

      {/* Big camera button */}
      <div
        className={`relative transition-all duration-300 ${isProcessing ? 'scale-95 opacity-70' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
      >
        <button
          onClick={() => cameraInputRef.current?.click()}
          disabled={isProcessing}
          className={`
            w-40 h-40 rounded-full 
            bg-gradient-to-br from-brand to-brand-dark
            flex flex-col items-center justify-center gap-2
            shadow-lg shadow-brand/30
            active:scale-95 transition-all duration-150
            ${isProcessing ? 'animate-pulse' : 'animate-pulse-glow'}
            ${dragOver ? 'ring-4 ring-electric scale-105' : ''}
          `}
        >
          {isProcessing ? (
            <div className="flex flex-col items-center gap-2">
              <svg className="w-10 h-10 text-white animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <span className="text-white/80 text-xs font-semibold">Analyzing...</span>
            </div>
          ) : (
            <>
              <svg className="w-14 h-14 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <circle cx="12" cy="13" r="3" />
              </svg>
              <span className="text-white font-bold text-sm">TAP TO SNAP</span>
            </>
          )}
        </button>
        {/* Outer ring */}
        <div className="absolute inset-0 -m-2 rounded-full border-2 border-brand/30 pointer-events-none" />
      </div>

      {/* Alternative: upload from library */}
      <button
        onClick={() => fileInputRef.current?.click()}
        disabled={isProcessing}
        className="flex items-center gap-2 px-6 py-3 rounded-xl bg-surface-elevated border border-surface-border text-neutral-300 hover:text-white hover:border-brand/50 transition-all active:scale-95"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        <span className="font-medium text-sm">Upload from Library</span>
      </button>

      {/* Hidden inputs */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) processFile(file);
          e.target.value = '';
        }}
      />
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) processFile(file);
          e.target.value = '';
        }}
      />

      {/* Tips */}
      <div className="text-center text-neutral-500 text-xs max-w-xs space-y-1">
        <p>📸 Best results: 3/4 front angle, good lighting</p>
        <p>🚗 Works with any car — classics, exotics, JDM, muscle</p>
      </div>
    </div>
  );
}
