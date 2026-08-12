/** One-shot toast across a client navigation (e.g. Studio → Carousels after Save template). */

export const FLASH_TOAST_KEY = 'ssp:flash-toast';

export function setFlashToast(message: string) {
	const msg = String(message ?? '').trim();
	if (!msg || typeof sessionStorage === 'undefined') return;
	try {
		sessionStorage.setItem(FLASH_TOAST_KEY, JSON.stringify({ message: msg, at: Date.now() }));
	} catch {
		/* private mode / quota */
	}
}

/** Read + clear. Returns null if missing or older than `maxAgeMs`. */
export function consumeFlashToast(maxAgeMs = 20_000): string | null {
	if (typeof sessionStorage === 'undefined') return null;
	try {
		const raw = sessionStorage.getItem(FLASH_TOAST_KEY);
		if (!raw) return null;
		sessionStorage.removeItem(FLASH_TOAST_KEY);
		const parsed = JSON.parse(raw) as { message?: string; at?: number };
		const at = Number(parsed.at) || 0;
		if (at && Date.now() - at > maxAgeMs) return null;
		const msg = String(parsed.message ?? '').trim();
		return msg || null;
	} catch {
		try {
			sessionStorage.removeItem(FLASH_TOAST_KEY);
		} catch {
			/* ignore */
		}
		return null;
	}
}
