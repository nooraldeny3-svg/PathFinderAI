import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const envFile = fileURLToPath(new URL('../.env', import.meta.url));
if (existsSync(envFile)) process.loadEnvFile(envFile);

const env = process.env;

export const config = {
  port: Number(env.PORT) || 4000,
  databaseUrl: env.DATABASE_URL || 'postgres://pathfinder:pathfinder@localhost:5432/pathfinder',
  jwtSecret: env.JWT_SECRET || 'dev-only-secret',
  jwtExpiresIn: env.JWT_EXPIRES_IN || '7d',
  clientOrigin: env.CLIENT_ORIGIN || 'http://localhost:5173',
  // Applies to /auth/login and /auth/register, per IP
  authRateLimit: {
    windowMs: Number(env.AUTH_RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
    max: Number(env.AUTH_RATE_LIMIT_MAX) || 10,
  },
  ai: {
    provider: (env.AI_PROVIDER || 'none').toLowerCase(),
    timeoutMs: Number(env.AI_TIMEOUT_MS) || 15000,
    cacheTtlMs: Number(env.AI_CACHE_TTL_MS) || 60 * 60 * 1000,
    openai: { apiKey: env.OPENAI_API_KEY, model: env.OPENAI_MODEL || 'gpt-4o-mini' },
    gemini: { apiKey: env.GEMINI_API_KEY, model: env.GEMINI_MODEL || 'gemini-2.0-flash' },
  },
};

if (env.NODE_ENV === 'production' && !env.JWT_SECRET) {
  throw new Error('JWT_SECRET must be set in production');
}
