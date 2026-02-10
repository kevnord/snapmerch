// api/utils/apiTracker.ts
// Server-side version of the API tracker. Fire-and-forget. Graceful failure.
// Uses TRACKER_URL env var instead of window.location.

const TRACKER_URL = process.env.TRACKER_URL || '';

// ── Types ──────────────────────────────────────────────────────────────

interface ApiUsageLog {
  app: string;
  model: string;
  operation: string;
  inputTokens?: number;
  outputTokens?: number;
  imageCount?: number;
  estimatedCost: number;
  durationMs?: number;
  metadata?: Record<string, string>;
}

// ── Cost Estimation Helpers ────────────────────────────────────────────

const GEMINI_PRICING: Record<string, { input: number; output: number; imageGen?: number }> = {
  'gemini-2.0-flash': { input: 0.10, output: 0.40, imageGen: 0.039 },
  'gemini-2.0-flash-001': { input: 0.10, output: 0.40, imageGen: 0.039 },
  'gemini-2.5-pro-preview': { input: 1.25, output: 10.0 },
  'gemini-2.5-pro': { input: 1.25, output: 10.0 },
  'gemini-2.5-flash-preview': { input: 0.15, output: 0.60 },
  'gemini-2.5-flash': { input: 0.15, output: 0.60 },
  'gemini-3-flash-preview': { input: 0.15, output: 0.60 },
  'gemini-3-pro-image-preview': { input: 1.25, output: 10.0, imageGen: 0.04 },
};

const IMAGE_COST_PER_IMAGE = 0.04;

function estimateGeminiCost(
  model: string,
  inputTokens: number,
  outputTokens: number,
  imageCount = 0
): number {
  const pricing = GEMINI_PRICING[model] || GEMINI_PRICING['gemini-2.0-flash'];
  const inputCost = (inputTokens / 1_000_000) * pricing.input;
  const outputCost = (outputTokens / 1_000_000) * pricing.output;
  const imageCost = imageCount * (pricing.imageGen || IMAGE_COST_PER_IMAGE);
  return inputCost + outputCost + imageCost;
}

function estimateImageGenCost(imageCount: number, model = 'gemini-2.0-flash'): number {
  const pricing = GEMINI_PRICING[model];
  const perImage = pricing?.imageGen || IMAGE_COST_PER_IMAGE;
  return imageCount * perImage;
}

// ── Main Tracker ───────────────────────────────────────────────────────

function trackApiCall(log: ApiUsageLog): void {
  if (!TRACKER_URL) return;
  try {
    fetch(TRACKER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...log, timestamp: Date.now() }),
    }).catch(() => {});
  } catch {
    // silently fail
  }
}

export function trackGeminiCall(
  app: string,
  operation: string,
  model: string,
  inputTokens: number,
  outputTokens: number,
  options?: { imageCount?: number; durationMs?: number; metadata?: Record<string, string> }
): void {
  const imageCount = options?.imageCount || 0;
  const estimatedCost = estimateGeminiCost(model, inputTokens, outputTokens, imageCount);
  trackApiCall({
    app,
    model,
    operation,
    inputTokens,
    outputTokens,
    imageCount,
    estimatedCost,
    durationMs: options?.durationMs,
    metadata: options?.metadata,
  });
}

export function trackImageGenCall(
  app: string,
  operation: string,
  model: string,
  imageCount: number,
  options?: { durationMs?: number; metadata?: Record<string, string> }
): void {
  const estimatedCost = estimateImageGenCost(imageCount, model);
  trackApiCall({
    app,
    model,
    operation,
    imageCount,
    estimatedCost,
    durationMs: options?.durationMs,
    metadata: options?.metadata,
  });
}
