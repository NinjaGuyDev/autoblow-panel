import helmet from 'helmet';

/**
 * Frame sources allowed for CSP frame-src directive.
 * These platforms are supported for embedded video playback.
 */
export const ALLOWED_FRAME_SOURCES = [
  'https://www.youtube.com',
  'https://www.youtube-nocookie.com',
  'https://player.vimeo.com',
  'https://*.pornhub.com',
  'https://*.xvideos.com'
];

/**
 * Creates helmet security middleware with CSP configuration
 * for embedded video platforms.
 *
 * NOTE: This should only be applied in production mode.
 * In development, CSP can interfere with Vite HMR.
 */
export function createSecurityMiddleware() {
  return helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"], // Tailwind requires unsafe-inline
        frameSrc: ALLOWED_FRAME_SOURCES,
        imgSrc: ["'self'", 'data:', 'https:'], // Thumbnails from embed platforms
        connectSrc: ["'self'"]
      }
    },
    // Do NOT set HSTS - handled by nginx in production
    // Short max-age causes confusion in dev
    hsts: false
  });
}
