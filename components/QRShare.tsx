import React, { useEffect, useState, useRef } from 'react';
import QRCode from 'qrcode';

interface QRShareProps {
  carSessionId: string;
  carTitle: string;
  onClose: () => void;
}

export default function QRShare({ carSessionId, carTitle, onClose }: QRShareProps) {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const shareUrl = `${window.location.origin}${window.location.pathname}#/car/${carSessionId}`;

  useEffect(() => {
    QRCode.toDataURL(shareUrl, {
      width: 400,
      margin: 2,
      color: { dark: '#000000', light: '#FFFFFF' },
      errorCorrectionLevel: 'M',
    }).then(setQrDataUrl).catch(console.error);
  }, [shareUrl]);

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Custom ${carTitle} Merch`,
          text: `Check out this custom art of my ${carTitle}! Get it on a shirt, mug, or canvas.`,
          url: shareUrl,
        });
      } catch { /* user cancelled */ }
    } else {
      await navigator.clipboard.writeText(shareUrl);
      alert('Link copied to clipboard!');
    }
  };

  const handleCopyLink = async () => {
    await navigator.clipboard.writeText(shareUrl);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}>
      <div className="bg-surface-card border border-surface-border rounded-3xl p-6 max-w-sm w-full animate-slide-up space-y-4"
        onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="text-center">
          <h2 className="text-white font-bold text-xl">Share with Customer</h2>
          <p className="text-neutral-400 text-sm mt-1">They scan → they shop → you earn 💰</p>
        </div>

        {/* QR Code */}
        <div className="flex justify-center">
          <div className="bg-white p-4 rounded-2xl">
            {qrDataUrl ? (
              <img src={qrDataUrl} alt="QR Code" className="w-56 h-56" />
            ) : (
              <div className="w-56 h-56 shimmer rounded" />
            )}
          </div>
        </div>

        {/* Car title */}
        <p className="text-center text-brand font-semibold">{carTitle}</p>

        {/* URL display */}
        <div className="flex items-center gap-2 bg-surface-elevated rounded-xl px-3 py-2 border border-surface-border">
          <span className="text-neutral-400 text-xs truncate flex-1 font-mono">{shareUrl}</span>
          <button
            onClick={handleCopyLink}
            className="flex-shrink-0 text-brand hover:text-brand-light text-xs font-semibold"
          >
            Copy
          </button>
        </div>

        {/* Action buttons */}
        <div className="flex gap-3">
          <button
            onClick={handleShare}
            className="flex-1 py-3 rounded-xl bg-brand text-white font-bold active:scale-95 transition-all"
          >
            📤 Share Link
          </button>
          <button
            onClick={onClose}
            className="px-4 py-3 rounded-xl bg-surface-elevated border border-surface-border text-neutral-300 font-semibold active:scale-95 transition-all"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
