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

/** Get the current user ID. */
export function getAuthUserId(): string | null {
  return _userId;
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

export function saveEventSession(session: EventSession): void {
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

export function getOrders(): Order[] {
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

/**
 * Load event session from Supabase (if authenticated).
 * Falls back to localStorage on error.
 */
export async function loadEventFromSupabase(): Promise<EventSession | null> {
  const supabase = getSupabase();
  if (!supabase || !_userId) return null;

  try {
    const today = new Date().toISOString().split('T')[0];
    const { data: events, error: evError } = await supabase
      .from('snap_events')
      .select('*')
      .eq('user_id', _userId)
      .eq('date', today)
      .order('created_at', { ascending: false })
      .limit(1);

    if (evError || !events || events.length === 0) return null;
    const ev = events[0];

    // Load cars
    const { data: cars, error: carsError } = await supabase
      .from('snap_cars')
      .select('*')
      .eq('event_id', ev.id)
      .order('created_at', { ascending: false });

    if (carsError || !cars) return null;

    // Load styles for all cars
    const carIds = cars.map(c => c.id);
    const { data: allStyles } = await supabase
      .from('snap_styles')
      .select('*')
      .in('car_id', carIds.length > 0 ? carIds : ['__none__']);

    const stylesMap = new Map<string, any[]>();
    for (const s of (allStyles || [])) {
      if (!stylesMap.has(s.car_id)) stylesMap.set(s.car_id, []);
      stylesMap.get(s.car_id)!.push(s);
    }

    // Load orders
    const { data: allOrders } = await supabase
      .from('snap_orders')
      .select('*')
      .in('car_id', carIds.length > 0 ? carIds : ['__none__']);

    const ordersMap = new Map<string, any[]>();
    for (const o of (allOrders || [])) {
      if (!ordersMap.has(o.car_id)) ordersMap.set(o.car_id, []);
      ordersMap.get(o.car_id)!.push(o);
    }

    // Build EventSession
    const session: EventSession = {
      id: ev.id,
      name: ev.name,
      date: ev.date,
      cars: cars.map(car => {
        const dbStyles = stylesMap.get(car.id) || [];
        const dbOrders = ordersMap.get(car.id) || [];
        return {
          id: car.id,
          photoBase64: '',
          photoThumbnail: car.photo_thumbnail || '',
          identity: car.identity || null,
          shareUrl: car.share_url || undefined,
          styles: dbStyles.map(s => ({
            styleId: s.style_id,
            imageUrl: s.image_url || '',
            status: s.status || 'idle',
            error: s.error || undefined,
          })),
          mockups: [],
          orders: dbOrders.map(o => ({
            id: o.id,
            carSessionId: o.car_id,
            items: o.items || [],
            customerEmail: o.customer_email,
            customerName: o.customer_name || undefined,
            customerPhone: o.customer_phone || undefined,
            shippingAddress: o.shipping_address || undefined,
            paymentId: o.payment_id || undefined,
            status: o.status,
            createdAt: new Date(o.created_at).getTime(),
          })),
          createdAt: new Date(car.created_at).getTime(),
        };
      }),
      createdAt: new Date(ev.created_at).getTime(),
    };

    // Also update localStorage with the Supabase data
    try {
      localStorage.setItem(KEYS.EVENT_SESSION, JSON.stringify(session));
    } catch {}

    return session;
  } catch (err) {
    console.warn('Supabase load failed, using localStorage:', err);
    return null;
  }
}
