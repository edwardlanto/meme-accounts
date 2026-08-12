<script lang="ts">
	/**
	 * First-run identity sheet — username + handle for Text Carousel /
	 * Creator hook (News branding uses logo, not a text byline).
	 */
	import { onMount } from 'svelte';
	import {
		hydrateBrandKit,
		loadBrandKit,
		normalizeBrandHandle,
		saveBrandKit,
		type BrandKitSettings,
	} from '$lib/studio/brand-kit';

	interface Props {
		userId: string;
		onComplete?: (kit: BrandKitSettings) => void;
	}

	let { userId, onComplete }: Props = $props();

	let open = $state(false);
	let name = $state('');
	let handle = $state('');
	let error = $state('');

	const previewName = $derived(name.trim() || 'YOUR NAME');
	const previewHandle = $derived(normalizeBrandHandle(handle) || '@yourhandle');
	const canSave = $derived(name.trim().length >= 2);

	onMount(() => {
		if (!userId) return;
		void (async () => {
			const kit = await hydrateBrandKit(userId);
			if (kit.onboardingComplete) return;
			if (kit.displayName.trim().length >= 2) {
				saveBrandKit(userId, { ...kit, onboardingComplete: true });
				return;
			}
			name = kit.displayName;
			handle = kit.handle;
			open = true;
		})();
	});

	function submit() {
		const displayName = name.trim();
		if (displayName.length < 2) {
			error = 'Add a username — it shows on Text Carousel and Creator slides.';
			return;
		}
		error = '';
		const nextHandle = normalizeBrandHandle(handle);
		const kit = loadBrandKit(userId);
		const saved: BrandKitSettings = {
			...kit,
			displayName,
			handle: nextHandle,
			onboardingComplete: true,
		};
		saveBrandKit(userId, saved);
		open = false;
		onComplete?.(saved);
	}
</script>

{#if open}
	<div class="ob-root" role="dialog" aria-modal="true" aria-labelledby="ob-title">
		<div class="ob-veil"></div>
		<div class="ob-sheet">
			<p class="ob-kicker">First, your identity</p>
			<h2 id="ob-title" class="ob-title">Who should appear on every slide?</h2>
			<p class="ob-lede">
				Username and handle show on Text Carousel and Creator hooks. Add your logo in Branding
				for News slides. You can change these later in Branding or Settings.
			</p>

			<div class="ob-preview" aria-hidden="true">
				<div class="ob-rule">
					<span class="ob-rule-line"></span>
					<span class="ob-rule-name">{previewName}</span>
					<span class="ob-rule-line"></span>
				</div>
				<p class="ob-preview-handle">{previewHandle}</p>
			</div>

			<form
				class="ob-form"
				onsubmit={(e) => {
					e.preventDefault();
					submit();
				}}
			>
				<label class="ob-label" for="ob-name">Username</label>
				<input
					id="ob-name"
					class="ob-input"
					type="text"
					bind:value={name}
					placeholder="MEME ACCOUNTS"
					autocomplete="nickname"
					maxlength={48}
				/>
				<label class="ob-label" for="ob-handle">Handle</label>
				<input
					id="ob-handle"
					class="ob-input"
					type="text"
					bind:value={handle}
					placeholder="@memeaccounts"
					autocomplete="username"
					maxlength={48}
				/>
				{#if error}
					<p class="ob-error">{error}</p>
				{/if}
				<button type="submit" class="ob-go" disabled={!canSave}>Save and continue</button>
			</form>
		</div>
	</div>
{/if}

<style>
	.ob-root {
		position: fixed;
		inset: 0;
		z-index: 500;
		display: grid;
		place-items: center;
		padding: 24px;
	}
	.ob-veil {
		position: absolute;
		inset: 0;
		background: rgba(8, 8, 8, 0.52);
		backdrop-filter: blur(10px);
	}
	.ob-sheet {
		position: relative;
		width: min(440px, 100%);
		padding: 28px 28px 24px;
		border-radius: 20px;
		background: #f7f4ee;
		color: #14120f;
		box-shadow: 0 24px 80px rgba(0, 0, 0, 0.28);
		border: 1px solid rgba(20, 18, 15, 0.08);
	}
	.ob-kicker {
		margin: 0 0 8px;
		font-size: 10px;
		font-weight: 700;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		color: #b0892e;
	}
	.ob-title {
		margin: 0 0 10px;
		font-family: 'Satoshi', sans-serif;
		font-size: 26px;
		font-weight: 800;
		letter-spacing: -0.035em;
		line-height: 1.15;
	}
	.ob-lede {
		margin: 0 0 22px;
		font-size: 13px;
		line-height: 1.5;
		color: rgba(20, 18, 15, 0.62);
	}
	.ob-preview {
		margin: 0 0 22px;
		padding: 18px 16px 14px;
		border-radius: 14px;
		background: #111110;
	}
	.ob-rule {
		display: flex;
		align-items: center;
		gap: 12px;
	}
	.ob-rule-line {
		flex: 1;
		height: 2px;
		background: #e8c547;
		opacity: 0.92;
	}
	.ob-rule-name {
		font-family: 'Satoshi', sans-serif;
		font-size: 13px;
		font-weight: 800;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: #e8c547;
		white-space: nowrap;
		max-width: 70%;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.ob-preview-handle {
		margin: 10px 0 0;
		text-align: center;
		font-size: 12px;
		font-style: italic;
		color: rgba(255, 255, 255, 0.45);
	}
	.ob-form {
		display: flex;
		flex-direction: column;
	}
	.ob-label {
		margin: 0 0 6px;
		font-size: 10px;
		font-weight: 700;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: rgba(20, 18, 15, 0.5);
	}
	.ob-input {
		margin: 0 0 14px;
		height: 42px;
		padding: 0 12px;
		border-radius: 10px;
		border: 1px solid rgba(20, 18, 15, 0.12);
		background: #fffdf8;
		color: #14120f;
		font-size: 14px;
		font-family: 'Satoshi', sans-serif;
		outline: none;
	}
	.ob-input:focus {
		border-color: #c4a035;
		box-shadow: 0 0 0 3px rgba(232, 197, 71, 0.28);
	}
	.ob-error {
		margin: -6px 0 12px;
		font-size: 12px;
		color: #b42318;
	}
	.ob-go {
		margin-top: 4px;
		height: 44px;
		border: 0;
		border-radius: 999px;
		background: #111110;
		color: #f7f4ee;
		font-size: 13px;
		font-weight: 700;
		letter-spacing: 0.02em;
		cursor: pointer;
	}
	.ob-go:disabled {
		opacity: 0.35;
		cursor: not-allowed;
	}
	.ob-go:not(:disabled):hover {
		background: #2a2824;
	}
</style>
