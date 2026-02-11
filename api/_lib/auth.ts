// api/_lib/auth.ts — Clerk JWT verification middleware
import type { VercelRequest } from '@vercel/node';
import { createClerkClient } from '@clerk/backend';

const clerk = createClerkClient({ 
  secretKey: process.env.CLERK_SECRET_KEY 
});

export interface AuthPayload {
  sub: string; // User ID
  sessionId: string;
  [key: string]: any;
}

/**
 * Verify Clerk JWT token from Authorization header
 * @returns Decoded token payload or null if invalid/missing
 */
export async function verifyAuth(req: VercelRequest): Promise<AuthPayload | null> {
  const authHeader = req.headers.authorization;
  const token = authHeader?.replace('Bearer ', '').trim();
  
  if (!token) return null;

  try {
    const payload = await clerk.verifyToken(token, {
      secretKey: process.env.CLERK_SECRET_KEY,
    });
    return payload as AuthPayload;
  } catch (err) {
    console.error('Auth verification failed:', err);
    return null;
  }
}

/**
 * Middleware wrapper: returns 401 if not authenticated
 */
export function requireAuth(handler: (req: VercelRequest, res: any, user: AuthPayload) => Promise<any>) {
  return async (req: VercelRequest, res: any) => {
    const user = await verifyAuth(req);
    if (!user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    return handler(req, res, user);
  };
}
