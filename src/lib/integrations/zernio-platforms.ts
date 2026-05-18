/**
 * Zernio connect platforms — @see https://docs.zernio.com/
 */
export type ZernioConnectPlatform =
	| 'facebook'
	| 'instagram'
	| 'tiktok'
	| 'linkedin'
	| 'twitter'
	| 'youtube'
	| 'pinterest'
	| 'reddit'
	| 'bluesky'
	| 'threads'
	| 'googlebusiness'
	| 'telegram'
	| 'snapchat'
	| 'whatsapp'
	| 'discord';

export const ZERNIO_CONNECT_PLATFORMS: readonly ZernioConnectPlatform[] = [
	'facebook',
	'instagram',
	'tiktok',
	'linkedin',
	'twitter',
	'youtube',
	'pinterest',
	'reddit',
	'bluesky',
	'threads',
	'googlebusiness',
	'telegram',
	'snapchat',
	'whatsapp',
	'discord',
];

const PLATFORM_SET = new Set<string>(ZERNIO_CONNECT_PLATFORMS);

export function isZernioConnectPlatform(value: string): value is ZernioConnectPlatform {
	return PLATFORM_SET.has(value);
}

export type IntegrationPlatformDef = {
	id: ZernioConnectPlatform;
	label: string;
	shortLabel?: string;
	color: string;
	bg: string;
};

/** Primary platforms shown on the Integrations page (matches product UI). */
export const INTEGRATION_PLATFORMS: IntegrationPlatformDef[] = [
	{ id: 'linkedin', label: 'LinkedIn', color: '#0A66C2', bg: 'color-mix(in oklab, #0A66C2 12%, transparent)' },
	{ id: 'facebook', label: 'Facebook', color: '#1877F2', bg: 'color-mix(in oklab, #1877F2 12%, transparent)' },
	{ id: 'instagram', label: 'Instagram', color: '#E4405F', bg: 'color-mix(in oklab, #E4405F 12%, transparent)' },
	{ id: 'tiktok', label: 'TikTok', color: '#010101', bg: 'color-mix(in oklab, #25f4ee 14%, transparent)' },
	{ id: 'twitter', label: 'X', shortLabel: 'X (Twitter)', color: 'var(--app-text)', bg: 'color-mix(in oklab, var(--app-text) 10%, transparent)' },
	{ id: 'youtube', label: 'YouTube', color: '#FF0000', bg: 'color-mix(in oklab, #FF0000 10%, transparent)' },
	{ id: 'pinterest', label: 'Pinterest', color: '#BD081C', bg: 'color-mix(in oklab, #BD081C 10%, transparent)' },
];
