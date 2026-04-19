import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import type { RequestHandler } from './$types';

/** Simple in-memory LRU cache (prompt → dataUrl) */
const cache = new Map<string, string>();
const MAX_CACHE = 50;

function cacheSet(key: string, val: string) {
	if (cache.size >= MAX_CACHE) {
		const first = cache.keys().next().value;
		if (first) cache.delete(first);
	}
	cache.set(key, val);
}

async function getAccessToken(): Promise<string> {
	const { readFileSync, existsSync } = await import('fs');
	const { homedir } = await import('os');
	const { join } = await import('path');

	let credentials: any;

	// Priority 1: inline JSON in env var (for production/Vercel)
	if (env.GOOGLE_SERVICE_ACCOUNT_JSON) {
		credentials = JSON.parse(env.GOOGLE_SERVICE_ACCOUNT_JSON);
	}
	// Priority 2: explicit file path in env var
	else if (env.GOOGLE_APPLICATION_CREDENTIALS && !env.GOOGLE_APPLICATION_CREDENTIALS.includes('/path/to/')) {
		credentials = JSON.parse(readFileSync(env.GOOGLE_APPLICATION_CREDENTIALS, 'utf8'));
	}
	// Priority 3: gcloud CLI Application Default Credentials (local dev)
	else {
		const adcPath = join(homedir(), '.config', 'gcloud', 'application_default_credentials.json');
		if (existsSync(adcPath)) {
			credentials = JSON.parse(readFileSync(adcPath, 'utf8'));
		} else {
			throw new Error(
				'No Google credentials found. Run: gcloud auth application-default login\n' +
				'Or set GOOGLE_SERVICE_ACCOUNT_JSON in your .env'
			);
		}
	}

	// ── authorized_user (gcloud CLI / OAuth2) ──────────────────────────
	if (credentials.type === 'authorized_user') {
		const res = await fetch('https://oauth2.googleapis.com/token', {
			method: 'POST',
			headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
			body: new URLSearchParams({
				client_id: credentials.client_id,
				client_secret: credentials.client_secret,
				refresh_token: credentials.refresh_token,
				grant_type: 'refresh_token',
			}),
		});
		if (!res.ok) throw new Error(`ADC token refresh failed: ${await res.text()}`);
		return (await res.json()).access_token;
	}

	// ── service_account (JSON key file) ───────────────────────────────
	const { private_key, client_email } = credentials;
	const now = Math.floor(Date.now() / 1000);

	const b64url = (s: string) => btoa(s).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
	const header  = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
	const payload = b64url(JSON.stringify({
		iss: client_email,
		scope: 'https://www.googleapis.com/auth/cloud-platform',
		aud: 'https://oauth2.googleapis.com/token',
		exp: now + 3600, iat: now,
	}));

	const signingInput = `${header}.${payload}`;
	const pemBody = private_key.replace(/\\n/g,'\n')
		.replace(/-----BEGIN PRIVATE KEY-----/,'').replace(/-----END PRIVATE KEY-----/,'').replace(/\s/g,'');
	const keyDer = Uint8Array.from(atob(pemBody), c => c.charCodeAt(0));

	const cryptoKey = await crypto.subtle.importKey(
		'pkcs8', keyDer, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']
	);
	const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', cryptoKey, new TextEncoder().encode(signingInput));
	const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sig))).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');

	const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
		method: 'POST',
		headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
		body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${signingInput}.${sigB64}` }),
	});
	if (!tokenRes.ok) throw new Error(`Token exchange failed: ${await tokenRes.text()}`);
	return (await tokenRes.json()).access_token;
}

export const POST: RequestHandler = async ({ request }) => {
	const { prompt, aspect = '3:4', context } = await request.json();

	if (!prompt) return json({ error: 'Missing prompt' }, { status: 400 });

	const cacheKey = `${prompt}:${aspect}`;
	if (cache.has(cacheKey)) {
		return json({ dataUrl: cache.get(cacheKey), cached: true });
	}

	// Build editorial image prompt
	const fullPrompt = `Generate a single high-quality editorial news photograph for this story: ${prompt}.
${context ? `Additional context: ${context}` : ''}
Style: Photojournalistic, sharp, dramatic natural lighting. Shot on Sony A7 IV full-frame.
Composition: Rule of thirds, no text overlays, suitable for Instagram (${aspect} ratio).
Quality: 8K, professional editorial photography, award-winning photojournalism.`;

	// Demo mode — no credentials
	const { existsSync } = await import('fs');
	const { homedir } = await import('os');
	const { join } = await import('path');
	const adcExists = existsSync(join(homedir(), '.config', 'gcloud', 'application_default_credentials.json'));
	const hasCredentials = env.GOOGLE_SERVICE_ACCOUNT_JSON ||
		(env.GOOGLE_APPLICATION_CREDENTIALS && !env.GOOGLE_APPLICATION_CREDENTIALS.includes('/path/to/')) ||
		adcExists;

	if (!hasCredentials) {
		// Return a placeholder gradient as base64 PNG
		return json({
			dataUrl: null,
			demo: true,
			message: 'Configure GOOGLE_SERVICE_ACCOUNT_JSON or GOOGLE_APPLICATION_CREDENTIALS to enable image generation.',
		});
	}

	try {
		const accessToken = await getAccessToken();

		const projectId = env.VERTEX_PROJECT_ID;
		const location = env.VERTEX_LOCATION ?? 'us-central1';
		const model = env.VERTEX_IMAGEN_MODEL ?? 'imagen-4.0-generate-001';

		// Map aspect ratio to Imagen format
		const aspectMap: Record<string, string> = {
			'1:1': '1:1',
			'3:4': '3:4',
			'4:3': '4:3',
			'9:16': '9:16',
			'16:9': '16:9',
		};
		const imagenAspect = aspectMap[aspect] ?? '3:4';

		const endpoint = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/${model}:predict`;

		const res = await fetch(endpoint, {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${accessToken}`,
				'Content-Type': 'application/json; charset=utf-8',
			},
			body: JSON.stringify({
				instances: [{ prompt: fullPrompt }],
				parameters: {
					sampleCount: 1,
					aspectRatio: imagenAspect,
					safetyFilterLevel: 'block_some',
					personGeneration: 'allow_adult',
				},
			}),
		});

		if (!res.ok) {
			const err = await res.text();
			console.error('[api/vertex] generation error:', err);
			return json({ error: `Vertex error: ${res.status}`, details: err }, { status: 500 });
		}

		const data = await res.json();
		const b64 = data?.predictions?.[0]?.bytesBase64Encoded;
		if (!b64) return json({ error: 'No image returned from Vertex' }, { status: 500 });

		const dataUrl = `data:image/png;base64,${b64}`;
		cacheSet(cacheKey, dataUrl);

		return json({ dataUrl, model });
	} catch (err: any) {
		console.error('[api/vertex]', err.message);
		return json({ error: err.message }, { status: 500 });
	}
};
