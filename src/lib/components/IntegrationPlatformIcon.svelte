<script lang="ts">
	import type { ZernioConnectPlatform } from '$lib/integrations/zernio-platforms';

	let { platform, size = 22 }: { platform: ZernioConnectPlatform; size?: number } = $props();
</script>

<svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
	{#if platform === 'linkedin'}
		<rect width="24" height="24" rx="5" fill="currentColor" fill-opacity="0.12" />
		<path
			fill="currentColor"
			d="M8.5 9.5h-2.6v9.2H8.5V9.5zm-1.3-3.2a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zm4.8 3.2H9.4v9.2h2.6v-4.4c0-1.2.9-2.2 2.1-2.2s1.8 1 1.8 2.4v4.2H18v-4.7c0-2.7-1.4-4-3.5-4-1.6 0-2.6.9-3 1.7l-.1-1.4z"
		/>
	{:else if platform === 'facebook'}
		<rect width="24" height="24" rx="5" fill="currentColor" fill-opacity="0.12" />
		<path
			fill="currentColor"
			d="M14.5 8.5h2.2l-.3 2.6h-1.9v7.4h-3V11.1H10V8.5h1.5V7c0-1.4.7-2.4 2.4-2.4h1.6v2.6h-1c-.7 0-.9.4-.9 1v.3z"
		/>
	{:else if platform === 'instagram'}
		<rect width="24" height="24" rx="5" fill="currentColor" fill-opacity="0.12" />
		<rect x="6" y="6" width="12" height="12" rx="3.5" stroke="currentColor" stroke-width="1.6" />
		<circle cx="12" cy="12" r="2.8" stroke="currentColor" stroke-width="1.6" />
		<circle cx="16.2" cy="7.8" r="1" fill="currentColor" />
	{:else if platform === 'tiktok'}
		<rect width="24" height="24" rx="5" fill="currentColor" fill-opacity="0.12" />
		<path
			fill="currentColor"
			d="M14.8 8.2c.8.6 1.8 1 2.9 1v2.4c-1.1 0-2.1-.3-3-.8v5.4a4.2 4.2 0 1 1-3.7-4.2v2.5a1.7 1.7 0 1 0 1.2 1.6V6h2.6v2.2z"
		/>
	{:else if platform === 'twitter'}
		<rect width="24" height="24" rx="5" fill="currentColor" fill-opacity="0.12" />
		<path
			fill="currentColor"
			d="M16.5 7h2.3l-5.1 5.8L19.5 17h-4.1l-3.2-4.2-3.7 4.2H6.2l5.5-6.3L6 7h4.2l2.9 3.8L16.5 7z"
		/>
	{:else if platform === 'youtube'}
		<rect width="24" height="24" rx="5" fill="currentColor" fill-opacity="0.12" />
		<path fill="currentColor" d="M18.5 8.5c.8.3 1.4 1 1.7 1.8.4 1.2.4 3.9.4 3.9s0 2.7-.4 3.9c-.3.8-.9 1.5-1.7 1.8-1 .4-5 .4-5 .4s-4 0-5-.4c-.8-.3-1.4-1-1.7-1.8C7 15.9 7 13.2 7 13.2s0-2.7.4-3.9c.3-.8.9-1.5 1.7-1.8 1-.4 5-.4 5-.4s4 0 5 .4z" />
		<path fill="var(--app-surface-2, #fff)" d="M11.2 15.6V10.8L15 13.2l-3.8 2.4z" />
	{:else if platform === 'pinterest'}
		<rect width="24" height="24" rx="5" fill="currentColor" fill-opacity="0.12" />
		<path
			fill="currentColor"
			d="M12 6.5c-3 0-5.5 2.2-5.5 5.5 0 2.3 1.4 4.3 3.5 5.1-.05-.4-.1-1 .02-1.4.1-.4.7-2.6.7-2.6s-.2-.4-.2-1c0-.9.5-1.6 1.2-1.6.6 0 .8.4.8 1 0 .6-.4 1.5-.6 2.3-.2.7.4 1.3 1.1 1.3 1.3 0 2.3-1.4 2.3-3.4 0-1.8-1.3-3-3.2-3-2.2 0-3.5 1.6-3.5 3.3 0 .7.3 1.4.6 1.8.07.08.08.15.06.24-.06.24-.2.78-.23.9-.04.14-.12.17-.28.1-1-.5-1.6-2-1.6-3.2 0-2.6 1.9-5 5.5-5 2.9 0 5.1 2.1 5.1 4.9 0 2.9-1.8 5.2-4.4 5.2-.9 0-1.7-.5-2-.9l-.5 2c-.2.7-.7 1.6-1 2.1.8.2 1.6.4 2.4.4 3.9 0 7-3.2 7-7.1C18.8 8.8 15.7 6.5 12 6.5z"
		/>
	{:else}
		<rect width="24" height="24" rx="5" fill="currentColor" fill-opacity="0.12" />
		<circle cx="12" cy="12" r="4" fill="currentColor" />
	{/if}
</svg>
