<script lang="ts">
	import { page } from '$app/stores';
	import { ArrowRight, Check, Lock, ShieldCheck, Sparkles } from 'lucide-svelte';
	import { PLAN_CATALOG } from '$lib/pricing-catalog';

	let interval = $state<'month' | 'year'>('month');
	let checkoutBusy = $state<string | null>(null);
	let checkoutError = $state<string | null>(null);

	const user = $derived($page.data.user);
	const yearlySave = 17; // ~2 months free messaging

	async function startCheckout(plan: 'pro' | 'agency') {
		checkoutError = null;
		if (!user) {
			window.location.href = `/?auth=signup&next=${encodeURIComponent(`/checkout?plan=${plan}&interval=${interval}`)}`;
			return;
		}
		checkoutBusy = plan;
		try {
			const res = await fetch('/api/stripe/checkout', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				credentials: 'include',
				body: JSON.stringify({ plan, interval }),
			});
			const data = await res.json();
			if (!res.ok || !data?.ok || !data?.url) {
				checkoutError = data?.error ?? 'Could not start checkout';
				checkoutBusy = null;
				return;
			}
			window.location.href = data.url;
		} catch {
			checkoutError = 'Network error — try again';
			checkoutBusy = null;
		}
	}

	function priceLabel(plan: 'free' | 'pro' | 'agency') {
		const p = PLAN_CATALOG[plan];
		if (plan === 'free') return { num: '0', per: '/mo' };
		if (interval === 'year') {
			return { num: String(Math.round(p.yearly / 12)), per: '/mo' };
		}
		return { num: String(p.monthly), per: '/mo' };
	}
</script>

<svelte:head>
	<title>Pricing — Carousel Studio</title>
	<meta name="description" content="Simple creator-first pricing. Start free, upgrade to Pro or Agency when you grow." />
</svelte:head>

<div class="page">
	<div class="atmosphere" aria-hidden="true">
		<div class="blob blob-a"></div>
		<div class="blob blob-b"></div>
		<div class="grain"></div>
	</div>

	<nav class="nav">
		<a href="/" class="logo">
			<span class="logo-mark">CS</span>
			<span class="logo-text">Carousel<em>Studio</em></span>
		</a>
		<div class="nav-links">
			<a href="/#features">Features</a>
			<a href="/#how">How it works</a>
			<a href="/pricing" aria-current="page">Pricing</a>
		</div>
		<div class="nav-actions">
			{#if user}
				<a href="/dashboard" class="nav-signin">Dashboard</a>
			{:else}
				<a href="/?auth=login" class="nav-signin">Sign in</a>
				<a href="/?auth=signup" class="btn-cta-nav">Start free →</a>
			{/if}
		</div>
	</nav>

	<section class="hero">
		<div class="container hero-grid">
			<div class="hero-copy">
				<span class="eyebrow"><Sparkles size={12} /> Pricing</span>
				<h1 class="title">Ship more posts.<br /><span class="title-accent">Pay for what scales.</span></h1>
				<p class="sub">
					Start free with real studio tools. Upgrade when unlimited carousels,
					news-to-post, and multi-brand workflows earn their keep.
				</p>

				<div class="toggle" role="group" aria-label="Billing interval">
					<button
						type="button"
						class="toggle-btn"
						class:active={interval === 'month'}
						onclick={() => (interval = 'month')}
					>
						Monthly
					</button>
					<button
						type="button"
						class="toggle-btn"
						class:active={interval === 'year'}
						onclick={() => (interval = 'year')}
					>
						Yearly
						<span class="save-pill">Save {yearlySave}%</span>
					</button>
				</div>
			</div>

			<aside class="trust-panel">
				<div class="trust-row">
					<ShieldCheck size={18} />
					<div>
						<strong>Stripe-secured checkout</strong>
						<span>Card data never touches our servers</span>
					</div>
				</div>
				<div class="trust-row">
					<Lock size={18} />
					<div>
						<strong>Cancel anytime</strong>
						<span>Manage billing in one click from Settings</span>
					</div>
				</div>
				<p class="trust-note">PCI DSS compliant via Stripe Checkout · SSL encrypted</p>
			</aside>
		</div>
	</section>

	{#if checkoutError}
		<div class="container">
			<p class="banner-error" role="alert">{checkoutError}</p>
		</div>
	{/if}

	<section class="section">
		<div class="container">
			<div class="pricing-grid">
				<!-- Free -->
				<article class="price-card">
					<div class="price-tier">Free</div>
					<div class="price-amount">
						<span class="currency">$</span>
						<span class="price-num">{priceLabel('free').num}</span>
						<span class="price-per">{priceLabel('free').per}</span>
					</div>
					<p class="price-note">{PLAN_CATALOG.free.tagline}</p>
					<ul class="price-list">
						{#each PLAN_CATALOG.free.features as item}
							<li><Check size={15} strokeWidth={2.5} class="check" />{item}</li>
						{/each}
					</ul>
					<a href={user ? '/dashboard' : '/?auth=signup'} class="btn-outline">
						{user ? 'Open studio' : 'Get started'}
					</a>
				</article>

				<!-- Pro -->
				<article class="price-card price-featured">
					<div class="price-badge">Most popular</div>
					<div class="price-tier">Pro</div>
					<div class="price-amount">
						<span class="currency">$</span>
						<span class="price-num">{priceLabel('pro').num}</span>
						<span class="price-per">{priceLabel('pro').per}</span>
					</div>
					<p class="price-note">
						{#if interval === 'year'}
							Billed ${PLAN_CATALOG.pro.yearly}/year · cancel anytime
						{:else}
							{PLAN_CATALOG.pro.tagline}
						{/if}
					</p>
					<ul class="price-list">
						{#each PLAN_CATALOG.pro.features as item}
							<li><Check size={15} strokeWidth={2.5} class="check" />{item}</li>
						{/each}
					</ul>
					<button
						type="button"
						class="btn-dark"
						disabled={checkoutBusy !== null}
						onclick={() => startCheckout('pro')}
					>
						{#if checkoutBusy === 'pro'}
							Redirecting to Stripe…
						{:else}
							{user ? 'Upgrade to Pro' : 'Start Pro'}
							<ArrowRight size={16} />
						{/if}
					</button>
				</article>

				<!-- Agency -->
				<article class="price-card">
					<div class="price-tier">Agency</div>
					<div class="price-amount">
						<span class="currency">$</span>
						<span class="price-num">{priceLabel('agency').num}</span>
						<span class="price-per">{priceLabel('agency').per}</span>
					</div>
					<p class="price-note">
						{#if interval === 'year'}
							Billed ${PLAN_CATALOG.agency.yearly}/year · cancel anytime
						{:else}
							{PLAN_CATALOG.agency.tagline}
						{/if}
					</p>
					<ul class="price-list">
						{#each PLAN_CATALOG.agency.features as item}
							<li><Check size={15} strokeWidth={2.5} class="check" />{item}</li>
						{/each}
					</ul>
					<button
						type="button"
						class="btn-outline"
						disabled={checkoutBusy !== null}
						onclick={() => startCheckout('agency')}
					>
						{#if checkoutBusy === 'agency'}
							Redirecting to Stripe…
						{:else}
							{user ? 'Upgrade to Agency' : 'Start Agency'}
						{/if}
					</button>
				</article>
			</div>

			<!-- Comparison strip -->
			<div class="compare">
				<div class="compare-head">
					<h2>What’s included</h2>
					<p>Every paid plan unlocks through Stripe — your plan updates the moment payment clears.</p>
				</div>
				<div class="compare-table" role="table" aria-label="Feature comparison">
					<div class="compare-row compare-labels" role="row">
						<span role="columnheader"></span>
						<span role="columnheader">Free</span>
						<span role="columnheader">Pro</span>
						<span role="columnheader">Agency</span>
					</div>
					{#each [
						['Carousels / month', '5', 'Unlimited', 'Unlimited'],
						['Competitor tracks', '3', '25', 'Unlimited'],
						['AI generation', 'Basic', 'Claude 3.5', 'Claude 3.5 + priority'],
						['News-to-Post', '—', 'Yes', 'Yes'],
						['Team seats', '1', '1', 'Unlimited'],
						['White-label / API', '—', '—', 'Yes'],
					] as row}
						<div class="compare-row" role="row">
							<span role="rowheader">{row[0]}</span>
							<span role="cell">{row[1]}</span>
							<span role="cell" class="hi">{row[2]}</span>
							<span role="cell">{row[3]}</span>
						</div>
					{/each}
				</div>
			</div>
		</div>
	</section>

	<section class="faq">
		<div class="container faq-inner">
			<h2>Questions, answered</h2>
			<div class="faq-grid">
				{#each [
					['Is checkout secure?', 'Yes. Payments run on Stripe Checkout — card numbers never hit Carousel Studio servers. We only store your plan status and Stripe customer id.'],
					['Can I change plans later?', 'Anytime. Upgrade from Pricing or manage cancel / invoices in Settings → Billing via the Stripe Customer Portal.'],
					['Do you offer refunds?', 'If something goes wrong in the first 7 days of a paid plan, email support and we’ll make it right.'],
					['What happens if I cancel?', 'You keep access until the period ends, then drop back to Free. Your projects stay in your account.'],
				] as [q, a]}
					<details class="faq-item">
						<summary>{q}</summary>
						<p>{a}</p>
					</details>
				{/each}
			</div>
		</div>
	</section>

	<section class="cta">
		<div class="container cta-inner">
			<h2 class="cta-h">Ready when you are.</h2>
			<p class="cta-p">Start free in minutes. Upgrade the moment your pipeline needs it.</p>
			<a href={user ? '/dashboard' : '/?auth=signup'} class="btn-lime-xl">
				{user ? 'Back to studio' : 'Get started free — no card needed'}
				<ArrowRight size={20} />
			</a>
		</div>
	</section>
</div>

<style>
	.page {
		--lime: #e8ff48;
		--orange: #ff6b35;
		--ink: #0a0505;
		--muted: rgba(10, 5, 5, 0.55);
		--paper: #f7f4ef;
		position: relative;
		min-height: 100vh;
		background: var(--paper);
		color: var(--ink);
		overflow-x: hidden;
	}

	.atmosphere {
		pointer-events: none;
		position: absolute;
		inset: 0;
		overflow: hidden;
		z-index: 0;
	}
	.blob {
		position: absolute;
		border-radius: 50%;
		filter: blur(80px);
		opacity: 0.55;
	}
	.blob-a {
		width: 42vw;
		height: 42vw;
		top: -12%;
		right: -8%;
		background: color-mix(in oklch, var(--lime) 70%, white);
	}
	.blob-b {
		width: 36vw;
		height: 36vw;
		top: 18%;
		left: -14%;
		background: color-mix(in oklch, var(--orange) 35%, transparent);
	}
	.grain {
		position: absolute;
		inset: 0;
		opacity: 0.04;
		background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
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
		background: color-mix(in oklch, var(--paper) 82%, transparent);
		backdrop-filter: blur(20px);
		-webkit-backdrop-filter: blur(20px);
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
		letter-spacing: -0.02em;
	}
	.logo-text em {
		font-style: italic;
		color: var(--orange);
	}
	.nav-links {
		display: flex;
		gap: 28px;
	}
	.nav-links a {
		font-size: 14px;
		color: var(--muted);
		text-decoration: none;
		font-weight: 500;
	}
	.nav-links a:hover,
	.nav-links a[aria-current='page'] {
		color: var(--ink);
	}
	.nav-actions {
		display: flex;
		align-items: center;
		gap: 14px;
	}
	.nav-signin {
		font-size: 14px;
		color: var(--muted);
		text-decoration: none;
	}
	.nav-signin:hover {
		color: var(--ink);
	}
	.btn-cta-nav {
		display: inline-flex;
		align-items: center;
		padding: 9px 20px;
		background: #080808;
		color: #fff;
		border-radius: 999px;
		font-size: 13px;
		font-weight: 600;
		text-decoration: none;
		transition: transform 0.2s;
	}
	.btn-cta-nav:hover {
		transform: translateY(-1px);
	}

	.hero {
		padding: clamp(48px, 8vw, 88px) 0 28px;
	}
	.hero-grid {
		display: grid;
		grid-template-columns: 1.35fr 0.85fr;
		gap: 40px;
		align-items: end;
	}
	.eyebrow {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		font-family: var(--font-mono);
		font-size: 11px;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: rgba(10, 5, 5, 0.55);
		margin-bottom: 14px;
	}
	.title {
		margin: 0 0 16px;
		font-family: var(--font-display);
		font-size: clamp(40px, 5.5vw, 64px);
		font-weight: 500;
		letter-spacing: -0.035em;
		line-height: 1.02;
	}
	.title-accent {
		font-style: italic;
		font-weight: 700;
	}
	.sub {
		margin: 0 0 28px;
		font-size: 17px;
		line-height: 1.55;
		color: var(--muted);
		max-width: 42ch;
	}

	.toggle {
		display: inline-flex;
		padding: 4px;
		border-radius: 999px;
		background: rgba(10, 5, 5, 0.06);
		border: 1px solid rgba(10, 5, 5, 0.08);
		gap: 2px;
	}
	.toggle-btn {
		appearance: none;
		border: 0;
		background: transparent;
		padding: 10px 18px;
		border-radius: 999px;
		font-size: 13px;
		font-weight: 600;
		color: rgba(10, 5, 5, 0.55);
		cursor: pointer;
		display: inline-flex;
		align-items: center;
		gap: 8px;
		transition: background 0.2s, color 0.2s;
	}
	.toggle-btn.active {
		background: #080808;
		color: #fff;
	}
	.save-pill {
		font-family: var(--font-mono);
		font-size: 10px;
		letter-spacing: 0.04em;
		padding: 3px 7px;
		border-radius: 999px;
		background: var(--lime);
		color: #0a0a0a;
		font-weight: 800;
	}
	.toggle-btn.active .save-pill {
		background: var(--lime);
	}

	.trust-panel {
		background: #080808;
		color: rgba(255, 255, 255, 0.9);
		border-radius: 22px;
		padding: 22px 22px 18px;
		display: flex;
		flex-direction: column;
		gap: 16px;
		box-shadow: 0 24px 60px rgba(0, 0, 0, 0.18);
	}
	.trust-row {
		display: flex;
		gap: 12px;
		align-items: flex-start;
	}
	.trust-row :global(svg) {
		color: var(--lime);
		flex-shrink: 0;
		margin-top: 2px;
	}
	.trust-row strong {
		display: block;
		font-size: 14px;
		font-weight: 700;
		margin-bottom: 2px;
	}
	.trust-row span {
		font-size: 13px;
		color: rgba(255, 255, 255, 0.55);
		line-height: 1.4;
	}
	.trust-note {
		margin: 4px 0 0;
		padding-top: 14px;
		border-top: 1px solid rgba(255, 255, 255, 0.1);
		font-family: var(--font-mono);
		font-size: 10px;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: rgba(255, 255, 255, 0.4);
	}

	.banner-error {
		margin: 0 0 16px;
		padding: 12px 16px;
		border-radius: 12px;
		background: rgba(255, 80, 60, 0.1);
		border: 1px solid rgba(255, 80, 60, 0.25);
		color: #9a1f0e;
		font-size: 14px;
	}

	.section {
		padding: 28px 0 72px;
	}
	.pricing-grid {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 16px;
		align-items: stretch;
	}

	.price-card {
		border-radius: 24px;
		background: rgba(255, 255, 255, 0.62);
		border: 1px solid rgba(10, 5, 5, 0.08);
		padding: 28px 26px;
		display: flex;
		flex-direction: column;
		gap: 14px;
		position: relative;
		backdrop-filter: blur(8px);
		transition: transform 0.25s ease, box-shadow 0.25s ease;
	}
	.price-card:hover {
		transform: translateY(-3px);
	}
	.price-featured {
		background: var(--lime);
		border-color: rgba(10, 5, 5, 0.16);
		box-shadow: 0 28px 70px rgba(0, 0, 0, 0.16);
		transform: translateY(-10px);
	}
	.price-featured:hover {
		transform: translateY(-13px);
	}
	.price-badge {
		position: absolute;
		top: 16px;
		right: 16px;
		font-family: var(--font-mono);
		font-size: 10px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.1em;
		padding: 6px 10px;
		border-radius: 999px;
		background: rgba(10, 5, 5, 0.12);
		color: rgba(10, 5, 5, 0.85);
	}
	.price-tier {
		font-family: var(--font-mono);
		font-size: 11px;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: rgba(10, 5, 5, 0.55);
	}
	.price-amount {
		display: flex;
		align-items: baseline;
		gap: 4px;
	}
	.currency {
		font-family: var(--font-display);
		font-size: 22px;
		font-weight: 700;
		opacity: 0.55;
	}
	.price-num {
		font-family: var(--font-display);
		font-size: 52px;
		font-weight: 900;
		letter-spacing: -0.04em;
		line-height: 1;
	}
	.price-per {
		font-family: var(--font-mono);
		font-size: 12px;
		color: rgba(10, 5, 5, 0.45);
	}
	.price-note {
		margin: 0;
		font-size: 14px;
		color: rgba(10, 5, 5, 0.55);
		line-height: 1.45;
		min-height: 2.9em;
	}
	.price-list {
		list-style: none;
		padding: 0;
		margin: 4px 0 8px;
		display: flex;
		flex-direction: column;
		gap: 11px;
		flex: 1;
	}
	.price-list li {
		display: flex;
		gap: 10px;
		align-items: flex-start;
		font-size: 14px;
		color: rgba(10, 5, 5, 0.72);
		line-height: 1.35;
	}
	.price-list :global(.check) {
		flex-shrink: 0;
		margin-top: 1px;
		color: rgba(10, 5, 5, 0.7);
	}
	.price-featured .price-list :global(.check) {
		color: #0a0a0a;
	}

	.btn-outline,
	.btn-dark {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		border-radius: 999px;
		padding: 12px 18px;
		font-weight: 700;
		font-size: 13px;
		text-decoration: none;
		cursor: pointer;
		border: 0;
		width: 100%;
		transition: background 0.2s, transform 0.2s;
	}
	.btn-outline {
		border: 1px solid rgba(10, 5, 5, 0.14);
		color: rgba(10, 5, 5, 0.88);
		background: rgba(255, 255, 255, 0.7);
	}
	.btn-outline:hover:not(:disabled) {
		background: #fff;
	}
	.btn-dark {
		background: #080808;
		color: #fff;
	}
	.btn-dark:hover:not(:disabled) {
		background: #1a1a1a;
		transform: translateY(-1px);
	}
	.btn-outline:disabled,
	.btn-dark:disabled {
		opacity: 0.65;
		cursor: wait;
	}

	.compare {
		margin-top: 64px;
		display: grid;
		gap: 28px;
	}
	.compare-head h2 {
		margin: 0 0 8px;
		font-family: var(--font-display);
		font-size: clamp(24px, 3vw, 32px);
		letter-spacing: -0.03em;
		font-weight: 700;
	}
	.compare-head p {
		margin: 0;
		color: var(--muted);
		max-width: 48ch;
		font-size: 15px;
	}
	.compare-table {
		border-radius: 18px;
		border: 1px solid rgba(10, 5, 5, 0.08);
		overflow: hidden;
		background: rgba(255, 255, 255, 0.55);
	}
	.compare-row {
		display: grid;
		grid-template-columns: 1.4fr repeat(3, 1fr);
		gap: 8px;
		padding: 14px 18px;
		font-size: 14px;
		border-top: 1px solid rgba(10, 5, 5, 0.06);
	}
	.compare-row:first-child {
		border-top: 0;
	}
	.compare-labels {
		background: rgba(10, 5, 5, 0.04);
		font-family: var(--font-mono);
		font-size: 11px;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: rgba(10, 5, 5, 0.5);
		font-weight: 700;
	}
	.compare-row [role='rowheader'] {
		font-weight: 600;
		color: rgba(10, 5, 5, 0.8);
	}
	.compare-row [role='cell'] {
		color: rgba(10, 5, 5, 0.55);
	}
	.compare-row .hi {
		color: #0a0a0a;
		font-weight: 700;
	}

	.faq {
		padding: 24px 0 80px;
	}
	.faq-inner h2 {
		margin: 0 0 24px;
		font-family: var(--font-display);
		font-size: clamp(24px, 3vw, 32px);
		letter-spacing: -0.03em;
		font-weight: 700;
	}
	.faq-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 12px;
	}
	.faq-item {
		border-radius: 16px;
		border: 1px solid rgba(10, 5, 5, 0.08);
		background: rgba(255, 255, 255, 0.55);
		padding: 4px 18px;
	}
	.faq-item summary {
		cursor: pointer;
		list-style: none;
		padding: 14px 0;
		font-weight: 700;
		font-size: 15px;
	}
	.faq-item summary::-webkit-details-marker {
		display: none;
	}
	.faq-item p {
		margin: 0 0 16px;
		font-size: 14px;
		line-height: 1.55;
		color: var(--muted);
		max-width: 52ch;
	}

	.cta {
		padding: 80px 0 96px;
		background: #080808;
		color: rgba(255, 255, 255, 0.92);
		position: relative;
		z-index: 1;
	}
	.cta-inner {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 14px;
	}
	.cta-h {
		margin: 0;
		font-family: var(--font-display);
		font-size: clamp(28px, 3.5vw, 44px);
		letter-spacing: -0.03em;
		font-weight: 900;
	}
	.cta-p {
		margin: 0;
		color: rgba(255, 255, 255, 0.55);
	}
	.btn-lime-xl {
		display: inline-flex;
		align-items: center;
		gap: 10px;
		margin-top: 8px;
		padding: 14px 22px;
		border-radius: 999px;
		background: var(--lime);
		color: #0a0a0a;
		font-weight: 800;
		text-decoration: none;
		transition: transform 0.2s;
	}
	.btn-lime-xl:hover {
		transform: translateY(-2px);
	}

	@media (max-width: 960px) {
		.hero-grid {
			grid-template-columns: 1fr;
		}
		.nav-links {
			display: none;
		}
		.pricing-grid {
			grid-template-columns: 1fr;
		}
		.price-featured {
			transform: none;
		}
		.price-featured:hover {
			transform: translateY(-3px);
		}
		.faq-grid {
			grid-template-columns: 1fr;
		}
		.compare-row {
			grid-template-columns: 1.2fr repeat(3, 0.8fr);
			font-size: 12px;
			padding: 12px;
		}
	}
</style>
