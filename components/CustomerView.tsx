import React, { useState, useEffect, useMemo } from 'react';
import type { CarSession, SnapMerchStyle, OrderItem, Order } from '../types';
import { STYLE_CONFIGS, PRODUCT_OPTIONS } from '../types';
import { getCarSession, saveOrder, generateId } from '../services/storage';
import { getPrioritizedStyles } from '../services/stylePriority';
import StyleGrid from './StyleGrid';
import ProductSelector from './ProductSelector';
import OrderForm from './OrderForm';

interface CustomerViewProps {
  carSessionId: string;
}

export default function CustomerView({ carSessionId }: CustomerViewProps) {
  const [car, setCar] = useState<CarSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedStyle, setSelectedStyle] = useState<SnapMerchStyle | null>(null);
  const [cart, setCart] = useState<OrderItem[]>([]);
  const [showOrderForm, setShowOrderForm] = useState(false);

  useEffect(() => {
    const carData = getCarSession(carSessionId);
    setCar(carData);
    setLoading(false);
  }, [carSessionId]);

  const carTitle = car?.identity
    ? `${car.identity.year} ${car.identity.make} ${car.identity.model}`
    : 'Vehicle';

  const handleAddToCart = (item: OrderItem) => {
    setCart(prev => [...prev, item]);
    setShowOrderForm(true);
  };

  const handleOrderSubmit = (order: Order) => {
    saveOrder(order);
  };

  const handleShare = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Custom ${carTitle} Art`,
          text: `Check out this custom art of my ${carTitle}!`,
          url,
        });
      } catch { /* cancelled */ }
    } else {
      await navigator.clipboard.writeText(url);
      alert('Link copied!');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <div className="text-center space-y-3">
          <svg className="w-12 h-12 text-brand animate-spin mx-auto" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <p className="text-neutral-400">Loading your car...</p>
        </div>
      </div>
    );
  }

  if (!car) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center px-6">
        <div className="text-center space-y-4 max-w-sm">
          <div className="text-6xl">🚗</div>
          <h1 className="text-white text-2xl font-bold">Design Not Found</h1>
          <p className="text-neutral-400">
            This link may have expired or the design session has ended.
            Visit us at the next Cars & Coffee to get your custom merch!
          </p>
          <div className="pt-4">
            <span className="text-brand font-bold text-lg">SnapMerch</span>
            <span className="text-neutral-500 text-sm block">by MyRestoMod</span>
          </div>
        </div>
      </div>
    );
  }

  // Priority-ordered configs for customer view — show all styles that have been generated
  const orderedConfigs = useMemo(() => {
    if (car?.identity) return getPrioritizedStyles(car.identity);
    return STYLE_CONFIGS;
  }, [car?.identity]);

  // Show only styles that have actually been generated (done or error)
  const visibleCount = useMemo(() => {
    if (!car) return 4;
    const generated = car.styles.filter(s => s.status === 'done' || s.status === 'error').length;
    return Math.max(4, generated);
  }, [car]);

  const selectedStyleData = selectedStyle
    ? car.styles.find(s => s.styleId === selectedStyle)
    : null;

  return (
    <div className="min-h-screen bg-surface">
      {/* Hero section */}
      <div className="relative">
        {/* Car photo */}
        <div className="h-48 overflow-hidden">
          <img
            src={car.photoThumbnail || car.photoBase64}
            alt={carTitle}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-surface" />
        </div>

        {/* Overlay title */}
        <div className="absolute bottom-0 left-0 right-0 px-4 pb-4">
          <div className="flex items-end gap-3">
            {car.identity?.color && (
              <div
                className="w-8 h-8 rounded-full border-2 border-white/30 shadow-lg flex-shrink-0"
                style={{ backgroundColor: car.identity.color.hex }}
              />
            )}
            <div>
              <h1 className="text-white text-2xl font-black drop-shadow-lg">{carTitle}</h1>
              <p className="text-white/70 text-sm">Your custom art — tap a style below</p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="pb-8">
        {showOrderForm && cart.length > 0 ? (
          <OrderForm
            items={cart}
            carSessionId={car.id}
            carTitle={carTitle}
            onSubmit={handleOrderSubmit}
            onBack={() => setShowOrderForm(false)}
          />
        ) : selectedStyle && selectedStyleData?.imageUrl ? (
          <ProductSelector
            styleId={selectedStyle}
            styleImageUrl={selectedStyleData.imageUrl}
            carTitle={carTitle}
            onAddToCart={handleAddToCart}
            onBack={() => setSelectedStyle(null)}
          />
        ) : (
          <StyleGrid
            styles={car.styles}
            orderedConfigs={orderedConfigs}
            visibleCount={visibleCount}
            onSelectStyle={setSelectedStyle}
            selectedStyle={selectedStyle}
          />
        )}

        {/* Social share */}
        {!showOrderForm && (
          <div className="px-4 pt-4 space-y-3">
            <button
              onClick={handleShare}
              className="w-full py-3 rounded-xl bg-surface-elevated border border-surface-border text-neutral-300 font-semibold 
                flex items-center justify-center gap-2 active:scale-[0.98] transition-all"
            >
              <span>📤</span> Share on Social
            </button>
          </div>
        )}

        {/* Footer branding */}
        <div className="text-center pt-8 pb-4 space-y-1">
          <div>
            <span className="text-brand font-black text-lg">Snap</span>
            <span className="text-white font-black text-lg">Merch</span>
          </div>
          <p className="text-neutral-500 text-xs">Custom car art by MyRestoMod</p>
          <p className="text-neutral-600 text-xs">Premium print-on-demand · Ships in 5-7 days</p>
        </div>
      </div>
    </div>
  );
}
