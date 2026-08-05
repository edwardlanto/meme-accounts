<script lang="ts">
	import { toPng } from 'html-to-image';
	import TweetTemplate from '$lib/components/templates/TweetTemplate.svelte';
	import { consumeTrialExport } from '$lib/trial-client';
	import {
		ArrowRight, Bird, Check, Download, Lock, Loader, Sparkles,
	} from 'lucide-svelte';

	let { data } = $props();

	const signedIn = $derived(Boolean(data.user));
	const trial = $derived(data.trial);

	let topName = $state('Chef 👨‍🍳');
	let topHandle = $state('@chefsevenn');
	let topText = $state('Ketchup or mayo or mustard?');
	let topImage = $state('/templates/tweet/demo-bg.jpg');
	let topVerified = $state(true);
	let bottomName = $state('Mo Mohler');
	let bottomHandle = $state('@MoMohler');
	let bottomText = $state('3 straight misses chef. These appear to be French fries.');
	let bottomVerified = $state(true);

	let exportRef: HTMLElement | null = $state(null);
	let exporting = $state(false);
	let exportError = $state<string | null>(null);
	let trialRemaining = $state<number | null>(data.trial?.remaining ?? null);
	let trialPaid = $state(data.trial?.isPaid ?? false);

	const previewScale = 520 / 1080;
	const canEdit = $derived(signedIn);
	const canExport = $derived(
		signedIn && (trialPaid || (trialRemaining !== null && trialRemaining > 0))
	);

	const jsonLd = {
		'@context': 'https://schema.org',
		'@type': 'WebApplication',
		name: 'Carousel Studio Fake Tweet Maker',
		applicationCategory: 'DesignApplication',
		operatingSystem: 'Web',
		description:
			'Free fake tweet maker and Twitter/X post generator. Design realistic tweet graphics for Instagram carousels, memes, and social content.',
		offers: {
			'@type': 'Offer',
			price: '0',
			priceCurrency: 'USD',
		},
	};

	async function exportPng() {
		if (!signedIn) {
			window.location.href = `/signup?next=${encodeURIComponent('/fake-tweet-maker')}`;
			return;
		}
		if (!exportRef) return;

		exporting = true;
		exportError = null;

		const gate = await consumeTrialExport();
		if (!gate.ok) {
			exportError = gate.error ?? 'Upgrade to export more posts.';
			exporting = false;
			return;
		}
		trialPaid = gate.isPaid ?? false;
		trialRemaining = gate.remaining ?? null;

		try {
			const dataUrl = await toPng(exportRef, {
				width: 1080,
				height: 1350,
				pixelRatio: 1,
				style: { transform: 'scale(1)', transformOrigin: 'top left' },
			});
			const a = document.createElement('a');
			a.href = dataUrl;
			a.download = 'fake-tweet.png';
			a.click();
		} catch (e: unknown) {
			exportError = e instanceof Error ? e.message : 'Export failed';
		}
		exporting = false;
	}

	function readAvatar(e: Event, setter: (v: string) => void) {
		const file = (e.target as HTMLInputElement).files?.[0];
		if (!file) return;
		const r = new FileReader();
		r.onload = () => setter(r.result as string);
		r.readAsDataURL(file);
	}
</script>

<svelte:head>
	<title>Fake Tweet Maker — Free Twitter / X Post Generator | Carousel Studio</title>
	<meta
		name="description"
		content="Make fake tweets for Instagram carousels and memes. Free tweet maker with realistic Twitter/X layout — sign in for 1 trial export, then upgrade for unlimited."
	/>
	<meta
		name="keywords"
		content="fake tweet maker, tweet maker, twitter post generator, fake twitter screenshot, x post maker, tweet template"
	/>
	<link rel="canonical" href="https://carouselstudio.app/fake-tweet-maker" />
	<meta property="og:title" content="Fake Tweet Maker — Carousel Studio" />
	<meta
		property="og:description"
		content="Design realistic fake tweets for social content. Free trial export, then upgrade for unlimited."
	/>
	<meta property="og:type" content="website" />
	{@html `<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>`}
</svelte:head>

<div class="page">
	<div class="atmosphere" aria-hidden="true">
		<div class="blob"></div>
	</div>

	<nav class="nav">
		<a href="/" class="logo">
			<span class="logo-mark">CS</span>
			<span class="logo-text">Carousel<em>Studio</em></span>
		</a>
		<div class="nav-links">
			<a href="/pricing">Pricing</a>
			<a href="/fake-tweet-maker" aria-current="page">Tweet Maker</a>
			<a href="/instagram-carousel-maker">Instagram</a>
			<a href="/linkedin-carousel-maker">LinkedIn</a>
		</div>
		<div class="nav-actions">
			{#if signedIn}
				<a href="/dashboard" class="nav-ghost">Dashboard</a>
			{:else}
				<a href="/login?next=/fake-tweet-maker" class="nav-ghost">Sign in</a>
				<a href="/signup?next=/fake-tweet-maker" class="btn-nav">Start free</a>
			{/if}
		</div>
	</nav>

	<header class="hero container">
		<span class="eyebrow"><Bird size={12} /> Tweet Maker</span>
		<h1>
			Fake tweet maker for <span class="accent">Twitter &amp; X</span> graphics
		</h1>
		<p class="lead">
			Build realistic tweet screenshots for Instagram carousels, meme pages, and commentary posts.
			This page is public — sign in to edit and export. Free accounts get <strong>one trial export</strong>,
			then upgrade for unlimited.
		</p>
	</header>

	<section class="maker container">
		<div class="editor" class:locked={!canEdit}>
			{#if !canEdit}
				<div class="lock-banner">
					<Lock size={16} />
					<span>Sign in to customize this tweet</span>
					<a href="/signup?next=/fake-tweet-maker" class="lock-cta">Create free account</a>
				</div>
			{/if}

			<div class="fields" aria-hidden={!canEdit}>
				<label>
					<span>Display name</span>
					<input bind:value={topName} disabled={!canEdit} />
				</label>
				<label>
					<span>Handle</span>
					<input bind:value={topHandle} disabled={!canEdit} />
				</label>
				<label class="full">
					<span>Tweet text</span>
					<textarea bind:value={topText} rows={3} disabled={!canEdit}></textarea>
				</label>
				<label class="full">
					<span>Reply text</span>
					<textarea bind:value={bottomText} rows={3} disabled={!canEdit}></textarea>
				</label>
				{#if canEdit}
					<label class="full">
						<span>Attach image</span>
						<input type="file" accept="image/*" onchange={(e) => readAvatar(e, (v) => (topImage = v))} />
					</label>
				{/if}
			</div>

			<div class="export-row">
				{#if signedIn && !trialPaid && trialRemaining !== null}
					<p class="trial-note">
						{#if trialRemaining > 0}
							<Sparkles size={14} /> {trialRemaining} free export left on your trial
						{:else}
							Trial used — <a href="/pricing">upgrade</a> for unlimited exports
						{/if}
					</p>
				{/if}
				{#if exportError}
					<p class="export-error" role="alert">{exportError} <a href="/pricing">View plans</a></p>
				{/if}
				<button
					type="button"
					class="export-btn"
					disabled={exporting || (signedIn && !canExport)}
					onclick={exportPng}
				>
					{#if exporting}
						<Loader size={16} class="spin" /> Exporting…
					{:else if !signedIn}
						<Lock size={16} /> Sign in to export
					{:else if !canExport}
						Upgrade to export
					{:else}
						<Download size={16} /> Download PNG
					{/if}
				</button>
			</div>
		</div>

		<div class="preview-wrap">
			<p class="preview-label">Live preview</p>
			<div class="preview-frame">
				<TweetTemplate
					bind:exportRef
					{topName}
					{topHandle}
					{topVerified}
					{topText}
					{topImage}
					{bottomName}
					{bottomHandle}
					{bottomVerified}
					{bottomText}
					scale={previewScale}
					interactive={false}
				/>
			</div>
		</div>
	</section>

	<section class="seo container">
		<h2>Why creators use our tweet maker</h2>
		<div class="seo-grid">
			{#each [
				['Realistic Twitter / X layout', 'Pixel-faithful tweet cards with replies — perfect for carousel slide 1.'],
				['Built for meme & commentary pages', 'Turn viral tweet formats into scroll-stopping Instagram content.'],
				['Export-ready PNGs', '1080×1350 output sized for Reels, Stories, and feed carousels.'],
				['Try before you upgrade', 'One free export on signup. Unlimited with Pro or Agency.'],
			] as [title, body]}
				<article class="seo-card">
					<h3>{title}</h3>
					<p>{body}</p>
				</article>
			{/each}
		</div>

		<div class="faq">
			<h2>Fake tweet maker FAQ</h2>
			{#each [
				['Is this a real Twitter account?', 'No — Carousel Studio generates static graphics only. Nothing is posted to X unless you publish separately.'],
				['Can I use these for commercial content?', 'Yes, subject to our Terms and the platform rules where you publish. Do not impersonate real people deceptively.'],
				['How does the free trial work?', 'After signing in, you can export one tweet graphic. Upgrade to Pro for unlimited exports and full studio access.'],
				['Does this work for X (Twitter) threads?', 'Yes — use Tweet Studio in the dashboard for multi-slide tweet carousels.'],
			] as [q, a]}
				<details class="faq-item">
					<summary>{q}</summary>
					<p>{a}</p>
				</details>
			{/each}
		</div>
	</section>

	<section class="cta">
		<div class="container cta-inner">
			<h2>Need unlimited tweet graphics?</h2>
			<p>Pro unlocks unlimited exports, bulk generation, and the full Carousel Studio.</p>
			<a href="/pricing" class="cta-btn">
				See pricing
				<ArrowRight size={18} />
			</a>
		</div>
	</section>

	<footer class="footer container">
		<a href="/privacy">Privacy</a>
		<a href="/terms">Terms</a>
		<a href="/refund-policy">Refunds</a>
		<span>© Carousel Studio</span>
	</footer>
</div>

<style>
	.page {
		--lime: #e8ff48;
		--orange: #ff6b35;
		--ink: #0a0505;
		--paper: #f7f4ef;
		min-height: 100vh;
		background: var(--paper);
		color: var(--ink);
		position: relative;
	}
	.atmosphere {
		position: absolute;
		inset: 0;
		pointer-events: none;
		overflow: hidden;
	}
	.blob {
		position: absolute;
		width: 50vw;
		height: 50vw;
		top: -15%;
		right: -12%;
		border-radius: 50%;
		background: color-mix(in oklch, var(--lime) 50%, white);
		filter: blur(90px);
		opacity: 0.65;
	}
	.container {
		position: relative;
		z-index: 1;
		max-width: 1120px;
		margin: 0 auto;
		padding: 0 clamp(20px, 4vw, 48px);
	}

	.nav {
		position: sticky;
		top: 0;
		z-index: 50;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 16px;
		padding: 14px clamp(20px, 4vw, 48px);
		background: color-mix(in oklch, var(--paper) 85%, transparent);
		backdrop-filter: blur(18px);
		border-bottom: 1px solid rgba(10, 5, 5, 0.07);
	}
	.logo {
		display: flex;
		align-items: center;
		gap: 10px;
		text-decoration: none;
		color: inherit;
	}
	.logo-mark {
		width: 32px;
		height: 32px;
		background: #080808;
		color: #fff;
		border-radius: 8px;
		display: grid;
		place-items: center;
		font-family: var(--font-mono);
		font-size: 11px;
		font-weight: 700;
	}
	.logo-text {
		font-family: var(--font-display);
		font-size: 17px;
		font-weight: 700;
	}
	.logo-text em {
		font-style: italic;
		color: var(--orange);
	}
	.nav-links {
		display: flex;
		gap: 24px;
	}
	.nav-links a {
		font-size: 14px;
		color: rgba(10, 5, 5, 0.55);
		text-decoration: none;
		font-weight: 600;
	}
	.nav-links a:hover,
	.nav-links a[aria-current='page'] {
		color: var(--ink);
	}
	.nav-actions {
		display: flex;
		gap: 12px;
		align-items: center;
	}
	.nav-ghost {
		font-size: 14px;
		color: rgba(10, 5, 5, 0.55);
		text-decoration: none;
		font-weight: 600;
	}
	.btn-nav {
		padding: 9px 18px;
		border-radius: 999px;
		background: #080808;
		color: #fff;
		font-size: 13px;
		font-weight: 700;
		text-decoration: none;
	}

	.hero {
		padding: 56px 0 32px;
	}
	.eyebrow {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		font-family: var(--font-mono);
		font-size: 11px;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: rgba(10, 5, 5, 0.5);
		margin-bottom: 12px;
	}
	h1 {
		margin: 0 0 16px;
		font-family: var(--font-display);
		font-size: clamp(36px, 5vw, 56px);
		font-weight: 500;
		letter-spacing: -0.035em;
		line-height: 1.05;
		max-width: 14ch;
	}
	.accent {
		font-style: italic;
		font-weight: 800;
	}
	.lead {
		margin: 0;
		font-size: 17px;
		line-height: 1.55;
		color: rgba(10, 5, 5, 0.62);
		max-width: 58ch;
	}

	.maker {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 24px;
		align-items: start;
		padding-bottom: 64px;
	}
	.editor {
		background: rgba(255, 255, 255, 0.72);
		border: 1px solid rgba(10, 5, 5, 0.08);
		border-radius: 22px;
		padding: 22px;
		display: flex;
		flex-direction: column;
		gap: 18px;
	}
	.editor.locked .fields {
		opacity: 0.55;
		pointer-events: none;
	}
	.lock-banner {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 10px;
		padding: 12px 14px;
		border-radius: 14px;
		background: #080808;
		color: rgba(255, 255, 255, 0.9);
		font-size: 13px;
		font-weight: 600;
	}
	.lock-banner :global(svg) {
		color: var(--lime);
	}
	.lock-cta {
		margin-left: auto;
		padding: 6px 12px;
		border-radius: 999px;
		background: var(--lime);
		color: #0a0a0a;
		text-decoration: none;
		font-size: 12px;
		font-weight: 800;
	}
	.fields {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 12px;
	}
	.fields label {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.fields label.full {
		grid-column: 1 / -1;
	}
	.fields span {
		font-family: var(--font-mono);
		font-size: 10px;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: rgba(10, 5, 5, 0.45);
		font-weight: 700;
	}
	.fields input,
	.fields textarea {
		border: 1px solid rgba(10, 5, 5, 0.12);
		border-radius: 12px;
		padding: 10px 12px;
		font-size: 14px;
		font-family: inherit;
		background: #fff;
	}
	.fields input:disabled,
	.fields textarea:disabled {
		background: rgba(10, 5, 5, 0.03);
	}
	.export-row {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}
	.trial-note {
		margin: 0;
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 13px;
		color: rgba(10, 5, 5, 0.55);
	}
	.trial-note a {
		color: var(--ink);
		font-weight: 700;
	}
	.export-error {
		margin: 0;
		padding: 10px 12px;
		border-radius: 12px;
		background: rgba(255, 80, 60, 0.1);
		border: 1px solid rgba(255, 80, 60, 0.22);
		font-size: 13px;
		color: #8a2010;
	}
	.export-error a {
		font-weight: 700;
	}
	.export-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		padding: 13px 18px;
		border: 0;
		border-radius: 999px;
		background: #080808;
		color: #fff;
		font-weight: 800;
		font-size: 14px;
		cursor: pointer;
	}
	.export-btn:disabled {
		opacity: 0.55;
		cursor: not-allowed;
	}
	:global(.spin) {
		animation: spin 0.8s linear infinite;
	}
	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	.preview-wrap {
		position: sticky;
		top: 88px;
	}
	.preview-label {
		margin: 0 0 12px;
		font-family: var(--font-mono);
		font-size: 11px;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: rgba(10, 5, 5, 0.45);
		font-weight: 700;
	}
	.preview-frame {
		border-radius: 20px;
		overflow: hidden;
		border: 1px solid rgba(10, 5, 5, 0.1);
		box-shadow: 0 24px 60px rgba(0, 0, 0, 0.12);
		background: #fff;
	}

	.seo {
		padding-bottom: 72px;
	}
	.seo h2 {
		font-family: var(--font-display);
		font-size: clamp(26px, 3vw, 36px);
		letter-spacing: -0.03em;
		margin: 0 0 24px;
	}
	.seo-grid {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 14px;
		margin-bottom: 48px;
	}
	.seo-card {
		padding: 20px;
		border-radius: 18px;
		background: rgba(255, 255, 255, 0.6);
		border: 1px solid rgba(10, 5, 5, 0.08);
	}
	.seo-card h3 {
		margin: 0 0 8px;
		font-size: 16px;
		font-weight: 700;
	}
	.seo-card p {
		margin: 0;
		font-size: 14px;
		line-height: 1.5;
		color: rgba(10, 5, 5, 0.62);
	}
	.faq {
		display: grid;
		gap: 10px;
	}
	.faq-item {
		border-radius: 14px;
		border: 1px solid rgba(10, 5, 5, 0.08);
		background: rgba(255, 255, 255, 0.55);
		padding: 4px 16px;
	}
	.faq-item summary {
		cursor: pointer;
		padding: 14px 0;
		font-weight: 700;
		list-style: none;
	}
	.faq-item summary::-webkit-details-marker {
		display: none;
	}
	.faq-item p {
		margin: 0 0 14px;
		font-size: 14px;
		color: rgba(10, 5, 5, 0.62);
		line-height: 1.5;
	}

	.cta {
		padding: 72px 0;
		background: #080808;
		color: #fff;
	}
	.cta-inner {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 12px;
	}
	.cta h2 {
		margin: 0;
		font-family: var(--font-display);
		font-size: clamp(26px, 3vw, 38px);
		letter-spacing: -0.03em;
	}
	.cta p {
		margin: 0;
		color: rgba(255, 255, 255, 0.55);
	}
	.cta-btn {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		margin-top: 8px;
		padding: 12px 20px;
		border-radius: 999px;
		background: var(--lime);
		color: #0a0a0a;
		font-weight: 800;
		text-decoration: none;
	}

	.footer {
		display: flex;
		flex-wrap: wrap;
		gap: 20px;
		padding: 32px 0 48px;
		font-size: 13px;
		color: rgba(10, 5, 5, 0.45);
	}
	.footer a {
		color: rgba(10, 5, 5, 0.55);
		text-decoration: none;
		font-weight: 600;
	}
	.footer a:hover {
		color: var(--ink);
	}

	@media (max-width: 900px) {
		.nav-links {
			display: none;
		}
		.maker {
			grid-template-columns: 1fr;
		}
		.preview-wrap {
			position: static;
		}
		.seo-grid {
			grid-template-columns: 1fr;
		}
		h1 {
			max-width: none;
		}
	}
</style>
