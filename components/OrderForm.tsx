import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { OrderItem, Order } from '../types';
import { PRODUCT_OPTIONS } from '../types';
import { generateId } from '../services/storage';

interface OrderFormProps {
  items: OrderItem[];
  carSessionId: string;
  carTitle: string;
  onSubmit: (order: Order) => void;
  onBack: () => void;
}

// PayPal client ID — set in Vercel env vars
const PAYPAL_CLIENT_ID = import.meta.env.VITE_PAYPAL_CLIENT_ID || '';
const PAYPAL_MODE = import.meta.env.VITE_PAYPAL_MODE || 'sandbox';

export default function OrderForm({ items, carSessionId, carTitle, onSubmit, onBack }: OrderFormProps) {
  const [paymentStatus, setPaymentStatus] = useState<'idle' | 'processing' | 'success' | 'error'>('idle');
  const [paymentError, setPaymentError] = useState<string>('');
  const [orderDetails, setOrderDetails] = useState<{
    captureId: string;
    payerEmail: string;
    payerName: string;
    shipping?: any;
  } | null>(null);

  const total = items.reduce((sum, item) => sum + item.price, 0);

  const handlePaymentSuccess = useCallback((details: typeof orderDetails) => {
    setOrderDetails(details);
    setPaymentStatus('success');

    // Create order record
    const order: Order = {
      id: generateId(),
      carSessionId,
      items,
      customerEmail: details?.payerEmail || '',
      customerName: details?.payerName || '',
      shippingAddress: details?.shipping?.address,
      paymentId: details?.captureId || '',
      status: 'confirmed',
      createdAt: Date.now(),
    };
    onSubmit(order);
  }, [carSessionId, items, onSubmit]);

  // ── Order Summary ──

  const OrderSummary = () => (
    <div className="bg-surface-elevated border border-surface-border rounded-xl p-3 space-y-2">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-xs text-neutral-500 uppercase tracking-wider font-semibold">Order Summary</span>
        <span className="text-xs text-brand font-medium">{carTitle}</span>
      </div>
      {items.map((item, i) => {
        const product = PRODUCT_OPTIONS.find(p => p.id === item.productId);
        return (
          <div key={i} className="flex justify-between items-center text-sm">
            <span className="text-neutral-300">
              {product?.emoji || '📦'} {product?.name || item.productId}
              {item.size ? ` · ${item.size}` : ''}{item.color ? ` · ${item.color}` : ''}
            </span>
            <span className="text-white font-semibold">${item.price.toFixed(2)}</span>
          </div>
        );
      })}
      <div className="flex justify-between items-center text-sm text-neutral-400">
        <span>Shipping</span>
        <span className="text-emerald-400 font-medium">FREE</span>
      </div>
      <div className="border-t border-surface-border pt-2 flex justify-between items-center">
        <span className="text-neutral-300 font-semibold">Total</span>
        <span className="text-brand text-lg font-bold">${total.toFixed(2)}</span>
      </div>
    </div>
  );

  // ── Success Screen ──

  if (paymentStatus === 'success') {
    return (
      <div className="animate-fade-in px-4 py-8 text-center space-y-4">
        <div className="text-6xl">🎉</div>
        <h2 className="text-white text-2xl font-bold">Payment Complete!</h2>
        <p className="text-neutral-400">
          Your custom <span className="text-brand">{carTitle}</span> merch is on its way.
        </p>
        <div className="bg-surface-elevated border border-surface-border rounded-xl p-4 space-y-2 text-sm text-left">
          <div className="flex justify-between">
            <span className="text-neutral-400">Payment ID</span>
            <span className="text-white font-mono text-xs">{orderDetails?.captureId?.slice(0, 16) || '—'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-neutral-400">Paid by</span>
            <span className="text-white">{orderDetails?.payerName || orderDetails?.payerEmail || '—'}</span>
          </div>
          {orderDetails?.shipping?.name && (
            <div className="flex justify-between">
              <span className="text-neutral-400">Ship to</span>
              <span className="text-white">
                {orderDetails.shipping.address?.city}, {orderDetails.shipping.address?.state}
              </span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-neutral-400">Status</span>
            <span className="text-emerald-400 font-medium">✅ Paid</span>
          </div>
        </div>
        <div className="bg-surface-elevated border border-surface-border rounded-xl p-4 text-sm text-neutral-300 space-y-1">
          <p>📦 Ships in 5-7 business days</p>
          <p>🎨 Premium quality print by MyRestoMod</p>
          <p>📧 Confirmation sent to {orderDetails?.payerEmail || 'your email'}</p>
        </div>
      </div>
    );
  }

  // ── Checkout with PayPal/Venmo ──

  return (
    <div className="animate-fade-in px-4 py-3 space-y-4">
      <button onClick={onBack} className="flex items-center gap-1 text-neutral-400 hover:text-white text-sm transition-colors">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        Back
      </button>

      <h2 className="text-white text-xl font-bold">Checkout</h2>
      <OrderSummary />

      {/* PayPal/Venmo sandbox notice */}
      {PAYPAL_MODE === 'sandbox' && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 flex items-center gap-2">
          <span className="text-lg">🧪</span>
          <div>
            <p className="text-amber-300 text-sm font-medium">Sandbox Mode</p>
            <p className="text-amber-400/70 text-xs">Test payments only — no real charges.</p>
          </div>
        </div>
      )}

      {/* PayPal Buttons */}
      {PAYPAL_CLIENT_ID ? (
        <PayPalButtons
          clientId={PAYPAL_CLIENT_ID}
          items={items}
          total={total}
          carTitle={carTitle}
          onSuccess={handlePaymentSuccess}
          onError={(msg) => { setPaymentError(msg); setPaymentStatus('error'); }}
          disabled={paymentStatus === 'processing'}
        />
      ) : (
        <div className="bg-surface-elevated border border-surface-border rounded-xl p-6 text-center space-y-3">
          <span className="text-4xl">💳</span>
          <p className="text-neutral-400 text-sm">Payment not configured yet.</p>
          <p className="text-neutral-500 text-xs">Set PAYPAL_CLIENT_ID to enable PayPal & Venmo checkout.</p>
        </div>
      )}

      {/* Error display */}
      {paymentStatus === 'error' && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-center">
          <p className="text-red-400 text-sm font-medium">⚠️ Payment failed</p>
          <p className="text-red-400/70 text-xs mt-1">{paymentError}</p>
          <button
            onClick={() => { setPaymentStatus('idle'); setPaymentError(''); }}
            className="text-brand text-sm font-semibold underline mt-2"
          >
            Try again
          </button>
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────
// PayPal + Venmo Buttons Component
// Loads the PayPal JS SDK and renders payment buttons
// ──────────────────────────────────────────────────────────────────────

interface PayPalButtonsProps {
  clientId: string;
  items: OrderItem[];
  total: number;
  carTitle: string;
  onSuccess: (details: { captureId: string; payerEmail: string; payerName: string; shipping?: any }) => void;
  onError: (message: string) => void;
  disabled?: boolean;
}

function PayPalButtons({ clientId, items, total, carTitle, onSuccess, onError, disabled }: PayPalButtonsProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [sdkReady, setSdkReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const buttonsRendered = useRef(false);

  // Load PayPal JS SDK
  useEffect(() => {
    const scriptId = 'paypal-sdk';
    if (document.getElementById(scriptId)) {
      setSdkReady(true);
      setLoading(false);
      return;
    }

    const script = document.createElement('script');
    script.id = scriptId;
    script.src = `https://www.paypal.com/sdk/js?client-id=${clientId}&currency=USD&enable-funding=venmo&components=buttons`;
    script.async = true;
    script.onload = () => { setSdkReady(true); setLoading(false); };
    script.onerror = () => { onError('Failed to load payment system'); setLoading(false); };
    document.head.appendChild(script);
  }, [clientId, onError]);

  // Render PayPal buttons once SDK is ready
  useEffect(() => {
    if (!sdkReady || !containerRef.current || buttonsRendered.current || disabled) return;
    if (!(window as any).paypal) return;

    buttonsRendered.current = true;
    const paypal = (window as any).paypal;

    paypal.Buttons({
      style: {
        layout: 'vertical',
        color: 'gold',
        shape: 'pill',
        label: 'pay',
        height: 48,
      },

      // Create order on our server
      createOrder: async () => {
        try {
          const paypalItems = items.map(item => {
            const product = PRODUCT_OPTIONS.find(p => p.id === item.productId);
            return {
              name: `${carTitle} — ${product?.name || item.productId}${item.size ? ` (${item.size})` : ''}${item.color ? ` — ${item.color}` : ''}`,
              quantity: 1,
              price: item.price.toFixed(2),
              description: `Custom ${product?.name || 'merch'} design`,
            };
          });

          const res = await fetch('/api/paypal/create-order', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ items: paypalItems }),
          });

          if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error || 'Failed to create order');
          }

          const { orderId } = await res.json();
          return orderId;
        } catch (err: any) {
          onError(err.message || 'Failed to start checkout');
          throw err;
        }
      },

      // Capture payment after customer approves
      onApprove: async (data: any) => {
        try {
          const res = await fetch('/api/paypal/capture-order', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ orderId: data.orderID }),
          });

          if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error || 'Payment capture failed');
          }

          const result = await res.json();
          onSuccess({
            captureId: result.captureId,
            payerEmail: result.payer?.email || '',
            payerName: result.payer?.name || '',
            shipping: result.shipping,
          });
        } catch (err: any) {
          onError(err.message || 'Payment failed after approval');
        }
      },

      onCancel: () => {
        // Customer closed the PayPal window — do nothing, let them try again
      },

      onError: (err: any) => {
        console.error('PayPal error:', err);
        onError('Payment system error — please try again');
      },
    }).render(containerRef.current);
  }, [sdkReady, items, total, carTitle, onSuccess, onError, disabled]);

  return (
    <div className="space-y-3">
      <p className="text-neutral-400 text-xs text-center">
        Pay securely with PayPal, Venmo, or debit/credit card
      </p>

      {loading && (
        <div className="bg-surface-elevated border border-surface-border rounded-xl p-6 flex flex-col items-center gap-3">
          <svg className="w-8 h-8 animate-spin text-brand" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span className="text-neutral-400 text-sm">Loading payment options...</span>
        </div>
      )}

      {/* PayPal buttons render here */}
      <div
        ref={containerRef}
        className={`min-h-[120px] rounded-xl overflow-hidden ${loading ? 'hidden' : ''}`}
      />

      {/* Security note */}
      <div className="flex items-center justify-center gap-1.5 text-neutral-500 text-xs">
        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
        </svg>
        <span>Secured by PayPal</span>
      </div>
    </div>
  );
}
