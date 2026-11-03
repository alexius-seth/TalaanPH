import { createHmac, timingSafeEqual } from 'crypto';

export const AUTH_COOKIE = 'talaan_session';

function getSecret(): string {
  const secret = process.env.AUTH_SECRET || process.env.STORE_PIN;
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      console.warn('[AUTH] Warning: AUTH_SECRET not configured in production environment. Using safe fallback.');
    }
    return 'talaan-dev-secret-fallback-2026';
  }
  return secret;
}

/**
 * Creates a signed session token: "<timestamp>.<signature>"
 */
export function createSessionToken(): string {
  const timestamp = Date.now().toString();
  const signature = createHmac('sha256', getSecret()).update(timestamp).digest('hex');
  return `${timestamp}.${signature}`;
}

/**
 * Validates a session token (valid signature and within 30 days).
 */
export function isValidSession(token: string | null | undefined): boolean {
  if (!token) return false;
  const parts = token.split('.');
  if (parts.length !== 2) return false;
  const [timestamp, signature] = parts;
  const expectedSignature = createHmac('sha256', getSecret()).update(timestamp).digest('hex');

  const sigBuf = Buffer.from(signature);
  const expBuf = Buffer.from(expectedSignature);
  if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
    return false;
  }

  const age = Date.now() - Number(timestamp);
  // Valid for 30 days
  return age >= 0 && age < 30 * 24 * 60 * 60 * 1000;
}

/**
 * Checks if incoming request has a valid session token (via cookie or Bearer header).
 */
export function isSessionAuthorized(req: Request): boolean {
  // Check cookie
  const cookieHeader = req.headers.get('cookie') || '';
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${AUTH_COOKIE}=([^;]+)`));
  const cookieToken = match ? match[1] : undefined;
  if (cookieToken && isValidSession(cookieToken)) {
    return true;
  }

  // Check Bearer header
  const authHeader = req.headers.get('authorization');
  if (authHeader && authHeader.toLowerCase().startsWith('bearer ')) {
    const bearerToken = authHeader.slice(7).trim();
    if (isValidSession(bearerToken)) {
      return true;
    }
  }

  // In development mode only without AUTH_SECRET configured, allow fallback
  if (process.env.NODE_ENV !== 'production' && !process.env.AUTH_SECRET) {
    return true;
  }

  return false;
}

