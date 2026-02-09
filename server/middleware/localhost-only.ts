import type { Request, Response, NextFunction } from 'express';

/**
 * Allowed IPs for localhost access
 * Includes IPv4 localhost, IPv6 localhost, and IPv4-mapped IPv6 localhost
 */
const ALLOWED_IPS = ['127.0.0.1', '::1', '::ffff:127.0.0.1'];

/**
 * Middleware to enforce localhost-only access to the backend.
 * Rejects requests from non-localhost IPs with 403 Forbidden.
 *
 * This provides a security boundary for a local-only app that should
 * never be exposed to the network.
 */
export function localhostOnly(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const clientIp = req.ip || req.socket.remoteAddress;

  if (!clientIp || !ALLOWED_IPS.includes(clientIp)) {
    console.warn(`[SECURITY] Access denied for IP: ${clientIp}`);
    res.status(403).json({
      error: 'Access denied - localhost only'
    });
    return;
  }

  next();
}
