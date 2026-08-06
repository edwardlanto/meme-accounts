<script lang="ts">
	import { ArrowRight, Check, Layers, Sparkles, Ratio, Briefcase } from 'lucide-svelte';

	let { data } = $props();
	const signedIn = $derived(Boolean(data.user));

	const studioHref = $derived(
		signedIn
			? '/dashboard/studio?template=news'
			: `/?auth=signup&next=${encodeURIComponent('/dashboard/studio?template=news')}`,
	);

	const jsonLd = {
		'@context': 'https://schema.org',
		'@type': 'WebApplication',
		name: 'Carousel Studio — LinkedIn Carousel Maker',
		applicationCategory: 'DesignApplication',
		operatingSystem: 'Web',
		description:
			'Free LinkedIn carousel maker. Build multi-slide document posts from news, templates, and AI — export PNG for LinkedIn carousels and PDFs.',
		offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
	};
</script>

<svelte:head>
	<title>LinkedIn Carousel Maker — Free Multi-Slide Post Generator | Carousel Studio</title>
	<meta
		name="description"
		content="Make LinkedIn carousels fast. Hook → slides → CTA decks, news-to-post, Square & Feed formats, AI backgrounds. Sign in for a free trial export."
	/>
	<meta
		name="keywords"
		content="linkedin carousel maker, linkedin carousel generator, linkedin document post, multi slide linkedin post, carousel studio"
	/>
	<link rel="canonical" href="https://carouselstudio.app/linkedin-carousel-maker" />
	<meta property="og:title" content="LinkedIn Carousel Maker — Carousel Studio" />
	<meta
		property="og:description"
		content="Design multi-slide LinkedIn carousels with news, templates, and AI. Free trial — then unlimited on Pro."
	/>
	<meta property="og:image" content="https://carouselstudio.app/images/seo/carousel-maker-studio.png" />
	<meta property="og:type" content="website" />
	{@html `<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>`}
</svelte:head>

<div class="page">
	<div class="atmosphere" aria-hidden="true"><div class="blob"></div></div>

	<nav class="nav">
		<a href="/" class="logo">
			<img
				src="/logo/meme-accounts-logo.webp"
				alt="Meme Accounts"
				class="logo-img"
				width="180"
				height="28"
			/>
		</a>
		<div class="nav-links">
			<a href="/pricing">Pricing</a>
			<a href="/fake-tweet-maker">Tweet Maker</a>
			<a href="/instagram-carousel-maker">Instagram</a>
			<a href="/instagram-grid-maker">Grid</a>
			<a href="/linkedin-carousel-maker" aria-current="page">LinkedIn</a>
		</div>
		<div class="nav-actions">
			{#if signedIn}
				<a href="/dashboard" class="nav-ghost">Dashboard</a>
			{:else}
				<a href="/?auth=login&next=/linkedin-carousel-maker" class="nav-ghost">Sign in</a>
				<a href={studioHref} class="btn-nav">Start free</a>
			{/if}
		</div>
	</nav>

	<header class="hero container">
		<span class="eyebrow"><Briefcase size={12} /> LinkedIn Carousel Maker</span>
		<h1>
			LinkedIn carousel maker for <span class="accent">document posts</span>
		</h1>
		<p class="lead">
			Build Hook → slides → CTA decks that perform on LinkedIn. Pull news, swap templates, pick
			Square or Feed sizes — then export PNGs for document carousels. Public page; sign in to use
			the studio (1 free trial export).
		</p>
		<div class="cta-row">
			<a href={studioHref} class="cta-primary">
				{signedIn ? 'Open carousel studio' : 'Try free — sign up'}
				<ArrowRight size={18} />
			</a>
			<a href="/pricing" class="cta-ghost">See plans</a>
		</div>
	</header>

	<section class="shot container">
		<figure class="shot-frame">
			<img
				src="/images/seo/carousel-maker-studio.png"
				alt="Carousel Studio editor with News template and multi-slide filmstrip for LinkedIn carousels"
				width="1200"
				height="720"
				loading="eager"
			/>
		</figure>
		<p class="shot-caption">Real product UI — dock tools, News template, aspect formats, slide strip.</p>
	</section>

	<section class="features container">
		<h2>Built for LinkedIn carousels</h2>
		<div class="feat-grid">
			{#each [
				{ icon: Briefcase, title: 'News → thought leadership', body: 'Fetch a story, auto-fill Hook + body slides, pull a matching image for professional posts.' },
				{ icon: Ratio, title: 'Square & Feed sizes', body: 'Export at Square 1:1 or Feed 4:5 — the formats LinkedIn document carousels expect.' },
				{ icon: Layers, title: 'Hook · Slides · CTA', body: 'Filmstrip for every panel — reorder, duplicate, and end with a clear follow or CTA slide.' },
				{ icon: Sparkles, title: 'AI backgrounds', body: 'Generate or swap slide art from the dock without leaving the canvas.' },
			] as f}
				<article class="feat">
					<f.icon size={18} />
					<h3>{f.title}</h3>
					<p>{f.body}</p>
				</article>
			{/each}
		</div>
	</section>

	<section class="strip container">
		<figure class="strip-frame">
			<img
				src="/images/seo/carousel-maker-filmstrip.png"
				alt="Carousel filmstrip showing Hook, Slide 2, Slide 3, Follow, and add slide"
				width="900"
				height="200"
				loading="lazy"
			/>
		</figure>
		<div class="strip-copy">
			<h2>See every slide at once</h2>
			<p>
				The filmstrip keeps Hook, body slides, CTA, and Add aligned — so you always know what
				you’re shipping before you export to LinkedIn.
			</p>
			<ul>
				{#each ['Drag to reorder', 'Brand kit on every slide', 'Schedule to LinkedIn after connect'] as item}
					<li><Check size={14} strokeWidth={2.5} />{item}</li>
				{/each}
			</ul>
		</div>
	</section>

	<section class="faq container">
		<h2>LinkedIn carousel maker FAQ</h2>
		{#each [
			['Is this free?', 'Yes to try — sign in and get one trial export. Pro unlocks unlimited carousels and AI.'],
			['Can I post directly to LinkedIn?', 'Yes. Export PNGs for a document carousel, or schedule after connecting LinkedIn in Settings → Integrations.'],
			['What size works best?', 'Square 1:1 and Feed 4:5 both work well for LinkedIn document posts. Switch formats in Studio without rebuilding the deck.'],
			['How is this different from Canva?', 'Built for news + creator velocity: fetch → deck → export, not a general design suite.'],
		] as [q, a]}
			<details class="faq-item">
				<summary>{q}</summary>
				<p>{a}</p>
			</details>
		{/each}
	</section>

	<section class="cta-band">
		<div class="container cta-inner">
			<h2>Ship your next LinkedIn carousel today</h2>
			<p>Start in News Studio. Upgrade when you need unlimited exports.</p>
			<a href={studioHref} class="cta-lime">
				{signedIn ? 'Open studio' : 'Create free account'}
				<ArrowRight size={18} />
			</a>
		</div>
	</section>

	<footer class="footer container">
		<a href="/privacy">Privacy</a>
		<a href="/terms">Terms</a>
		<a href="/refund-policy">Refunds</a>
		<a href="/instagram-carousel-maker">Instagram Carousel</a>
		<a href="/fake-tweet-maker">Tweet Maker</a>
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
		width: 48vw;
		height: 48vw;
		top: -12%;
		right: -10%;
		border-radius: 50%;
		background: color-mix(in oklch, var(--lime) 48%, white);
		filter: blur(90px);
		opacity: 0.65;
	}
	.container {
		position: relative;
		z-index: 1;
		max-width: 1080px;
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
	.logo-img {
		display: block;
		height: 28px;
		width: auto;
		max-width: min(200px, 52vw);
		object-fit: contain;
	}
	.nav-links {
		display: flex;
		gap: 22px;
	}
	.nav-links a {
		font-size: 14px;
		color: rgba(10, 5, 5, 0.55);
		text-decoration: none;
		font-weight: 600;
	}
	.nav-links a[aria-current='page'],
	.nav-links a:hover {
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
		padding: 56px 0 28px;
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
		max-width: 16ch;
	}
	.accent {
		font-style: italic;
		font-weight: 800;
	}
	.lead {
		margin: 0 0 24px;
		font-size: 17px;
		line-height: 1.55;
		color: rgba(10, 5, 5, 0.62);
		max-width: 54ch;
	}
	.cta-row {
		display: flex;
		flex-wrap: wrap;
		gap: 12px;
		align-items: center;
	}
	.cta-primary,
	.cta-lime {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		padding: 13px 20px;
		border-radius: 999px;
		background: #080808;
		color: #fff;
		font-weight: 800;
		font-size: 14px;
		text-decoration: none;
	}
	.cta-lime {
		background: var(--lime);
		color: #0a0a0a;
	}
	.cta-ghost {
		font-size: 14px;
		font-weight: 700;
		color: rgba(10, 5, 5, 0.55);
		text-decoration: none;
	}

	.shot {
		padding-bottom: 48px;
	}
	.shot-frame {
		margin: 0;
		border-radius: 20px;
		overflow: hidden;
		border: 1px solid rgba(10, 5, 5, 0.1);
		box-shadow: 0 28px 70px rgba(0, 0, 0, 0.14);
		background: #eceae4;
	}
	.shot-frame img {
		display: block;
		width: 100%;
		height: auto;
	}
	.shot-caption {
		margin: 12px 0 0;
		font-size: 13px;
		color: rgba(10, 5, 5, 0.45);
		font-family: var(--font-mono);
	}

	.features {
		padding-bottom: 56px;
	}
	.features h2,
	.strip-copy h2,
	.faq h2 {
		font-family: var(--font-display);
		font-size: clamp(24px, 3vw, 34px);
		letter-spacing: -0.03em;
		margin: 0 0 20px;
	}
	.feat-grid {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 12px;
	}
	.feat {
		padding: 20px;
		border-radius: 18px;
		background: rgba(255, 255, 255, 0.62);
		border: 1px solid rgba(10, 5, 5, 0.08);
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	.feat :global(svg) {
		color: rgba(10, 5, 5, 0.55);
	}
	.feat h3 {
		margin: 0;
		font-size: 16px;
		font-weight: 700;
	}
	.feat p {
		margin: 0;
		font-size: 14px;
		line-height: 1.5;
		color: rgba(10, 5, 5, 0.62);
	}

	.strip {
		display: grid;
		grid-template-columns: 1.2fr 0.8fr;
		gap: 28px;
		align-items: center;
		padding-bottom: 64px;
	}
	.strip-frame {
		margin: 0;
		border-radius: 18px;
		overflow: hidden;
		border: 1px solid rgba(10, 5, 5, 0.08);
		background: #fff;
		padding: 16px;
	}
	.strip-frame img {
		display: block;
		width: 100%;
		height: auto;
	}
	.strip-copy p {
		margin: 0 0 14px;
		font-size: 15px;
		line-height: 1.55;
		color: rgba(10, 5, 5, 0.62);
	}
	.strip-copy ul {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: 10px;
	}
	.strip-copy li {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 14px;
		font-weight: 600;
	}

	.faq {
		padding-bottom: 64px;
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

	.cta-band {
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
	.cta-band h2 {
		margin: 0;
		font-family: var(--font-display);
		font-size: clamp(26px, 3vw, 38px);
		letter-spacing: -0.03em;
	}
	.cta-band p {
		margin: 0;
		color: rgba(255, 255, 255, 0.55);
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

	@media (max-width: 900px) {
		.nav-links {
			display: none;
		}
		.feat-grid,
		.strip {
			grid-template-columns: 1fr;
		}
		h1 {
			max-width: none;
		}
	}
</style>
