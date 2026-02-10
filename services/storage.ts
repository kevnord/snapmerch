// SnapMerch localStorage service + Supabase sync
import type { CarSession, EventSession, Order } from '../types';
import { getSupabase } from '../lib/supabase';

const KEYS = {
  EVENT_SESSION: 'snapmerch_event_session',
  ORDERS: 'snapmerch_orders',
};

// ── Auth state (set by React layer) ─────────────────────────────────────

let _userId: string | null = null;

/** Set the current Clerk user ID. Call from React when auth state changes. */
export function setAuthUserId(userId: string | null): void {
  _userId = userId;
}

// ── Event Session ───────────────────────────────────────────────────────

export function getEventSession(): EventSession {
  try {
    const stored = localStorage.getItem(KEYS.EVENT_SESSION);
    if (stored) {
      const session = JSON.parse(stored) as EventSession;
      // Reset if it's a different day
      const today = new Date().toISOString().split('T')[0];
      if (session.date === today) return session;
    }
  } catch {
    // Corrupted data — clear it
    localStorage.removeItem(KEYS.EVENT_SESSION);
  }
  return createNewEventSession();
}

export function createNewEventSession(): EventSession {
  const session: EventSession = {
    id: generateId(),
    name: 'Cars & Coffee',
    date: new Date().toISOString().split('T')[0],
    cars: [],
    createdAt: Date.now(),
  };
  saveEventSession(session);
  return session;
}

// Check if a string is a large data URL (base64 image)
function isLargeDataUrl(s: string | null | undefined): boolean {
  if (!s) return false;
  return s.startsWith('data:') && s.length > 500;
}

function saveEventSession(session: EventSession): void {
  // Strip ALL large base64 data before saving to localStorage (5MB limit)
  const stripped: EventSession = {
    ...session,
    cars: session.cars.map(car => ({
      ...car,
      photoBase64: '', // NEVER persist full photos — thumbnail only
      // Keep thumbnail only if it's small (< 10KB as base64)
      photoThumbnail: (car.photoThumbnail && car.photoThumbnail.length < 15000) ? car.photoThumbnail : '',
      styles: car.styles.map(s => ({
        ...s,
        // Strip ALL base64 image data from styles — they must be regenerated
        imageUrl: isLargeDataUrl(s.imageUrl) ? '' : (s.imageUrl || ''),
      })),
      // Strip mockup images too
      mockups: car.mockups.map(m => ({
        ...m,
        imageUrl: isLargeDataUrl(m.imageUrl) ? '' : (m.imageUrl || ''),
      })),
    })),
  };
  try {
    localStorage.setItem(KEYS.EVENT_SESSION, JSON.stringify(stripped));
  } catch (e) {
    // If still too large, progressively trim
    console.warn('localStorage full, trimming old sessions');
    stripped.cars = stripped.cars.slice(0, 3);
    // Also strip all thumbnails as last resort
    stripped.cars.forEach(c => { c.photoThumbnail = ''; });
    try {
      localStorage.setItem(KEYS.EVENT_SESSION, JSON.stringify(stripped));
    } catch {
      // Nuclear option: clear and start fresh
      localStorage.removeItem(KEYS.EVENT_SESSION);
    }
  }

  // Background sync to Supabase
  if (_userId) {
    syncEventToSupabase(session).catch(err =>
      console.warn('Supabase sync failed:', err.message)
    );
  }
}

// ── Car Sessions ────────────────────────────────────────────────────────

export function addCarSession(car: CarSession): EventSession {
  const session = getEventSession();
  session.cars.unshift(car); // newest first
  saveEventSession(session);
  return session;
}

export function updateCarSession(carId: string, update: Partial<CarSession>): EventSession {
  const session = getEventSession();
  const idx = session.cars.findIndex(c => c.id === carId);
  if (idx !== -1) {
    session.cars[idx] = { ...session.cars[idx], ...update };
    saveEventSession(session);
  }
  return session;
}

export function getCarSession(carId: string): CarSession | null {
  const session = getEventSession();
  return session.cars.find(c => c.id === carId) || null;
}

// ── Orders ──────────────────────────────────────────────────────────────

function getOrders(): Order[] {
  const stored = localStorage.getItem(KEYS.ORDERS);
  return stored ? JSON.parse(stored) : [];
}

export function saveOrder(order: Order): void {
  const orders = getOrders();
  orders.unshift(order);
  localStorage.setItem(KEYS.ORDERS, JSON.stringify(orders));

  // Sync order to Supabase
  if (_userId) {
    syncOrderToSupabase(order).catch(err =>
      console.warn('Supabase order sync failed:', err.message)
    );
  }
}

// ── Utilities ───────────────────────────────────────────────────────────

export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 6);
}

// Create a small thumbnail from a base64 image for the dashboard
export async function createThumbnail(base64: string, maxSize: number = 300): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ratio = Math.min(maxSize / img.width, maxSize / img.height);
      canvas.width = img.width * ratio;
      canvas.height = img.height * ratio;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', 0.6));
    };
    img.onerror = () => resolve(base64); // fallback
    img.src = base64;
  });
}

// ── Supabase Sync ───────────────────────────────────────────────────────

async function syncEventToSupabase(session: EventSession): Promise<void> {
  const supabase = getSupabase();
  if (!supabase || !_userId) return;

  // Upsert event
  const { error: eventError } = await supabase
    .from('snap_events')
    .upsert({
      id: session.id,
      user_id: _userId,
      name: session.name,
      date: session.date,
    }, { onConflict: 'id' });

  if (eventError) {
    console.warn('Supabase snap_events upsert error:', eventError.message);
    return;
  }

  // Upsert cars
  for (const car of session.cars) {
    const { error: carError } = await supabase
      .from('snap_cars')
      .upsert({
        id: car.id,
        event_id: session.id,
        photo_thumbnail: (car.photoThumbnail && car.photoThumbnail.length < 15000)
          ? car.photoThumbnail : null,
        identity: car.identity,
        share_url: car.shareUrl || null,
      }, { onConflict: 'id' });

    if (carError) {
      console.warn(`Supabase snap_cars upsert error for ${car.id}:`, carError.message);
      continue;
    }

    // Upsert styles (skip base64 image data — only store CDN URLs)
    for (const style of car.styles) {
      if (style.status === 'idle') continue; // Skip unstarted styles

      const { error: styleError } = await supabase
        .from('snap_styles')
        .upsert({
          id: `${car.id}_${style.styleId}`, // deterministic ID
          car_id: car.id,
          style_id: style.styleId,
          image_url: (style.imageUrl && !style.imageUrl.startsWith('data:'))
            ? style.imageUrl : null, // Only store CDN URLs
          status: style.status,
          error: style.error || null,
        }, { onConflict: 'id' });

      if (styleError) {
        console.warn(`Supabase snap_styles upsert error for ${style.styleId}:`, styleError.message);
      }
    }
  }
}

async function syncOrderToSupabase(order: Order): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;

  const { error } = await supabase
    .from('snap_orders')
    .upsert({
      id: order.id,
      car_id: order.carSessionId,
      customer_email: order.customerEmail,
      customer_name: order.customerName || null,
      customer_phone: order.customerPhone || null,
      shipping_address: order.shippingAddress || null,
      items: order.items,
      payment_id: order.paymentId || null,
      status: order.status,
    }, { onConflict: 'id' });

  if (error) {
    console.warn('Supabase snap_orders upsert error:', error.message);
  }
}


