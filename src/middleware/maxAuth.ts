import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

export interface MaxUser {
  id: number;
  name?: string;
  username?: string;
  first_name?: string;
  last_name?: string;
}

export interface MaxAuthenticatedRequest extends Request {
  maxUser?: MaxUser;
}

export function maxAuth(req: MaxAuthenticatedRequest, res: Response, next: NextFunction): void {
  const initData = req.headers['x-max-init-data'] as string;

  if (!initData) {
    res.status(401).json({ error: 'Max init data required' });
    return;
  }

  try {
    // Max bridge may send URL-encoded initData — decode first
    const decoded = decodeURIComponent(initData);
    const params = new URLSearchParams(decoded);
    const hash = params.get('hash');
    params.delete('hash');

    if (!hash) {
      console.error('Max auth: no hash in initData');
      res.status(401).json({ error: 'Max hash missing' });
      return;
    }

    const dataCheckString = Array.from(params.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}=${value}`)
      .join('\n');

    const maxToken = process.env.MAX_BOT_TOKEN;
    if (!maxToken) {
      res.status(500).json({ error: 'Max auth not configured' });
      return;
    }

    // Method 1: Binary secret key (Telegram pattern)
    const secretKey = crypto.createHmac('sha256', 'WebAppData').update(maxToken).digest();
    const calculatedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

    if (calculatedHash === hash) {
      // Validation passed
      return extractUserAndProceed(params, req, res, next);
    }

    // Method 2: Hex string as key (alternative Max pattern)
    const secretKeyHex = crypto.createHmac('sha256', 'WebAppData').update(maxToken).digest('hex');
    const calculatedHash2 = crypto.createHmac('sha256', secretKeyHex).update(dataCheckString).digest('hex');

    if (calculatedHash2 === hash) {
      return extractUserAndProceed(params, req, res, next);
    }

    // Method 3: Try without URL decoding
    const paramsRaw = new URLSearchParams(initData);
    const hashRaw = paramsRaw.get('hash');
    paramsRaw.delete('hash');

    const dataCheckStringRaw = Array.from(paramsRaw.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}=${value}`)
      .join('\n');

    const calculatedHash3 = crypto.createHmac('sha256', secretKey).update(dataCheckStringRaw).digest('hex');

    if (calculatedHash3 === hashRaw) {
      return extractUserAndProceed(paramsRaw, req, res, next);
    }

    // Log debug info for troubleshooting
    console.error('Max auth HMAC mismatch:');
    console.error('  initData (first 200):', initData.substring(0, 200));
    console.error('  hash received:', hash);
    console.error('  hash calc (binary key):', calculatedHash);
    console.error('  hash calc (hex key):', calculatedHash2);
    console.error('  dataCheckString (first 200):', dataCheckString.substring(0, 200));

    res.status(401).json({ error: 'Invalid Max data' });
  } catch (error) {
    console.error('Max auth error:', error);
    res.status(401).json({ error: 'Max auth failed' });
  }
}

function extractUserAndProceed(
  params: URLSearchParams,
  req: MaxAuthenticatedRequest,
  res: Response,
  next: NextFunction,
): void {
  // Validate auth_date freshness (24 hours)
  // Max sends auth_date in milliseconds (13 digits), Telegram in seconds (10 digits)
  const authDate = params.get('auth_date');
  if (authDate) {
    const raw = parseInt(authDate);
    const authTimestamp = raw > 9999999999 ? raw : raw * 1000;
    const now = Date.now();
    if (now - authTimestamp > 24 * 60 * 60 * 1000) {
      console.error('Max auth: data expired, auth_date:', authDate);
      res.status(401).json({ error: 'Max auth data expired' });
      return;
    }
  }

  const userStr = params.get('user');
  if (!userStr) {
    console.error('Max auth: no user in initData, keys:', Array.from(params.keys()));
    res.status(401).json({ error: 'Max user data missing' });
    return;
  }

  try {
    req.maxUser = JSON.parse(userStr);
    next();
  } catch (e) {
    console.error('Max auth: failed to parse user JSON:', userStr);
    res.status(401).json({ error: 'Invalid Max user data' });
  }
}
