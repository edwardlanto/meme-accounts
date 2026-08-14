/** Client helpers for plan usage / carousel tokens. */
export async function refreshUsageStatus(): Promise<{
	signedIn: boolean;
	canGenerate?: boolean;
	remaining?: number | null;
	isPaid?: boolean;
	used?: number;
	limit?: number | null;
	plan?: string;
}> {
	const res = await fetch('/api/usage/status', { credentials: 'include' });
	return res.json();
}

/** @deprecated Use refreshUsageStatus */
export async function refreshTrialStatus(): Promise<{
	signedIn: boolean;
	canExport?: boolean;
	canGenerate?: boolean;
	remaining?: number | null;
	isPaid?: boolean;
}> {
	const res = await fetch('/api/usage/status', { credentials: 'include' });
	return res.json();
}

/** @deprecated Export no longer consumes tokens; kept for legacy call sites. */
export async function consumeTrialExport(): Promise<{
	ok: boolean;
	error?: string;
	remaining?: number | null;
	isPaid?: boolean;
}> {
	const res = await fetch('/api/trial/consume', {
		method: 'POST',
		credentials: 'include',
	});
	const data = await res.json();
	return data;
}

export async function consumeCarouselTokens(count = 1): Promise<{
	ok: boolean;
	error?: string;
	code?: string;
	remaining?: number | null;
	isPaid?: boolean;
	used?: number;
	limit?: number | null;
}> {
	const res = await fetch('/api/usage/consume', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		credentials: 'include',
		body: JSON.stringify({ count }),
	});
	const data = await res.json();
	return data;
}
