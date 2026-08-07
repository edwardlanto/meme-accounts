<script lang="ts">
	import { ArrowRight, Check, Grid3x3, Image, Ratio, Sparkles } from 'lucide-svelte';

	let { data } = $props();
	const signedIn = $derived(Boolean(data.user));

	const studioHref = $derived(
		signedIn
			? '/dashboard/grid'
			: `/?auth=signup&next=${encodeURIComponent('/dashboard/grid')}`,
	);

	const previewTiles = [
		'/templates/news/demo-bg.jpg',
		'/images/templates/topic-bg.jpeg',
		'/templates/image-quote/demo-bg.png',
		'/placeholders/marquee/slide-4.png',
		'/templates/news/demo-bg.jpg',
		'/images/templates/topic-bg.jpeg',
		'/templates/image-quote/demo-bg.png',
		'/placeholders/marquee/slide-4.png',
		'/templates/news/demo-bg.jpg',
	];

	const jsonLd = {
		'@context': 'https://schema.org',
		'@type': 'WebApplication',
		name: 'Carousel Studio — Instagram Grid Maker',
		applicationCategory: 'DesignApplication',
		operatingSystem: 'Web',
		description:
			'Free Instagram grid maker. Plan a cohesive feed, design square and Feed posts, and export a polished profile grid from Carousel Studio.',
		offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
	};
</script>

<svelte:head>
	<title>Instagram Grid Maker — Free Feed Grid Planner &amp; Post Designer | Carousel Studio</title>
	<meta
		name="description"
		content="Make a cohesive Instagram feed grid. Design square and 4:5 posts, align a 3×3 profile look, export PNGs, and schedule. Free trial — then unlimited on Pro."
	/>
	<meta
		name="keywords"
		content="instagram grid maker, instagram feed planner, profile grid maker, 3x3 instagram grid, feed aesthetic maker, carousel studio"
	/>
	<link rel="canonical" href="https://carouselstudio.app/instagram-grid-maker" />
	<meta property="og:title" content="Instagram Grid Maker — Carousel Studio" />
	<meta
		property="og:description"
		content="Plan and design a cohesive Instagram profile grid. Square &amp; Feed sizes, templates, AI backgrounds — free trial."
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
			<a href="/instagram-carousel-maker">Carousel</a>
			<a href="/instagram-grid-maker" aria-current="page">Grid</a>
			<a href="/linkedin-carousel-maker">LinkedIn</a>
		</div>
		<div class="nav-actions">
			{#if signedIn}
				<a href="/dashboard" class="nav-ghost">Dashboard</a>
			{:else}
				<a href="/?auth=login&next=/instagram-grid-maker" class="nav-ghost">Sign in</a>
				<a href={studioHref} class="btn-nav">Start free</a>
			{/if}
		</div>
	</nav>

	<header class="hero container">
		<span class="eyebrow"><Grid3x3 size={12} /> Instagram Grid Maker</span>
		<h1>
			Design a feed that looks <span class="accent">intentional</span>
		</h1>
		<p class="lead">
			Build posts that tile into a clean profile grid — square or Feed 4:5, shared templates and
			palette, then export or schedule. Public page; sign in to open Grid Studio (1 free trial export).
		</p>
		<div class="cta-row">
			<a href={studioHref} class="cta-primary">
				{signedIn ? 'Open grid studio' : 'Try free — sign up'}
				<ArrowRight size={18} />
			</a>
			<a href="/pricing" class="cta-ghost">See plans</a>
		</div>
	</header>

	<section class="shot container">
		<figure class="shot-frame grid-preview" aria-label="Example Instagram profile grid">
			{#each previewTiles as src, i (i)}
				<div class="grid-cell">
					<img src={src} alt="" loading={i < 3 ? 'eager' : 'lazy'} />
				</div>
			{/each}
		</figure>
		<p class="shot-caption">A 3×3 profile grid — plan tiles in Studio, then publish in order.</p>
	</section>

	<section class="features container">
		<h2>Made for profile grids</h2>
		<div class="feat-grid">
			{#each [
				{ icon: Grid3x3, title: 'Think in tiles', body: 'Design each post so the profile read as one composition — not nine random squares.' },
				{ icon: Ratio, title: 'Square & Feed', body: 'Switch 1:1 and 4:5 without rebuilding. Match what Instagram actually crops.' },
				{ icon: Image, title: 'Shared assets', body: 'Reuse brand photos, stickers, and AI backgrounds across every tile in the set.' },
				{ icon: Sparkles, title: 'Templates that ship', body: 'News, quote, blank, and more — same dock tools as Carousel Studio.' },
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
				src="/images/seo/carousel-maker-studio.png"
				alt="Carousel Studio editor used to design Instagram feed posts"
				width="1200"
				height="720"
				loading="lazy"
			/>
		</figure>
		<div class="strip-copy">
			<h2>One studio for the whole grid</h2>
			<p>
				Grid Studio is Carousel Studio focused for feed posts — filmstrip for multi-slide tiles,
				library assets, and export ready for a cohesive profile.
			</p>
			<ul>
				{#each ['Square or Feed aspect in one click', 'Asset library for repeating brand art', 'Export PNG or send to scheduler'] as item}
					<li><Check size={14} strokeWidth={2.5} />{item}</li>
				{/each}
			</ul>
		</div>
	</section>

	<section class="faq container">
		<h2>Instagram grid maker FAQ</h2>
		{#each [
			['Is this free?', 'Yes to try — sign in and get one trial export. Pro unlocks unlimited exports and AI.'],
			['Is this a 3×3 planner?', 'You design posts in Studio sized for Instagram; arrange the live profile grid when you publish in order.'],
			['Carousel vs grid?', 'Carousels are multi-slide posts. Grid maker is for the profile mosaic — both use the same studio.'],
			['Can I schedule posts?', 'Yes. Export or send to the post scheduler after connecting Instagram.'],
		] as [q, a]}
			<details class="faq-item">
				<summary>{q}</summary>
				<p>{a}</p>
			</details>
		{/each}
	</section>

	<section class="cta-band">
		<div class="container cta-inner">
			<h2>Build your next feed grid today</h2>
			<p>Open Grid Studio. Upgrade when you need unlimited exports.</p>
			<a href={studioHref} class="cta-lime">
				{signedIn ? 'Open grid studio' : 'Create free account'}
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
		--lime: #7bf1a8;
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
	.grid-preview {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 4px;
		padding: 4px;
		background: #0a0a0a;
	}
	.grid-cell {
		aspect-ratio: 1;
		overflow: hidden;
		background: #1a1a1a;
	}
	.grid-cell img {
		display: block;
		width: 100%;
		height: 100%;
		object-fit: cover;
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
