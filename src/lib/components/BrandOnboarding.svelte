<script lang="ts">
	/**
	 * First-run identity sheet — username, handle, and logo for brand kit.
	 */
	import { onMount } from 'svelte';
	import { ImagePlus, X } from 'lucide-svelte';
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
	let logoUrl = $state('');
	let logoInput = $state<HTMLInputElement | null>(null);
	let error = $state('');

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
			logoUrl = String(kit.logoUrl ?? '').trim();
			open = true;
		})();
	});

	function onLogoPicked(e: Event) {
		const input = e.currentTarget as HTMLInputElement;
		const file = input.files?.[0] ?? null;
		input.value = '';
		if (!file || !file.type.startsWith('image/')) {
			error = 'Choose an image file for your logo.';
			return;
		}
		error = '';
		const reader = new FileReader();
		reader.onload = () => {
			const next = typeof reader.result === 'string' ? reader.result : '';
			if (!next.startsWith('data:image/')) {
				error = 'Could not read that logo — try a PNG or JPG.';
				return;
			}
			logoUrl = next;
		};
		reader.onerror = () => {
			error = 'Could not read that logo — try again.';
		};
		reader.readAsDataURL(file);
	}

	function clearLogo() {
		logoUrl = '';
	}

	function submit() {
		const displayName = name.trim();
		if (displayName.length < 2) {
			error = 'Add a username — it shows on Text Carousel and Creator slides.';
			return;
		}
		error = '';
		const nextHandle = normalizeBrandHandle(handle);
		const nextLogo = logoUrl.trim();
		const kit = loadBrandKit(userId);
		const saved: BrandKitSettings = {
			...kit,
			displayName,
			handle: nextHandle,
			logoUrl: nextLogo,
			sourceLabelMode: nextLogo ? 'logo' : kit.sourceLabelMode,
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

				<p class="ob-label" id="ob-logo-label">Logo</p>
				<input
					bind:this={logoInput}
					type="file"
					accept="image/*"
					class="sr-only"
					aria-labelledby="ob-logo-label"
					onchange={onLogoPicked}
				/>
				{#if logoUrl}
					<div class="ob-logo-row">
						<img class="ob-logo-preview" src={logoUrl} alt="Brand logo preview" />
						<div class="ob-logo-actions">
							<button type="button" class="ob-logo-btn" onclick={() => logoInput?.click()}>
								Replace
							</button>
							<button type="button" class="ob-logo-btn is-quiet" onclick={clearLogo}>
								<X size={14} strokeWidth={2.2} />
								Remove
							</button>
						</div>
					</div>
				{:else}
					<button
						type="button"
						class="ob-logo-drop"
						onclick={() => logoInput?.click()}
					>
						<span class="ob-logo-icon" aria-hidden="true">
							<ImagePlus size={18} strokeWidth={2} />
						</span>
						<span class="ob-logo-copy">
							<span class="ob-logo-title">Upload logo</span>
							<span class="ob-logo-sub">PNG or JPG · used on News slides</span>
						</span>
					</button>
				{/if}

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
		margin: 0 0 22px;
		font-family: 'Satoshi', sans-serif;
		font-size: 26px;
		font-weight: 800;
		letter-spacing: -0.035em;
		line-height: 1.15;
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
		border-color: #7bf1a8;
		box-shadow: 0 0 0 3px rgba(123, 241, 168, 0.28);
	}
	.ob-logo-drop {
		display: flex;
		align-items: center;
		gap: 12px;
		width: 100%;
		margin: 0 0 14px;
		padding: 12px 14px;
		border-radius: 12px;
		border: 1px dashed rgba(20, 18, 15, 0.18);
		background: #fffdf8;
		text-align: left;
		cursor: pointer;
		color: inherit;
	}
	.ob-logo-drop:hover {
		border-color: rgba(123, 241, 168, 0.8);
		background: color-mix(in oklab, #7bf1a8 10%, #fffdf8);
	}
	.ob-logo-icon {
		display: grid;
		place-items: center;
		width: 40px;
		height: 40px;
		border-radius: 10px;
		background: color-mix(in oklab, #7bf1a8 22%, #fff);
		color: #0f0f10;
		flex-shrink: 0;
	}
	.ob-logo-copy {
		display: flex;
		flex-direction: column;
		gap: 2px;
		min-width: 0;
	}
	.ob-logo-title {
		font-size: 13px;
		font-weight: 700;
	}
	.ob-logo-sub {
		font-size: 11px;
		color: rgba(20, 18, 15, 0.5);
	}
	.ob-logo-row {
		display: flex;
		align-items: center;
		gap: 12px;
		margin: 0 0 14px;
		padding: 10px 12px;
		border-radius: 12px;
		border: 1px solid rgba(20, 18, 15, 0.1);
		background: #fffdf8;
	}
	.ob-logo-preview {
		width: 48px;
		height: 48px;
		border-radius: 10px;
		object-fit: contain;
		background: #111110;
		flex-shrink: 0;
	}
	.ob-logo-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}
	.ob-logo-btn {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		height: 32px;
		padding: 0 10px;
		border-radius: 8px;
		border: 1px solid rgba(20, 18, 15, 0.12);
		background: #fff;
		font-size: 12px;
		font-weight: 600;
		cursor: pointer;
		color: #14120f;
	}
	.ob-logo-btn.is-quiet {
		background: transparent;
		color: rgba(20, 18, 15, 0.55);
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
		background: #7bf1a8;
		color: #0f0f10;
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
		background: #a7f7c6;
	}
</style>
