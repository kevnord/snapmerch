import React, { useState, useCallback, useEffect, useRef } from 'react';
import type {
  CarSession,
  EventSession,
  GeneratedStyle,
  SnapMerchStyle,
  StyleConfig,
  OrderItem,
  Order,
  VendorTab,
} from '../types';
import { STYLE_CONFIGS } from '../types';
import { analyzeVehicle, generateAllStyles } from '../services/api';
import { getPrioritizedStyles } from '../services/stylePriority';
import {
  getEventSession,
  addCarSession,
  updateCarSession,
  saveOrder,
  createThumbnail,
  generateId,
  createNewEventSession,
} from '../services/storage';
import CameraCapture from './CameraCapture';
import CarIdentityCard from './CarIdentity';
import StyleGrid from './StyleGrid';
import ProductSelector from './ProductSelector';
import QRShare from './QRShare';
import OrderForm from './OrderForm';
import EventDashboard from './EventDashboard';

const INITIAL_BATCH_SIZE = 4;
const MORE_BATCH_SIZE = 4;

export default function VendorMode() {
  const [tab, setTab] = useState<VendorTab>('capture');
  const [eventSession, setEventSession] = useState<EventSession>(getEventSession());
  const [currentCar, setCurrentCar] = useState<CarSession | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [selectedStyle, setSelectedStyle] = useState<SnapMerchStyle | null>(null);
  const [showQR, setShowQR] = useState(false);
  const [showQRForCarId, setShowQRForCarId] = useState<string | null>(null);
  const [cart, setCart] = useState<OrderItem[]>([]);
  const [showOrderForm, setShowOrderForm] = useState(false);
  const [generationStartTime, setGenerationStartTime] = useState<number | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [statusStep, setStatusStep] = useState<number>(0);
  // Whether the user has started design generation (locks year/make/model)
  const [generationStarted, setGenerationStarted] = useState(false);

  // Priority-ordered style configs for current car
  const [orderedConfigs, setOrderedConfigs] = useState<StyleConfig[]>(STYLE_CONFIGS);
  // How many styles are currently visible (starts at 4, can grow to 8, 12)
  const [visibleCount, setVisibleCount] = useState(INITIAL_BATCH_SIZE);
  // Whether we're generating more styles
  const [isGeneratingMore, setIsGeneratingMore] = useState(false);
  // Styles explicitly picked via "Choose Your Own" that are beyond the visibleCount window
  const [extraVisibleStyles, setExtraVisibleStyles] = useState<Set<SnapMerchStyle>>(new Set());

  // Keep a ref to the current photo for generating more styles later
  const currentPhotoRef = useRef<string>('');

  const refreshSession = useCallback(() => {
    setEventSession(getEventSession());
  }, []);

  // Generate a batch of styles
  const generateStyleBatch = useCallback(async (
    carSession: CarSession,
    configs: StyleConfig[],
    referenceImage: string | undefined,
    totalLabel: string,
  ) => {
    let completedCount = 0;
    await generateAllStyles(
      carSession.identity!,
      configs,
      referenceImage,
      (styleId, imageUrl) => {
        completedCount++;
        const config = configs.find(c => c.id === styleId);
        setStatusMessage(`✅ ${config?.label || styleId} ready! (${completedCount}/${configs.length}${totalLabel})`);
        setCurrentCar(prev => {
          if (!prev) return prev;
          const styles = prev.styles.map(s =>
            s.styleId === styleId ? { ...s, imageUrl, status: 'done' as const } : s
          );
          const updated = { ...prev, styles };
          updateCarSession(prev.id, { styles });
          refreshSession();
          return updated;
        });
      },
      (styleId, error) => {
        completedCount++;
        const config = configs.find(c => c.id === styleId);
        setStatusMessage(`⚠️ ${config?.label || styleId} failed — ${completedCount}/${configs.length}${totalLabel}`);
        setCurrentCar(prev => {
          if (!prev) return prev;
          const styles = prev.styles.map(s =>
            s.styleId === styleId ? { ...s, status: 'error' as const, error } : s
          );
          const updated = { ...prev, styles };
          updateCarSession(prev.id, { styles });
          return updated;
        });
      }
    );
  }, [refreshSession]);

  // Handle photo capture — analyze only, don't auto-generate designs
  const handleCapture = useCallback(async (base64Image: string) => {
    setIsAnalyzing(true);
    setSelectedStyle(null);
    setCart([]);
    setShowOrderForm(false);
    setGenerationStarted(false);
    setExtraVisibleStyles(new Set());
    setStatusStep(1);
    setStatusMessage('📷 Compressing photo...');
    setVisibleCount(INITIAL_BATCH_SIZE);
    currentPhotoRef.current = base64Image;

    const thumbnail = await createThumbnail(base64Image);

    // Create car session with all 12 style slots
    const carSession: CarSession = {
      id: generateId(),
      photoBase64: base64Image,
      photoThumbnail: thumbnail,
      identity: null,
      styles: STYLE_CONFIGS.map(c => ({ styleId: c.id, imageUrl: null, status: 'idle' as const })),
      mockups: [],
      orders: [],
      createdAt: Date.now(),
    };
    setCurrentCar(carSession);
    setTab('designs');

    try {
      // Analyze vehicle — stop here, let user review/edit before generating
      setStatusStep(2);
      setStatusMessage('🔍 Identifying vehicle — year, make, model...');
      const identity = await analyzeVehicle(base64Image);
      carSession.identity = identity;
      setCurrentCar({ ...carSession });

      // Get priority-ordered configs
      const prioritized = getPrioritizedStyles(identity);
      setOrderedConfigs(prioritized);

      // Add to event session
      const updated = addCarSession(carSession);
      setEventSession(updated);
      setIsAnalyzing(false);
      setStatusStep(0);
      setStatusMessage(null);
      // User can now edit year/make/model, then hit "Generate Designs"
    } catch (err: any) {
      console.error('Analysis failed:', err);
      setIsAnalyzing(false);

      const fallbackIdentity = { year: '?', make: 'Unknown', model: 'Vehicle', trim: '', color: { name: 'Unknown', hex: '#666666' } };
      carSession.identity = fallbackIdentity;
      setCurrentCar({ ...carSession });

      const prioritized = getPrioritizedStyles(fallbackIdentity);
      setOrderedConfigs(prioritized);

      const updated = addCarSession(carSession);
      setEventSession(updated);
      setStatusStep(0);
      setStatusMessage(`⚠️ Couldn't auto-ID — edit the details above, then generate.`);
    }
  }, [refreshSession]);

  // Start generating designs (user-triggered after reviewing car identity)
  const handleStartGeneration = useCallback(async () => {
    if (!currentCar?.identity) return;

    setGenerationStarted(true);
    const referenceImage = currentPhotoRef.current || undefined;

    // Re-compute priority order in case user edited the identity
    const prioritized = getPrioritizedStyles(currentCar.identity);
    setOrderedConfigs(prioritized);

    const initialConfigs = prioritized.slice(0, INITIAL_BATCH_SIZE);
    setStatusStep(3);
    setStatusMessage(`🎨 Generating ${initialConfigs.length} art styles — ~15-30s each...`);

    // Mark initial styles as generating
    setCurrentCar(prev => {
      if (!prev) return prev;
      const styles = prev.styles.map(s => {
        if (initialConfigs.some(c => c.id === s.styleId)) {
          return { ...s, status: 'generating' as const };
        }
        return s;
      });
      return { ...prev, styles };
    });
    setGenerationStartTime(Date.now());

    await generateStyleBatch(currentCar, initialConfigs, referenceImage, '');

    // Memory cleanup — release full photo
    currentPhotoRef.current = '';
    setCurrentCar(prev => {
      if (!prev) return prev;
      const cleaned = { ...prev, photoBase64: '' };
      updateCarSession(prev.id, { photoBase64: '' });
      return cleaned;
    });

    setStatusStep(0);
    setStatusMessage(null);
  }, [currentCar, generateStyleBatch]);

  // Handle "Generate More Styles" (auto next batch)
  const handleGenerateMore = useCallback(async () => {
    if (!currentCar?.identity || isGeneratingMore) return;

    const newVisibleCount = Math.min(visibleCount + MORE_BATCH_SIZE, orderedConfigs.length);
    const moreConfigs = orderedConfigs.slice(visibleCount, newVisibleCount);

    if (moreConfigs.length === 0) return;

    setVisibleCount(newVisibleCount);
    setIsGeneratingMore(true);
    setStatusStep(3);
    setStatusMessage(`✨ Generating ${moreConfigs.length} more styles...`);
    setGenerationStartTime(Date.now());

    // Mark new styles as generating
    setCurrentCar(prev => {
      if (!prev) return prev;
      const styles = prev.styles.map(s => {
        if (moreConfigs.some(c => c.id === s.styleId)) {
          return { ...s, status: 'generating' as const };
        }
        return s;
      });
      return { ...prev, styles };
    });

    // Generate — no reference image (already cleaned up)
    const tempCar = { ...currentCar };
    await generateStyleBatch(tempCar, moreConfigs, undefined, ` bonus`);

    setIsGeneratingMore(false);
    setStatusStep(0);
    setStatusMessage(null);
  }, [currentCar, visibleCount, orderedConfigs, isGeneratingMore, generateStyleBatch]);

  // Handle "Choose Your Own" — generate user-picked styles
  const handleGenerateSelected = useCallback(async (styleIds: SnapMerchStyle[]) => {
    if (!currentCar?.identity || isGeneratingMore || styleIds.length === 0) return;

    // Find configs for the selected style IDs
    const selectedConfigs = styleIds
      .map(id => STYLE_CONFIGS.find(c => c.id === id))
      .filter((c): c is StyleConfig => c !== undefined);

    if (selectedConfigs.length === 0) return;

    // Track extra styles that need to be visible (beyond the visibleCount window)
    setExtraVisibleStyles(prev => {
      const next = new Set(prev);
      for (const sc of selectedConfigs) {
        const idx = orderedConfigs.findIndex(c => c.id === sc.id);
        if (idx >= visibleCount) next.add(sc.id);
      }
      return next;
    });

    setIsGeneratingMore(true);
    setStatusStep(3);
    setStatusMessage(`🎨 Generating ${selectedConfigs.length} custom pick${selectedConfigs.length > 1 ? 's' : ''}...`);
    setGenerationStartTime(Date.now());

    // Mark selected styles as generating
    setCurrentCar(prev => {
      if (!prev) return prev;
      const styles = prev.styles.map(s => {
        if (styleIds.includes(s.styleId)) {
          return { ...s, status: 'generating' as const, imageUrl: null, error: undefined };
        }
        return s;
      });
      return { ...prev, styles };
    });

    const tempCar = { ...currentCar };
    await generateStyleBatch(tempCar, selectedConfigs, undefined, ' custom');

    setIsGeneratingMore(false);
    setStatusStep(0);
    setStatusMessage(null);
  }, [currentCar, visibleCount, orderedConfigs, isGeneratingMore, generateStyleBatch]);

  // Handle selecting a car from dashboard
  const handleSelectCar = useCallback((carId: string) => {
    const car = eventSession.cars.find(c => c.id === carId);
    if (car) {
      if (currentCar && currentCar.id !== carId) {
        setCurrentCar(prev => {
          if (!prev) return prev;
          return { ...prev, photoBase64: '', styles: prev.styles.map(s => ({ ...s, imageUrl: s.status === 'done' ? '' : s.imageUrl })) };
        });
      }
      setCurrentCar(car);
      setSelectedStyle(null);
      setCart([]);
      setShowOrderForm(false);

      // Re-compute priority order for this car
      setExtraVisibleStyles(new Set());
      if (car.identity) {
        const prioritized = getPrioritizedStyles(car.identity);
        setOrderedConfigs(prioritized);
        // Show all styles that have been generated
        const doneOrErrorCount = car.styles.filter(s => s.status === 'done' || s.status === 'error').length;
        setVisibleCount(Math.max(INITIAL_BATCH_SIZE, Math.min(doneOrErrorCount, STYLE_CONFIGS.length)));
        // If any styles were already generated, lock the identity
        setGenerationStarted(doneOrErrorCount > 0);
      } else {
        setOrderedConfigs(STYLE_CONFIGS);
        setVisibleCount(INITIAL_BATCH_SIZE);
        setGenerationStarted(false);
      }

      setTab('designs');
    }
  }, [eventSession, currentCar]);

  const handleShareCar = useCallback((carId: string) => {
    setShowQRForCarId(carId);
    setShowQR(true);
  }, []);

  const handleAddToCart = useCallback((item: OrderItem) => {
    setCart(prev => [...prev, item]);
    setShowOrderForm(true);
  }, []);

  const handleOrderSubmit = useCallback((order: Order) => {
    saveOrder(order);
    if (currentCar) {
      const updatedOrders = [...currentCar.orders, order];
      updateCarSession(currentCar.id, { orders: updatedOrders });
      setCurrentCar(prev => prev ? { ...prev, orders: updatedOrders } : prev);
    }
    refreshSession();
  }, [currentCar, refreshSession]);

  const carTitle = currentCar?.identity
    ? `${currentCar.identity.year} ${currentCar.identity.make} ${currentCar.identity.model}`
    : 'Vehicle';

  const qrCarId = showQRForCarId || currentCar?.id;
  const qrCar = qrCarId ? eventSession.cars.find(c => c.id === qrCarId) : currentCar;
  const qrCarTitle = qrCar?.identity
    ? `${qrCar.identity.year} ${qrCar.identity.make} ${qrCar.identity.model}`
    : 'Vehicle';

  const canGenerateMore = visibleCount < orderedConfigs.length;

  return (
    <div className="min-h-screen bg-surface flex flex-col">
      <div className="flex-1 overflow-y-auto pb-20">
        {tab === 'capture' && (
          <CameraCapture onCapture={handleCapture} isProcessing={isAnalyzing} />
        )}

        {tab === 'designs' && currentCar && (
          <div className="space-y-3">
            {/* Status banner */}
            {statusMessage && (
              <div className={`mx-4 mt-3 px-4 py-3 rounded-2xl border text-sm font-medium flex items-center gap-3 transition-all duration-300 ${
                statusStep === 1 ? 'bg-blue-500/10 border-blue-500/30 text-blue-300' :
                statusStep === 2 ? 'bg-amber-500/10 border-amber-500/30 text-amber-300' :
                statusStep === 3 ? 'bg-brand/10 border-brand/30 text-brand-light' :
                'bg-surface-card border-surface-border text-neutral-300'
              }`}>
                {statusStep > 0 && statusStep < 3 && (
                  <svg className="w-4 h-4 animate-spin shrink-0" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                )}
                <span>{statusMessage}</span>
              </div>
            )}

            {/* Car identity */}
            {currentCar.identity && (
              <div className="px-4 pt-3">
                <CarIdentityCard
                  identity={currentCar.identity}
                  photoBase64={currentCar.photoThumbnail || currentCar.photoBase64}
                  locked={generationStarted}
                  onUpdate={(updated) => {
                    setCurrentCar(prev => {
                      if (!prev) return prev;
                      const car = { ...prev, identity: updated };
                      updateCarSession(prev.id, { identity: updated });
                      refreshSession();
                      return car;
                    });
                  }}
                />
              </div>
            )}

            {/* "Generate Designs" button — shown after ID, before generation starts */}
            {currentCar.identity && !generationStarted && !isAnalyzing && (
              <div className="px-4 pt-2">
                <p className="text-neutral-400 text-xs text-center mb-2">
                  Review the details above, then tap to generate designs
                </p>
                <button
                  onClick={handleStartGeneration}
                  className="w-full py-4 rounded-2xl bg-gradient-to-r from-brand to-brand-dark text-white font-bold text-lg
                    shadow-lg shadow-brand/30 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                >
                  <span className="text-xl">🎨</span>
                  Generate Designs
                </button>
              </div>
            )}

            {/* Loading indicator for analysis */}
            {isAnalyzing && !statusMessage && (
              <div className="px-4">
                <div className="bg-surface-card border border-surface-border rounded-2xl p-4 shimmer">
                  <div className="h-4 bg-surface-elevated rounded w-2/3 mb-2" />
                  <div className="h-3 bg-surface-elevated rounded w-1/2" />
                </div>
              </div>
            )}

            {/* Product selector or style grid */}
            {showOrderForm && cart.length > 0 ? (
              <OrderForm
                items={cart}
                carSessionId={currentCar.id}
                carTitle={carTitle}
                onSubmit={handleOrderSubmit}
                onBack={() => setShowOrderForm(false)}
              />
            ) : selectedStyle && currentCar.styles.find(s => s.styleId === selectedStyle)?.imageUrl ? (
              <ProductSelector
                styleId={selectedStyle}
                styleImageUrl={currentCar.styles.find(s => s.styleId === selectedStyle)!.imageUrl!}
                carTitle={carTitle}
                onAddToCart={handleAddToCart}
                onBack={() => setSelectedStyle(null)}
              />
            ) : (
              <>
                <StyleGrid
                  styles={currentCar.styles}
                  orderedConfigs={orderedConfigs}
                  visibleCount={visibleCount}
                  extraVisibleStyles={extraVisibleStyles}
                  onSelectStyle={setSelectedStyle}
                  selectedStyle={selectedStyle}
                  generationStartTime={generationStartTime || undefined}
                  onGenerateMore={handleGenerateMore}
                  onGenerateSelected={handleGenerateSelected}
                  canGenerateMore={canGenerateMore}
                  isGeneratingMore={isGeneratingMore}
                  carIdentity={currentCar.identity}
                  onStyleUpdated={(styleId, newImageUrl) => {
                    // Update the style's imageUrl in the car session
                    const updatedStyles = currentCar.styles.map(s =>
                      s.styleId === styleId ? { ...s, imageUrl: newImageUrl } : s
                    );
                    setCurrentCar(prev => prev ? { ...prev, styles: updatedStyles } : prev);
                    updateCarSession(currentCar.id, { styles: updatedStyles });
                  }}
                />

                {/* Share button */}
                {currentCar.identity && currentCar.styles.some(s => s.status === 'done') && (
                  <div className="px-4 pb-4">
                    <button
                      onClick={() => {
                        setShowQRForCarId(currentCar.id);
                        setShowQR(true);
                      }}
                      className="w-full py-3 rounded-2xl bg-electric text-white font-bold text-base flex items-center justify-center gap-2
                        shadow-lg shadow-electric/30 active:scale-[0.98] transition-all"
                    >
                      <span className="text-xl">📲</span>
                      Share with Customer
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {tab === 'designs' && !currentCar && (
          <div className="text-center py-16 space-y-3">
            <div className="text-5xl">🎨</div>
            <p className="text-neutral-400">No car selected</p>
            <p className="text-neutral-500 text-sm">Snap a photo or pick from the dashboard</p>
          </div>
        )}

        {tab === 'dashboard' && (
          <EventDashboard
            session={eventSession}
            onSelectCar={handleSelectCar}
            onShareCar={handleShareCar}
            onNewSession={() => {
              const ns = createNewEventSession();
              setEventSession(ns);
              setCurrentCar(null);
            }}
          />
        )}
      </div>

      {/* Bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 bg-surface-card/95 backdrop-blur-md border-t border-surface-border">
        <div className="absolute top-0 right-2 -translate-y-full px-2 py-0.5 bg-black/60 rounded-t text-[9px] font-mono text-neutral-400 tracking-wider">
          {__COMMIT_HASH__}
        </div>
        <div className="flex max-w-lg mx-auto">
          {[
            { id: 'capture' as VendorTab, icon: '📸', label: 'Capture' },
            { id: 'designs' as VendorTab, icon: '🎨', label: 'Designs' },
            { id: 'dashboard' as VendorTab, icon: '📊', label: 'Dashboard' },
          ].map(item => (
            <button
              key={item.id}
              onClick={() => setTab(item.id)}
              className={`flex-1 flex flex-col items-center gap-0.5 py-3 transition-colors
                ${tab === item.id ? 'text-brand' : 'text-neutral-500 hover:text-neutral-300'}`}
            >
              <span className="text-xl">{item.icon}</span>
              <span className="text-[10px] font-semibold">{item.label}</span>
              {item.id === 'dashboard' && eventSession.cars.length > 0 && (
                <span className="absolute top-1 right-1/3 bg-brand text-white text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                  {eventSession.cars.length}
                </span>
              )}
            </button>
          ))}
        </div>
      </nav>

      {/* QR Share modal */}
      {showQR && qrCarId && (
        <QRShare
          carSessionId={qrCarId}
          carTitle={qrCarTitle}
          onClose={() => { setShowQR(false); setShowQRForCarId(null); }}
        />
      )}
    </div>
  );
}
