/** Client helper — call before exporting a trial-gated post. */
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

export async function refreshTrialStatus(): Promise<{
	signedIn: boolean;
	canExport?: boolean;
	remaining?: number | null;
	isPaid?: boolean;
}> {
	const res = await fetch('/api/trial/status', { credentials: 'include' });
	return res.json();
}
