import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const redis = new Redis({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
});

const limiters = {
  auth: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(10, '1m'), prefix: 'rl:auth' }),
  ai: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(5, '1m'), prefix: 'rl:ai' }),
  form: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(5, '1h'), prefix: 'rl:form' }),
  read: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(60, '1m'), prefix: 'rl:read' }),
  write: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(20, '1m'), prefix: 'rl:write' }),
};

export type RateLimitTier = keyof typeof limiters;

function getClientIp(req: VercelRequest): string {
  return (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim()
    || req.headers['x-real-ip'] as string
    || 'unknown';
}

export async function rateLimit(
  req: VercelRequest, res: VercelResponse, tier: RateLimitTier, identifier?: string
): Promise<boolean> {
  const id = identifier || getClientIp(req);
  try {
    const { success, limit, remaining, reset } = await limiters[tier].limit(id);
    res.setHeader('X-RateLimit-Limit', limit);
    res.setHeader('X-RateLimit-Remaining', remaining);
    res.setHeader('X-RateLimit-Reset', reset);
    if (!success) {
      const retryAfter = Math.ceil((reset - Date.now()) / 1000);
      res.setHeader('Retry-After', retryAfter);
      res.status(429).json({ error: 'Too many requests. Please try again later.', retryAfter });
      return false;
    }
    return true;
  } catch (err) {
    console.error('Rate limit check failed:', err);
    return true; // fail open
  }
}
