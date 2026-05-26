import { env } from '$env/dynamic/private';
import { existsSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import { readFileSync } from 'fs';

export function hasGoogleCredentials(): boolean {
	const adcExists = existsSync(join(homedir(), '.config', 'gcloud', 'application_default_credentials.json'));
	return !!(
		env.GOOGLE_SERVICE_ACCOUNT_JSON ||
		(env.GOOGLE_APPLICATION_CREDENTIALS && !env.GOOGLE_APPLICATION_CREDENTIALS.includes('/path/to/')) ||
		adcExists
	);
}

export async function getGoogleAccessToken(): Promise<string> {
	let credentials: Record<string, unknown>;

	if (env.GOOGLE_SERVICE_ACCOUNT_JSON) {
		credentials = JSON.parse(env.GOOGLE_SERVICE_ACCOUNT_JSON);
	} else if (env.GOOGLE_APPLICATION_CREDENTIALS && !env.GOOGLE_APPLICATION_CREDENTIALS.includes('/path/to/')) {
		credentials = JSON.parse(readFileSync(env.GOOGLE_APPLICATION_CREDENTIALS, 'utf8'));
	} else {
		const adcPath = join(homedir(), '.config', 'gcloud', 'application_default_credentials.json');
		if (!existsSync(adcPath)) {
			throw new Error(
				'No Google credentials found. Run: gcloud auth application-default login or set GOOGLE_SERVICE_ACCOUNT_JSON',
			);
		}
		credentials = JSON.parse(readFileSync(adcPath, 'utf8'));
	}

	if (credentials.type === 'authorized_user') {
		const res = await fetch('https://oauth2.googleapis.com/token', {
			method: 'POST',
			headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
			body: new URLSearchParams({
				client_id: String(credentials.client_id ?? ''),
				client_secret: String(credentials.client_secret ?? ''),
				refresh_token: String(credentials.refresh_token ?? ''),
				grant_type: 'refresh_token',
			}),
		});
		if (!res.ok) throw new Error(`ADC token refresh failed: ${await res.text()}`);
		return (await res.json()).access_token as string;
	}

	const private_key = String(credentials.private_key ?? '');
	const client_email = String(credentials.client_email ?? '');
	const now = Math.floor(Date.now() / 1000);

	const b64url = (s: string) => btoa(s).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
	const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
	const payload = b64url(
		JSON.stringify({
			iss: client_email,
			scope: 'https://www.googleapis.com/auth/cloud-platform',
			aud: 'https://oauth2.googleapis.com/token',
			exp: now + 3600,
			iat: now,
		}),
	);

	const signingInput = `${header}.${payload}`;
	const pemBody = private_key
		.replace(/\\n/g, '\n')
		.replace(/-----BEGIN PRIVATE KEY-----/, '')
		.replace(/-----END PRIVATE KEY-----/, '')
		.replace(/\s/g, '');
	const keyDer = Uint8Array.from(atob(pemBody), (c) => c.charCodeAt(0));

	const cryptoKey = await crypto.subtle.importKey(
		'pkcs8',
		keyDer,
		{ name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
		false,
		['sign'],
	);
	const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', cryptoKey, new TextEncoder().encode(signingInput));
	const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sig)))
		.replace(/=/g, '')
		.replace(/\+/g, '-')
		.replace(/\//g, '_');

	const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
		method: 'POST',
		headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
		body: new URLSearchParams({
			grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
			assertion: `${signingInput}.${sigB64}`,
		}),
	});
	if (!tokenRes.ok) throw new Error(`Token exchange failed: ${await tokenRes.text()}`);
	return (await tokenRes.json()).access_token as string;
}
