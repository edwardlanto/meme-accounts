<script lang="ts">
	import { ArrowLeft, ArrowRight, Check, Lock, ShieldCheck } from 'lucide-svelte';

	let { data } = $props();

	let busy = $state(false);
	let error = $state<string | null>(null);

	async function pay() {
		busy = true;
		error = null;
		try {
			const res = await fetch('/api/stripe/checkout', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				credentials: 'include',
				body: JSON.stringify({ plan: data.plan, interval: data.interval }),
			});
			const json = await res.json();
			if (!res.ok || !json?.ok || !json?.url) {
				error = json?.error ?? 'Could not start secure checkout';
				busy = false;
				return;
			}
			window.location.href = json.url;
		} catch {
			error = 'Network error — try again';
			busy = false;
		}
	}
</script>

<svelte:head>
	<title>Secure checkout — Meme Accounts</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<div class="page">
	<div class="atmosphere" aria-hidden="true">
		<div class="blob"></div>
		<div class="grain"></div>
	</div>

	<header class="top">
		<a href="/pricing" class="back">
			<ArrowLeft size={16} />
			Pricing
		</a>
		<div class="secure-chip">
			<Lock size={13} />
			Secure checkout
		</div>
	</header>

	<main class="layout">
		<section class="summary">
			<span class="eyebrow">Order summary</span>
			<h1>
				{data.planName}
				<span class="period">{data.interval === 'year' ? 'yearly' : 'monthly'}</span>
			</h1>
			<p class="tagline">{data.tagline}</p>

			<div class="price-block">
				<div class="big">
					<span class="dollar">$</span>{data.perMonth}
					<span class="unit">/mo</span>
				</div>
				{#if data.interval === 'year'}
					<p class="billed">Billed ${data.amount} today · 2 months free vs monthly</p>
				{:else}
					<p class="billed">Billed ${data.amount} today · cancel anytime</p>
				{/if}
			</div>

			<ul class="features">
				{#each data.features as f}
					<li><Check size={15} strokeWidth={2.5} />{f}</li>
				{/each}
			</ul>
		</section>

		<section class="pay-panel">
			{#if data.canceled}
				<p class="canceled" role="status">Checkout was canceled. Your card was not charged.</p>
			{/if}

			<h2>Continue to Stripe</h2>
			<p class="pay-copy">
				You’ll complete payment on Stripe’s PCI-certified page. Card details never pass through
				Meme Accounts.
			</p>

			<div class="account">
				<span class="account-label">Signed in as</span>
				<strong>{data.userEmail}</strong>
			</div>

			{#if error}
				<p class="err" role="alert">{error}</p>
			{/if}

			<button type="button" class="pay-btn" disabled={busy} onclick={pay}>
				{#if busy}
					Opening Stripe…
				{:else}
					Pay securely
					<ArrowRight size={18} />
				{/if}
			</button>

			<ul class="guarantees">
				<li><ShieldCheck size={15} /> Stripe Checkout · TLS encrypted</li>
				<li><Lock size={15} /> No card data stored on our servers</li>
				<li><Check size={15} /> Instant plan activation via webhook</li>
			</ul>

			<p class="fine">
				By continuing you agree to our
				<a href="/terms">Terms</a>
				and
				<a href="/privacy">Privacy Policy</a>.
			</p>
		</section>
	</main>
</div>

<style>
	.page {
		--lime: #7bf1a8;
		--ink: #0a0505;
		--paper: #f3efe8;
		min-height: 100vh;
		background: var(--paper);
		color: var(--ink);
		position: relative;
		overflow-x: hidden;
	}
	.atmosphere {
		position: absolute;
		inset: 0;
		pointer-events: none;
	}
	.blob {
		position: absolute;
		width: 50vw;
		height: 50vw;
		right: -10%;
		top: -20%;
		border-radius: 50%;
		background: color-mix(in oklch, var(--lime) 55%, white);
		filter: blur(90px);
		opacity: 0.7;
	}
	.grain {
		position: absolute;
		inset: 0;
		opacity: 0.035;
		background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
	}

	.top {
		position: relative;
		z-index: 1;
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 20px clamp(20px, 4vw, 48px);
	}
	.back {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		text-decoration: none;
		color: rgba(10, 5, 5, 0.55);
		font-size: 14px;
		font-weight: 600;
	}
	.back:hover {
		color: var(--ink);
	}
	.secure-chip {
		display: inline-flex;
		align-items: center;
		gap: 7px;
		padding: 8px 12px;
		border-radius: 999px;
		background: #080808;
		color: var(--lime);
		font-family: var(--font-mono);
		font-size: 11px;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		font-weight: 700;
	}

	.layout {
		position: relative;
		z-index: 1;
		max-width: 960px;
		margin: 0 auto;
		padding: 24px clamp(20px, 4vw, 48px) 80px;
		display: grid;
		grid-template-columns: 1.05fr 0.95fr;
		gap: 20px;
		align-items: start;
	}

	.summary,
	.pay-panel {
		border-radius: 24px;
		padding: 28px;
	}
	.summary {
		background: rgba(255, 255, 255, 0.7);
		border: 1px solid rgba(10, 5, 5, 0.08);
		backdrop-filter: blur(10px);
	}
	.pay-panel {
		background: #080808;
		color: rgba(255, 255, 255, 0.92);
		box-shadow: 0 30px 80px rgba(0, 0, 0, 0.22);
	}

	.eyebrow {
		font-family: var(--font-mono);
		font-size: 11px;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: rgba(10, 5, 5, 0.45);
	}
	.summary h1 {
		margin: 10px 0 8px;
		font-family: var(--font-display);
		font-size: clamp(32px, 4vw, 44px);
		letter-spacing: -0.03em;
		font-weight: 700;
		display: flex;
		align-items: baseline;
		gap: 12px;
		flex-wrap: wrap;
	}
	.period {
		font-family: var(--font-mono);
		font-size: 12px;
		font-weight: 700;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: rgba(10, 5, 5, 0.45);
	}
	.tagline {
		margin: 0 0 24px;
		color: rgba(10, 5, 5, 0.55);
		font-size: 15px;
	}
	.price-block {
		padding: 18px 0;
		border-top: 1px solid rgba(10, 5, 5, 0.08);
		border-bottom: 1px solid rgba(10, 5, 5, 0.08);
		margin-bottom: 20px;
	}
	.big {
		font-family: var(--font-display);
		font-size: 56px;
		font-weight: 900;
		letter-spacing: -0.04em;
		line-height: 1;
	}
	.dollar {
		font-size: 28px;
		opacity: 0.5;
		margin-right: 2px;
	}
	.unit {
		font-family: var(--font-mono);
		font-size: 14px;
		font-weight: 500;
		color: rgba(10, 5, 5, 0.45);
		margin-left: 4px;
	}
	.billed {
		margin: 10px 0 0;
		font-size: 13px;
		color: rgba(10, 5, 5, 0.5);
	}
	.features {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: 12px;
	}
	.features li {
		display: flex;
		gap: 10px;
		align-items: flex-start;
		font-size: 14px;
		color: rgba(10, 5, 5, 0.75);
	}
	.features :global(svg) {
		flex-shrink: 0;
		margin-top: 2px;
	}

	.canceled {
		margin: 0 0 16px;
		padding: 12px 14px;
		border-radius: 12px;
		background: rgba(255, 180, 60, 0.12);
		border: 1px solid rgba(255, 180, 60, 0.28);
		color: #f5d9a0;
		font-size: 13px;
	}
	.pay-panel h2 {
		margin: 0 0 10px;
		font-family: var(--font-display);
		font-size: 28px;
		letter-spacing: -0.03em;
		font-weight: 700;
	}
	.pay-copy {
		margin: 0 0 22px;
		color: rgba(255, 255, 255, 0.55);
		font-size: 14px;
		line-height: 1.5;
	}
	.account {
		display: flex;
		flex-direction: column;
		gap: 4px;
		padding: 14px 16px;
		border-radius: 14px;
		background: rgba(255, 255, 255, 0.06);
		border: 1px solid rgba(255, 255, 255, 0.08);
		margin-bottom: 18px;
	}
	.account-label {
		font-family: var(--font-mono);
		font-size: 10px;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: rgba(255, 255, 255, 0.4);
	}
	.account strong {
		font-size: 14px;
		font-weight: 600;
	}
	.err {
		margin: 0 0 14px;
		padding: 12px 14px;
		border-radius: 12px;
		background: rgba(255, 80, 60, 0.15);
		border: 1px solid rgba(255, 80, 60, 0.35);
		color: #ffb4a8;
		font-size: 13px;
	}
	.pay-btn {
		width: 100%;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 10px;
		padding: 15px 20px;
		border: 0;
		border-radius: 999px;
		background: var(--lime);
		color: #0a0a0a;
		font-weight: 800;
		font-size: 15px;
		cursor: pointer;
		transition: transform 0.2s, opacity 0.2s;
	}
	.pay-btn:hover:not(:disabled) {
		transform: translateY(-1px);
	}
	.pay-btn:disabled {
		opacity: 0.7;
		cursor: wait;
	}
	.guarantees {
		list-style: none;
		padding: 0;
		margin: 22px 0 0;
		display: flex;
		flex-direction: column;
		gap: 10px;
	}
	.guarantees li {
		display: flex;
		align-items: center;
		gap: 10px;
		font-size: 13px;
		color: rgba(255, 255, 255, 0.55);
	}
	.guarantees :global(svg) {
		color: var(--lime);
		flex-shrink: 0;
	}
	.fine {
		margin: 22px 0 0;
		font-size: 12px;
		color: rgba(255, 255, 255, 0.35);
		line-height: 1.5;
	}
	.fine a {
		color: rgba(255, 255, 255, 0.65);
	}

	@media (max-width: 800px) {
		.layout {
			grid-template-columns: 1fr;
		}
	}
</style>
