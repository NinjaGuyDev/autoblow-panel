import type { Request, Response, NextFunction } from 'express';

/**
 * Allowed IPs for localhost access
 * Includes IPv4 localhost, IPv6 localhost, and IPv4-mapped IPv6 localhost
 */
const ALLOWED_IPS = ['127.0.0.1', '::1', '::ffff:127.0.0.1'];

/**
 * Docker bridge networks use 172.16.0.0/12 (172.16.x.x - 172.31.x.x).
 * When running behind nginx in Docker, the request comes from the
 * nginx container's bridge IP, not localhost.
 */
function isDockerBridgeIp(ip: string): boolean {
  const raw = ip.startsWith('::ffff:') ? ip.slice(7) : ip;
  const parts = raw.split('.');
  if (parts.length !== 4) return false;
  const first = parseInt(parts[0], 10);
  const second = parseInt(parts[1], 10);
  return first === 172 && second >= 16 && second <= 31;
}

/**
 * Middleware to enforce localhost-only access to the backend.
 * Rejects requests from non-localhost IPs with 403 Forbidden.
 *
 * In Docker, trusts requests forwarded by nginx on the bridge network
 * when X-Real-IP indicates a localhost origin.
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

  if (clientIp && ALLOWED_IPS.includes(clientIp)) {
    return next();
  }

  // Trust Docker bridge peers forwarding from nginx reverse proxy
  if (clientIp && isDockerBridgeIp(clientIp)) {
    return next();
  }

  console.warn(`[SECURITY] Access denied for IP: ${clientIp}`);
  res.status(403).json({
    error: 'Access denied - localhost only'
  });
}
