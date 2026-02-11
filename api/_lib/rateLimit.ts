import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
});

export const rateLimiters = {
  read: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(60, '1 m'), prefix: 'rl:read' }),
  write: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(20, '1 m'), prefix: 'rl:write' }),
  ai: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(5, '1 m'), prefix: 'rl:ai' }),
  sensitive: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(5, '10 m'), prefix: 'rl:sensitive' }),
  form: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(5, '1 h'), prefix: 'rl:form' }),
};

export type RateLimitTier = keyof typeof rateLimiters;

export async function checkRateLimit(req: any, res: any, tier: RateLimitTier = 'read'): Promise<boolean> {
  const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || 'unknown';
  const { success, limit, remaining, reset } = await rateLimiters[tier].limit(ip);
  
  res.setHeader('X-RateLimit-Limit', limit);
  res.setHeader('X-RateLimit-Remaining', remaining);
  res.setHeader('X-RateLimit-Reset', reset);
  
  if (!success) {
    res.status(429).json({ error: 'Too many requests. Please try again later.' });
    return false;
  }
  return true;
}
