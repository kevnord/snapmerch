// SnapMerch localStorage service
import type { CarSession, EventSession, Order } from '../types';

const KEYS = {
  EVENT_SESSION: 'snapmerch_event_session',
  ORDERS: 'snapmerch_orders',
};

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
