// SnapMerch API service — calls the same backend as MyRestoModStudio
import type { CarIdentity, SnapMerchStyle, StyleConfig } from '../types';

const API_BASE = import.meta.env.VITE_API_BASE_URL || ''; // empty = same origin (own serverless functions)

// ── Image Compression (Vercel has 4.5MB body limit) ─────────────────

function compressImage(base64: string, maxWidth = 1200, quality = 0.7): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxWidth / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => resolve(base64);
    img.src = base64;
  });
}

async function post<T>(path: string, body: Record<string, any>): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `Request failed: ${res.statusText}` }));
    throw new Error(err.error || `Request failed: ${res.statusText}`);
  }
  return res.json();
}

// ── Vehicle Analysis ────────────────────────────────────────────────────

export async function analyzeVehicle(base64Image: string): Promise<CarIdentity> {
  const compressed = await compressImage(base64Image, 1200, 0.7);
  return post<CarIdentity>('/api/analyze', { imageBase64: compressed });
}

// ── Art Generation (uses /api/generate with draft quality for speed) ─────

// Compress a returned design image to JPEG to save mobile memory
// Aggressive settings: 600px max, 70% JPEG — keeps images under ~150KB each
function compressDesignImage(base64: string, maxWidth = 600, quality = 0.70): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxWidth / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const result = canvas.toDataURL('image/jpeg', quality);
      // Clean up canvas to free memory immediately
      canvas.width = 0;
      canvas.height = 0;
      resolve(result);
    };
    img.onerror = () => resolve(base64);
    img.src = base64;
  });
}

async function generateArt(
  identity: CarIdentity,
  styleConfig: StyleConfig,
  referenceImage?: string
): Promise<string> {
  const carColor = identity.color?.hex || '#003366';
  
  const details: Record<string, any> = {
    year: identity.year,
    make: identity.make,
    model: identity.model,
    trim: identity.trim,
    artStyle: styleConfig.artStyle,
    view: '3/4 Front',
    color: carColor,
    backgroundColor: styleConfig.backgroundColor || '#FFFFFF',
    resolution: '1K',
    quality: 'draft', // SPEED — use flash model at events
  };

  // For calligram/typography style, add the car name as title
  if (styleConfig.id === 'calligram') {
    details.title = `${identity.year} ${identity.make} ${identity.model}`;
    details.artStyle = 'Distressed';
    details.customization = `Include stylized typography of "${identity.year} ${identity.make} ${identity.model}" integrated into the design`;
  }

  // Compress reference image aggressively (600px, 50% quality) to stay under Vercel 4.5MB limit
  // and reduce memory — this is sent to server, not displayed
  if (referenceImage) {
    details.referenceImage = await compressImage(referenceImage, 600, 0.5);
  }

  const result = await post<{ imageUrl: string; prompt: string }>('/api/generate', { details });
  // Compress the returned image aggressively to save mobile memory (PNG→JPEG, 600px, 70%)
  return compressDesignImage(result.imageUrl, 600, 0.70);
}

// ── Generate styles with limited concurrency (2 at a time) ──────────────

export async function generateAllStyles(
  identity: CarIdentity,
  styleConfigs: StyleConfig[],
  referenceImage?: string,
  onStyleComplete?: (styleId: SnapMerchStyle, imageUrl: string) => void,
  onStyleError?: (styleId: SnapMerchStyle, error: string) => void
): Promise<Map<SnapMerchStyle, string>> {
  const results = new Map<SnapMerchStyle, string>();
  const MAX_CONCURRENT = 2; // Only 2 at a time to reduce mobile memory pressure
  
  // Process in batches of MAX_CONCURRENT
  for (let i = 0; i < styleConfigs.length; i += MAX_CONCURRENT) {
    const batch = styleConfigs.slice(i, i + MAX_CONCURRENT);
    const batchPromises = batch.map(async (config, batchIndex) => {
      // Small stagger within batch to avoid hitting rate limits
      if (batchIndex > 0) await new Promise(r => setTimeout(r, 500));
      try {
        // Send reference image to ALL styles — since we generate 2 at a time,
        // memory impact is manageable and results are much more accurate.
        const ref = referenceImage;
        const imageUrl = await generateArt(identity, config, ref);
        results.set(config.id, imageUrl);
        onStyleComplete?.(config.id, imageUrl);
      } catch (err: any) {
        onStyleError?.(config.id, err.message);
      }
    });
    await Promise.allSettled(batchPromises);
  }
  
  return results;
}

// ── Tweak / Remix a Design ───────────────────────────────────────────────

export async function tweakDesign(
  imageInput: string,
  prompt: string,
  carDetails: Record<string, any>
): Promise<string> {
  // Convert blob URL to base64 if needed, then compress
  const base64 = await blobUrlToBase64(imageInput);
  if (!base64 || !base64.startsWith('data:')) {
    throw new Error('Design image is unavailable — please go back and re-select the style');
  }
  const compressed = await compressImage(base64, 600, 0.7);
  const result = await post<{ imageUrl: string; prompt: string }>('/api/edit', {
    imageBase64: compressed,
    editPrompt: prompt,
    resolution: '1K',
    details: carDetails,
  });
  // Compress the returned image to match other designs (600px, 70% JPEG)
  return compressDesignImage(result.imageUrl, 600, 0.70);
}

// ── Helpers: blob URL → base64 ──────────────────────────────────────────

async function blobUrlToBase64(url: string): Promise<string> {
  // Already a data URL — pass through
  if (!url || !url.startsWith('blob:')) return url;

  // Use fetch + FileReader (much more reliable than Image+canvas for blob URLs)
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error('FileReader failed on blob'));
      reader.readAsDataURL(blob);
    });
  } catch {
    // Blob URL may have been revoked — try Image+canvas as fallback
    return new Promise<string>((resolve, reject) => {
      const img = new Image();
      // Do NOT set crossOrigin on blob URLs — they're same-origin and CORS breaks them
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0);
        const result = canvas.toDataURL('image/jpeg', 0.8);
        canvas.width = 0;
        canvas.height = 0;
        resolve(result);
      };
      img.onerror = () => reject(new Error(`Image URL expired or invalid (${url.substring(0, 30)}…)`));
      img.src = url;
    });
  }
}

// ── Product Mockup ──────────────────────────────────────────────────────

export async function generateMockup(
  designImageInput: string,
  options: {
    productType?: string;
    color?: string;
    colorName?: string;
    carDescription?: string;
    gender?: 'male' | 'female';
    ageRange?: string;
    background?: 'studio' | 'lifestyle';
  } = {}
): Promise<string> {
  const {
    productType = 'tshirt',
    color = '#000000',
    colorName = 'Black',
    carDescription = 'automotive art',
    gender = 'male',
    ageRange = '25-40',
    background = 'studio',
  } = options;

  // Convert blob URL to base64 if needed, then compress
  const base64 = await blobUrlToBase64(designImageInput);
  if (!base64 || !base64.startsWith('data:')) {
    throw new Error('Design image is unavailable — please go back and try selecting the style again');
  }
  const compressed = await compressDesignImage(base64, 600, 0.70);

  const result = await post<{ imageUrl: string }>('/api/mockup', {
    designImageBase64: compressed,
    productType,
    shirtColor: color,
    shirtColorName: colorName,
    shirtBrand: productType === 'hoodie' ? 'Gildan 18500' : 'Bella Canvas 3001',
    gender,
    ageRange,
    carDescription,
    background,
  });

  // Compress returned mockup image (600px, 70% JPEG)
  return compressDesignImage(result.imageUrl, 600, 0.70);
}

// ── Re-identify paint color using photo + corrected vehicle info ────────

export async function identifyColor(
  base64Image: string,
  year: string,
  make: string,
  model: string
): Promise<{ name: string; hex: string }> {
  const compressed = await compressImage(base64Image, 800, 0.6);
  return post<{ name: string; hex: string }>('/api/identify-color', {
    imageBase64: compressed,
    year,
    make,
    model,
  });
}
