/**
 * In-memory sliding-window rate limiter.
 * For multi-instance deploys, replace with Redis / edge rate limiting.
 */
import { json } from '@sveltejs/kit';

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

export type RateLimitResult = { ok: true } | { ok: false; retryAfterSec: number };

export function checkRateLimit(
	key: string,
	maxRequests: number,
	windowMs: number,
): RateLimitResult {
	const now = Date.now();
	let bucket = buckets.get(key);
	if (!bucket || now >= bucket.resetAt) {
		bucket = { count: 0, resetAt: now + windowMs };
		buckets.set(key, bucket);
	}
	bucket.count += 1;
	if (bucket.count > maxRequests) {
		return { ok: false, retryAfterSec: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)) };
	}
	return { ok: true };
}

/** Best-effort cleanup so long-running processes don't grow memory without bound. */
if (typeof setInterval !== 'undefined') {
	setInterval(() => {
		const now = Date.now();
		for (const [key, bucket] of buckets) {
			if (now >= bucket.resetAt) buckets.delete(key);
		}
	}, 60_000);
}

/** Global AI bucket — covers most LLM / vision routes. */
const AI_ROUTE_RE =
	/^\/api\/(vertex|brand\/(generate|extract)|news(\/|$)|generate(-slides)?|hooks|analyze|stock\/query|videos\/(analyze|reframe-clip))/;

/** Expensive OpenRouter copy jobs — extra per-user burst cap on top of the global AI limit. */
const AI_HEAVY_ROUTE_RE =
	/^\/api\/(news(\/|$)|generate-slides|hooks|brand\/generate|videos\/analyze)/;

export function apiRateLimitKey(pathname: string): 'ai' | 'api' {
	return AI_ROUTE_RE.test(pathname) ? 'ai' : 'api';
}

export function isAiHeavyPath(pathname: string): boolean {
	return AI_HEAVY_ROUTE_RE.test(pathname);
}

export const RATE_LIMITS = {
	/** General authenticated API traffic. */
	api: { max: 120, windowMs: 60_000 },
	/** All AI routes (global handle). */
	ai: { max: 20, windowMs: 60_000 },
	/**
	 * Extra burst cap for expensive copy/vision calls.
	 * Applied in handlers (and optionally hooks) keyed by user id.
	 */
	aiHeavy: { max: 8, windowMs: 60_000 },
} as const;

export function rateLimitedJson(retryAfterSec: number) {
	return json(
		{ error: 'Too many requests. Slow down and try again.', code: 'rate_limited' },
		{
			status: 429,
			headers: { 'Retry-After': String(retryAfterSec) },
		},
	);
}

/** Per-user heavy AI burst check. Call after auth on expensive generate routes. */
export function enforceAiHeavyRateLimit(userId: string): RateLimitResult {
	const { max, windowMs } = RATE_LIMITS.aiHeavy;
	return checkRateLimit(`user:${userId}:aiHeavy`, max, windowMs);
}
