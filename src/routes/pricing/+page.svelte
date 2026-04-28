<script lang="ts">
	import { ArrowRight } from 'lucide-svelte';
</script>

<svelte:head>
	<title>Pricing — Carousel Studio</title>
</svelte:head>

<div class="page">
	<nav class="nav">
		<a href="/" class="logo">
			<span class="logo-mark">CS</span>
			<span class="logo-text">Carousel<em>Studio</em></span>
		</a>
		<div class="nav-links">
			<a href="/#features">Features</a>
			<a href="/#how">How it works</a>
			<a href="/pricing">Pricing</a>
		</div>
		<div class="nav-actions">
			<a href="/login" class="nav-signin">Sign in</a>
			<a href="/signup" class="btn-cta-nav">Start free →</a>
		</div>
	</nav>

	<section class="hero">
		<div class="container">
			<span class="eyebrow">Pricing</span>
			<h1 class="title">Simple, creator-first pricing.</h1>
			<p class="sub">Start free. Scale when you grow.</p>
		</div>
	</section>

	<section class="section">
		<div class="container">
			<div class="pricing-grid">
				<div class="price-card">
					<div class="price-tier">Free</div>
					<div class="price-amount">
						<span class="price-num">$0</span>
						<span class="price-per">/mo</span>
					</div>
					<p class="price-note">No card needed. Forever free.</p>
					<ul class="price-list">
						{#each ['5 carousels/month', '3 competitor tracks', 'AI hook suggestions', 'Basic canvas editor'] as item}
							<li><span class="price-check">✓</span>{item}</li>
						{/each}
					</ul>
					<a href="/signup" class="btn-outline-glass">Get started</a>
				</div>

				<div class="price-card price-featured">
					<div class="price-badge">Most popular</div>
					<div class="price-tier" style="color:#0a0a0a">Pro</div>
					<div class="price-amount">
						<span class="price-num" style="color:#0a0a0a">$29</span>
						<span class="price-per" style="color:rgba(10,10,10,0.45)">/mo</span>
					</div>
					<p class="price-note" style="color:rgba(10,10,10,0.5)">Cancel anytime.</p>
					<ul class="price-list price-list--dark">
						{#each ['Unlimited carousels', '25 competitor tracks', 'Claude 3.5 Sonnet AI', 'News-to-Post (Vertex AI)', 'Full canvas + export', 'Style extraction'] as item}
							<li><span class="price-check" style="color:#0a0a0a">✓</span>{item}</li>
						{/each}
					</ul>
					<a href="/signup" class="btn-dark-solid">Start Pro free</a>
				</div>

				<div class="price-card">
					<div class="price-tier">Agency</div>
					<div class="price-amount">
						<span class="price-num">$99</span>
						<span class="price-per">/mo</span>
					</div>
					<p class="price-note">For teams managing multiple brands.</p>
					<ul class="price-list">
						{#each ['Everything in Pro', 'Unlimited accounts', 'Team workspace', 'White-label export', 'API access'] as item}
							<li><span class="price-check">✓</span>{item}</li>
						{/each}
					</ul>
					<a href="/signup" class="btn-outline-glass">Contact us</a>
				</div>
			</div>
		</div>
	</section>

	<section class="cta">
		<div class="container cta-inner">
			<h2 class="cta-h">Ready to ship faster?</h2>
			<p class="cta-p">Start free in minutes. Upgrade anytime.</p>
			<a href="/signup" class="btn-lime-xl">
				Get started free — no card needed
				<ArrowRight size={20} />
			</a>
		</div>
	</section>
</div>

<style>
	:root {
		--lime: #E8FF48;
		--dark: #080808;
		--light: #ffffff;
		--l-text: #0a0505;
		--l-muted: rgba(10,5,5,0.5);
	}

	.page { min-height: 100vh; background: var(--light); color: var(--l-text); }
	.container { max-width: 1280px; margin: 0 auto; padding: 0 48px; }

	/* Nav (same as home, simplified) */
	.nav {
		position: sticky; top: 0; z-index: 50;
		display: flex; align-items: center; justify-content: space-between;
		padding: 16px 48px;
		background: rgba(255,255,255,0.88);
		backdrop-filter: blur(24px);
		-webkit-backdrop-filter: blur(24px);
		border-bottom: 1px solid rgba(0,0,0,0.07);
	}
	.logo { display: flex; align-items: center; gap: 10px; text-decoration: none; }
	.logo-mark {
		width: 32px; height: 32px; background: var(--dark); color: #fff;
		border-radius: 8px; display: flex; align-items: center; justify-content: center;
		font-family: var(--font-mono); font-size: 11px; font-weight: 700;
	}
	.logo-text { font-family: var(--font-display); font-size: 17px; font-weight: 700; color: var(--l-text); letter-spacing: -0.02em; }
	.logo-text em { font-style: italic; color: #FF6B35; }
	.nav-links { display: flex; gap: 28px; }
	.nav-links a { font-size: 14px; color: var(--l-muted); text-decoration: none; font-weight: 500; }
	.nav-links a:hover { color: var(--l-text); }
	.nav-actions { display: flex; align-items: center; gap: 14px; }
	.nav-signin { font-size: 14px; color: var(--l-muted); text-decoration: none; }
	.nav-signin:hover { color: var(--l-text); }
	.btn-cta-nav {
		display: inline-flex; align-items: center;
		padding: 9px 22px; background: var(--dark); color: #fff;
		border-radius: 999px; font-size: 13px; font-weight: 600;
		text-decoration: none; transition: transform 0.2s;
	}
	.btn-cta-nav:hover { transform: translateY(-1px); }

	.hero { padding: 72px 0 24px; }
	.eyebrow {
		display: inline-block;
		font-family: var(--font-mono);
		font-size: 11px;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: rgba(10,10,10,0.55);
		margin-bottom: 12px;
	}
	.title {
		margin: 0 0 12px;
		font-family: var(--font-display);
		font-size: clamp(36px, 4vw, 56px);
		font-weight: 900;
		letter-spacing: -0.03em;
		line-height: 1.05;
	}
	.sub { margin: 0; font-size: 16px; line-height: 1.6; color: rgba(10,10,10,0.6); max-width: 52ch; }

	.section { padding: 36px 0 88px; }
	.pricing-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; align-items: stretch; }

	.price-card {
		border-radius: 22px;
		background: rgba(10,10,10,0.03);
		border: 1px solid rgba(10,10,10,0.08);
		padding: 26px;
		position: relative;
		display: flex;
		flex-direction: column;
		gap: 14px;
	}
	.price-featured {
		background: var(--lime);
		border-color: rgba(10,10,10,0.18);
		box-shadow: 0 20px 60px rgba(0,0,0,0.16);
		transform: translateY(-6px);
	}
	.price-badge {
		position: absolute; top: 16px; right: 16px;
		font-family: var(--font-mono); font-size: 10px; font-weight: 700;
		text-transform: uppercase; letter-spacing: 0.1em;
		padding: 6px 10px; border-radius: 999px;
		background: rgba(10,10,10,0.12); color: rgba(10,10,10,0.85);
	}
	.price-tier { font-family: var(--font-mono); font-size: 11px; letter-spacing: 0.12em; text-transform: uppercase; color: rgba(10,10,10,0.65); }
	.price-amount { display: flex; align-items: baseline; gap: 8px; }
	.price-num { font-family: var(--font-display); font-size: 44px; font-weight: 900; letter-spacing: -0.03em; }
	.price-per { font-family: var(--font-mono); font-size: 12px; color: rgba(10,10,10,0.45); }
	.price-note { margin: 0; font-size: 14px; color: rgba(10,10,10,0.55); line-height: 1.5; }
	.price-list { list-style: none; padding: 0; margin: 6px 0 10px; display: flex; flex-direction: column; gap: 10px; }
	.price-list li { display: flex; gap: 10px; color: rgba(10,10,10,0.7); font-size: 14px; }
	.price-check { color: rgba(10,10,10,0.65); font-weight: 900; }
	.price-list--dark li { color: rgba(10,10,10,0.78); }

	.btn-outline-glass, .btn-dark-solid {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		border-radius: 999px;
		padding: 10px 16px;
		text-decoration: none;
		font-weight: 700;
		font-size: 13px;
	}
	.btn-outline-glass {
		border: 1px solid rgba(10,10,10,0.14);
		color: rgba(10,10,10,0.85);
		background: rgba(255,255,255,0.55);
	}
	.btn-outline-glass:hover { background: rgba(255,255,255,0.75); }
	.btn-dark-solid { background: #0a0a0a; color: #fff; }
	.btn-dark-solid:hover { background: #222; }

	.cta { padding: 72px 0 96px; background: #0a0a0a; color: rgba(255,255,255,0.92); }
	.cta-inner { display: flex; flex-direction: column; align-items: flex-start; gap: 14px; }
	.cta-h { margin: 0; font-family: var(--font-display); font-size: clamp(28px, 3vw, 42px); letter-spacing: -0.03em; font-weight: 900; }
	.cta-p { margin: 0; color: rgba(255,255,255,0.6); }
	.btn-lime-xl {
		display: inline-flex; align-items: center; gap: 10px;
		padding: 12px 18px; border-radius: 999px;
		background: var(--lime); color: #0a0a0a;
		font-weight: 800; text-decoration: none;
	}

	@media (max-width: 900px) {
		.container { padding: 0 24px; }
		.nav-links { display: none; }
		.pricing-grid { grid-template-columns: 1fr; }
		.price-featured { transform: none; }
	}
</style>

