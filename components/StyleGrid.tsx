import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import type { CarIdentity, GeneratedStyle, SnapMerchStyle, StyleConfig } from '../types';
import { STYLE_CONFIGS } from '../types';
import { tweakDesign } from '../services/api';

// Convert a data URL to a blob URL to reduce memory pressure.
function dataUrlToBlobUrl(dataUrl: string): string | null {
  try {
    if (!dataUrl.startsWith('data:')) return null;
    const [header, data] = dataUrl.split(',');
    const mime = header.match(/data:([^;]+)/)?.[1] || 'image/jpeg';
    const binary = atob(data);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const blob = new Blob([bytes], { type: mime });
    return URL.createObjectURL(blob);
  } catch {
    return null;
  }
}

interface StyleGridProps {
  styles: GeneratedStyle[];
  orderedConfigs: StyleConfig[];    // priority-ordered style configs
  visibleCount: number;             // how many styles are currently visible (4, 8, 12)
  extraVisibleStyles?: Set<SnapMerchStyle>; // styles beyond visibleCount that were explicitly picked
  onSelectStyle: (styleId: SnapMerchStyle) => void;
  selectedStyle: SnapMerchStyle | null;
  generationStartTime?: number;
  onGenerateMore?: () => void;      // callback when user clicks "Generate More"
  onGenerateSelected?: (styleIds: SnapMerchStyle[]) => void; // callback for custom picks
  canGenerateMore?: boolean;        // whether there are more styles to generate
  isGeneratingMore?: boolean;       // whether more styles are currently being generated
  carIdentity?: CarIdentity | null; // car identity for tweak/remix context
  onStyleUpdated?: (styleId: SnapMerchStyle, newImageUrl: string) => void; // callback when a style is tweaked
}

// Fun messages that rotate during generation
const LOADING_MESSAGES = [
  '🎨 Mixing the paints...',
  '✏️ Sketching the lines...',
  '🖌️ Laying down color...',
  '🔥 Adding some heat...',
  '✨ Polishing the details...',
  '🎯 Dialing it in...',
  '💎 Making it shine...',
  '🖼️ Framing the shot...',
];

function LoadingTimer({ startTime }: { startTime: number }) {
  const [elapsed, setElapsed] = useState(0);
  const [msgIndex, setMsgIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime) / 1000));
    }, 100);
    return () => clearInterval(interval);
  }, [startTime]);

  useEffect(() => {
    const interval = setInterval(() => {
      setMsgIndex(i => (i + 1) % LOADING_MESSAGES.length);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const mins = Math.floor(elapsed / 60);
  const secs = elapsed % 60;

  return (
    <div className="flex items-center gap-2 text-xs text-neutral-400">
      <span className="font-mono tabular-nums text-brand font-semibold">
        {mins > 0 ? `${mins}:${secs.toString().padStart(2, '0')}` : `${secs}s`}
      </span>
      <span className="text-neutral-500 transition-all duration-500">{LOADING_MESSAGES[msgIndex]}</span>
    </div>
  );
}

function StyleLoadingCard({ config, index }: { config: StyleConfig; index: number }) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress(p => {
        if (p >= 90) return p + 0.1;
        if (p >= 70) return p + 0.3;
        if (p >= 50) return p + 0.5;
        return p + 1;
      });
    }, 200);
    return () => clearInterval(interval);
  }, []);

  const accentColor = config.backgroundColor === '#000000' || config.backgroundColor === '#1a0033' || config.backgroundColor === '#003366'
    ? '#a855f7' : '#d97706';

  return (
    <div className="relative aspect-square rounded-2xl overflow-hidden border-2 border-surface-border">
      <div className="absolute inset-0 bg-surface-elevated overflow-hidden">
        <div
          className="absolute inset-y-0 w-1/3 opacity-20"
          style={{
            background: `linear-gradient(90deg, transparent, ${accentColor}40, transparent)`,
            animation: `brush-sweep ${2 + index * 0.3}s ease-in-out infinite`,
            animationDelay: `${index * 0.5}s`,
          }}
        />
        {[0, 1, 2].map(col => (
          <div
            key={col}
            className="absolute bottom-0 w-1/3 opacity-10"
            style={{
              left: `${col * 33}%`,
              background: `linear-gradient(to top, ${accentColor}, transparent)`,
              animation: `paint-drip ${3 + col}s ease-in-out infinite`,
              animationDelay: `${index * 0.5 + col * 0.8}s`,
            }}
          />
        ))}
      </div>

      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 z-10">
        <div className="relative">
          <span className="text-3xl block animate-pulse">{config.emoji}</span>
          <svg className="absolute -inset-2 w-[calc(100%+16px)] h-[calc(100%+16px)] animate-spin" style={{ animationDuration: '3s' }} viewBox="0 0 50 50">
            <circle cx="25" cy="25" r="20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeDasharray="15 85" className="text-brand/40" />
          </svg>
        </div>
        <div className="w-2/3 h-1 bg-surface-border rounded-full overflow-hidden mt-1">
          <div
            className="h-full bg-gradient-to-r from-brand to-brand-light rounded-full progress-bar-glow transition-all duration-300 ease-out"
            style={{ width: `${Math.min(progress, 95)}%` }}
          />
        </div>
      </div>

      <div className="absolute bottom-0 left-0 right-0 px-2 py-1.5 bg-gradient-to-t from-black/80 to-transparent z-10">
        <div className="flex items-center gap-1.5">
          <span className="text-sm">{config.emoji}</span>
          <span className="text-white text-xs font-semibold">{config.label}</span>
        </div>
      </div>
    </div>
  );
}

// ── Style Picker (Choose Your Own) ──────────────────────────────────────

interface StylePickerProps {
  allConfigs: StyleConfig[];
  styles: GeneratedStyle[];
  onGenerate: (styleIds: SnapMerchStyle[]) => void;
  onClose: () => void;
  anyGenerating: boolean;
}

function StylePicker({ allConfigs, styles, onGenerate, onClose, anyGenerating }: StylePickerProps) {
  const [picked, setPicked] = useState<Set<SnapMerchStyle>>(new Set());

  const toggle = (id: SnapMerchStyle) => {
    setPicked(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const pickedCount = picked.size;

  return (
    <div className="mt-3 bg-surface-card border border-surface-border rounded-2xl p-3 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-neutral-300 flex items-center gap-1.5">
          <span>🎨</span> Pick Your Styles
        </h4>
        <button
          onClick={onClose}
          className="text-neutral-500 hover:text-neutral-300 text-xs font-medium px-2 py-1 rounded-lg
            hover:bg-surface-elevated transition-colors"
        >
          ✕ Close
        </button>
      </div>

      {/* 3-column compact grid */}
      <div className="grid grid-cols-3 gap-2">
        {allConfigs.map(config => {
          const gen = styles.find(s => s.styleId === config.id);
          const alreadyDone = gen?.status === 'done';
          const isGenerating = gen?.status === 'generating';
          const isError = gen?.status === 'error';
          const isPicked = picked.has(config.id);
          // Can pick if not already done and not currently generating
          const canPick = !alreadyDone && !isGenerating;

          return (
            <button
              key={config.id}
              onClick={() => canPick && toggle(config.id)}
              disabled={!canPick}
              className={`
                relative flex flex-col items-center justify-center gap-1 py-2.5 px-1 rounded-xl
                border-2 transition-all duration-150
                ${alreadyDone
                  ? 'border-emerald-500/40 bg-emerald-500/10 opacity-60 cursor-default'
                  : isGenerating
                    ? 'border-brand/40 bg-brand/10 opacity-60 cursor-default'
                    : isPicked
                      ? 'border-brand bg-brand/15 scale-[1.03] shadow-md shadow-brand/20'
                      : isError
                        ? 'border-red-500/30 bg-red-500/5 hover:border-red-400/50'
                        : 'border-surface-border bg-surface-elevated hover:border-neutral-500 active:scale-95'}
              `}
            >
              <span className="text-xl leading-none">{config.emoji}</span>
              <span className={`text-[10px] font-semibold leading-tight text-center ${
                alreadyDone ? 'text-emerald-400' :
                isPicked ? 'text-brand-light' :
                'text-neutral-400'
              }`}>
                {config.label}
              </span>

              {/* Already generated badge */}
              {alreadyDone && (
                <div className="absolute top-1 right-1 w-4 h-4 bg-emerald-500 rounded-full flex items-center justify-center">
                  <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              )}

              {/* Currently generating spinner */}
              {isGenerating && (
                <div className="absolute top-1 right-1 w-4 h-4">
                  <svg className="w-4 h-4 animate-spin text-brand" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                </div>
              )}

              {/* Selected checkmark */}
              {isPicked && !alreadyDone && (
                <div className="absolute top-1 right-1 w-4 h-4 bg-brand rounded-full flex items-center justify-center shadow shadow-brand/40">
                  <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              )}

              {/* Error indicator */}
              {isError && !isPicked && (
                <div className="absolute top-1 right-1 w-4 h-4 bg-red-500/80 rounded-full flex items-center justify-center">
                  <span className="text-[8px] text-white font-bold">!</span>
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Generate button */}
      <button
        onClick={() => pickedCount > 0 && onGenerate(Array.from(picked))}
        disabled={pickedCount === 0 || anyGenerating}
        className={`
          w-full py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all
          ${pickedCount > 0 && !anyGenerating
            ? 'bg-brand text-white shadow-lg shadow-brand/30 active:scale-[0.98]'
            : 'bg-surface-elevated text-neutral-600 cursor-not-allowed'}
        `}
      >
        {anyGenerating ? (
          <>
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Generating...
          </>
        ) : (
          <>
            <span>🚀</span>
            {pickedCount > 0
              ? `Generate Selected (${pickedCount})`
              : 'Tap styles to select'}
          </>
        )}
      </button>
    </div>
  );
}

// ── Tweak Panel (slide-up overlay) ──────────────────────────────────────

interface TweakPanelProps {
  style: GeneratedStyle;
  config: StyleConfig;
  imageUrl: string;         // display URL (may be blob for memory efficiency)
  originalUrl?: string;     // original data URL for API calls
  carIdentity?: CarIdentity | null;
  onClose: () => void;
  onTweakComplete: (styleId: SnapMerchStyle, newImageUrl: string) => void;
}

function TweakPanel({ style, config, imageUrl, originalUrl, carIdentity, onClose, onTweakComplete }: TweakPanelProps) {
  const [tweakPrompt, setTweakPrompt] = useState('');
  const [isRemixing, setIsRemixing] = useState(false);
  const [showTweakInput, setShowTweakInput] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when tweak input is shown
  useEffect(() => {
    if (showTweakInput) {
      const timer = setTimeout(() => inputRef.current?.focus(), 200);
      return () => clearTimeout(timer);
    }
  }, [showTweakInput]);

  // Close on backdrop tap
  const handleBackdropClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget && !isRemixing) onClose();
  }, [onClose, isRemixing]);

  const handleRemix = async () => {
    if (!tweakPrompt.trim() || isRemixing) return;
    setIsRemixing(true);
    setError(null);

    try {
      const carDetails: Record<string, any> = {
        artStyle: config.artStyle,
        view: '3/4 Front',
        backgroundColor: config.backgroundColor || '#FFFFFF',
        color: carIdentity?.color?.hex || '#003366',
      };
      if (carIdentity) {
        carDetails.year = carIdentity.year;
        carDetails.make = carIdentity.make;
        carDetails.model = carIdentity.model;
        carDetails.trim = carIdentity.trim;
      }

      // Use original data URL for API call (blob URLs may fail in fetch)
      const newImageUrl = await tweakDesign(originalUrl || imageUrl, tweakPrompt.trim(), carDetails);
      onTweakComplete(style.styleId, newImageUrl);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Remix failed — try again');
      setIsRemixing(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm animate-fadeIn"
      onClick={handleBackdropClick}
    >
      <div
        ref={panelRef}
        className="w-full max-w-lg bg-surface-card rounded-t-3xl shadow-2xl border-t border-surface-border
          animate-slideUp overflow-hidden"
        style={{ maxHeight: '85vh' }}
      >
        {/* Handle bar */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-neutral-600" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-4 pb-2">
          <h3 className="text-sm font-bold text-neutral-200 flex items-center gap-1.5">
            <span>{config.emoji}</span>
            <span>{config.label}</span>
          </h3>
          <button
            onClick={() => !isRemixing && onClose()}
            disabled={isRemixing}
            className="text-neutral-500 hover:text-neutral-300 text-xs font-medium px-2 py-1 rounded-lg
              hover:bg-surface-elevated transition-colors disabled:opacity-40"
          >
            ✕
          </button>
        </div>

        {/* Large design preview */}
        <div className="px-4 pb-3">
          <div className="relative aspect-square rounded-2xl overflow-hidden border border-surface-border">
            <img
              src={imageUrl}
              alt={config.label}
              className={`w-full h-full object-cover transition-opacity duration-300 ${isRemixing ? 'opacity-40' : ''}`}
            />
            {isRemixing && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                <svg className="w-10 h-10 animate-spin text-brand" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <span className="text-brand-light text-sm font-semibold animate-pulse">Remixing...</span>
              </div>
            )}
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div className="px-4 pb-2">
            <p className="text-red-400 text-xs bg-red-500/10 rounded-xl px-3 py-2 border border-red-500/20">
              ⚠️ {error}
            </p>
          </div>
        )}

        {/* Action buttons */}
        <div className="px-4 pb-3 space-y-2">
          {/* Use this design — primary action */}
          <button
            onClick={() => {
              if (!isRemixing) {
                onTweakComplete(style.styleId, imageUrl);
                onClose();
              }
            }}
            disabled={isRemixing}
            className="w-full py-3.5 rounded-xl bg-emerald-600 text-white font-bold text-sm
              flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20
              active:scale-[0.98] transition-all disabled:opacity-40"
          >
            <span>✅</span> Use This Design
          </button>

          {/* Tweak toggle — collapsed by default */}
          {!showTweakInput && !isRemixing && (
            <button
              onClick={() => setShowTweakInput(true)}
              className="w-full py-2.5 rounded-xl bg-surface-elevated border border-surface-border
                text-neutral-400 font-medium text-sm flex items-center justify-center gap-1.5
                hover:border-brand/40 hover:text-neutral-300 active:scale-[0.98] transition-all"
            >
              <span>🎛️</span> Tweak This Design
            </button>
          )}

          {/* Tweak input + remix button — shown when user requests it */}
          {showTweakInput && (
            <div className="flex gap-2 animate-fade-in">
              <input
                ref={inputRef}
                type="text"
                value={tweakPrompt}
                onChange={e => setTweakPrompt(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleRemix()}
                placeholder="e.g. Make it red, add flames..."
                disabled={isRemixing}
                className="flex-1 px-4 py-3 rounded-xl bg-surface-elevated border border-surface-border
                  text-neutral-200 text-sm placeholder-neutral-500
                  focus:outline-none focus:border-brand/60 focus:ring-1 focus:ring-brand/30
                  disabled:opacity-50 transition-all"
              />
              <button
                onClick={handleRemix}
                disabled={!tweakPrompt.trim() || isRemixing}
                className={`px-5 py-3 rounded-xl font-bold text-sm flex items-center gap-1.5 transition-all whitespace-nowrap
                  ${tweakPrompt.trim() && !isRemixing
                    ? 'bg-brand text-white shadow-lg shadow-brand/30 active:scale-[0.97]'
                    : 'bg-surface-elevated text-neutral-600 cursor-not-allowed'}`}
              >
                {isRemixing ? (
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                ) : (
                  <span>🎛️</span>
                )}
                Remix
              </button>
            </div>
          )}
        </div>

        {/* Bottom padding */}
        <div className="pb-3" />
      </div>

      {/* Animations */}
      <style>{`
        @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes slideUp { from { transform: translateY(100%) } to { transform: translateY(0) } }
        .animate-fadeIn { animation: fadeIn 0.2s ease-out; }
        .animate-slideUp { animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1); }
      `}</style>
    </div>
  );
}

// ── Main StyleGrid Component ────────────────────────────────────────────

export default function StyleGrid({
  styles,
  orderedConfigs,
  visibleCount,
  extraVisibleStyles,
  onSelectStyle,
  selectedStyle,
  generationStartTime,
  onGenerateMore,
  onGenerateSelected,
  canGenerateMore,
  isGeneratingMore,
  carIdentity,
  onStyleUpdated,
}: StyleGridProps) {
  const [showPicker, setShowPicker] = useState(false);
  const [tweakStyleId, setTweakStyleId] = useState<SnapMerchStyle | null>(null);

  // Show styles from the visible window PLUS any explicitly picked extras
  const baseConfigs = orderedConfigs.slice(0, visibleCount);
  const extraConfigs = extraVisibleStyles
    ? orderedConfigs.filter(c => extraVisibleStyles.has(c.id) && !baseConfigs.some(b => b.id === c.id))
    : [];
  const visibleConfigs = [...baseConfigs, ...extraConfigs];
  const anyLoading = styles.some(s => s.status === 'generating');
  const visibleStyles = styles.filter(s => visibleConfigs.some(c => c.id === s.styleId));
  const doneCount = visibleStyles.filter(s => s.status === 'done').length;
  const generatingCount = visibleStyles.filter(s => s.status === 'generating').length;
  const totalVisible = visibleConfigs.length;

  // Are there any styles left that haven't been generated yet?
  const hasUngeneratedStyles = STYLE_CONFIGS.some(c => {
    const s = styles.find(st => st.styleId === c.id);
    return !s || s.status === 'idle' || s.status === 'error';
  });

  // Convert data URLs to blob URLs to reduce JS heap memory pressure.
  const blobUrlsRef = useRef<Map<string, string>>(new Map());
  const blobUrls = useMemo(() => {
    const newMap = new Map<string, string>();
    styles.forEach(s => {
      if (s.status === 'done' && s.imageUrl) {
        const existing = blobUrlsRef.current.get(s.styleId);
        if (existing) {
          newMap.set(s.styleId, existing);
        } else {
          const blobUrl = dataUrlToBlobUrl(s.imageUrl);
          if (blobUrl) {
            newMap.set(s.styleId, blobUrl);
          }
        }
      }
    });
    blobUrlsRef.current.forEach((url, key) => {
      if (!newMap.has(key)) {
        URL.revokeObjectURL(url);
      }
    });
    blobUrlsRef.current = newMap;
    return newMap;
  }, [styles]);

  useEffect(() => {
    return () => {
      blobUrlsRef.current.forEach(url => URL.revokeObjectURL(url));
      blobUrlsRef.current.clear();
    };
  }, []);

  // Check if initial batch (first 4) is done generating
  const initialBatchDone = orderedConfigs.slice(0, 4).every(c => {
    const s = styles.find(st => st.styleId === c.id);
    return s && (s.status === 'done' || s.status === 'error');
  });

  // Close picker when generation starts (styles start appearing)
  useEffect(() => {
    if (anyLoading && showPicker) {
      setShowPicker(false);
    }
  }, [anyLoading]);

  const handlePickerGenerate = (styleIds: SnapMerchStyle[]) => {
    setShowPicker(false);
    onGenerateSelected?.(styleIds);
  };

  // Show the bottom action area when initial batch is done and not in order flow
  const showActions = initialBatchDone && !anyLoading && (canGenerateMore || hasUngeneratedStyles);

  return (
    <div className="px-4 py-3">
      {/* Header with timer */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-neutral-400 uppercase tracking-wider">
          Choose Your Style
        </h3>
        {anyLoading && generationStartTime && (
          <LoadingTimer startTime={generationStartTime} />
        )}
      </div>

      {/* Overall progress when generating */}
      {(anyLoading || generatingCount > 0) && (
        <div className="mb-3 space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-neutral-400">{doneCount}/{totalVisible} styles ready</span>
            <span className="text-brand font-medium">{Math.round((doneCount / totalVisible) * 100)}%</span>
          </div>
          <div className="w-full h-1.5 bg-surface-border rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-brand via-electric to-brand rounded-full progress-bar-glow transition-all duration-700 ease-out"
              style={{ width: `${(doneCount / totalVisible) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Main results grid */}
      <div className="grid grid-cols-2 gap-3">
        {visibleConfigs.map((config, index) => {
          const generated = styles.find(s => s.styleId === config.id);
          const isSelected = selectedStyle === config.id;
          const isReady = generated?.status === 'done';
          const isLoading = generated?.status === 'generating';
          const hasError = generated?.status === 'error';

          if (isLoading) {
            return <StyleLoadingCard key={config.id} config={config} index={index} />;
          }

          return (
            <button
              key={config.id}
              onClick={() => {
                if (!isReady) return;
                // Single tap opens tweak panel; if already selected, go straight to select
                if (isSelected) {
                  onSelectStyle(config.id);
                } else {
                  setTweakStyleId(config.id);
                }
              }}
              disabled={!isReady}
              className={`
                relative aspect-square rounded-2xl overflow-hidden
                border-2 transition-all duration-200
                ${isSelected
                  ? 'border-brand ring-2 ring-brand/30 scale-[1.02]'
                  : isReady
                    ? 'border-surface-border hover:border-brand/50 active:scale-95'
                    : 'border-surface-border'}
              `}
            >
              {isReady && generated?.imageUrl ? (
                <img
                  src={blobUrls.get(config.id) || generated.imageUrl}
                  alt={config.label}
                  loading="lazy"
                  decoding="async"
                  className="w-full h-full object-cover art-reveal"
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center gap-2 bg-surface-elevated">
                  {hasError ? (
                    <>
                      <span className="text-2xl">⚠️</span>
                      <span className="text-red-400 text-xs">Failed</span>
                    </>
                  ) : (
                    <>
                      <span className="text-3xl opacity-40">{config.emoji}</span>
                      <span className="text-neutral-600 text-xs">Waiting...</span>
                    </>
                  )}
                </div>
              )}

              <div className="absolute bottom-0 left-0 right-0 px-2 py-1.5 bg-gradient-to-t from-black/80 to-transparent">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm">{config.emoji}</span>
                  <span className="text-white text-xs font-semibold">{config.label}</span>
                </div>
              </div>

              {/* Tweak hint badge on ready styles */}
              {isReady && !isSelected && (
                <div className="absolute top-2 right-2 w-6 h-6 bg-surface-card/80 backdrop-blur rounded-full flex items-center justify-center border border-surface-border">
                  <span className="text-[10px]">🎛️</span>
                </div>
              )}

              {isSelected && (
                <div className="absolute top-2 right-2 w-6 h-6 bg-brand rounded-full flex items-center justify-center shadow-lg shadow-brand/30">
                  <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Action buttons: Generate More + Choose Your Own */}
      {showActions && !showPicker && (
        <div className="flex gap-2 mt-4">
          {/* Generate More (auto next batch) */}
          {canGenerateMore && (
            <button
              onClick={onGenerateMore}
              className="flex-1 py-2.5 rounded-xl bg-surface-card border-2 border-dashed border-surface-border
                text-neutral-300 font-semibold text-xs flex items-center justify-center gap-1.5
                hover:border-brand/50 hover:text-brand-light active:scale-[0.98] transition-all"
            >
              <span className="text-base">✨</span>
              <span>More Styles</span>
              <span className="text-[10px] text-neutral-500">
                +{Math.min(4, orderedConfigs.length - visibleCount)}
              </span>
            </button>
          )}

          {/* Choose Your Own */}
          {hasUngeneratedStyles && onGenerateSelected && (
            <button
              onClick={() => setShowPicker(true)}
              className="flex-1 py-2.5 rounded-xl bg-surface-card border-2 border-surface-border
                text-neutral-300 font-semibold text-xs flex items-center justify-center gap-1.5
                hover:border-electric/50 hover:text-electric active:scale-[0.98] transition-all"
            >
              <span className="text-base">🎨</span>
              <span>Choose Your Own</span>
            </button>
          )}
        </div>
      )}

      {/* Style Picker panel */}
      {showPicker && onGenerateSelected && (
        <StylePicker
          allConfigs={orderedConfigs}
          styles={styles}
          onGenerate={handlePickerGenerate}
          onClose={() => setShowPicker(false)}
          anyGenerating={anyLoading}
        />
      )}

      {/* Tweak Panel (slide-up) */}
      {tweakStyleId && (() => {
        const tweakStyle = styles.find(s => s.styleId === tweakStyleId);
        const tweakConfig = orderedConfigs.find(c => c.id === tweakStyleId);
        // Use blob URL for display, but keep original data URL for API calls
        const tweakDisplayUrl = blobUrls.get(tweakStyleId) || tweakStyle?.imageUrl;
        const tweakOriginalUrl = tweakStyle?.imageUrl; // always the data URL
        if (!tweakStyle || !tweakConfig || !tweakDisplayUrl) return null;
        return (
          <TweakPanel
            style={tweakStyle}
            config={tweakConfig}
            imageUrl={tweakDisplayUrl}
            originalUrl={tweakOriginalUrl || undefined}
            carIdentity={carIdentity}
            onClose={() => setTweakStyleId(null)}
            onTweakComplete={(styleId, newImageUrl) => {
              // Only update parent if the image actually changed (remix happened).
              // If user just clicked "Use This Design" without remixing, newImageUrl
              // is the display blob URL — DON'T overwrite the original data URL with it.
              if (newImageUrl.startsWith('data:')) {
                onStyleUpdated?.(styleId, newImageUrl);
              }
              // Select the style for product/mockup flow
              onSelectStyle(styleId);
            }}
          />
        );
      })()}
    </div>
  );
}
