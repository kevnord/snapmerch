import React, { useState, useRef, useCallback } from 'react';
import type { SnapMerchStyle, OrderItem } from '../types';
import { PRODUCT_OPTIONS } from '../types';
import { generateMockup } from '../services/api';

interface ProductSelectorProps {
  styleId: SnapMerchStyle;
  styleImageUrl: string;
  carTitle: string;
  onAddToCart: (item: OrderItem) => void;
  onBack: () => void;
}

const PROGRESS_MESSAGES = [
  'Setting up the photo studio…',
  'Positioning the product…',
  'Applying your design…',
  'Adjusting lighting…',
  'Rendering final mockup…',
  'Almost there…',
];

export default function ProductSelector({ styleId, styleImageUrl, carTitle, onAddToCart, onBack }: ProductSelectorProps) {
  const [selectedProduct, setSelectedProduct] = useState<string>('tshirt');
  const [selectedSize, setSelectedSize] = useState<string>('L');
  const [selectedColor, setSelectedColor] = useState<string>('Black');
  const [mockupStatus, setMockupStatus] = useState<'idle' | 'generating' | 'done' | 'error'>('idle');
  const [mockupUrl, setMockupUrl] = useState<string | null>(null);
  const [mockupError, setMockupError] = useState<string>('');
  const [progressMsg, setProgressMsg] = useState('');
  const [progressPercent, setProgressPercent] = useState(0);
  const progressTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const mockupRef = useRef<HTMLDivElement>(null);

  const product = PRODUCT_OPTIONS.find(p => p.id === selectedProduct)!;
  const selectedColorObj = product.colors?.find(c => c.name === selectedColor);

  const clearProgress = useCallback(() => {
    if (progressTimer.current) {
      clearInterval(progressTimer.current);
      progressTimer.current = null;
    }
  }, []);

  const startProgress = useCallback(() => {
    let step = 0;
    setProgressPercent(0);
    setProgressMsg(PROGRESS_MESSAGES[0]);
    progressTimer.current = setInterval(() => {
      step++;
      const pct = Math.min(90, step * 6);
      setProgressPercent(pct);
      const msgIdx = Math.min(step, PROGRESS_MESSAGES.length - 1);
      setProgressMsg(PROGRESS_MESSAGES[msgIdx]);
    }, 3000);
  }, []);

  const handleGenerateMockup = async () => {
    setMockupStatus('generating');
    setMockupUrl(null);
    setMockupError('');
    startProgress();

    try {
      const url = await generateMockup(styleImageUrl, {
        productType: selectedProduct,
        color: selectedColorObj?.hex || '#000000',
        colorName: selectedColor,
        carDescription: carTitle,
      });
      clearProgress();
      setProgressPercent(100);
      setProgressMsg('Done!');
      setMockupUrl(url);
      setMockupStatus('done');
      // Scroll to mockup
      setTimeout(() => mockupRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 200);
    } catch (err: any) {
      clearProgress();
      setMockupError(err.message || 'Mockup generation failed');
      setMockupStatus('error');
    }
  };

  const handleSaveMockup = () => {
    if (!mockupUrl) return;
    const link = document.createElement('a');
    link.href = mockupUrl;
    link.download = `${carTitle.replace(/\s+/g, '-')}-${selectedProduct}-mockup.jpg`;
    link.click();
  };

  const handleShareMockup = async () => {
    if (!mockupUrl) return;
    try {
      // Convert data URL to blob for sharing
      const res = await fetch(mockupUrl);
      const blob = await res.blob();
      const file = new File([blob], `${carTitle}-mockup.jpg`, { type: 'image/jpeg' });

      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          title: `${carTitle} - ${product.name} Mockup`,
          text: `Check out this custom ${product.name} design!`,
          files: [file],
        });
      } else if (navigator.share) {
        await navigator.share({
          title: `${carTitle} - ${product.name} Mockup`,
          text: `Check out this custom ${product.name} design!`,
        });
      } else {
        // Fallback: copy to clipboard
        await navigator.clipboard.writeText(window.location.href);
        alert('Link copied to clipboard!');
      }
    } catch {
      /* user cancelled */
    }
  };

  const handleAddToCart = () => {
    onAddToCart({
      productId: selectedProduct,
      styleId,
      size: selectedSize,
      color: selectedColor,
      price: product.basePrice,
    });
  };

  const isApparel = selectedProduct === 'tshirt' || selectedProduct === 'hoodie';

  return (
    <div className="animate-fade-in px-4 py-3 space-y-4">
      {/* Back button */}
      <button
        onClick={onBack}
        className="flex items-center gap-1 text-neutral-400 hover:text-white text-sm transition-colors"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        Back to styles
      </button>

      {/* Design preview */}
      <div className="rounded-2xl overflow-hidden bg-surface-elevated border border-surface-border">
        <img src={styleImageUrl} alt="Design" className="w-full aspect-square object-cover" />
      </div>

      {/* Product type selector */}
      <div>
        <h3 className="text-sm font-semibold text-neutral-400 uppercase tracking-wider mb-2">Product</h3>
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
          {PRODUCT_OPTIONS.map(p => (
            <button
              key={p.id}
              onClick={() => {
                setSelectedProduct(p.id);
                if (p.sizes) setSelectedSize(p.sizes[Math.floor(p.sizes.length / 2)]);
                if (p.colors) setSelectedColor(p.colors[0].name);
                // Reset mockup when changing product
                setMockupStatus('idle');
                setMockupUrl(null);
              }}
              className={`flex-shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-xl border transition-all
                ${selectedProduct === p.id
                  ? 'bg-brand/20 border-brand text-white'
                  : 'bg-surface-elevated border-surface-border text-neutral-300 hover:border-brand/40'}`}
            >
              <span className="text-lg">{p.emoji}</span>
              <div className="text-left">
                <div className="text-sm font-semibold">{p.name}</div>
                <div className="text-xs text-neutral-400">${p.basePrice.toFixed(2)}</div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Size selector */}
      {product.sizes && (
        <div>
          <h3 className="text-sm font-semibold text-neutral-400 uppercase tracking-wider mb-2">Size</h3>
          <div className="flex gap-2 flex-wrap">
            {product.sizes.map(size => (
              <button
                key={size}
                onClick={() => setSelectedSize(size)}
                className={`min-w-[48px] px-3 py-2 rounded-lg border text-sm font-semibold transition-all
                  ${selectedSize === size
                    ? 'bg-brand border-brand text-white'
                    : 'bg-surface-elevated border-surface-border text-neutral-300 hover:border-brand/40'}`}
              >
                {size}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Color selector */}
      {product.colors && (
        <div>
          <h3 className="text-sm font-semibold text-neutral-400 uppercase tracking-wider mb-2">Color</h3>
          <div className="flex gap-3 flex-wrap">
            {product.colors.map(color => (
              <button
                key={color.name}
                onClick={() => {
                  setSelectedColor(color.name);
                  // Reset mockup when color changes
                  if (mockupStatus === 'done') {
                    setMockupStatus('idle');
                    setMockupUrl(null);
                  }
                }}
                className={`relative w-10 h-10 rounded-full border-2 transition-all
                  ${selectedColor === color.name
                    ? 'border-brand ring-2 ring-brand/40 scale-110'
                    : 'border-neutral-600 hover:border-neutral-400'}`}
                style={{ backgroundColor: color.hex }}
                title={color.name}
              >
                {selectedColor === color.name && (
                  <svg className={`absolute inset-0 m-auto w-5 h-5 ${color.hex === '#000000' || color.hex === '#001F3F' ? 'text-white' : 'text-black'}`}
                    fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>
            ))}
          </div>
          <p className="text-xs text-neutral-500 mt-1">{selectedColor}</p>
        </div>
      )}

      {/* Generate Mockup Button */}
      <div className="pt-1">
        <button
          onClick={handleGenerateMockup}
          disabled={mockupStatus === 'generating'}
          className={`w-full py-3.5 rounded-2xl font-bold text-base flex items-center justify-center gap-2 transition-all
            ${mockupStatus === 'generating'
              ? 'bg-surface-elevated border border-surface-border text-neutral-400 cursor-wait'
              : 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg shadow-purple-600/30 active:scale-[0.98]'}`}
        >
          {mockupStatus === 'generating' ? (
            <>
              <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <span>Generating Mockup…</span>
            </>
          ) : (
            <>
              <span>🖼️</span>
              <span>{mockupStatus === 'done' ? 'Regenerate Mockup' : 'Generate Mockup'}</span>
            </>
          )}
        </button>

        {/* Progress bar */}
        {mockupStatus === 'generating' && (
          <div className="mt-3 space-y-2">
            <div className="w-full h-2 bg-surface-elevated rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-purple-500 to-indigo-500 rounded-full transition-all duration-1000 ease-out"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <p className="text-xs text-neutral-400 text-center animate-pulse">{progressMsg}</p>
          </div>
        )}
      </div>

      {/* Mockup Result */}
      <div ref={mockupRef}>
        {mockupStatus === 'done' && mockupUrl && (
          <div className="space-y-3 animate-fade-in">
            <h3 className="text-sm font-semibold text-neutral-400 uppercase tracking-wider">AI Mockup Preview</h3>
            <div className="rounded-2xl overflow-hidden bg-surface-elevated border border-surface-border shadow-xl">
              <img
                src={mockupUrl}
                alt={`${product.name} mockup`}
                className="w-full object-cover"
              />
            </div>
            {/* Mockup actions */}
            <div className="flex gap-2">
              <button
                onClick={handleSaveMockup}
                className="flex-1 py-2.5 rounded-xl bg-surface-elevated border border-surface-border text-neutral-300 font-semibold
                  text-sm flex items-center justify-center gap-1.5 active:scale-[0.98] transition-all hover:border-brand/40"
              >
                <span>💾</span> Save
              </button>
              <button
                onClick={handleShareMockup}
                className="flex-1 py-2.5 rounded-xl bg-surface-elevated border border-surface-border text-neutral-300 font-semibold
                  text-sm flex items-center justify-center gap-1.5 active:scale-[0.98] transition-all hover:border-brand/40"
              >
                <span>📤</span> Share
              </button>
            </div>
          </div>
        )}

        {/* Error state */}
        {mockupStatus === 'error' && (
          <div className="rounded-2xl bg-red-500/10 border border-red-500/30 p-4 text-center space-y-2">
            <p className="text-red-400 text-sm font-semibold">⚠️ Mockup generation failed</p>
            <p className="text-red-400/70 text-xs">{mockupError}</p>
            <button
              onClick={handleGenerateMockup}
              className="text-sm text-brand font-semibold underline"
            >
              Try again
            </button>
          </div>
        )}
      </div>

      {/* Add to cart */}
      <button
        onClick={handleAddToCart}
        className="w-full py-4 rounded-2xl bg-gradient-to-r from-brand to-brand-dark text-white font-bold text-lg 
          shadow-lg shadow-brand/30 active:scale-[0.98] transition-all"
      >
        Add to Cart — ${product.basePrice.toFixed(2)}
      </button>
    </div>
  );
}
