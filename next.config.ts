import type { NextConfig } from 'next';

/**
 * En-têtes de sécurité (audit M3) : anti-clickjacking, anti-sniffing MIME,
 * transport strict, politique de référent et d'autorisations.
 * La CSP est volontairement minimale (frame-ancestors) : une CSP complète sur
 * les scripts demande des nonces Next.js — à faire dans un second temps.
 */
const entetes = [
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
  { key: 'Content-Security-Policy', value: "frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'" },
];

const config: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{ source: '/:path*', headers: entetes }];
  },
};

export default config;
