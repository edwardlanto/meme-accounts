/**
 * In-memory sliding-window rate limiter.
 * For multi-instance deploys, replace with Redis / edge rate limiting.
 */
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

const AI_ROUTE_RE =
	/^\/api\/(vertex|brand\/(generate|extract)|news(\/|$)|generate|generate-slides|hooks|analyze|videos\/analyze)/;

export function apiRateLimitKey(pathname: string): 'ai' | 'api' {
	return AI_ROUTE_RE.test(pathname) ? 'ai' : 'api';
}

export const RATE_LIMITS = {
	api: { max: 120, windowMs: 60_000 },
	ai: { max: 24, windowMs: 60_000 },
} as const;
