/** Client auth modal open/close + safe redirect URLs (replaces /login & /signup pages). */

export type AuthMode = 'login' | 'signup';

export type AuthModalState = {
	open: boolean;
	mode: AuthMode;
	next: string;
	/** Optional banner error (e.g. OAuth callback failure). */
	bannerError: string;
};

/** Only allow same-origin relative paths (open-redirect safe). */
export function safeAuthNext(raw: string | null | undefined): string {
	if (!raw || !raw.startsWith('/') || raw.startsWith('//')) return '/dashboard';
	return raw;
}

export function authModalHref(mode: AuthMode, next?: string | null): string {
	const params = new URLSearchParams();
	params.set('auth', mode);
	params.set('next', safeAuthNext(next));
	return `/?${params.toString()}`;
}

type Listener = (s: AuthModalState) => void;

let state: AuthModalState = {
	open: false,
	mode: 'login',
	next: '/dashboard',
	bannerError: '',
};
const listeners = new Set<Listener>();

function emit() {
	for (const l of listeners) l(state);
}

export function getAuthModalState(): AuthModalState {
	return state;
}

export function subscribeAuthModal(listener: Listener): () => void {
	listeners.add(listener);
	listener(state);
	return () => listeners.delete(listener);
}

export function openAuthModal(
	mode: AuthMode,
	next?: string | null,
	opts?: { bannerError?: string },
) {
	state = {
		open: true,
		mode,
		next: safeAuthNext(next),
		bannerError: String(opts?.bannerError ?? '').trim(),
	};
	emit();
}

export function setAuthModalMode(mode: AuthMode) {
	state = { ...state, mode, bannerError: '' };
	emit();
}

export function closeAuthModal() {
	state = { ...state, open: false, bannerError: '' };
	emit();
}
