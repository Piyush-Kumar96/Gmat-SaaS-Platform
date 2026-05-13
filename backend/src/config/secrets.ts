/**
 * Production-only secret guard. Run once at boot from index.ts.
 *
 * Dev keeps using the hardcoded fallbacks scattered through the codebase
 * (see roleAuth.ts, authMiddleware.ts, authRoutes.ts) so onboarding stays
 * easy. In production those fallbacks must never be reached — this guard
 * fails fast if any required secret is missing or still set to its dev
 * default. That's the contract called out in GO_LIVE_PLAN.md § 6.
 */

const PROD_REQUIRED = ['MONGODB_URI', 'JWT_SECRET', 'JWT_REFRESH_SECRET'] as const;

const KNOWN_DEV_DEFAULTS: Record<string, string[]> = {
  JWT_SECRET: [
    'development-jwt-secret-do-not-use-in-production',
    'gmat-quiz-jwt-secret-key-dev',
  ],
  JWT_REFRESH_SECRET: ['development-refresh-secret-do-not-use-in-production'],
};

export function assertProductionSecrets(): void {
  if (process.env.NODE_ENV !== 'production') return;

  const missing: string[] = [];
  const usingDefaults: string[] = [];

  for (const key of PROD_REQUIRED) {
    const value = process.env[key];
    if (!value || !value.trim()) {
      missing.push(key);
      continue;
    }
    if ((KNOWN_DEV_DEFAULTS[key] || []).includes(value)) {
      usingDefaults.push(key);
    }
  }

  if (missing.length === 0 && usingDefaults.length === 0) return;

  const lines: string[] = ['Refusing to boot in NODE_ENV=production:'];
  if (missing.length) lines.push(`  Missing required env vars: ${missing.join(', ')}`);
  if (usingDefaults.length) lines.push(`  Insecure dev defaults detected for: ${usingDefaults.join(', ')}`);
  lines.push('  Populate .env.production with strong values (e.g. openssl rand -base64 64).');
  throw new Error(lines.join('\n'));
}
